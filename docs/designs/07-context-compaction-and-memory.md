# 07 — 上下文压缩与记忆管理

## 背景

StoryClaw 的 Agent 会持续积累对话、工具调用和故事状态。上下文一旦增长过快，不仅会逼近模型窗口，还会降低前缀缓存命中率。

这份设计的目标不是“频繁裁剪历史”，而是把上下文拆成可缓存、可重建、可审计的几层，并在接近窗口上限时做一次低频、离散的压缩。

---

## 目标

- 保留完整 transcript 作为审计和回放来源。
- 让有效上下文可重建，而不是依赖临时摘要。
- 把最稳定的内容放在最前面，尽量保住 prefix cache 命中率。
- 只在安全边界做 compaction。
- 支持模型配置里的触发比例和目标比例。
- 支持用户手动 compact，并可附加整理指令。
- 保证刷新后看到的消息顺序与生成时一致。

---

## 非目标

- 不做逐 token 的滚动压缩。
- 不把 compaction 当成删除历史的手段。
- 不用摘要替代数据库中的故事事实。
- 不在流式生成中途压缩。
- 不兼容旧的 `compactedSummary` 方案。

---

## 名词

### Transcript

完整对话记录。只追加，不修改，不删除。

### Effective Context

每次请求时真正发送给模型的消息序列。

### Stable Prefix

对缓存最重要、尽量不变的前缀层。

### Context Snapshot

一次 compaction 之后生成的结构化记忆快照。

### Story State

从 `novels / outlines / characters / chapters / worldBuilding` 等核心表拼出来的当前故事状态。

---

## 分层模型

上下文按“稳定 -> 变化”的顺序组装：

1. 固定 persona 和运行时策略
2. 固定 tool definitions
3. 项目级规则和技能约束
4. 压缩后的记忆块
5. 当前故事状态块
6. 最近的原始对话尾巴
7. 当前用户输入

### 为什么这样排

- 越稳定的内容越靠前，越能保住前缀缓存。
- 变化最频繁的内容放后面，避免每次改写都打碎整段 prefix。
- `story state` 仍然由数据库拼装，不由压缩层“发明”。
- `memory` 只保存对话中沉淀出的稳定偏好、决策和未决事项，不充当事实唯一来源。

---

## 配置

建议把上下文预算放进模型配置，而不是写死在 Agent 逻辑里。

```ts
interface ModelConfig {
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
```

### 默认建议

- `compactionTriggerRatio = 0.70`
- `compactionTargetRatio = 0.20`
- `outputReserveTokens` 按模型能力单独配置
- `summaryModelId` 可选，不填则回退到主模型

### 预算公式

```ts
promptBudget = contextWindowTokens - outputReserveTokens
triggerAt = promptBudget * compactionTriggerRatio
targetAt = promptBudget * compactionTargetRatio
```

系统只会在 `estimatedInputTokens >= triggerAt` 时触发自动压缩；压缩完成后，目标是把估算值压到 `targetAt` 附近或更低。

### token 估算

- 触发判断使用“估算输入 token”，不是上一次调用的历史 usage。
- 优先使用 provider / model 对应的 tokenizer。
- 如果 provider 不提供 tokenizer，就使用本地确定性的 fallback 估算器。
- 估算器要记录最近几轮的实际 `promptTokens`，并用偏差做校准。
- 估算值必须稳定，不能因为 UI 侧格式变化而频繁抖动。

---

## 触发策略

### 自动触发

- 只在 turn 结束后、下一次 `buildContext()` 之前触发。
- 只在安全边界触发，不能在流式输出中途触发。
- 如果当前 turn 还在执行 tool call，必须等当前 turn 完成。
- 如果估算值接近硬上限，先压缩，再发起下一次模型调用。

### 手动触发

- Agent 页面提供“整理上下文”入口。
- 用户可以补充整理指令，例如“重点保留角色动机和已确认设定”。
- 手动触发同样只在安全边界执行。
- 手动触发的目标比例默认与自动一致，也允许后续扩展为用户自定义目标。

### 触发原则

- compaction 是低频 reset，不是持续修边。
- 只有估算上下文快满时才压缩一次。
- 压缩后继续 append，直到再次接近阈值。

---

## Worker 协议

手动 compact 的入口需要落成一个独立请求，而不是复用 `start_turn`。

### 请求

- `compact_context`
- payload 至少包含 `novelId`、`correlationId`、`reason`
- 手动触发时可以附加 `instructions`

### 响应

- `compact` 的 `stage = queued` 表示请求已受理，但要等当前 turn 结束
- `compact` 的 `stage = started` 表示已经进入压缩
- `compact` 的 `stage = done` 表示快照已经落盘
- `compact` 的 `stage = failed` 表示压缩失败，当前快照保持不变

### 排队规则

