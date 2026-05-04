# 06 — 上下文管理与消息回放

## 目标

当前实现的上下文系统目标不是“自动压缩历史”，而是保证以下几点：

1. **流式渲染顺序与持久化顺序一致**
2. **刷新后回放与生成时看到的结构一致**
3. **只把稳定、可重放的内容重新喂给模型**
4. **工具调用与工具结果严格成对回放**
5. **reasoning content 仅在模型支持时参与上下文**

---

## 当前设计总览

Agent 对话使用统一的 `Conversation.messages` 结构保存到 IndexedDB。上下文构建时不再依赖摘要压缩，也不再保留独立的 `tool` / `system` 历史消息。

```text
Conversation
  ├── user message
  ├── assistant message
  │     ├── reasoning part
  │     ├── text part
  │     └── tool_use part
  ├── status message
  └── ...
```

核心原则：

- `assistant.parts` 是唯一的顺序来源
- `status` 仅用于界面提示，不参与模型上下文
- 未完成的 assistant 文本不回放给模型
- 已完成的 tool result 即使来自被取消/截断的 assistant，也可以单独回放

---

## 消息模型

```typescript
interface Conversation {
  novelId: string
  messages: Message[]
  updatedAt: number
}

type Message = UserMessage | StatusMessage | AssistantMessage

interface UserMessage {
  id: string
  role: 'user'
  content: string
  timestamp: number
}

interface StatusMessage {
  id: string
  role: 'status'
  kind: 'info' | 'warning' | 'error' | 'cancelled'
  content: string
  timestamp: number
}

interface AssistantMessage {
  id: string
  role: 'assistant'
  parts: AssistantPart[]
  state: 'completed' | 'cancelled' | 'error' | 'truncated'
  finishReason?: string
  timestamp: number
  promptTokens?: number
  completionTokens?: number
}

type AssistantPart =
  | { type: 'reasoning'; text: string }
  | { type: 'text'; text: string }
  | {
      type: 'tool_use'
      toolCallId: string
      toolName: string
      rawArguments: string
      arguments: Record<string, unknown> | null
      result: string | null
      status: 'pending' | 'completed' | 'cancelled' | 'error'
    }
```

设计说明：

- `rawArguments` 作为标准回放来源，避免 `arguments` 被 UI 侧加工后失真
- `arguments` 仅用于前端摘要展示，允许为 `null`
- tool result 以字符串保存，保持与 OpenAI tool message 一致
- `state` 表示整条 assistant turn 是否可完整回放

---

## 上下文构建规则

上下文构建入口为 `buildContext()`。它会将本地 `Conversation.messages` 转换为 OpenAI 兼容的 `messages[]`。

构建顺序：

1. 固定 persona system prompt
2. 上下文快照（如有）
3. 过滤并转换后的历史消息
4. 当前用户消息（首次对话或上下文压缩后，前面会自动注入【当前故事状态】作为前缀）

```text
[
  { role: 'system', content: personaPrompt },
  { role: 'system', content: 'Context Snapshot\n{...}' },  // 如有
  ...replayedHistory,
  { role: 'user', content: '【当前故事状态】\n{...}\n\n---\n...' }  // 首次/压缩后注入
]
```

> **状态注入策略：** story state 不作为 system message 固定注入，而是在 `user` role 中按需前缀注入。仅在首次对话（无历史消息）或上下文压缩后注入，日常对话中 LLM 通过工具调用结果自然感知状态变化。这样可以最大化前缀缓存命中率，避免每轮都打断 persona + history 缓存。

### 历史消息过滤规则

#### `user`

始终保留。

#### `status`

始终忽略。

原因：

- `status` 属于 UI 运行时信息
- 例如“已取消生成”“保存失败”不应该污染后续模型上下文

#### `assistant`

分两类处理：

1. `state === 'completed'`
   - 回放文本
   - 回放 reasoning（仅限支持的模型）
   - 回放所有非 cancelled 的 tool calls
   - 回放每个 tool call 对应的 tool result

