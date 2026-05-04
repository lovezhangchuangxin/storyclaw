# 02 — Agent 系统设计

## 概述

Agent 系统是整个应用的大脑，运行在前端（Web Worker 中）。它是一个自定义实现的 Agent 框架，兼容 OpenAI 接口，集成了 Tools、Skills、Multi-Agent 和 Hooks 机制。

## Agent Loop 架构

```
┌─────────────────────────────────────────────────────┐
│                    Web Worker                        │
│                                                     │
│  ┌──────────┐   ┌──────────────┐   ┌────────────┐  │
│  │  Agent    │   │   Context    │   │    Tool     │  │
│  │  Loop     │◄──┤   Manager    │◄──┤  Executor   │  │
│  │(orchestr) │   │(cache+cmpt) │   │ (tool call) │  │
│  └────┬─────┘   └──────────────┘   └────────────┘  │
│       │                                              │
│       │  ┌──────────┐   ┌──────────┐                │
│       ├──┤  State   │   │  Skill   │                │
│       │  │ Manager  │   │  Manager │                │
│       │  └──────────┘   └──────────┘                │
│       │                                              │
│       │  ┌──────────┐   ┌──────────┐                │
│       ├──┤  Hook    │   │  Multi-  │                │
│       │  │  System  │   │  Agent   │                │
│       │  └──────────┘   └──────────┘                │
│       │                                              │
│  ┌────▼─────┐                                       │
│  │   LLM    │  ← `openai` SDK（streaming + tool calls）│
│  │  Client  │                                       │
│  └──────────┘                                       │
└─────────────────────────────────────────────────────┘
         │ postMessage (token stream)
         ▼
┌─────────────────┐
│   Main Thread   │
│   (Vue App)     │
│   UI + Reader   │
└─────────────────┘
```

## Agent Loop 核心流程

```
loop (max 15 tool-call iterations per turn):
  1. 检查取消标志，如果已取消 → 追加 status:cancelled 并结束
  2. ContextManager.build()     → 基于已持久化消息构建请求上下文
  3. LLMClient.chat()           → 发送请求，流式获取文本 / reasoning / tool call
  4. 将流式输出写入当前 assistant.parts，并实时推送给主线程渲染
  5. 如果模型返回 tool_call：
     - 执行 ToolExecutor.execute()
     - 将 tool result 写回当前 assistant message
     - 追加 tool result 到下一轮请求上下文
     - 如果迭代次数 < maxIterations → goto step 1
     - 否则 → 追加 warning 状态并终止
  6. 如果模型正常结束 → 将当前 assistant message 标记为 completed
  7. 如果取消 / 异常 / 截断 → 将当前 assistant message 标记为 cancelled / error / truncated
  8. 保存本轮 turn messages 到 conversation store
```

**安全机制：**

- `maxToolCalls` 默认 15，可在配置中调整
- 每轮迭代检查 `cancelToken`，支持用户随时中断
- 达到最大迭代次数时强制结束当前 turn，通知用户

## Tools 系统

Agent 通过 Tools 与故事状态交互。每个 Tool 是声明式定义 + 执行函数：

```typescript
interface Tool {
  name: string
  description: string
  parameters: JSONSchema
  execute(args: any, context: ToolContext): Promise<ToolResult>
}
```

### 核心 Tools

**大纲相关：**

- `create_outline` — 创建故事大纲（标题、梗概、三幕结构）
- `update_outline` — 修改大纲
- `get_outline` — 获取当前大纲

**角色相关：**

- `create_character` — 创建角色（姓名、外貌、性格、背景）
- `update_character` — 修改角色
- `delete_character` — 删除角色
- `get_character` — 获取单个角色详情
- `list_characters` — 列出所有角色

**章节相关：**

- `plan_chapters` — 规划章节划分和各章节概要
- `write_chapter` — 创作指定章节内容（流式，通过 tool_stream_token 推送）
- `rewrite_chapter` — 根据反馈重写章节（流式，通过 tool_stream_token 推送）
- `get_chapter` — 获取章节内容

