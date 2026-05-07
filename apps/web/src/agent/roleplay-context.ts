import type OpenAI from 'openai'
import type { ChatCompletionTool } from 'openai/resources/chat/completions'
import { getLatestContextSnapshot } from '@/db/context-snapshots'
import { getRoleplayConversationBySessionId } from '@/db/roleplay-conversations'
import { getRoleplaySessionById } from '@/db/roleplay-sessions'
import { getPromptById } from '@/db/prompts'
import type { Message, ModelConfig } from '@/db/types'
import { supportsReasoningContent } from '@/lib/model-capabilities'
import { serializeContextSnapshot } from './context-compaction'
import { convertToApiMessages, getEffectiveConversationMessages } from './message-conversion'
import { estimatePromptTokens } from './token-estimator'
import { getToolDefinitions } from './tools'
import type { ToolContext } from './tools/types'

export interface RoleplayContextBuildResult {
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  totalTokensUsed: number
  tools: ChatCompletionTool[]
  includeReasoningContent: boolean
}

export async function buildRoleplayContext(
  sessionId: string,
  userMessage: string,
  modelConfig: ModelConfig,
  preloadedMessages?: Message[],
): Promise<RoleplayContextBuildResult> {
  const toolContext: ToolContext = { sessionId, scenario: 'roleplay' }
  const includeReasoningContent = supportsReasoningContent(modelConfig)

  const session = await getRoleplaySessionById(sessionId)
  const prompt = session ? await getPromptById(session.promptId) : null
  const personaPrompt = prompt?.content ?? ''

  const tools = getToolDefinitions(toolContext)
  const snapshot = await getLatestContextSnapshot(sessionId, 'roleplay')

  const existingConversation = preloadedMessages
    ? { messages: preloadedMessages }
    : await getRoleplayConversationBySessionId(sessionId)
  const historyMessagesSource = getEffectiveConversationMessages(
    existingConversation?.messages ?? [],
    snapshot?.compactedThroughMessageId ?? null,
  )
  const historyMessages = convertToApiMessages(historyMessagesSource, includeReasoningContent)

  const contextMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []

  if (personaPrompt) {
    contextMessages.push({ role: 'system', content: personaPrompt })
  }

  if (snapshot) {
    contextMessages.push({
      role: 'system',
      content: `Context Snapshot\n${serializeContextSnapshot(snapshot)}`,
    })
  }

  contextMessages.push(...historyMessages)
  contextMessages.push({ role: 'user', content: userMessage })

  const totalTokensUsed = estimatePromptTokens(
    [
      personaPrompt,
      snapshot ? serializeContextSnapshot(snapshot) : '',
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