2. `state !== 'completed'`
   - 不回放半截文本
   - 不回放半截 reasoning
   - 如果其中存在已完成 tool result，则只回放 tool call + tool result 对

这样可以保证：

- 用户已经看过但未完成的自然语言不会误导后续模型
- 已经落地生效的工具结果不会从上下文中凭空消失

---

## Tool Call 回放规则

每个 `tool_use` part 都可能映射成两段 OpenAI 消息：

1. assistant 的 `tool_calls`
2. 紧随其后的 `tool` role result

示意：

```typescript
{
  role: 'assistant',
  content: null,
  tool_calls: [
    {
      id: toolUse.toolCallId,
      type: 'function',
      function: {
        name: toolUse.toolName,
        arguments: toolUse.rawArguments,
      }
    }
  ]
}

{
  role: 'tool',
  tool_call_id: toolUse.toolCallId,
  content: toolUse.result
}
```

约束：

- `status === 'cancelled'` 的 tool call 不回放
- `result === null` 的 tool call 不回放 result
- tool call 顺序使用模型流中的原始 index 顺序

---

## Reasoning Content 规则

只有支持 reasoning content 的模型才会在上下文中包含 reasoning。

当前判断逻辑：

- provider / apiBase / model 名命中 DeepSeek / R1 / Reasoner 特征时启用

不支持 reasoning 的模型：

- reasoning part 仍会保存到本地会话
- UI 仍可展示
- 但不会回放给模型

---

## Token 使用量

系统不再维护一个独立的会话级 token 累计器，也不做自动 compaction。

当前做法：

- 每次 assistant 响应结束后，从 API usage 写回该条 `AssistantMessage`
  - `promptTokens`
  - `completionTokens`
- `buildContext()` 会累加历史消息上的 token 统计，作为观察值返回

这意味着：

- token 统计是“已发生调用的账本”
- 不是“精确的当前 prompt 估算器”
- 目前仅用于观测，不驱动自动压缩

---

## 取消、异常与截断

### 用户取消

- 当前 in-flight assistant 标记为 `cancelled`
- 所有 pending tool use 标记为 `cancelled`
- 已生成的可见内容仍保留在 UI 与持久化历史中
- 后续上下文不会回放其半截自然语言

### 流式异常

- 当前 in-flight assistant 标记为 `error`
- 已生成内容保留
- pending tool use 标记为 `cancelled`
- 追加一条 `status:error`

### finish reason 非 `stop` / `tool_calls`

- assistant 标记为 `truncated`
- 已生成内容保留
- pending tool use 标记为 `cancelled`
- 追加一条 `status:warning`

---

## 前端渲染一致性约束

`AgentChat.vue` 不再自己拼装“当前轮次 UI 结构”，而是直接渲染 `Message[]`。

这保证三件事共用同一份顺序：

1. 流式生成中的界面
2. 保存到 IndexedDB 的数据
3. 刷新后的历史回放

assistant 渲染规则：

- `reasoning` part → `ThinkingCard`
- `text` part → assistant markdown 气泡
- `tool_use` part → `ToolCard`

因此不存在“流式中工具卡跑到文本前，结束后又刷新纠正”的双轨顺序问题。

---

## 当前不做的事情

以下方案曾在早期设计里出现，但当前实现明确不采用：

- 不做 `compactedSummary`
- 不做自动上下文压缩
- 不保留 `system` / `tool` 平铺历史
- 不在对话历史中保存运行时 UI 提示以供回放

如果未来重新引入压缩，必须满足两个前提：

1. 不破坏 `assistant.parts` 的顺序语义
2. 不让“生成中看到的内容”和“刷新后上下文回放”发生分叉

未来的自动 / 手动上下文压缩设计见 [07 — 上下文压缩与记忆管理](./07-context-compaction-and-memory.md)。
