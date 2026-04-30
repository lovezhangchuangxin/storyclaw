# 05 — 数据模型与存储

## 存储方案

### 前端：IndexedDB

前端以 IndexedDB 为主要存储，所有小说数据、配置、会话都在本地持久化。

使用 `idb` 库封装操作。数据库名：`storyclaw`。

### 后端：PostgreSQL + Redis

后端存储用户、小说副本（用于同步）、认证信息。Redis 存储 session 和速率限制。

---

## 前端数据模型（IndexedDB）

### Object Stores

```
storyclaw (database)
├── novels          keyPath: id
├── outlines        keyPath: novelId
├── characters      keyPath: [novelId, id]
├── chapters        keyPath: [novelId, index]
├── worldBuilding   keyPath: novelId
├── conversations   keyPath: novelId
├── config          keyPath: id
├── readingProgress keyPath: novelId
└── operationHistory keyPath: id     (undo/redo 操作记录)
```

### 详细 Schema

#### novels
```typescript
interface Novel {
  id: string;                // nanoid
  title: string;
  synopsis: string;
  genre: string;             // 类型标签
  targetWordCount: number;   // 目标字数（≤50000）
  currentWordCount: number;
  status: 'drafting' | 'writing' | 'completed' | 'paused';
  styleSettings: StyleSettings;
  cover?: string;            // 封面图 base64
  createdAt: number;         // timestamp
  updatedAt: number;
  version: number;           // 同步版本号
}
```

#### outlines
```typescript
interface Outline {
  novelId: string;
  premise: string;           // 故事前提
  threeActs: {
    act1: ActOutline;        // 建置
    act2: ActOutline;        // 对抗
    act3: ActOutline;        // 解决
  };
  chapterPlan: ChapterPlan[];
  updatedAt: number;
}

interface ActOutline {
  summary: string;
  keyEvents: string[];
  characterArcs: string[];
}

interface ChapterPlan {
  index: number;
  title: string;
  summary: string;
  estimatedWordCount: number;
  pointOfView: string;      // POV 角色
  status: 'planned' | 'writing' | 'completed';
}
```

#### characters
```typescript
interface Character {
  id: string;
  novelId: string;
  name: string;
  role: 'protagonist' | 'antagonist' | 'supporting' | 'minor';
  appearance: string;
  personality: string;
  background: string;
  motivation: string;
  arc: string;
  relationships: Relationship[];
  updatedAt: number;
}

interface Relationship {
  characterId: string;
  characterName: string;
  relation: string;
  description: string;
}
```

#### chapters
```typescript
interface Chapter {
  novelId: string;
  index: number;
  title: string;
  content: string;           // Markdown 格式
  wordCount: number;
  status: 'planned' | 'draft' | 'completed';
  pointOfView?: string;
  summary?: string;          // AI 生成的摘要（用于 context）
  scenes: Scene[];
  createdAt: number;
  updatedAt: number;
}

interface Scene {
  id: string;
  title: string;
  content: string;
}
```

#### worldBuilding
```typescript
interface WorldBuilding {
  novelId: string;
  era: string;               // 时代背景
  location: string;          // 主要地点
  rules: string;             // 世界观规则（魔法体系、科技设定等）
  culture: string;           // 文化背景
  factions: Faction[];
  notes: string;             // 其他设定
  updatedAt: number;
}

interface Faction {
  name: string;
  description: string;
  goals: string;
}
```

#### conversations
```typescript
interface Conversation {
  novelId: string;
  messages: Message[];       // 完整对话历史
  compactedSummary?: CompactedSummary;
  settings: ConversationSettings;
  updatedAt: number;
}

interface Message {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  timestamp: number;
  tokenCount?: number;       // 从 API 响应获取的实际 token 数
}

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

interface CompactedSummary {
  generatedAt: number;
  summary: string;           // 压缩后的摘要
  originalMessageRange: [number, number]; // [startIndex, endIndex]
  retainedMessageIds: string[]; // 保留未压缩的消息 ID
}
```

#### config
```typescript
interface AppConfig {
  id: 'app-config';
  models: ModelConfig[];
  defaultModelId: string;
  skillModelMapping: Record<string, string>;  // skillName → modelId
  readingTheme: ReadingTheme;
  readingSettings: ReadingSettings;
  backendUrl?: string;
  useBackendProxy: boolean;
  updatedAt: number;
}

interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  apiBase: string;           // OpenAI 兼容 endpoint
  apiKey: string;            // 明文存储
  model: string;             // 模型名
  maxTokens: number;
  temperature: number;
  topP: number;
}
```

#### readingProgress
```typescript
interface ReadingProgress {
  novelId: string;
  chapterIndex: number;       // 当前阅读到的章节
  scrollPosition: number;     // 章节内滚动位置（百分比 0-1）
  updatedAt: number;
}
```

#### operationHistory
```typescript
interface OperationRecord {
  id: string;                 // nanoid
  novelId: string;
  timestamp: number;
  store: string;              // IndexedDB store 名
  key: any;                   // 记录 key
  before: any;                // 变更前数据快照
  after: any;                 // 变更后数据
}
```
最多保留 50 条操作记录，超出时删除最旧的。

---

## 后端数据模型（PostgreSQL）

```sql
-- 用户
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'user',  -- 'user' | 'admin'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 小说（后端同步副本）
CREATE TABLE novels (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  data JSONB NOT NULL,       -- 完整小说数据
  version INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 刷新令牌
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  token VARCHAR(512) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- LLM 调用日志（可选，用于管理后台）
CREATE TABLE llm_logs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  model VARCHAR(100),
  prompt_tokens INT,
  completion_tokens INT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 同步策略

### 同步模型

前端主导，后端被动存储。用户在前端操作，可选择性地将数据推送到后端。

```
前端(IndexedDB) ──push──▶ 后端(PostgreSQL)
前端(IndexedDB) ◀──pull── 后端(PostgreSQL)
```

### 冲突处理

采用 Last-Write-Wins (LWW) 策略，基于 `updatedAt` 时间戳：

```
1. 前端 push 时，带上本地 version
2. 后端比较 version：
   - 本地 version > 服务端 version → 接受 push
   - 本地 version < 服务端 version → 返回服务端数据，前端合并
3. 用户手动选择保留哪个版本
```

简化处理：每本小说在后端只存一份完整 JSON，不做字段级合并。

### 同步触发时机

- 手动触发（设置页的"同步"按钮）
- 连接后端后，打开小说时自动 pull
- 章节创作完成后自动 push（如果已连接后端）
- 定时自动 push（每 5 分钟，如果已连接）

---

## 数据流总结

```
创作阶段：
  用户输入 → Agent Loop → LLM API → 流式响应
    → Tool Calls → 更新 IndexedDB（大纲/角色/章节）
    → 流式渲染到阅读器

阅读阶段：
  用户打开小说 → IndexedDB 读取章节
    → 阅读器渲染（应用主题/字体）
    → 进度保存到 IndexedDB

同步阶段（可选）：
  前端 IndexedDB → push → 后端 PostgreSQL
  后端 PostgreSQL → pull → 前端 IndexedDB
```
