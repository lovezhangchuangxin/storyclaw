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
  version: number
}

export interface StyleSettings {
  narrativePerspective: string
  tense: string
  languageStyle: string
  customPrompt?: string
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
  compactedSummary?: CompactedSummary
  updatedAt: number
}

export interface Message {
  id: string
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  toolCalls?: ToolCall[]
  toolCallId?: string
  timestamp: number
  promptTokens?: number
  completionTokens?: number
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface CompactedSummary {
  generatedAt: number
  summary: string
  originalMessageRange: [number, number]
  retainedMessageIds: string[]
}

// ---- Config ----

export interface AppConfig {
  id: 'app-config'
  models: ModelConfig[]
  defaultModelId: string
  skillModelMapping: Record<string, string>
  readingTheme: string
  readingSettings: ReadingSettings
  backendUrl?: string
  useBackendProxy: boolean
  updatedAt: number
}

export interface ModelConfig {
  id: string
  name: string
  provider: string
  apiBase: string
  apiKey: string
  model: string
  maxTokens: number
  temperature: number
  topP: number
}

export interface ReadingSettings {
  fontFamily: string
  fontSize: number
  lineHeight: number
  paragraphSpacing: number
  textColor: string
  backgroundColor: string
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
  readingTheme: 'serene',
  readingSettings: {
    fontFamily: 'Noto Sans SC',
    fontSize: 18,
    lineHeight: 1.8,
    paragraphSpacing: 1,
    textColor: '#333333',
    backgroundColor: '#F5F0E8',
    scrollMode: 'scroll',
    autoScrollSpeed: 50,
  },
  backendUrl: '',
  useBackendProxy: false,
  updatedAt: Date.now(),
}