**世界设定：**

- `set_world_building` — 设定世界观（时代、地点、规则等）
- `get_world_building` — 获取世界观设定

**文风控制：**

- `set_style` — 设定文风偏好（叙事视角、时态、语言风格等）
- `get_style` — 获取文风设定

**故事管理：**

- `upsert_story` — 创建新故事或更新已有故事信息。如果故事记录已存在则更新标题/简介，不存在则创建
- `get_story_status` — 获取当前故事整体状态
- `generate_title` — 根据内容生成标题
- `generate_synopsis` — 生成故事简介

## 用户命令（User Commands）

用户命令是用户在 UI 上主动触发的操作，对 Agent 透明——Agent 不知道也不参与命令执行。命令直接操作 IndexedDB 中的故事数据。

```typescript
interface UserCommand {
  name: string
  description: string
  execute(context: CommandContext): Promise<void>
  canUndo: boolean
}
```

### 核心命令

| 命令               | 说明                                   | 可撤销 |
| ------------------ | -------------------------------------- | ------ |
| `undo`             | 撤销最近一次数据变更（大纲/角色/章节） | —      |
| `redo`             | 重做最近一次撤销                       | —      |
| `revert_chapter`   | 回退某章节到上一个版本                 | 是     |
| `delete_character` | 从故事中移除某个角色                   | 是     |
| `reset_outline`    | 清空大纲，重新开始设计                 | 是     |

**撤销/重做机制：**

所有数据变更（tool 执行结果）推入一个操作历史栈：

```typescript
interface OperationRecord {
  id: string
  timestamp: number
  store: string // IndexedDB store 名
  key: any // 记录 key
  before: any // 变更前的数据快照
  after: any // 变更后的数据
}
```

操作历史保存在 IndexedDB 中。`undo` 恢复 `before` 快照，`redo` 重新应用 `after`。最多保留 50 条操作记录。

**重要：undo/redo 是前端数据层操作，不回退 conversation history。** 撤销大纲变更后，对话历史中的相关消息不会被删除——Agent 在下一轮会从当前 story state 重新理解上下文。

## Skills 系统

Skills 是预定义的 Agent 行为组合，本质是 Prompt 模板 + Tool 组合 + 约束。

```typescript
interface Skill {
  name: string
  description: string
  systemPrompt: string
  allowedTools: string[]
  constraints: SkillConstraint[]
}
```

### 预设 Skills

| Skill              | 说明                                           |
| ------------------ | ---------------------------------------------- |
| `brainstorm`       | 脑暴模式：发散思考，生成多种故事创意供用户选择 |
| `outline-design`   | 大纲设计：深入访谈式地帮助用户构建故事大纲     |
| `character-create` | 角色创建：访谈式创建角色，确保角色立体丰满     |
| `chapter-write`    | 章节创作：按照大纲和角色设定创作章节           |
| `chapter-rewrite`  | 章节重写：根据用户反馈重写指定章节             |
| `style-adjust`     | 文风调整：分析和调整文风                       |
| `ending-craft`     | 结局设计：专门设计结局的不同可能性             |

## Multi-Agent 系统

Multi-Agent 允许将任务派发给不同的子 Agent，每个子 Agent 有独立的 system prompt 和工具集。

```
Coordinator Agent（主编）
  ├── Outline Agent（大纲师）
  ├── Character Agent（角色设计师）
  ├── Writing Agent（写手）
  ├── Style Agent（文风师）
  └── Review Agent（审稿人）
```

子 Agent 之间通过 Coordinator 协调，不直接通信。

```typescript
interface SubAgent {
  name: string
  role: string
  systemPrompt: string
  tools: string[]
  model?: string // 可指定不同模型
}
```

### 上下文 Fork 机制

子 Agent 通过 **fork** 从 Main Agent 获取上下文，而非从零开始：