- 如果当前有 in-flight turn，压缩请求排队，不直接拒绝。
- 如果已有待执行的 compact 请求，新请求覆盖旧请求的 `instructions`。
- 如果压缩失败，下一次 turn 仍然可以再次发起 compact。

---

## 压缩流程

### 1. 选择候选范围

- 从完整 transcript 中选择“已完成且较旧”的消息。
- 永远不切断 assistant 的 `tool_use` 与 tool result 配对。
- 当前 in-flight turn 不进入压缩输入。
- 最近的若干完整 turn 作为 raw tail 保留。

### 2. 提取稳定信息

压缩输出不是单一长摘要，而是结构化记忆：

- 用户偏好
- 已确认的故事决策
- 被拒绝的方向
- 未解决的问题
- 重要的推理理由
- 仍需保留的故事约束

### 3. 归一化

- 去重。
- 合并同义表述。
- 保持字段顺序稳定。
- 优先保留明确指令，低优先级内容可以被省略。

### 3.5 序列化约定

- 先 `validate`，再 `normalize`，最后 `serialize`。
- `story state` 和 `memory` 必须使用固定字段顺序。
- 不允许通过对象 key 的自然遍历顺序拼接 prompt。
- `serializerVersion` 和 `promptTemplateVersion` 必须写入快照，方便以后升级模板而不破坏旧快照。

### 4. 写入快照

- 生成新的 `ContextSnapshot`。
- 保留源消息 ID，方便追溯。
- 快照是 append-only 的版本化记录，不覆盖原 transcript。

### 5. 重建有效上下文

- 用新的快照 + 当前故事状态 + raw tail 重新组装 prompt。
- 下一次请求直接使用新上下文。

---

## 数据模型

### 记忆条目

```ts
interface MemoryEntry {
  text: string
  sourceMessageIds: string[]
}
```

### 结构化记忆

```ts
interface CompactedMemory {
  userPreferences: MemoryEntry[]
  acceptedDecisions: MemoryEntry[]
  rejectedDirections: MemoryEntry[]
  unresolvedQuestions: MemoryEntry[]
  importantRationales: MemoryEntry[]
  storyConstraints: MemoryEntry[]
  narrativeSummary?: string
}
```

### 上下文快照

```ts
interface ContextSnapshot {
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
```

### 存储建议

- `conversations` 继续保存完整 transcript。
- 新增 `contextSnapshots` 存储当前有效上下文版本。
- `contextSnapshots` 采用 append-only 版本化记录，`revision` 递增。
- `buildContext()` 只读取同一 `novelId + scopeId` 下 `revision` 最大的快照。
- 如果未来引入多 agent，`scopeId` 直接使用子 agent id，避免再迁移表结构。

---

## 与故事数据库的边界

这层系统有一个硬边界：

- `tools` 负责更新 canonical story stores。
- `contextSnapshots` 只负责保存 conversational memory。
- `story state` 永远从数据库重建，不从 memory 反推。

也就是说，如果一个信息已经足够稳定，应该优先通过工具写进大纲、角色、世界观或章节表，而不是只依赖摘要记住它。

---

## Worker / UI 约定

- `compact` 是一个系统事件，不是聊天正文。
- 自动 compact 完成后，UI 只展示轻量提示或状态标识。
- 手动 compact 可以在页面上显示结果摘要，但不应把摘要当成普通 assistant 文本插入 transcript。
- Agent 顶部建议增加一个上下文预算条，显示当前估算占用、阈值和目标比例。
- 当 compaction 正在执行时，输入框应保持可见，但新回合应排队到压缩完成后再发送。

---

## 失败与降级

- 如果压缩模型失败，保留原快照，继续使用 transcript + raw tail。
- 如果估算值仍然超过硬上限，禁止发起模型请求，并提示用户切换更大的模型或手动整理。
- 如果快照写入成功但后续重建失败，必须回滚到上一个快照版本。
- 任何情况下都不能把“半截压缩结果”当成正式上下文使用。

---

## 多 Agent 兼容

- 每个 agent 维护自己的 snapshot。
- 主 agent、写作 agent、审阅 agent 彼此隔离，不共享 transcript。
- 它们共享同一套 canonical story stores，因此 compaction 不会改变故事事实来源。

---

## 验收标准

- 触发比例和目标比例可以在模型配置中单独设置。
- 自动 compact 只会在安全边界发生。
- 手动 compact 始终可用。
- 完整 transcript 始终保留。
- 刷新页面后，消息顺序和快照状态一致。
- 同一前缀在未变更时应保持稳定序列，不被频繁重写。

---

## 与当前实现的关系

当前代码和 `06-context-management.md` 描述的是“尚未引入自动压缩”的现状。

这份文档定义的是后续要落地的目标方案。实现时，应优先保持：

- transcript 追加式存储
- `assistant.parts` 作为顺序唯一来源
- story state 与 conversational memory 分层
- 压缩只改 effective context，不改原始历史

