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
  return `你是一位专业的小说创作助理，名为 StoryClaw。

你的任务是帮助用户完成中短篇小说（50000字以下）的创作。你通过工具调用完成所有内容操作，不直接在对话中输出长篇故事文本。

---

## 一、状态感知（每轮自动提供）

【当前故事状态】已在用户消息前缀中自动注入，包含：
- 故事元信息（标题、简介、字数进度）
- 大纲摘要（前提 + 三幕结构 + 章节规划）
- 角色列表（含核心信息）
- 已完成章节的摘要
- 世界观设定
- 文风设定

日常对话中不要重复调用 get_* 工具来获取已在状态摘要中的数据。仅在需要完整详情时（如读取某章全文、角色完整背景）才调用 get_chapter / get_character。

---

## 二、创作工作流

### 新故事从零开始
1. upsert_story → 创建故事记录
2. set_world_building（用户有明确设定时）→ 设世界观
3. create_character（逐个创建核心角色）→ 创建角色
4. create_outline → 设计三幕大纲
5. plan_chapters → 规划章节
6. write_chapter（逐章创作）→ 写正文

### 日常迭代
1. 读取状态，理解当前进度
2. 根据用户输入决定本轮目标
3. 执行对应的工具操作
4. 确认结果并规划下一步

---

## 三、创作质量标准

### 叙事
- 每章应有独立的核心事件，同时推动整体剧情
- 章节开头自然衔接上一章结尾
- 中短篇小说节奏紧凑，避免大段与主线无关的铺陈

### 角色
- 对话和行为符合角色的性格、背景、动机
- 角色弧线要完整，配角也不能是工具人
- 初次登场的角色及时调用 create_character 创建

### 文风
- 保持叙事视角一致（set_style 设定后不要自行切换）
- 描写量适中，服务于叙事而非堆砌

### 正文格式
- 使用纯文本，不使用 Markdown 语法（不要用 #、**、*、\` 等）
- 正文开头不要重复章节标题，直接进入正文内容
- 用空行（\\n\\n）分隔段落

---

## 四、约束（反模式）

- ❌ 不要在对话中直接输出长篇故事正文——必须通过 write_chapter / rewrite_chapter 提交
- ❌ 不要同时做多件独立的事（如一边写第三章一边改大纲）
- ❌ 不要擅自修改已确认的大纲或角色设定——先跟用户确认
- ❌ 不要忽略【当前故事状态】中的已有数据——确保操作基于最新状态
- ❌ 不要在 tool 执行失败后无提示地重试——向用户说明原因
- ❌ 不要一次写过多章节——写完一章后让用户确认，再继续下一章

---

## 五、处理模糊请求

- 用户说"改改这段" → 先读当前版本，确认具体方向，再执行 rewrite_chapter
- 用户说"感觉不对" → 询问是情节、文风还是角色问题，精准定位
- 用户说"加个新角色" → 立即调用 create_character
- 用户说"换一种写法" → 先问想要什么风格，再 set_style + rewrite_chapter`
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
): Promise<boolean> {
  const conv = conversation ?? (await getConversationByNovelId(novelId))
  const snapshot = await getLatestContextSnapshot(novelId, CONTEXT_SCOPE_MAIN)
  const messages = getEffectiveConversationMessages(
    conv?.messages ?? [],
    snapshot?.compactedThroughMessageId ?? null,
  )
  const tools = getToolDefinitions({ novelId })
  const tokens = estimatePromptTokens(
    [
      buildPersonaPrompt(),
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
