import OpenAI from 'openai'
import { z } from 'zod'
import { getConfig } from '@/db/config'
import type {
  AssistantMessage,
  Conversation,
  ContextSnapshot,
  MemoryEntry,
  Message,
  ModelConfig,
} from '@/db/types'
import {
  getLatestContextSnapshot,
  getNextContextSnapshotRevision,
  pruneOldSnapshots,
  saveContextSnapshot,
} from '@/db/context-snapshots'
import {
  getAssistantReasoningParts,
  getAssistantTextParts,
  getAssistantToolUses,
  isMessageIncludedInContext,
} from './message-state'
import type { StoryStateSnapshot } from './story-state'
import { serializeStoryState } from './story-state'
import {
  calculateTriggerThreshold,
  estimateJsonTokens,
  estimatePromptTokens,
  estimateTextTokens,
  estimateWindowBudget,
} from './token-estimator'

export const CONTEXT_SCOPE_MAIN = 'main'
export const CONTEXT_SERIALIZER_VERSION = 1
export const CONTEXT_PROMPT_TEMPLATE_VERSION = 1
export const CONTEXT_RAW_TAIL_MESSAGE_LIMIT = 8
export const CONTEXT_MANUAL_PROMPT_LIMIT = 1024

const compactionLocks = new Map<string, Promise<void>>()

async function withCompactionLock<T>(novelId: string, fn: () => Promise<T>): Promise<T> {
  const previous = compactionLocks.get(novelId) ?? Promise.resolve()
  let resolve!: () => void
  const next = new Promise<void>((r) => {
    resolve = r
  })
  compactionLocks.set(novelId, next)
  try {
    await previous
    return await fn()
  } finally {
    resolve()
    if (compactionLocks.get(novelId) === next) {
      compactionLocks.delete(novelId)
    }
  }
}

const memoryEntrySchema = z.object({
  text: z.string().min(1),
  sourceMessageIds: z.array(z.string().min(1)).min(1),
})

const compactedMemorySchema = z.object({
  userPreferences: z.array(memoryEntrySchema),
  acceptedDecisions: z.array(memoryEntrySchema),
  rejectedDirections: z.array(memoryEntrySchema),
  unresolvedQuestions: z.array(memoryEntrySchema),
  importantRationales: z.array(memoryEntrySchema),
  storyConstraints: z.array(memoryEntrySchema),
  narrativeSummary: z.string().optional(),
})

const compactionResponseSchema = z.object({
  memory: compactedMemorySchema,
  narrativeSummary: z.string().optional(),
})

export interface SerializableCompactionTranscriptEntry {
  id: string
  role: 'user' | 'assistant'
  content: string
  reasoning?: string
  toolUses?: Array<{
    toolCallId: string
    toolName: string
    rawArguments: string
    arguments: Record<string, unknown> | null
    result: string | null
    status: string
  }>
  state?: string
  finishReason?: string
}

export interface CompactConversationContextOptions {
  novelId: string
  modelConfig: ModelConfig
  conversation: Conversation
  storyState: StoryStateSnapshot
  reason: 'auto' | 'manual'
  manualInstructions?: string
  force?: boolean
}

export interface CompactConversationContextResult {
  snapshot?: ContextSnapshot
  compacted: boolean
  estimatedInputTokensBefore: number
  estimatedInputTokensAfter: number
}