```
Main Agent context:
  [System: persona, tools, story state, style]
  [Conversation: ...history...]
  [Latest user message]

Fork for Writing Agent:
  [SubAgent's own system prompt]
  [Injected story state from Main Agent]  ← fork 过来的大纲/角色/章节摘要
  [Relevant conversation subset]          ← fork 过来的相关消息
  [Task-specific instruction]
```

Fork 策略：

- **Story State Fork**：子 Agent 总是获得当前最新的 story state（大纲摘要 + 角色列表 + 最近章节摘要）
- **Conversation Fork**：从主对话中提取与该子 Agent 任务相关的消息子集（例如 Writing Agent 获取最近的章节反馈）
- 子 Agent 完成后，其 tool calls 产生的状态变更合并回 Main Agent 的 state

## Hooks 系统

Hooks 是 Agent 生命周期中的回调点，允许插入自定义逻辑。

```
before:turn         — 每轮对话开始前
after:turn          — 每轮对话结束后
before:tool         — 工具调用前
after:tool          — 工具调用后
on:chapter-start    — 开始创作章节时
on:chapter-done     — 章节创作完成时
on:story-done       — 故事完成时
before:compact      — 上下文压缩前（仅在安全边界触发）
after:compact       — 上下文压缩后（快照落盘后触发）
on:max_iterations   — 达到最大迭代次数时
on:error            — 发生错误时
```

```typescript
interface Hook {
  event: string
  handler: (context: HookContext) => Promise<void>
  priority: number
}
```

Hooks 可以用于：

- 自动保存状态到 IndexedDB
- 记录操作历史（用于 undo/redo）
- 触发通知
- 在章节完成时自动生成摘要
- 在错误时重试或降级

## Agent Loop → Web Worker 通信

Worker 通过 `postMessage` 与主线程通信：

```
// Main → Worker
{ type: "start_turn", payload: { message, novelId, correlationId } }
{ type: "cancel_turn", payload: { correlationId } }
{ type: "compact_context", payload: { novelId, correlationId, reason, instructions? } }

// Worker → Main
{ type: "token", payload: { text, correlationId } }            // 流式文本
{ type: "tool_stream_token", payload: { text, toolCallId } }   // tool 内流式内容（如章节生成）
{ type: "tool_call", payload: { name, args, correlationId } }  // 工具调用开始
{ type: "tool_result", payload: { result, correlationId } }    // 工具调用结果
{ type: "status", payload: { state: "thinking"|"calling_tool"|"compacting" } }
{ type: "turn_done", payload: { correlationId } }              // 本轮完成
{ type: "turn_cancelled", payload: { correlationId } }         // 本轮被取消
{ type: "error", payload: { message, correlationId } }         // 错误
{ type: "compact", payload: { stage: "queued"|"started"|"done"|"failed", reason, beforeRatio?, afterRatio?, snapshotId?, message? } } // 压缩通知
```

**流式 tool 内容：** `write_chapter` 和 `rewrite_chapter` 这类流式 tool 在生成内容时，通过 `tool_stream_token` 将内容逐 token 推送到主线程，让用户实时看到章节内容生成过程。tool 执行完毕后发送 `tool_result` 表示完成。

**上下文压缩：** `compact_context` 是显式请求，Worker 在收到后会先返回 `stage: "queued"` 或 `stage: "started"`。如果当前有 in-flight turn，则压缩请求排队到安全边界执行；如果队列里已有未执行的 compact 请求，新请求会覆盖旧请求。`compact` 只在一轮结束后的安全边界触发，配合 `before:compact` / `after:compact` hooks 更新快照和 UI 提示，不会改写当前 in-flight 回合。

**取消机制：** 主线程发送 `cancel_turn` 后，Worker 在下一个检查点（每次 LLM 响应后、每次 tool 执行前）终止 loop，发送 `turn_cancelled`。已执行的 tool 结果保留，未执行的丢弃。

**correlationId：** 每次 `start_turn` 生成唯一 ID，所有响应消息携带该 ID，避免快速连续请求时的消息混淆。
