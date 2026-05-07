import type OpenAI from 'openai'
import { i18n } from '@/i18n'
import { getConfig } from '@/db/config'
import { getAllModels } from '@/composables/useModels'
import {
  getRoleplayConversationBySessionId,
  saveRoleplayConversation,
} from '@/db/roleplay-conversations'
import type { AssistantMessage, AssistantToolUsePart, Message, ModelConfig } from '@/db/types'
import { buildRoleplayContext } from './roleplay-context'
import { maybeCompactRoleplayBeforeBuild } from './roleplay-compaction'
import { createLLMClient } from './llm-client'
import {
  appendAssistantReasoning,
  appendAssistantText,
  assistantHasRenderableContent,
  cancelPendingToolUses,
  completeAssistantToolUse,
  cloneMessages,
  createAssistantMessage,
  createStatusMessage,
  createUserMessage,
  getAssistantReasoningParts,
  getAssistantTextParts,
  getAssistantToolUses,
  isToolResultError,
  parseToolArguments,
  startAssistantToolUse,
} from './message-state'
import { executeToolCall } from './tools'
import type { ToolContext } from './tools/types'
import { isAbortError } from './utils'
import type { RoleplaySidebarData } from '@/db/roleplay-types'

// ---- Public types ----

export interface RoleplayLoopOptions {
  sessionId: string
  userMessage: string
  modelConfigId?: string
  historyMessages?: Message[]
  onMessagesUpdated?: (messages: Message[]) => void
  onAssistantResponseStart?: () => void
  onToken?: (token: string) => void
  onToolCall?: (
    toolCallId: string,
    name: string,
    rawArguments: string,
    args: Record<string, unknown> | null,
  ) => void
  onToolResult?: (
    toolCallId: string,
    name: string,
    result: string,
    status: AssistantToolUsePart['status'],
  ) => void
  onToolStreamToken?: (toolCallId: string, toolName: string, token: string) => void
  onReasoningToken?: (token: string) => void
  onSidebarUpdate?: (data: RoleplaySidebarData) => void
  onError?: (error: string) => void
  signal?: AbortSignal
}

export interface RoleplayTurnResult {
  messages: Message[]
  status: 'completed' | 'awaiting_choice'
  pendingChoiceToolCallId?: string
  persisted: boolean
  persistenceError?: string
}

export interface ResumeChoiceOptions {
  sessionId: string
  selectedChoiceId: string | null
  selectedChoiceText?: string
  freeTextInput?: string
  choiceToolCallId: string
  assistantMessage: AssistantMessage
  turnMessages: Message[]
  historyMessages: Message[]
  modelConfigId?: string
  onMessagesUpdated?: (messages: Message[]) => void
  onAssistantResponseStart?: () => void
  onToken?: (token: string) => void
  onToolCall?: (
    toolCallId: string,
    name: string,
    rawArguments: string,
    args: Record<string, unknown> | null,
  ) => void
  onToolResult?: (
    toolCallId: string,
    name: string,
    result: string,
    status: AssistantToolUsePart['status'],
  ) => void
  onToolStreamToken?: (toolCallId: string, toolName: string, token: string) => void
  onReasoningToken?: (token: string) => void
  onSidebarUpdate?: (data: RoleplaySidebarData) => void
  onError?: (error: string) => void
  signal?: AbortSignal
}

// ---- Internal types ----

const MAX_TOOL_ITERATIONS = 15

interface LoopCallbacks {
  onMessagesUpdated?: (messages: Message[]) => void
  onAssistantResponseStart?: () => void
  onToken?: (token: string) => void
  onToolCall?: (
    toolCallId: string,
    name: string,
    rawArguments: string,
    args: Record<string, unknown> | null,
  ) => void
  onToolResult?: (
    toolCallId: string,
    name: string,
    result: string,
    status: AssistantToolUsePart['status'],
  ) => void
  onToolStreamToken?: (toolCallId: string, toolName: string, token: string) => void
  onReasoningToken?: (token: string) => void
  onSidebarUpdate?: (data: RoleplaySidebarData) => void
  onError?: (error: string) => void
}

interface InternalLoopParams {
  sessionId: string
  historyMessages: Message[]
  turnMessages: Message[]
  context: Awaited<ReturnType<typeof buildRoleplayContext>>
  toolContext: ToolContext
  modelConfig: ModelConfig
  backendUrl: string | undefined
  callbacks: LoopCallbacks
  signal?: AbortSignal
}

