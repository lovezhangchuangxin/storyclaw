import type OpenAI from 'openai'
import type { ChatCompletionTool } from 'openai/resources/chat/completions'
import { getLatestContextSnapshot } from '@/db/context-snapshots'
import { getConversationByNovelId } from '@/db/conversations'
import { getNovelById } from '@/db/novels'
import { getPromptsByIds } from '@/db/prompts'
import type { Conversation, Message, ModelConfig } from '@/db/types'
import { supportsReasoningContent } from '@/lib/model-capabilities'
import {
  compactConversationContext,
  CONTEXT_SCOPE_MAIN,
  serializeContextSnapshot,
} from './context-compaction'
import {
  getAssistantReasoningParts,
  getAssistantTextParts,
  getAssistantToolUses,
  isMessageIncludedInContext,
} from './message-state'
import { loadStoryState, serializeStoryState } from './story-state'
import { calculateTriggerThreshold, estimatePromptTokens } from './token-estimator'
import { getToolDefinitions } from './tools'
import type { ToolContext } from './tools/types'
import { STORYCLAW_PERSONA } from './persona'

export interface ContextBuildResult {
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  totalTokensUsed: number
  tools: ChatCompletionTool[]
  includeReasoningContent: boolean
}

function buildPersonaPrompt(): string {
  return STORYCLAW_PERSONA
}

function getEffectiveConversationMessages(
  messages: Message[],
  compactedThroughMessageId: string | null,
): Message[] {
  const includedMessages = messages.filter(isMessageIncludedInContext)
  if (!compactedThroughMessageId) {
    return includedMessages
  }

  const boundaryIndex = includedMessages.findIndex(
    (message) => message.id === compactedThroughMessageId,
  )
  if (boundaryIndex === -1) {
    return includedMessages
  }

  return includedMessages.slice(boundaryIndex + 1)
}

function convertToApiMessages(
  messages: Message[],
  includeReasoningContent: boolean,
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const result: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []

  for (const message of messages) {
    if (!isMessageIncludedInContext(message)) continue

    switch (message.role) {
      case 'user':
        result.push({ role: 'user', content: message.content })
        break
      case 'assistant': {
        const includeAssistantContent = message.state === 'completed'
        const textContent = includeAssistantContent ? getAssistantTextParts(message).join('') : ''
        const reasoningContent = includeAssistantContent
          ? getAssistantReasoningParts(message).join('')
          : ''
        const toolUses = getAssistantToolUses(message).filter(
          (toolUse) => toolUse.status !== 'cancelled' && toolUse.result !== null,
        )

        if (!textContent && toolUses.length === 0) {
          break
        }

        const assistantMessage: Record<string, unknown> = {
          role: 'assistant',
          content: textContent || null,
        }

        if (includeAssistantContent && includeReasoningContent && reasoningContent) {
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

        result.push(
          assistantMessage as unknown as OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam,
        )

        for (const toolUse of toolUses) {
          result.push({
            role: 'tool',
            content: toolUse.result!,
            tool_call_id: toolUse.toolCallId,
          })
        }
        break
      }
      case 'status':
        break
    }
  }

  return result
}

export async function maybeCompactBeforeBuild(
  novelId: string,
  modelConfig: ModelConfig,
  conversation?: Conversation,
): Promise<boolean> {
  const conv = conversation ?? (await getConversationByNovelId(novelId))
  const snapshot = await getLatestContextSnapshot(novelId, CONTEXT_SCOPE_MAIN)
  const messages = getEffectiveConversationMessages(
    conv?.messages ?? [],
    snapshot?.compactedThroughMessageId ?? null,
  )
  const novel = await getNovelById(novelId)
  const selectedPromptIds = novel?.selectedPromptIds ?? []
  const selectedPrompts =
    selectedPromptIds.length > 0 ? await getPromptsByIds(selectedPromptIds) : []
  const customPromptContents = selectedPrompts.filter((p) => !p.isBuiltin).map((p) => p.content)

  const tools = getToolDefinitions({ novelId })
  const tokens = estimatePromptTokens(
    [
      buildPersonaPrompt(),
      ...customPromptContents,
      snapshot ? serializeContextSnapshot(snapshot) : '',
      ...messages,
    ],
    tools,
  )

  const triggerAt = calculateTriggerThreshold(
    modelConfig.contextWindowTokens,
    modelConfig.outputReserveTokens,
    modelConfig.compactionTriggerRatio,
  )

  if (tokens < triggerAt) return false

  const storyState = await loadStoryState(novelId)
  await compactConversationContext({
    novelId,
    modelConfig,
    conversation: conv ?? { novelId, messages: [], updatedAt: Date.now() },
    storyState,
    reason: 'auto',
    force: true,
  })
  return true
}

export async function buildContext(
  novelId: string,
  userMessage: string,
  modelConfig: ModelConfig,
  existingConversation?: Conversation,
  options?: { compacted?: boolean },
): Promise<ContextBuildResult> {
  const conversation = existingConversation ?? (await getConversationByNovelId(novelId))
  const toolContext: ToolContext = { novelId }
  const includeReasoningContent = supportsReasoningContent(modelConfig)
  const personaPrompt = buildPersonaPrompt()

  const novel = await getNovelById(novelId)
  const selectedPromptIds = novel?.selectedPromptIds ?? []
  const selectedPrompts =
    selectedPromptIds.length > 0 ? await getPromptsByIds(selectedPromptIds) : []

  const customSystemMessages: OpenAI.Chat.Completions.ChatCompletionSystemMessageParam[] =
    selectedPrompts
      .filter((p) => !p.isBuiltin)
      .map((p) => ({ role: 'system' as const, content: p.content }))

  const tools = getToolDefinitions(toolContext)
  const storyState = await loadStoryState(novelId)
  const snapshot = await getLatestContextSnapshot(novelId, CONTEXT_SCOPE_MAIN)
  const historyMessagesSource = getEffectiveConversationMessages(
    conversation?.messages ?? [],
    snapshot?.compactedThroughMessageId ?? null,
  )
  const historyMessages = convertToApiMessages(historyMessagesSource, includeReasoningContent)

  // Inject story state into the user message when the LLM has no recent context:
  // - First turn (no history): LLM knows nothing about the story yet
  // - Right after compaction: LLM has lost the detailed conversation history
  const compacted = options?.compacted ?? false
  const shouldInjectState = compacted || historyMessagesSource.length === 0
  const statePayload = shouldInjectState
    ? `【当前故事状态】\n${serializeStoryState(storyState)}\n\n---\n${userMessage}`
    : userMessage

  const contextMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: personaPrompt },
    ...customSystemMessages,
  ]

  if (snapshot) {
    contextMessages.push({
      role: 'system',
      content: `Context Snapshot\n${serializeContextSnapshot(snapshot)}`,
    })
  }

  contextMessages.push(...historyMessages)
  contextMessages.push({ role: 'user', content: statePayload })

  const totalTokensUsed = estimatePromptTokens(
    [
      personaPrompt,
      ...customSystemMessages.map((m) => m.content as string),
      snapshot ? serializeContextSnapshot(snapshot) : '',
      ...historyMessagesSource,
      statePayload,
    ],
    tools,
  )

  return {
    messages: contextMessages,
    totalTokensUsed,
    tools,
    includeReasoningContent,
  }
}
