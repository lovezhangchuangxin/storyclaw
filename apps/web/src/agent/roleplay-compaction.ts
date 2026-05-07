import {
  getLatestContextSnapshot,
  saveContextSnapshot,
  pruneOldSnapshots,
} from '@/db/context-snapshots'
import { getRoleplayConversationBySessionId } from '@/db/roleplay-conversations'
import type { ModelConfig } from '@/db/types'
import { getEffectiveConversationMessages } from './message-conversion'
import { createLLMClient } from './llm-client'
import { calculateTriggerThreshold, estimatePromptTokens } from './token-estimator'
import { getToolDefinitions } from './tools'
import { uuid } from '@/lib/utils'
import type { ToolContext } from './tools/types'

const CONTEXT_SCOPE_ROLEPLAY = 'roleplay'
const CONTEXT_RAW_TAIL_MESSAGE_LIMIT = 8

export interface RoleplayCompactedMemory {
  worldFacts: string[]
  characterStates: string[]
  plotProgress: string[]
  playerDecisions: string[]
  pendingEvents: string[]
  sessionNotes: string[]
  narrativeSummary: string
}

export async function maybeCompactRoleplayBeforeBuild(
  sessionId: string,
  modelConfig: ModelConfig,
): Promise<boolean> {
  const conversation = await getRoleplayConversationBySessionId(sessionId)
  const snapshot = await getLatestContextSnapshot(sessionId, CONTEXT_SCOPE_ROLEPLAY)
  const messages = getEffectiveConversationMessages(
    conversation?.messages ?? [],
    snapshot?.compactedThroughMessageId ?? null,
  )

  const toolContext: ToolContext = { sessionId, scenario: 'roleplay' }
  const tools = getToolDefinitions(toolContext)
  const tokens = estimatePromptTokens(messages, tools)

  const triggerAt = calculateTriggerThreshold(
    modelConfig.contextWindowTokens,
    modelConfig.outputReserveTokens,
    modelConfig.compactionTriggerRatio,
  )

  if (tokens < triggerAt) return false

  await compactRoleplayContext({
    sessionId,
    modelConfig,
    conversation: conversation ?? { sessionId, messages: [], updatedAt: Date.now() },
  })
  return true
}

interface CompactRoleplayOptions {
  sessionId: string
  modelConfig: ModelConfig
  conversation: { sessionId: string; messages: unknown[]; updatedAt: number }
}

async function compactRoleplayContext(options: CompactRoleplayOptions): Promise<void> {
  const { sessionId, modelConfig, conversation } = options
  const snapshot = await getLatestContextSnapshot(sessionId, CONTEXT_SCOPE_ROLEPLAY)
  const allMessages = getEffectiveConversationMessages(
    conversation.messages as any[],
    snapshot?.compactedThroughMessageId ?? null,
  )

  const tailCount = Math.min(CONTEXT_RAW_TAIL_MESSAGE_LIMIT, allMessages.length)
  const tailMessages = allMessages.slice(-tailCount)
  const sourceMessages = allMessages.slice(0, -tailCount)

  if (sourceMessages.length === 0) return

  const compactedThroughMessageId = sourceMessages[sourceMessages.length - 1].id
  const retainedTailMessageIds = tailMessages.map((m) => m.id)

  // Serialize source messages for LLM summarization
  const serializedSource = sourceMessages
    .map((m) => {
      switch (m.role) {
        case 'user':
          return `[User]: ${m.content}`
        case 'assistant':
          return `[Assistant]: ${JSON.stringify(m.parts?.map((p: any) => (p.type === 'text' ? p.text : `[${p.type}]`)) ?? [])}`
        default:
          return ''
      }
    })
    .filter(Boolean)
    .join('\n')

  const summaryModelConfig = modelConfig.summaryModelId ? { ...modelConfig } : modelConfig

  const memory = await summarizeWithModel(serializedSource, summaryModelConfig)

  const contextSnapshot = {
    id: uuid(),
    novelId: sessionId,
    scopeId: CONTEXT_SCOPE_ROLEPLAY,
    revision: (snapshot?.revision ?? 0) + 1,
    kind: 'auto' as const,
    serializerVersion: 1,
    promptTemplateVersion: 1,
    compactedThroughMessageId,
    retainedTailMessageIds,
    sourceMessageIds: sourceMessages.map((m) => m.id),
    memory: {
      userPreferences: [],
      acceptedDecisions: memory.playerDecisions.map((d) => ({
        text: d,
        turn: 0,
        sourceMessageIds: [],
      })),
      rejectedDirections: [],
      unresolvedQuestions: memory.pendingEvents.map((e) => ({
        text: e,
        turn: 0,
        sourceMessageIds: [],
      })),
      importantRationales: [],
      storyConstraints: memory.worldFacts.map((f) => ({ text: f, turn: 0, sourceMessageIds: [] })),
      narrativeSummary: memory.narrativeSummary,
    },
    estimatedInputTokensBefore: 0,
    estimatedInputTokensAfter: 0,
    createdAt: Date.now(),
  }

  await saveContextSnapshot(contextSnapshot)
  await pruneOldSnapshots(sessionId, CONTEXT_SCOPE_ROLEPLAY)
}

async function summarizeWithModel(
  sourceText: string,
  modelConfig: ModelConfig,
): Promise<RoleplayCompactedMemory> {
  const emptyMemory: RoleplayCompactedMemory = {
    worldFacts: [],
    characterStates: [],
    plotProgress: [],
    playerDecisions: [],
    pendingEvents: [],
    sessionNotes: [],
    narrativeSummary: '',
  }

  try {
    const prompt = `Analyze this roleplay conversation and extract key information. Return a JSON object with these fields:
- worldFacts: string[] — important facts about the game world
- characterStates: string[] — current state/status of characters
- plotProgress: string[] — key plot developments
- playerDecisions: string[] — important choices the player made
- pendingEvents: string[] — unresolved plot threads or upcoming events
- sessionNotes: string[] — any other important notes
- narrativeSummary: string — brief narrative summary (2-3 sentences)

Conversation:
${sourceText.slice(-8000)}

Return ONLY valid JSON.`

    const client = createLLMClient({ config: modelConfig })
    const response = await client.chat([{ role: 'user', content: prompt }], [])

    const content = response.content
    if (!content) return emptyMemory

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return emptyMemory

    const parsed = JSON.parse(jsonMatch[0])
    return {
      worldFacts: Array.isArray(parsed.worldFacts) ? parsed.worldFacts : [],
      characterStates: Array.isArray(parsed.characterStates) ? parsed.characterStates : [],
      plotProgress: Array.isArray(parsed.plotProgress) ? parsed.plotProgress : [],
      playerDecisions: Array.isArray(parsed.playerDecisions) ? parsed.playerDecisions : [],
      pendingEvents: Array.isArray(parsed.pendingEvents) ? parsed.pendingEvents : [],
      sessionNotes: Array.isArray(parsed.sessionNotes) ? parsed.sessionNotes : [],
      narrativeSummary: typeof parsed.narrativeSummary === 'string' ? parsed.narrativeSummary : '',
    }
  } catch {
    return emptyMemory
  }
}