// ---- Helpers ----

function buildAssistantApiMessage(
  message: AssistantMessage,
  includeReasoning: boolean,
): OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam | null {
  const textContent = getAssistantTextParts(message).join('')
  const reasoningContent = getAssistantReasoningParts(message).join('')
  const toolUses = getAssistantToolUses(message).filter((toolUse) => toolUse.status !== 'cancelled')

  if (!textContent && toolUses.length === 0) {
    return null
  }

  const assistantMessage: Record<string, unknown> = {
    role: 'assistant',
    content: textContent || null,
  }

  if (includeReasoning && reasoningContent) {
    assistantMessage.reasoning_content = reasoningContent
  }

  if (toolUses.length > 0) {
    assistantMessage.tool_calls = toolUses.map((toolUse) => ({
      id: toolUse.toolCallId,
      type: 'function' as const,
      function: {
        name: toolUse.toolName,
        arguments: toolUse.rawArguments,
      },
    }))
  }

  return assistantMessage as unknown as OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam
}

function serializeToolExecutionError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return JSON.stringify({ error: message })
}

function finalizeInFlightAssistant(
  turnMessages: Message[],
  assistantMessage: AssistantMessage | null,
  state: AssistantMessage['state'],
): AssistantMessage | null {
  if (!assistantMessage || turnMessages.includes(assistantMessage)) return assistantMessage
  assistantMessage.state = state
  if (state !== 'completed') {
    cancelPendingToolUses(assistantMessage)
  }
  if (assistantHasRenderableContent(assistantMessage)) {
    turnMessages.push(assistantMessage)
  }
  return assistantMessage
}

async function persistRoleplayTurn(
  sessionId: string,
  historyMessages: Message[],
  turnMessages: Message[],
): Promise<{ persisted: boolean; persistenceError?: string }> {
  try {
    await saveRoleplayConversation({
      sessionId,
      messages: [...historyMessages, ...turnMessages],
      updatedAt: Date.now(),
    })
    return { persisted: true }
  } catch (error) {
    return {
      persisted: false,
      persistenceError: error instanceof Error ? error.message : String(error),
    }
  }
}

function handleSidebarUpdate(
  rawArguments: string,
  onSidebarUpdate?: (data: RoleplaySidebarData) => void,
) {
  try {
    const parsed = JSON.parse(rawArguments)
    if (parsed.groups && onSidebarUpdate) {
      onSidebarUpdate({ groups: parsed.groups })
    }
  } catch {
    // Ignore parse errors
  }
}

// ---- Shared tool iteration loop ----

