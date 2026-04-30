# 06 — 上下文管理与 Prompt Caching

## 目标

在 Agent Loop 中高效管理 LLM 上下文，实现：
1. **高缓存命中率** — 利用 OpenAI 兼容接口的自动前缀匹配缓存（DeepSeek 等主流提供商均已支持）
2. **窗口满时自动压缩** — 上下文接近 token 上限时无损压缩历史
3. **故事状态始终可用** — 大纲、角色、设定不被压缩丢失

---

## Token 使用量追踪

### 使用 API 响应中的实际数据

调用 OpenAI 兼容接口时，响应体包含 `usage` 字段，无需自行估算 token：

```json
{
  "usage": {
    "prompt_tokens": 12450,
    "completion_tokens": 823,
    "total_tokens": 13273
  }
}
```

每次 LLM 调用后记录实际 token 使用量到 Message：

```typescript
interface Message {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  timestamp: number;
  promptTokens?: number;       // 本次调用的 prompt tokens（来自 API 响应）
  completionTokens?: number;   // 本次调用的 completion tokens（来自 API 响应）
}
```

ContextManager 维护一个累计 token 计数器，每次 API 调用后更新：

```typescript
let totalPromptTokensUsed = 0;
let totalCompletionTokensUsed = 0;

// 每次 API 调用后
function recordUsage(usage: { prompt_tokens: number; completion_tokens: number }) {
  totalPromptTokensUsed += usage.prompt_tokens;
  totalCompletionTokensUsed += usage.completion_tokens;
}
```

### 触发时机

- Token 使用率达到 **70%** 时，前端展示预警提示
- Token 使用率达到 **85%** 时，自动触发 compaction
- 用户在 Agent 模式下可手动触发 compaction

以实际编译词数(token数)为准，不考虑字符估算，所以不存在中英文差异问题。

---

## 缓存策略：前缀匹配优化

### OpenAI 兼容接口的缓存机制

OpenAI 和 DeepSeek 等主流提供商的 prompt caching 均基于**自动前缀匹配**：如果新请求的 messages 前缀（从第一条 message 开始）与之前的请求相同，前缀部分命中缓存，不计入 token 处理费用且响应更快。

**关键规则：**
- 前缀必须完全一致（逐 token 匹配）
- 一旦某条 message 发生变化，该 message 及之后的所有内容都会 cache miss
- 至少 1024 tokens 的匹配前缀才会触发缓存

### 上下文编排

为确保高缓存命中率，messages 按以下顺序构建：

```
[System Messages — 固定层]
  ├── System Prompt (1)      ← 创作 persona，永久不变 → 永远命中缓存
  ├── System Prompt (2)      ← 工具定义，基本不变 → 几乎永远命中缓存
  ├── System Prompt (3)      ← 大纲 & 角色摘要，偶尔变化 → 大部分时间命中
  └── System Prompt (4)      ← 文风设定，基本不变 → 几乎永远命中缓存

[Conversation History — 增量层]
  ├── User Message (turn 1)  ← 一般不变
  ├── Assistant (turn 1)     ← 一般不变
  ├── User Message (turn 2)  ← 一般不变
  ├── ...                    ← 不变部分命中缓存
  ├── User Message (turn N-1)← 上一轮，不变
  └── Assistant (turn N-1)   ← 上一轮，不变

[Current Turn — 变化层]
  └── User Message (turn N)  ← 最新消息，每次不同 → 必定 miss
```

### 优化手段

1. **工具定义保持稳定。** 不在运行时动态增删 tools，使用固定的全集 tool 定义。

2. **大纲/角色变更使用追加策略。** 不修改现有的 system prompt，而是追加新的 system message 描述变更。

3. **Conversation messages 只追加、不修改。** 即使 agent 修正了之前说的内容，也以新 message 形式追加纠正，不编辑旧 message。

4. **为同一 novel 的请求维护一致的分隔符和格式。** 包括 tool call 的 JSON 格式、缩进风格等。

---

## Context Compaction（上下文压缩）

### 压缩算法（尊重 tool-call 边界）

Tool call + tool result 是一个原子单元，compaction 不能切断它们。

```
function findSafeBoundary(messages, targetIndex):
  // 从 targetIndex 向前找到安全的切割点
  // 确保不会切断 tool-call/result 配对
  boundary = targetIndex
  while boundary > 0:
    msg = messages[boundary]
    if msg.role == 'tool':
      // 跳过关联的 tool call，继续向前
      boundary--
      continue
    if msg.role == 'assistant' && msg.toolCalls:
      // 如果有 tool call，向前跳过该对
      boundary--
      continue
    break
  return boundary
```

