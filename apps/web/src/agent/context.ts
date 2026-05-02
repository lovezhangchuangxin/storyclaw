import type OpenAI from 'openai'
import type { ChatCompletionTool } from 'openai/resources/chat/completions'
import { getConversationByNovelId } from '@/db/conversations'
import type { Conversation, Message, ModelConfig } from '@/db/types'
import { supportsReasoningContent } from '@/lib/model-capabilities'
import {
  getAssistantReasoningParts,
  getAssistantTextParts,
  getAssistantToolUses,
  isMessageIncludedInContext,
} from './message-state'
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

export async function buildContext(
  novelId: string,
  userMessage: string,
  modelConfig: ModelConfig,
  existingConversation?: Conversation,
): Promise<ContextBuildResult> {
  const conversation = existingConversation ?? (await getConversationByNovelId(novelId))
  const toolContext: ToolContext = { novelId }
  const includeReasoningContent = supportsReasoningContent(modelConfig)

  const tools = getToolDefinitions(toolContext)
  const historyMessages = convertToApiMessages(conversation?.messages ?? [], includeReasoningContent)
  const totalTokensUsed =
    conversation?.messages.reduce(
      (sum, message) => sum + (message.promptTokens ?? 0) + (message.completionTokens ?? 0),
      0,
    ) ?? 0

  return {
    messages: [
      { role: 'system', content: buildPersonaPrompt() },
      ...historyMessages,
      { role: 'user', content: userMessage },
    ],
    totalTokensUsed,
    tools,
    includeReasoningContent,
  }
}
