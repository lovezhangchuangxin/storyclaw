import type OpenAI from 'openai'
import { getConversationByNovelId } from '@/db/conversations'
import { getToolDefinitions } from './tools'
import type { ToolContext } from './tools/types'
import type { Conversation, Message } from '@/db/types'

import type { ChatCompletionTool } from 'openai/resources/chat/completions'

export interface ContextBuildResult {
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  totalTokensUsed: number
  tools: ChatCompletionTool[]
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

function findSafeSliceStart(messages: Message[], targetStart: number): number {
  if (messages.length === 0) return 0
  const MAX_WALKBACK = 10
  let i = Math.min(targetStart, messages.length - 1)
  let walked = 0
  while (i > 0 && walked < MAX_WALKBACK) {
    const msg = messages[i]
    if (msg.role === 'tool' || msg.role === 'tool_call' || msg.role === 'reasoning') {
      i--
      walked++
      continue
    }
    break
  }
  return i
}

function convertToApiMessages(messages: Message[]): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const result: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []

  let pendingReasoning: string | undefined
  let pendingToolCalls: Array<{ id: string; name: string; args: string }> = []

  function flushToolGroup(): void {
    if (pendingToolCalls.length === 0) return

    const assistantMsg: Record<string, unknown> = {
      role: 'assistant',
      content: null,
    }
    if (pendingReasoning) {
      assistantMsg.reasoning_content = pendingReasoning
      pendingReasoning = undefined
    }
    assistantMsg.tool_calls = pendingToolCalls.map((tc) => ({
      id: tc.id,
      type: 'function' as const,
      function: { name: tc.name, arguments: tc.args },
    }))
    result.push(
      assistantMsg as unknown as OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam,
    )

    for (const tc of pendingToolCalls) {
      const toolMsg = messages.find(
        (m) => m.role === 'tool' && m.toolCallId === tc.id,
      )
      result.push({
        role: 'tool',
        content: toolMsg?.content ?? JSON.stringify({ error: '工具结果缺失' }),
        tool_call_id: tc.id,
      })
    }

    pendingToolCalls = []
  }

  for (const msg of messages) {
    switch (msg.role) {
      case 'system':
        result.push({ role: 'system', content: msg.content })
        break
      case 'user':
        flushToolGroup()
        pendingReasoning = undefined
        result.push({ role: 'user', content: msg.content })
        break
      case 'reasoning':
        pendingReasoning = msg.content
        break
      case 'tool_call':
        pendingToolCalls.push({
          id: msg.toolCallId!,
          name: msg.toolName!,
          args: JSON.stringify(msg.arguments),
        })
        break
      case 'tool':
        break
      case 'assistant':
        flushToolGroup()
        pendingReasoning = undefined
        result.push({ role: 'assistant', content: msg.content || null })
        break
    }
  }

  flushToolGroup()

  return result
}

export async function buildContext(
  novelId: string,
  userMessage: string,
  existingConversation?: Conversation,
): Promise<ContextBuildResult> {
  const conversation = existingConversation ?? (await getConversationByNovelId(novelId))

  const toolContext: ToolContext = { novelId }
  const tools = getToolDefinitions(toolContext)

  const systemMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: buildPersonaPrompt() },
  ]

  const rawMessages = conversation?.messages ?? []

  let historyMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]

  if (conversation?.compactedSummary) {
    const targetStart = Math.max(0, rawMessages.length - 6)
    const safeStart = findSafeSliceStart(rawMessages, targetStart)
    const recentMessages = rawMessages.slice(safeStart)
    historyMessages = [
      {
        role: 'system' as const,
        content: `[对话历史摘要]\n${conversation.compactedSummary.summary}`,
      },
      ...convertToApiMessages(recentMessages),
    ]
  } else {
    historyMessages = convertToApiMessages(rawMessages)
  }

  const totalTokensUsed =
    conversation?.messages?.reduce(
      (sum, m) => sum + (m.promptTokens ?? 0) + (m.completionTokens ?? 0),
      0,
    ) ?? 0

  return {
    messages: [...systemMessages, ...historyMessages, { role: 'user', content: userMessage }],
    totalTokensUsed,
    tools,
  }
}
