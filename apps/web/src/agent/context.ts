import type OpenAI from 'openai'
import type { ChatCompletionTool } from 'openai/resources/chat/completions'
import { getLatestContextSnapshot } from '@/db/context-snapshots'
import { getConversationByNovelId } from '@/db/conversations'
import type { Conversation, Message, ModelConfig } from '@/db/types'
import { supportsReasoningContent } from '@/lib/model-capabilities'
import { compactConversationContext, CONTEXT_SCOPE_MAIN, serializeContextSnapshot } from './context-compaction'
import { getAssistantReasoningParts, getAssistantTextParts, getAssistantToolUses, isMessageIncludedInContext } from './message-state'
import { loadStoryState, serializeStoryState } from './story-state'
import { calculateTriggerThreshold, estimatePromptTokens } from './token-estimator'
import { getToolDefinitions } from './tools'
import type { ToolContext } from './tools/types'

export interface ContextBuildResult {
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  totalTokensUsed: number
  tools: ChatCompletionTool[]
  includeReasoningContent: boolean
}

function buildPersonaPrompt(): string {
  return `你是一位专业的小说创作助手，名为 StoryClaw。

你的职责：
1. 根据用户需求设计故事大纲、角色和世界观
2. 按照大纲创作中短篇小说（50000字以下）
3. 根据用户反馈调整内容
4. 保持文风一致，角色行为符合设定

工作流程：
- 收到用户请求后，先调用 get_outline, list_characters, get_story_status, get_world_building, get_style 等工具了解当前故事状态
- 不要假设故事状态，必须通过工具读取最新数据
- 根据读取到的实际状态，再决定如何行动

创作原则：
- 专注于中短篇小说，控制节奏和篇幅
- 所有故事内容通过工具调用来完成，不要直接输出长篇故事文本到对话中
- 创作章节时，先通过 write_chapter 工具提交内容
- 主动使用工具，不要让用户催促`
}

function getEffectiveConversationMessages(
  messages: Message[],
  compactedThroughMessageId: string | null,
): Message[] {
  const includedMessages = messages.filter(isMessageIncludedInContext)
  if (!compactedThroughMessageId) {
    return includedMessages
  }

  const boundaryIndex = includedMessages.findIndex((message) => message.id === compactedThroughMessageId)
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

        if (!includeAssistantContent && toolUses.length === 0) {
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
): Promise<void> {
  const conv = conversation ?? (await getConversationByNovelId(novelId))
  const snapshot = await getLatestContextSnapshot(novelId, CONTEXT_SCOPE_MAIN)
  const messages = getEffectiveConversationMessages(
    conv?.messages ?? [],
    snapshot?.compactedThroughMessageId ?? null,
  )
  const storyState = await loadStoryState(novelId)
  const tools = getToolDefinitions({ novelId })
  const tokens = estimatePromptTokens(
    [
      buildPersonaPrompt(),
      snapshot ? serializeContextSnapshot(snapshot) : '',
      serializeStoryState(storyState),
      ...messages,
    ],
    tools,
  )

  const triggerAt = calculateTriggerThreshold(
    modelConfig.contextWindowTokens,
    modelConfig.outputReserveTokens,
    modelConfig.compactionTriggerRatio,
  )

  if (tokens < triggerAt) return

  await compactConversationContext({
    novelId,
    modelConfig,
    conversation: conv ?? { novelId, messages: [], updatedAt: Date.now() },
    storyState,
    reason: 'auto',
    force: true,
  })
}

export async function buildContext(
  novelId: string,
  userMessage: string,
  modelConfig: ModelConfig,
  existingConversation?: Conversation,
): Promise<ContextBuildResult> {
  const conversation = existingConversation ?? (await getConversationByNovelId(novelId))
  const toolContext: ToolContext = { novelId }
  const includeReasoningContent = supportsReasoningContent(modelConfig)
  const personaPrompt = buildPersonaPrompt()

  const tools = getToolDefinitions(toolContext)
  const storyState = await loadStoryState(novelId)
  const snapshot = await getLatestContextSnapshot(novelId, CONTEXT_SCOPE_MAIN)
  const historyMessagesSource = getEffectiveConversationMessages(
    conversation?.messages ?? [],
    snapshot?.compactedThroughMessageId ?? null,
  )
  const historyMessages = convertToApiMessages(historyMessagesSource, includeReasoningContent)
  const contextMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: personaPrompt },
  ]

  if (snapshot) {
    contextMessages.push({
      role: 'system',
      content: `Context Snapshot\n${serializeContextSnapshot(snapshot)}`,
    })
  }

  contextMessages.push({
    role: 'system',
    content: `Story State\n${serializeStoryState(storyState)}`,
  })
  contextMessages.push(...historyMessages)
  contextMessages.push({ role: 'user', content: userMessage })

  const totalTokensUsed = estimatePromptTokens(
    [
      personaPrompt,
      snapshot ? serializeContextSnapshot(snapshot) : '',
      serializeStoryState(storyState),
      ...historyMessagesSource,
      userMessage,
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