function trimText(text: string, maxLength: number): string {
  const normalized = text.trim()
  if (!normalized) return ''
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength).trimEnd()}…`
}

function splitIntoSentences(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .split(/(?<=[。！？!?])\s+|[\n]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function firstSentence(text: string): string {
  return splitIntoSentences(text)[0] ?? trimText(text, 180)
}

function serializeConversationMessages(
  messages: Message[],
): SerializableCompactionTranscriptEntry[] {
  return messages.filter(isMessageIncludedInContext).map((message) => {
    if (message.role === 'user') {
      return {
        id: message.id,
        role: 'user' as const,
        content: trimText(message.content, 2000),
      }
    }

    const assistant = message as AssistantMessage
    return {
      id: message.id,
      role: 'assistant' as const,
      content: trimText(getAssistantTextParts(assistant).join(''), 4000),
      reasoning: trimText(getAssistantReasoningParts(assistant).join(''), 4000) || undefined,
      toolUses: getAssistantToolUses(assistant).map((toolUse) => ({
        toolCallId: toolUse.toolCallId,
        toolName: toolUse.toolName,
        rawArguments: trimText(toolUse.rawArguments, 4000),
        arguments: toolUse.arguments ? JSON.parse(JSON.stringify(toolUse.arguments)) : null,
        result: toolUse.result ? trimText(toolUse.result, 4000) : null,
        status: toolUse.status,
      })),
      state: assistant.state,
      finishReason: assistant.finishReason,
    }
  })
}

function extractEntriesByKeywords(
  messages: SerializableCompactionTranscriptEntry[],
  keywords: RegExp,
  limit = 12,
): MemoryEntry[] {
  const entries: MemoryEntry[] = []

  for (const message of messages) {
    const candidateTexts = [
      message.content,
      message.reasoning ?? '',
      ...(message.toolUses?.flatMap((toolUse) => [toolUse.rawArguments, toolUse.result ?? '']) ??
        []),
    ]

    for (const candidate of candidateTexts) {
      if (!candidate || !keywords.test(candidate)) continue
      const sentence = firstSentence(candidate)
      if (!sentence) continue
      entries.push({
        text: sentence,
        sourceMessageIds: [message.id],
      })
      if (entries.length >= limit) return entries
      break
    }
  }

  return entries
}

function normalizeMemoryEntries(entries: MemoryEntry[]): MemoryEntry[] {
  const seen = new Map<string, MemoryEntry>()
  for (const entry of entries) {
    const text = trimText(entry.text, 500)
    if (!text) continue
    const key = text.toLowerCase()
    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, {
        text,
        sourceMessageIds: [...new Set(entry.sourceMessageIds.filter(Boolean))],
      })
      continue
    }
    existing.sourceMessageIds = [
      ...new Set([...existing.sourceMessageIds, ...entry.sourceMessageIds.filter(Boolean)]),
    ]
  }
  return [...seen.values()]
}

function estimateTranscriptEntryTokens(entry: SerializableCompactionTranscriptEntry): number {
  let total = estimateTextTokens(entry.content)
  total += estimateTextTokens(entry.reasoning ?? '')
  for (const toolUse of entry.toolUses ?? []) {
    total += estimateTextTokens(toolUse.toolName)
    total += estimateTextTokens(toolUse.rawArguments)
    total += estimateTextTokens(toolUse.result ?? '')
    if (toolUse.arguments) {
      total += estimateJsonTokens(toolUse.arguments)
    }
  }
  return total
}

function buildHeuristicMemory(
  messages: SerializableCompactionTranscriptEntry[],
  manualInstructions?: string,
) {
  const userPreferences = normalizeMemoryEntries([
    ...extractEntriesByKeywords(messages, /(喜欢|偏好|希望|更适合|尽量|保持|使用|采用)/),
  ])
  const acceptedDecisions = normalizeMemoryEntries([
    ...extractEntriesByKeywords(messages, /(确定|就这样|按.*来|已经决定|同意|采纳|继续|保留)/),
  ])
  const rejectedDirections = normalizeMemoryEntries([
    ...extractEntriesByKeywords(messages, /(不要|别|拒绝|不需要|取消|不要再|不要用)/),
  ])
  const unresolvedQuestions = normalizeMemoryEntries([
    ...extractEntriesByKeywords(messages, /(\?|待确认|还没|未定|需要确认|要不要)/),
  ])
  const importantRationales = normalizeMemoryEntries([
    ...extractEntriesByKeywords(messages, /(因为|所以|因此|如果|为了|原因|逻辑)/),
  ])
  const storyConstraints = normalizeMemoryEntries([
    ...extractEntriesByKeywords(
      messages,
      /(上下文|缓存|token|模型|窗口|压缩|章节|字数|风格|设定|角色|大纲)/,
    ),
  ])

  const narrativeSummarySource = messages
    .slice(-4)
    .map((message) => {
      if (message.role === 'user') {
        return `用户：${firstSentence(message.content)}`
      }
      return `助手：${firstSentence(message.content)}`
    })
    .filter(Boolean)

  const narrativeSummary = trimText(
    [
      manualInstructions ? `手动整理指令：${trimText(manualInstructions, 180)}` : '',
      ...narrativeSummarySource,
    ]
      .filter(Boolean)
      .join(' / '),
    1000,
  )

  return {
    userPreferences,
    acceptedDecisions,
    rejectedDirections,
    unresolvedQuestions,
    importantRationales,
    storyConstraints,
    narrativeSummary,
  }
}

function buildCompactionPrompt(options: {
  novelId: string
  reason: 'auto' | 'manual'
  manualInstructions?: string
  sourceMessages: SerializableCompactionTranscriptEntry[]
  storyState: StoryStateSnapshot
  snapshot?: ContextSnapshot
}): string {
  return JSON.stringify(
    {
      prompt: 'compact_context',
      serializerVersion: CONTEXT_SERIALIZER_VERSION,
      promptTemplateVersion: CONTEXT_PROMPT_TEMPLATE_VERSION,
      novelId: options.novelId,
      reason: options.reason,
      manualInstructions: trimText(options.manualInstructions ?? '', CONTEXT_MANUAL_PROMPT_LIMIT),
      existingSnapshot: options.snapshot
        ? {
            revision: options.snapshot.revision,
            kind: options.snapshot.kind,
            compactedThroughMessageId: options.snapshot.compactedThroughMessageId,
            retainedTailMessageIds: options.snapshot.retainedTailMessageIds,
            memory: options.snapshot.memory,
          }
        : null,
      storyState: options.storyState,
      sourceMessages: options.sourceMessages,
      outputSchema: {
        memory: {
          userPreferences: [{ text: 'string', sourceMessageIds: ['message-id'] }],
          acceptedDecisions: [{ text: 'string', sourceMessageIds: ['message-id'] }],
          rejectedDirections: [{ text: 'string', sourceMessageIds: ['message-id'] }],
          unresolvedQuestions: [{ text: 'string', sourceMessageIds: ['message-id'] }],
          importantRationales: [{ text: 'string', sourceMessageIds: ['message-id'] }],
          storyConstraints: [{ text: 'string', sourceMessageIds: ['message-id'] }],
          narrativeSummary: 'string',
        },
      },
      instructions: [
        '只输出合法 JSON，不要代码块，不要解释。',
        '只使用 sourceMessages 里的 message id。',
        '优先保留明确约束、已确认决策、用户偏好、未解决问题和重要推理。',
        '如果某一类没有内容，返回空数组。',
        'summary 要短、稳定、可复用。',
      ],
    },
    null,
    2,
  )
}

function validateMemorySourceIds(
  memory: ContextSnapshot['memory'],
  validIds: Set<string>,
): ContextSnapshot['memory'] {
  const validateEntries = (entries: MemoryEntry[]): MemoryEntry[] =>
    entries
      .map((entry) => ({
        text: trimText(entry.text, 500),
        sourceMessageIds: [...new Set(entry.sourceMessageIds.filter((id) => validIds.has(id)))],
      }))
      .filter((entry) => entry.text && entry.sourceMessageIds.length > 0)

  return {
    userPreferences: validateEntries(memory.userPreferences),
    acceptedDecisions: validateEntries(memory.acceptedDecisions),
    rejectedDirections: validateEntries(memory.rejectedDirections),
    unresolvedQuestions: validateEntries(memory.unresolvedQuestions),
    importantRationales: validateEntries(memory.importantRationales),
    storyConstraints: validateEntries(memory.storyConstraints),
    narrativeSummary: trimText(memory.narrativeSummary ?? '', 1000),
  }
}

function buildMemoryFromModelOutput(
  rawContent: string,
  validIds: Set<string>,
  fallbackMessages: SerializableCompactionTranscriptEntry[],
  manualInstructions?: string,
): ContextSnapshot['memory'] {
  try {
    const parsed = compactionResponseSchema.parse(JSON.parse(rawContent))
    return validateMemorySourceIds(
      {
        ...parsed.memory,
        narrativeSummary: parsed.narrativeSummary ?? parsed.memory.narrativeSummary ?? '',
      },
      validIds,
    )
  } catch {
    const fallback = buildHeuristicMemory(fallbackMessages, manualInstructions)
    return validateMemorySourceIds(fallback, validIds)
  }
}

async function summarizeWithModel(options: {
  modelConfig: ModelConfig
  prompt: string
  signal?: AbortSignal
}): Promise<string> {
  const client = new OpenAI({
    baseURL: options.modelConfig.apiBase,
    apiKey: options.modelConfig.apiKey,
    dangerouslyAllowBrowser: true,
  })

  const response = await client.chat.completions.create(
    {
      model: options.modelConfig.model,
      messages: [
        {
          role: 'system',
          content: [
            '你是上下文压缩器。',
            '只输出合法 JSON，不要解释。',
            'JSON 必须满足用户提供的输出 schema。',
          ].join('\n'),
        },
        {
          role: 'user',
          content: options.prompt,
        },
      ],
      temperature: 0,
      max_tokens: Math.max(1024, Math.min(options.modelConfig.maxOutputTokens, 4096)),
      stream: false,
    },
    { signal: options.signal },
  )

  return response.choices[0]?.message?.content?.trim() ?? ''
}

function selectTailMessages(
  messages: SerializableCompactionTranscriptEntry[],
  maxTailTokens: number,
): SerializableCompactionTranscriptEntry[] {
  if (messages.length <= CONTEXT_RAW_TAIL_MESSAGE_LIMIT) {
    return [...messages]
  }

  const tail: SerializableCompactionTranscriptEntry[] = []
  let tokenCount = 0

  for (let index = messages.length - 1; index >= 0; index--) {
    const candidate = messages[index]
    const candidateTokens = estimateTranscriptEntryTokens(candidate)
    if (
      tail.length >= 2 &&
      (tail.length >= CONTEXT_RAW_TAIL_MESSAGE_LIMIT ||
        tokenCount + candidateTokens > maxTailTokens)
    ) {
      break
    }

    tail.unshift(candidate)
    tokenCount += candidateTokens
  }

  const prevIndex = messages.length - tail.length - 1
  if (prevIndex >= 0 && tail.length > 1 && tail[0]?.role === 'assistant') {
    const previous = messages[prevIndex]
    if (tokenCount + estimateTranscriptEntryTokens(previous) <= maxTailTokens) {
      return [previous, ...tail]
    }
  }

  return tail
}

export function serializeContextSnapshot(snapshot: ContextSnapshot): string {
  return JSON.stringify(
    {
      serializerVersion: snapshot.serializerVersion,
      promptTemplateVersion: snapshot.promptTemplateVersion,
      scopeId: snapshot.scopeId,
      revision: snapshot.revision,
      kind: snapshot.kind,
      compactedThroughMessageId: snapshot.compactedThroughMessageId,
      retainedTailMessageIds: snapshot.retainedTailMessageIds,
      sourceMessageIds: snapshot.sourceMessageIds,
      estimatedInputTokensBefore: snapshot.estimatedInputTokensBefore,
      estimatedInputTokensAfter: snapshot.estimatedInputTokensAfter,
      summaryModelId: snapshot.summaryModelId ?? '',
      manualInstructions: snapshot.manualInstructions ?? '',
      memory: {
        userPreferences: normalizeMemoryEntries(snapshot.memory.userPreferences),
        acceptedDecisions: normalizeMemoryEntries(snapshot.memory.acceptedDecisions),
        rejectedDirections: normalizeMemoryEntries(snapshot.memory.rejectedDirections),
        unresolvedQuestions: normalizeMemoryEntries(snapshot.memory.unresolvedQuestions),
        importantRationales: normalizeMemoryEntries(snapshot.memory.importantRationales),
        storyConstraints: normalizeMemoryEntries(snapshot.memory.storyConstraints),
        narrativeSummary: trimText(snapshot.memory.narrativeSummary ?? '', 1000),
      },
    },
    null,
    2,
  )
}

export async function compactConversationContext(
  options: CompactConversationContextOptions,
): Promise<CompactConversationContextResult> {
  return withCompactionLock(options.novelId, async () => {
    const transcriptMessages = serializeConversationMessages(options.conversation.messages)
    const latestSnapshot = await getLatestContextSnapshot(options.novelId, CONTEXT_SCOPE_MAIN)
    const promptBudget = estimateWindowBudget(
      options.modelConfig.contextWindowTokens,
      options.modelConfig.outputReserveTokens,
    )
    const triggerAt = calculateTriggerThreshold(
      options.modelConfig.contextWindowTokens,
      options.modelConfig.outputReserveTokens,
      options.modelConfig.compactionTriggerRatio,
    )
    const targetAt = Math.floor(promptBudget * options.modelConfig.compactionTargetRatio)

    const tailTokenBudget = Math.max(800, Math.floor(targetAt * 0.35))
    const retainedTailMessages = selectTailMessages(transcriptMessages, tailTokenBudget)
    const sourceMessages = transcriptMessages.slice(
      0,
      Math.max(0, transcriptMessages.length - retainedTailMessages.length),
    )
    const compactedThroughMessageId = sourceMessages.at(-1)?.id ?? null
    const sourceMessageIds = sourceMessages.map((message) => message.id)

    if (promptBudget <= 0) {
      return { compacted: false, estimatedInputTokensBefore: 0, estimatedInputTokensAfter: 0 }
    }

    const tailTokenEstimate = retainedTailMessages.reduce(
      (sum, message) => sum + estimateTranscriptEntryTokens(message),
      0,
    )
    const storyStateText = serializeStoryState(options.storyState)
    const sourceText = JSON.stringify({
      novelId: options.novelId,
      reason: options.reason,
      manualInstructions: trimText(options.manualInstructions ?? '', CONTEXT_MANUAL_PROMPT_LIMIT),
      storyState: options.storyState,
      sourceMessages,
    })
    const estimatedInputTokensBefore = estimatePromptTokens([storyStateText, sourceText])

    if (!options.force && estimatedInputTokensBefore < triggerAt) {
      return {
        compacted: false,
        estimatedInputTokensBefore,
        estimatedInputTokensAfter: estimatedInputTokensBefore,
      }
    }

    if (sourceMessages.length === 0) {
      return {
        compacted: false,
        estimatedInputTokensBefore,
        estimatedInputTokensAfter: estimatedInputTokensBefore,
      }
    }

    const summaryModelConfig = await resolveSummaryModelConfig(options.modelConfig)
    const prompt = buildCompactionPrompt({
      novelId: options.novelId,
      reason: options.reason,
      manualInstructions: options.manualInstructions,
      sourceMessages,
      storyState: options.storyState,
      snapshot: latestSnapshot,
    })

    const validSourceIds = new Set(sourceMessageIds)
    let memory = buildHeuristicMemory(sourceMessages, options.manualInstructions)

    try {
      const rawContent = await summarizeWithModel({
        modelConfig: summaryModelConfig,
        prompt,
      })
      if (rawContent) {
        memory = buildMemoryFromModelOutput(
          rawContent,
          validSourceIds,
          sourceMessages,
          options.manualInstructions,
        )
      }
    } catch {
      memory = buildMemoryFromModelOutput(
        '',
        validSourceIds,
        sourceMessages,
        options.manualInstructions,
      )
    }

    const createdAt = Date.now()
    const snapshotRevision = await getNextContextSnapshotRevision(
      options.novelId,
      CONTEXT_SCOPE_MAIN,
    )
    const snapshotPreview: ContextSnapshot = {
      id: crypto.randomUUID(),
      novelId: options.novelId,
      scopeId: CONTEXT_SCOPE_MAIN,
      revision: snapshotRevision,
      kind: options.reason,
      serializerVersion: CONTEXT_SERIALIZER_VERSION,
      promptTemplateVersion: CONTEXT_PROMPT_TEMPLATE_VERSION,
      compactedThroughMessageId,
      retainedTailMessageIds: retainedTailMessages.map((message) => message.id),
      sourceMessageIds,
      memory: validateMemorySourceIds(memory, validSourceIds),
      estimatedInputTokensBefore,
      estimatedInputTokensAfter: 0,
      summaryModelId: summaryModelConfig.id,
      manualInstructions: options.manualInstructions,
      createdAt,
    }

    const estimatedInputTokensAfter =
      tailTokenEstimate +
      estimatePromptTokens([serializeContextSnapshot(snapshotPreview), storyStateText])

    const snapshot: ContextSnapshot = {
      ...snapshotPreview,
      estimatedInputTokensAfter,
    }

    await saveContextSnapshot(snapshot)
    await pruneOldSnapshots(options.novelId, CONTEXT_SCOPE_MAIN)

    return {
      snapshot,
      compacted: true,
      estimatedInputTokensBefore,
      estimatedInputTokensAfter: snapshot.estimatedInputTokensAfter,
    }
  })
}

async function resolveSummaryModelConfig(modelConfig: ModelConfig): Promise<ModelConfig> {
  if (!modelConfig.summaryModelId || modelConfig.summaryModelId === modelConfig.id) {
    return modelConfig
  }

  const config = await getConfig()
  const resolved = config.models.find((model) => model.id === modelConfig.summaryModelId)
  return resolved ?? modelConfig
}