async function runToolIterationLoop(params: InternalLoopParams): Promise<RoleplayTurnResult> {
  const {
    sessionId,
    historyMessages,
    turnMessages,
    context,
    toolContext,
    modelConfig,
    backendUrl,
    callbacks,
    signal,
  } = params
  const {
    onMessagesUpdated,
    onAssistantResponseStart,
    onToken,
    onToolCall,
    onToolResult,
    onToolStreamToken,
    onReasoningToken,
    onSidebarUpdate,
    onError,
  } = callbacks

  const { t } = i18n.global
  const localMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [...context.messages]
  let currentAssistantMessage: AssistantMessage | null = null

  const emitMessagesUpdated = () => {
    const snapshot = [...turnMessages]
    if (
      currentAssistantMessage &&
      !turnMessages.includes(currentAssistantMessage) &&
      assistantHasRenderableContent(currentAssistantMessage)
    ) {
      snapshot.push(currentAssistantMessage)
    }
    onMessagesUpdated?.(cloneMessages(snapshot))
  }

  emitMessagesUpdated()

  const client = createLLMClient({
    config: modelConfig,
    signal,
    backendUrl,
    modelId: modelConfig.backendId,
    onToken(token) {
      if (!currentAssistantMessage) return
      appendAssistantText(currentAssistantMessage, token)
      emitMessagesUpdated()
      onToken?.(token)
    },
    onReasoningToken(token) {
      if (!currentAssistantMessage) return
      appendAssistantReasoning(currentAssistantMessage, token)
      emitMessagesUpdated()
      onReasoningToken?.(token)
    },
    onToolCallStart(toolCallId, toolName, rawArguments) {
      if (!currentAssistantMessage) return
      startAssistantToolUse(currentAssistantMessage, toolCallId, toolName, rawArguments)
      emitMessagesUpdated()
      onToolCall?.(toolCallId, toolName, rawArguments, parseToolArguments(rawArguments))
    },
    onToolStreamToken(toolCallId, toolName, token) {
      if (!currentAssistantMessage) return
      const part = startAssistantToolUse(currentAssistantMessage, toolCallId, toolName)
      part.rawArguments += token
      part.arguments = parseToolArguments(part.rawArguments)
      emitMessagesUpdated()
      onToolStreamToken?.(toolCallId, toolName, token)
    },
  })

  let iterationCount = 0
  let turnCompleted = false

  try {
    while (iterationCount < MAX_TOOL_ITERATIONS) {
      if (signal?.aborted) {
        turnMessages.push(createStatusMessage('cancelled', t('agent.cancelled')))
        emitMessagesUpdated()
        turnCompleted = true
        break
      }

      iterationCount++
      onAssistantResponseStart?.()

      const assistantMessage = createAssistantMessage()
      currentAssistantMessage = assistantMessage
      emitMessagesUpdated()
      const response = await client.chat(localMessages, context.tools)

      assistantMessage.finishReason = response.finishReason
      assistantMessage.promptTokens = response.usage?.promptTokens
      assistantMessage.completionTokens = response.usage?.completionTokens
      assistantMessage.cachedTokens = response.usage?.cachedTokens

      for (const toolCall of response.toolCalls) {
        const part = startAssistantToolUse(
          assistantMessage,
          toolCall.id,
          toolCall.function.name,
          toolCall.function.arguments,
        )
        part.arguments = parseToolArguments(part.rawArguments)
      }

      if (response.aborted) {
        finalizeInFlightAssistant(turnMessages, assistantMessage, 'cancelled')
        turnMessages.push(createStatusMessage('cancelled', t('agent.cancelled')))
        emitMessagesUpdated()
        turnCompleted = true
        currentAssistantMessage = null
        break
      }

      if (response.finishReason !== 'stop' && response.finishReason !== 'tool_calls') {
        finalizeInFlightAssistant(turnMessages, assistantMessage, 'truncated')
        turnMessages.push(
          createStatusMessage(
            'warning',
            t('agent.incomplete', { reason: response.finishReason || 'unknown' }),
          ),
        )
        emitMessagesUpdated()
        turnCompleted = true
        currentAssistantMessage = null
        break
      }

      const apiMsg = buildAssistantApiMessage(assistantMessage, context.includeReasoningContent)
      if (apiMsg) localMessages.push(apiMsg)

      if (response.toolCalls.length > 0) {
        const choiceCalls = response.toolCalls.filter((tc) => tc.function.name === 'render_choice')
        const nonChoiceCalls = response.toolCalls.filter(
          (tc) => tc.function.name !== 'render_choice',
        )

        if (choiceCalls.length > 0 && nonChoiceCalls.length > 0) {
          // Execute non-choice tools first, then reject choice
          for (const toolCall of nonChoiceCalls) {
            if (signal?.aborted) break
            let result: string
            try {
              result = await executeToolCall(
                toolCall.function.name,
                toolCall.function.arguments,
                toolContext,
                signal,
              )
            } catch (error) {
              result = serializeToolExecutionError(error)
            }
            const toolStatus: AssistantToolUsePart['status'] = isToolResultError(result)
              ? 'error'
              : 'completed'
            completeAssistantToolUse(assistantMessage, toolCall.id, result, toolStatus)
            emitMessagesUpdated()
            onToolResult?.(toolCall.id, toolCall.function.name, result, toolStatus)
            localMessages.push({ role: 'tool', content: result, tool_call_id: toolCall.id })

            if (toolCall.function.name === 'update_sidebar' && toolStatus === 'completed') {
              handleSidebarUpdate(toolCall.function.arguments, onSidebarUpdate)
            }
          }

          // Reject the choice call with error
          const choiceError = JSON.stringify({
            error:
              'render_choice must be the only tool call in a turn. Do not combine it with other tools.',
          })
          for (const toolCall of choiceCalls) {
            completeAssistantToolUse(assistantMessage, toolCall.id, choiceError, 'error')
            emitMessagesUpdated()
            onToolResult?.(toolCall.id, toolCall.function.name, choiceError, 'error')
            localMessages.push({ role: 'tool', content: choiceError, tool_call_id: toolCall.id })
          }
        } else if (choiceCalls.length > 0) {
          // render_choice is the only tool — execute and pause
          const choiceCall = choiceCalls[0]
          let result: string
          try {
            result = await executeToolCall(
              choiceCall.function.name,
              choiceCall.function.arguments,
              toolContext,
              signal,
            )
          } catch (error) {
            result = serializeToolExecutionError(error)
          }
          const toolStatus: AssistantToolUsePart['status'] = isToolResultError(result)
            ? 'error'
            : 'completed'
          completeAssistantToolUse(assistantMessage, choiceCall.id, result, toolStatus)
          emitMessagesUpdated()
          onToolResult?.(choiceCall.id, choiceCall.function.name, result, toolStatus)

          finalizeInFlightAssistant(turnMessages, assistantMessage, 'completed')
          emitMessagesUpdated()

          // If the choice tool errored, continue the loop instead of pausing
          if (toolStatus === 'error') {
            localMessages.push({ role: 'tool', content: result, tool_call_id: choiceCall.id })
            currentAssistantMessage = null
            continue
          }

          // Pause — return awaiting_choice
          const persistence = await persistRoleplayTurn(sessionId, historyMessages, turnMessages)
          return {
            messages: turnMessages,
            status: 'awaiting_choice',
            pendingChoiceToolCallId: choiceCall.id,
            ...persistence,
          }
        } else {
          // No render_choice — execute all tools normally
          for (const toolCall of response.toolCalls) {
            if (signal?.aborted) {
              finalizeInFlightAssistant(turnMessages, assistantMessage, 'cancelled')
              break
            }

            let result: string
            try {
              result = await executeToolCall(
                toolCall.function.name,
                toolCall.function.arguments,
                toolContext,
                signal,
              )
            } catch (error) {
              result = serializeToolExecutionError(error)
            }

            const toolStatus: AssistantToolUsePart['status'] = isToolResultError(result)
              ? 'error'
              : 'completed'
            completeAssistantToolUse(assistantMessage, toolCall.id, result, toolStatus)
            emitMessagesUpdated()
            onToolResult?.(toolCall.id, toolCall.function.name, result, toolStatus)
            localMessages.push({ role: 'tool', content: result, tool_call_id: toolCall.id })

            if (toolCall.function.name === 'update_sidebar' && toolStatus === 'completed') {
              handleSidebarUpdate(toolCall.function.arguments, onSidebarUpdate)
            }
          }
        }

        if (assistantMessage.state === 'cancelled') {
          turnMessages.push(createStatusMessage('cancelled', t('agent.cancelled')))
          emitMessagesUpdated()
          turnCompleted = true
          currentAssistantMessage = null
          break
        }

        finalizeInFlightAssistant(turnMessages, assistantMessage, 'completed')
        emitMessagesUpdated()
        currentAssistantMessage = null
        continue
      }

      finalizeInFlightAssistant(turnMessages, assistantMessage, 'completed')
      emitMessagesUpdated()
      turnCompleted = true
      currentAssistantMessage = null
      break
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const state: AssistantMessage['state'] =
      signal?.aborted || isAbortError(error) ? 'cancelled' : 'error'
    finalizeInFlightAssistant(turnMessages, currentAssistantMessage, state)
    currentAssistantMessage = null

    if (state === 'cancelled') {
      turnMessages.push(createStatusMessage('cancelled', t('agent.cancelled')))
    } else {
      onError?.(message)
      turnMessages.push(createStatusMessage('error', message))
    }
    emitMessagesUpdated()
    turnCompleted = true
  }

  if (!turnCompleted && iterationCount >= MAX_TOOL_ITERATIONS) {
    turnMessages.push(createStatusMessage('warning', t('agent.maxIterations')))
    emitMessagesUpdated()
  }

  const persistence = await persistRoleplayTurn(sessionId, historyMessages, turnMessages)
  return {
    messages: turnMessages,
    status: 'completed',
    ...persistence,
  }
}

// ---- Public API ----

export async function runRoleplayLoop(options: RoleplayLoopOptions): Promise<RoleplayTurnResult> {
  const {
    sessionId,
    userMessage,
    modelConfigId,
    historyMessages: providedHistoryMessages,
    signal,
    onError,
  } = options

  const config = await getConfig()
  const allModels = await getAllModels()
  const modelId = modelConfigId ?? config.defaultModelId
  const modelConfig = allModels.find((model) => model.id === modelId) ?? allModels[0]
  const existingConversation = await getRoleplayConversationBySessionId(sessionId)
  const historyMessages = providedHistoryMessages ?? existingConversation?.messages ?? []
  const turnMessages: Message[] = [createUserMessage(userMessage)]

  const { t } = i18n.global
  if (!modelConfig) {
    const errorMessage = modelId ? t('agent.modelNotFound', { modelId }) : t('agent.noModel')
    onError?.(errorMessage)
    turnMessages.push(createStatusMessage('error', errorMessage))
    const persistence = await persistRoleplayTurn(sessionId, historyMessages, turnMessages)
    return { messages: turnMessages, status: 'completed', ...persistence }
  }

  await maybeCompactRoleplayBeforeBuild(sessionId, modelConfig)
  const context = await buildRoleplayContext(sessionId, userMessage, modelConfig)

  return runToolIterationLoop({
    sessionId,
    historyMessages,
    turnMessages,
    context,
    toolContext: { sessionId, scenario: 'roleplay' },
    modelConfig,
    backendUrl: config.backendUrl,
    callbacks: {
      onMessagesUpdated: options.onMessagesUpdated,
      onAssistantResponseStart: options.onAssistantResponseStart,
      onToken: options.onToken,
      onToolCall: options.onToolCall,
      onToolResult: options.onToolResult,
      onToolStreamToken: options.onToolStreamToken,
      onReasoningToken: options.onReasoningToken,
      onSidebarUpdate: options.onSidebarUpdate,
      onError: options.onError,
    },
    signal,
  })
}

export async function resumeFromChoice(options: ResumeChoiceOptions): Promise<RoleplayTurnResult> {
  const {
    sessionId,
    selectedChoiceId,
    selectedChoiceText,
    freeTextInput,
    choiceToolCallId,
    assistantMessage,
    turnMessages,
    historyMessages,
    modelConfigId,
    signal,
    onError,
  } = options

  // Build tool result for the choice
  let choiceResult: string
  if (selectedChoiceId) {
    choiceResult = JSON.stringify({ selectedChoiceId, selectedChoiceText })
    turnMessages.push(createUserMessage(selectedChoiceText ?? selectedChoiceId))
  } else {
    choiceResult = JSON.stringify({ selectedChoiceId: null, freeTextInput })
    turnMessages.push(createUserMessage(freeTextInput ?? ''))
  }

  // Complete the tool use part with the choice result
  completeAssistantToolUse(assistantMessage, choiceToolCallId, choiceResult, 'completed')

  const { t } = i18n.global
  const config = await getConfig()
  const allModels = await getAllModels()
  const modelId = modelConfigId ?? config.defaultModelId
  const modelConfig = allModels.find((model) => model.id === modelId) ?? allModels[0]

  if (!modelConfig) {
    const errorMessage = t('agent.noModel')
    onError?.(errorMessage)
    const persistence = await persistRoleplayTurn(sessionId, historyMessages, turnMessages)
    return { messages: turnMessages, status: 'completed', ...persistence }
  }

  const userMsg = selectedChoiceId
    ? (selectedChoiceText ?? selectedChoiceId)
    : (freeTextInput ?? '')
  const context = await buildRoleplayContext(sessionId, userMsg, modelConfig)

  return runToolIterationLoop({
    sessionId,
    historyMessages,
    turnMessages,
    context,
    toolContext: { sessionId, scenario: 'roleplay' },
    modelConfig,
    backendUrl: config.backendUrl,
    callbacks: {
      onMessagesUpdated: options.onMessagesUpdated,
      onAssistantResponseStart: options.onAssistantResponseStart,
      onToken: options.onToken,
      onToolCall: options.onToolCall,
      onToolResult: options.onToolResult,
      onToolStreamToken: options.onToolStreamToken,
      onReasoningToken: options.onReasoningToken,
      onSidebarUpdate: options.onSidebarUpdate,
      onError: options.onError,
    },
    signal,
  })
}
