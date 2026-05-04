// ---- Novel ----

export interface Novel {
  id: string
  title: string
  synopsis: string
  genre: string
  targetWordCount: number
  currentWordCount: number
  status: 'drafting' | 'writing' | 'completed' | 'paused'
  styleSettings: StyleSettings
  cover?: string
  createdAt: number
  updatedAt: number
  selectedPromptIds?: string[]
  version: number
  backendId?: string
}

export interface StyleSettings {
  narrativePerspective: string
  tense: string
  languageStyle: string
  customPrompt?: string
}

// ---- Prompt ----

export interface Prompt {
  id: string
  name: string
  content: string
  isBuiltin: boolean
  createdAt: number
  updatedAt: number
}

// ---- Outline ----

export interface Outline {
  novelId: string
  premise: string
  threeActs: {
    act1: ActOutline
    act2: ActOutline
    act3: ActOutline
  }
  chapterPlan: ChapterPlan[]
  updatedAt: number
}

export interface ActOutline {
  summary: string
  keyEvents: string[]
  characterArcs: string[]
}

export interface ChapterPlan {
  index: number
  title: string
  summary: string
  estimatedWordCount: number
  pointOfView: string
  status: 'planned' | 'writing' | 'completed'
}

// ---- Character ----

export interface Character {
  id: string
  novelId: string
  name: string
  role: 'protagonist' | 'antagonist' | 'supporting' | 'minor'
  appearance: string
  personality: string
  background: string
  motivation: string
  arc: string
  relationships: Relationship[]
  updatedAt: number
}

export interface Relationship {
  characterId: string
  characterName: string
  relation: string
  description: string
}

// ---- Chapter ----

export interface Chapter {
  novelId: string
  index: number
  title: string
  content: string
  wordCount: number
  status: 'planned' | 'draft' | 'completed'
  pointOfView?: string
  summary?: string
  scenes: Scene[]
  createdAt: number
  updatedAt: number
}

export interface Scene {
  id: string
  title: string
  content: string
}

// ---- World Building ----

export interface WorldBuilding {
  novelId: string
  era: string
  location: string
  rules: string
  culture: string
  factions: Faction[]
  notes: string
  updatedAt: number
}

export interface Faction {
  name: string
  description: string
  goals: string
}

// ---- Conversation ----

export interface Conversation {
  novelId: string
  messages: Message[]
  updatedAt: number
}

export interface MemoryEntry {
  text: string
  sourceMessageIds: string[]
}

export interface CompactedMemory {
  userPreferences: MemoryEntry[]
  acceptedDecisions: MemoryEntry[]
  rejectedDirections: MemoryEntry[]
  unresolvedQuestions: MemoryEntry[]
  importantRationales: MemoryEntry[]
  storyConstraints: MemoryEntry[]
  narrativeSummary: string
}

export interface ContextSnapshot {
  id: string
  novelId: string
  scopeId: string
  revision: number
  kind: 'auto' | 'manual'
  serializerVersion: number
  promptTemplateVersion: number
  compactedThroughMessageId: string | null
  retainedTailMessageIds: string[]
  sourceMessageIds: string[]
  memory: CompactedMemory
  estimatedInputTokensBefore: number
  estimatedInputTokensAfter: number
  summaryModelId?: string
  manualInstructions?: string
  createdAt: number
}

interface BaseMessage {
  id: string
  timestamp: number
  promptTokens?: number
  completionTokens?: number
}

export interface UserMessage extends BaseMessage {
  role: 'user'
  content: string
}

export interface StatusMessage extends BaseMessage {
  role: 'status'
  kind: 'info' | 'warning' | 'error' | 'cancelled'
  content: string
}

export interface AssistantReasoningPart {
  type: 'reasoning'
  text: string
}

export interface AssistantTextPart {
  type: 'text'
  text: string
}

export interface AssistantToolUsePart {
  type: 'tool_use'
  toolCallId: string
  toolName: string
  rawArguments: string
  arguments: Record<string, unknown> | null
  result: string | null
  status: 'pending' | 'completed' | 'cancelled' | 'error'
}

export type AssistantPart =
  | AssistantReasoningPart
  | AssistantTextPart
  | AssistantToolUsePart

export interface AssistantMessage extends BaseMessage {
  role: 'assistant'
  parts: AssistantPart[]
  state: 'completed' | 'cancelled' | 'error' | 'truncated'
  finishReason?: string
}

export type Message = UserMessage | StatusMessage | AssistantMessage

