import type OpenAI from 'openai'
import { getNovelById } from '@/db/novels'
import { getOutlineByNovelId } from '@/db/outlines'
import { getCharactersByNovelId } from '@/db/characters'
import { getConversationByNovelId } from '@/db/conversations'
import { getToolDefinitions } from './tools'
import type { ToolContext } from './tools/types'
import type { Message } from '@/db/types'

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

创作原则：
- 专注于中短篇小说，控制节奏和篇幅
- 所有故事内容通过工具调用来完成，不要直接输出长篇故事文本到对话中
- 创作章节时，先通过 write_chapter 工具提交内容
- 主动使用工具，不要让用户催促`
}

function buildStoryStateBlock(outline: unknown, characters: unknown[]): string {
  let block = '[STORY STATE]\n'

  if (outline) {
    const o = outline as {
      premise: string
      chapterPlan: Array<{ index: number; title: string; status: string; summary: string }>
    }
    block += `\n大纲: ${o.premise}\n`
    if (o.chapterPlan?.length) {
      const completed = o.chapterPlan.filter((c) => c.status === 'completed').length
      block += `章节规划: ${completed}/${o.chapterPlan.length} 章完成\n`
      block += `最近章节: ${o.chapterPlan
        .slice(-3)
        .map((c) => `Ch ${c.index} "${c.title}": ${c.summary.slice(0, 50)}`)
        .join(' | ')}\n`
    }
  }

  if (characters?.length) {
    const top5 = characters.slice(0, 5)
    block += `\n角色 (${characters.length}个):\n`
    for (const c of top5) {
      const ch = c as { name: string; role: string; personality: string }
      block += `- ${ch.name}(${ch.role}): ${ch.personality.slice(0, 80)}\n`
    }
  }

  return block
}

function findSafeSliceStart(messages: Message[], targetStart: number): number {
  if (messages.length === 0) return 0
  const MAX_WALKBACK = 10
  let i = Math.min(targetStart, messages.length - 1)
  let walked = 0
  while (i > 0 && walked < MAX_WALKBACK) {
    const msg = messages[i]
    if (msg.role === 'tool') {
      i--
      walked++
      continue
    }
    if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
      i--
      walked++
      continue
    }
    break
  }
  return i
}

export async function buildContext(
  novelId: string,
  userMessage: string,
): Promise<ContextBuildResult> {
  const novel = await getNovelById(novelId)
  const outline = await getOutlineByNovelId(novelId)
  const characters = await getCharactersByNovelId(novelId)
  const conversation = await getConversationByNovelId(novelId)

  const toolContext: ToolContext = { novelId }
  const tools = getToolDefinitions(toolContext)

  const systemMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: buildPersonaPrompt() },
    { role: 'system', content: buildStoryStateBlock(outline, characters) },
  ]

  if (novel) {
    systemMessages.push({
      role: 'system',
      content: `文风设定: 叙事视角=${novel.styleSettings.narrativePerspective || '未指定'}，时态=${novel.styleSettings.tense || '未指定'}，语言风格=${novel.styleSettings.languageStyle || '未指定'}`,
    })
  }

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
      ...(recentMessages as OpenAI.Chat.Completions.ChatCompletionMessageParam[]),
    ]
  } else {
    historyMessages =
      rawMessages as OpenAI.Chat.Completions.ChatCompletionMessageParam[]
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