```
function compact(messages, modelContextWindow, currentUsage):
  // 1. 计算需要释放的 token 数
  targetFree = modelContextWindow * 0.3
  
  // 2. 保留最近 3 轮完整对话，对之前的做压缩
  recentTurns = 3
  compactTarget = messages.length - (recentTurns * 2)
  
  // 3. 找到安全的切割点（不切断 tool-call/result 对）
  compactEnd = findSafeBoundary(messages, compactTarget)
  compactRange = messages[0 ... compactEnd]
  
  // 4. 预估 compactRange 大小，如果超过 50% 窗口则截断
  if estimateTokens(compactRange) > modelContextWindow * 0.5:
    compactRange = compactRange.slice(-(modelContextWindow * 0.5))
  
  // 5. 调用模型生成摘要
  summary = await llm.chat({
    messages: [
      { role: 'system', content: 'Summarize the key points...' },
      ...compactRange,
      { role: 'user', content: 'Please provide a concise summary.' }
    ],
    maxTokens: 1000
  })
  
  // 6. 用摘要替换被压缩的消息
  compactedMessages = [
    { role: 'system', content: `[Conversation Summary]\n${summary}` },
    ...messages[compactEnd:]
  ]
  
  return {
    messages: compactedMessages,
    compactedSummary: {
      generatedAt: Date.now(),
      summary,
      originalMessageRange: [0, compactEnd],
      retainedMessageIds: messages.slice(compactEnd).map(m => m.id)
    }
  }
```

### 摘要提示词模板

```
You are summarizing a conversation between a reader and a story-writing AI agent.
Focus on retaining:
1. All story decisions the reader made (rejected ideas, preferred directions)
2. Key feedback on characters, plot, and style
3. Important changes to the outline or character arcs
4. The reader's explicit preferences and dislikes

Do NOT include:
- Technical details about the writing process
- Redundant information already in the story outline
- Minor stylistic tweaks that were applied

Format as a bulleted list of key points, organized by: Plot / Characters / Style / Reader Preferences.
```

### 错误恢复

如果摘要 LLM 调用失败（网络错误、速率限制），降级为硬截断：

```
function compactFallback(messages):
  // 保留 system messages + 最近 6 条 messages
  systemMsgs = messages.filter(m => m.role == 'system')
  recentMsgs = messages.slice(-6)
  return [...systemMsgs, ...recentMsgs]
```

---

## 上下文构建完整流程

```typescript
class ContextManager {
  private totalTokensUsed = 0;
  
  async build(novelId: string, userMessage: string): Message[] {
    const novel = await db.novels.get(novelId);
    const conversation = await db.conversations.get(novelId);
    const outline = await db.outlines.get(novelId);
    const characters = await db.characters.where({ novelId }).toArray();

    const systemMessages = [
      this.buildPersonaPrompt(),
      this.buildToolsPrompt(),
      this.buildStoryStateBlock(outline, characters),
      this.buildStylePrompt(novel.styleSettings),
    ];

    const historyMessages = conversation.compactedSummary
      ? [
          { role: 'system', content: `[Conversation Summary]\n${conversation.compactedSummary.summary}` },
          ...conversation.messages.slice(-6)
        ]
      : conversation.messages;

    const messages = [
      ...systemMessages,
      ...historyMessages,
      { role: 'user', content: userMessage },
    ];

    const contextWindow = this.getContextWindow();
    const usageRatio = this.totalTokensUsed / contextWindow;

    if (usageRatio > 0.85) {
      return await this.compact(messages, contextWindow);
    }

    return messages;
  }
  
  recordUsage(usage: { prompt_tokens: number; completion_tokens: number }) {
    this.totalTokensUsed += usage.prompt_tokens + usage.completion_tokens;
  }
}
```

---

## Story State Block

为了让 Agent 获得最新故事状态，在 system messages 末尾追加 State Block。
添加数量上限防止无限增长：

```
[SYSTEM STATE]
Current story: 《星落之城》
Progress: 第 12 章 / 共 24 章 | 18500 / 30000 字
Status: 创作中

Recent chapters (最多 3 章):
- Ch 10 "破晓": 李明在实验室发现了真相，决定...
- Ch 11 "暗流": 组织派出追兵，李明与苏晓逃亡...
- Ch 12 "抉择" (当前): 李明面临两个选择——

Character states (最多 5 个角色):
- 李明(男主): 已从科学家转变为逃亡者，内心挣扎中
- 苏晓(女主): 刚揭露真实身份为组织卧底
- 王教授(反派): 正在追踪主角，尚未登场

Pending decisions:
- 李明是否相信苏晓？
```

---

## Multi-Agent 缓存策略

当使用子 Agent 时，每次切换到不同的子 Agent（不同 system prompt），缓存前缀会失效。策略：

- **子 Agent 调用频率低**（大纲设计、角色创建只在特定阶段触发），缓存失效影响有限
- **Writing Agent 主力创作**，其 system prompt 单独维护一份缓存
- 子 Agent 完成后，主 Agent 的上下文不变（缓存恢复命中）

---

## 模型上下文窗口配置

| 模型 | 上下文窗口 | Compaction 触发点（85%） |
|------|----------|------------------------|
| GPT-4o | 128K | ~109K tokens |
| GPT-4o-mini | 128K | ~109K tokens |
| DeepSeek-V3 | 128K | ~109K tokens |
| DeepSeek-R1 | 128K | ~109K tokens |
| Qwen-2.5 | 32K-128K | 视配置而定 |
| 自定义 | 用户配置 | 配置值 * 0.85 |

Compaction 主要应对以下场景：
- 使用较小上下文窗口的模型（32K）
- 用户进行了大量反馈迭代
- Agent 在单轮中产生了大量 tool call 历史