// ---- Config ----

export type AppTheme = 'light' | 'dark' | 'parchment' | 'frost' | 'peach' | 'pine'

export interface BackgroundSettings {
  activeImageId: string | null
  opacity: number
  blur: number
}

export interface BackgroundImage {
  id: string
  blob: Blob
  type: string
  name: string
  updatedAt: number
}

export interface AppConfig {
  id: 'app-config'
  models: ModelConfig[]
  defaultModelId: string
  skillModelMapping: Record<string, string>
  appTheme: AppTheme
  readingSettings: ReadingSettings
  backgroundSettings: BackgroundSettings
  backendUrl?: string
  useBackendProxy: boolean
  updatedAt: number
}

export interface ModelConfig {
  id: string
  provider: string
  apiBase: string
  apiKey: string
  model: string
  maxOutputTokens: number
  contextWindowTokens: number
  outputReserveTokens: number
  compactionTriggerRatio: number
  compactionTargetRatio: number
  summaryModelId?: string
}

export interface ReadingSettings {
  fontFamily: string
  fontSize: number
  lineHeight: number
  paragraphSpacing: number
  scrollMode: 'scroll' | 'paged' | 'auto'
  autoScrollSpeed: number
}

// ---- Reading Progress ----

export interface ReadingProgress {
  novelId: string
  chapterIndex: number
  scrollPosition: number
  updatedAt: number
}

// ---- Operation History ----

export interface OperationRecord {
  id: string
  novelId: string
  timestamp: number
  store: string
  key: unknown
  before: unknown
  after: unknown
}

// ---- Defaults ----

export const DEFAULT_CONFIG: AppConfig = {
  id: 'app-config',
  models: [],
  defaultModelId: '',
  skillModelMapping: {},
  appTheme: 'light',
  readingSettings: {
    fontFamily: 'Noto Sans SC',
    fontSize: 18,
    lineHeight: 1.6,
    paragraphSpacing: 1,
    scrollMode: 'scroll',
    autoScrollSpeed: 50,
  },
  backgroundSettings: {
    activeImageId: null,
    opacity: 30,
    blur: 0,
  },
  backendUrl: '',
  useBackendProxy: false,
  updatedAt: 0,
}

export function createDefaultConfig(): AppConfig {
  return { ...DEFAULT_CONFIG, updatedAt: Date.now() }
}

export const DEFAULT_MODEL_CONFIG: Omit<
  ModelConfig,
  'id' | 'provider' | 'apiBase' | 'apiKey' | 'model'
> = {
  maxOutputTokens: 16384,
  contextWindowTokens: 128000,
  outputReserveTokens: 4096,
  compactionTriggerRatio: 0.7,
  compactionTargetRatio: 0.2,
  summaryModelId: '',
}

export function createDefaultModelConfig(
  model: Partial<ModelConfig> & Pick<ModelConfig, 'id' | 'provider' | 'apiBase' | 'apiKey' | 'model'>,
): ModelConfig {
  return {
    ...DEFAULT_MODEL_CONFIG,
    ...model,
    summaryModelId: model.summaryModelId ?? '',
  }
}

// ---- Backend Integration ----

export interface UserInfo {
  id: string
  email: string
  role: 'user' | 'admin'
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn?: number
}

export interface AuthResponse {
  user: UserInfo
  access_token: string
  refresh_token: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
}

export interface RefreshRequest {
  refresh_token: string
}

export interface HealthResponse {
  status: string
  db?: boolean
  redis?: boolean
  uptime?: number
  version?: string
}

export interface AdminStats {
  totalUsers: number
  totalNovels: number
  totalLlmCalls: number
  dailyActiveUsers?: number
}

export interface AdminUserSummary {
  id: string
  email: string
  role: string
  novelCount: number
  createdAt: string
  updatedAt: string
}

export interface AdminNovelSummary {
  id: string
  title: string
  authorEmail: string
  wordCount: number
  status: string
  createdAt: string
  updatedAt: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  perPage: number
}

export interface SyncPayload {
  novel: Novel
  outline?: Outline
  characters: Character[]
  chapters: Chapter[]
  worldBuilding?: WorldBuilding
  conversation?: Conversation
}

export interface PushNovelRequest {
  data: SyncPayload
  version: number
}

export interface PushNovelResponse {
  accepted: boolean
  serverVersion: number
  backendId?: string
  data?: SyncPayload
}

export interface PullNovelResponse {
  data: SyncPayload
  version: number
}
