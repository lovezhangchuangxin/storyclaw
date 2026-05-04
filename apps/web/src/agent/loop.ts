import type OpenAI from 'openai'
import { getConfig } from '@/db/config'
import { getConversationByNovelId, saveConversation } from '@/db/conversations'
import type { AssistantMessage, AssistantToolUsePart, Message } from '@/db/types'
import { buildContext, maybeCompactBeforeBuild } from './context'
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

export interface AgentLoopOptions {
  novelId: string
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
  onError?: (error: string) => void
  signal?: AbortSignal
}

export interface AgentTurnResult {
  messages: Message[]
  persisted: boolean
  persistenceError?: string
}

const MAX_TOOL_ITERATIONS = 15

function buildAssistantApiMessage(
  message: AssistantMessage,
  includeReasoning: boolean,
): OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam | null {
  const textContent = getAssistantTextParts(message).join('')
  const reasoningContent = getAssistantReasoningParts(message).join('')
  const toolUses = getAssistantToolUses(message).filter(
    (toolUse) => toolUse.status !== 'cancelled',
  )

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

function buildTurnMessages(historyMessages: Message[], turnMessages: Message[]): Message[] {
  return [...historyMessages, ...turnMessages]
}

function serializeToolExecutionError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return JSON.stringify({ error: message })
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException && error.name === 'AbortError'
  ) || (
    error instanceof Error && error.name === 'AbortError'
  )
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

async function persistTurn(
  novelId: string,
  historyMessages: Message[],
  turnMessages: Message[],
): Promise<{ persisted: boolean; persistenceError?: string }> {
  try {
    await saveConversation({
      novelId,
      messages: buildTurnMessages(historyMessages, turnMessages),
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

export async function runAgentLoop(options: AgentLoopOptions): Promise<AgentTurnResult> {
  const {
    novelId,
    userMessage,
    modelConfigId,
    historyMessages: providedHistoryMessages,
    onMessagesUpdated,
    onAssistantResponseStart,
    onToken,
    onToolCall,
    onToolResult,
    onToolStreamToken,
    onReasoningToken,
    onError,
    signal,
  } = options

  const config = await getConfig()
  const modelId = modelConfigId ?? config.defaultModelId
  const modelConfig = config.models.find((model) => model.id === modelId) ?? config.models[0]
  const existingConversation = await getConversationByNovelId(novelId)
  const historyMessages = providedHistoryMessages ?? existingConversation?.messages ?? []
  const turnMessages: Message[] = [createUserMessage(userMessage)]

  if (!modelConfig) {
    const errorMessage = '没有配置模型。请在模型配置中配置至少一个模型。'
    onError?.(errorMessage)
    turnMessages.push(createStatusMessage('error', errorMessage))
    const persistence = await persistTurn(novelId, historyMessages, turnMessages)
    return { messages: turnMessages, ...persistence }
  }

  const compacted = await maybeCompactBeforeBuild(novelId, modelConfig, {
    novelId,
    messages: historyMessages,
    updatedAt: existingConversation?.updatedAt ?? Date.now(),
  })

  const context = await buildContext(
    novelId,
    userMessage,
    modelConfig,
    {
      novelId,
      messages: historyMessages,
      updatedAt: existingConversation?.updatedAt ?? Date.now(),
    },
    { compacted },
  )
  const localMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [...context.messages]
  const toolContext: ToolContext = { novelId }
  let currentAssistantMessage: AssistantMessage | null = null

  const emitMessagesUpdated = () => {
    const snapshot = [...turnMessages]
    if (
      currentAssistantMessage
      && !turnMessages.includes(currentAssistantMessage)
      && assistantHasRenderableContent(currentAssistantMessage)
    ) {
      snapshot.push(currentAssistantMessage)
    }
    onMessagesUpdated?.(cloneMessages(snapshot))
  }

  emitMessagesUpdated()

  const client = createLLMClient({
    config: modelConfig,
    signal,
    useBackendProxy: config.useBackendProxy,
    backendUrl: config.backendUrl,
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
        turnMessages.push(createStatusMessage('cancelled', '已取消生成'))
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
        turnMessages.push(createStatusMessage('cancelled', '已取消生成'))
        emitMessagesUpdated()
        turnCompleted = true
        currentAssistantMessage = null
        break
      }

      if (response.finishReason !== 'stop' && response.finishReason !== 'tool_calls') {
        finalizeInFlightAssistant(turnMessages, assistantMessage, 'truncated')
        turnMessages.push(
          createStatusMessage('warning', `回复未完整结束（${response.finishReason || 'unknown'}）`),
        )
        emitMessagesUpdated()
        turnCompleted = true
        currentAssistantMessage = null
        break
      }

      const apiMsg = buildAssistantApiMessage(assistantMessage, context.includeReasoningContent)
      if (apiMsg) localMessages.push(apiMsg)

      if (response.toolCalls.length > 0) {
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

          localMessages.push({
            role: 'tool',
            content: result,
            tool_call_id: toolCall.id,
          })
        }

        if (assistantMessage.state === 'cancelled') {
          turnMessages.push(createStatusMessage('cancelled', '已取消生成'))
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
    const state: AssistantMessage['state'] = signal?.aborted || isAbortError(error)
      ? 'cancelled'
      : 'error'
    finalizeInFlightAssistant(turnMessages, currentAssistantMessage, state)
    currentAssistantMessage = null

    if (state === 'cancelled') {
      turnMessages.push(createStatusMessage('cancelled', '已取消生成'))
    } else {
      onError?.(message)
      turnMessages.push(createStatusMessage('error', message))
    }
    emitMessagesUpdated()
    turnCompleted = true
  }

  if (!turnCompleted && iterationCount >= MAX_TOOL_ITERATIONS) {
    turnMessages.push(createStatusMessage('warning', '已达到最大工具调用次数，已自动停止'))
    emitMessagesUpdated()
  }

  const persistence = await persistTurn(novelId, historyMessages, turnMessages)
  return {
    messages: turnMessages,
    ...persistence,
  }
}
