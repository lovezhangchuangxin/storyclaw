# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

StoryClaw 是一个 Agent 驱动的中短篇小说创作与阅读 Web 应用。用户通过自然语言描述需求，Agent 自动设计大纲、角色、章节并创作。用户不可手动编辑小说，一切由 Agent 生成，用户只阅读和反馈。

## 常用命令

```bash
pnpm install                  # 安装所有依赖
pnpm --filter web dev         # 启动前端开发服务器（Vite）
pnpm --filter web build       # 类型检查 + 构建
pnpm --filter web preview     # 预览构建产物
pnpm --filter web add <pkg>   # 给前端添加依赖
pnpm --filter web add -D <pkg>  # 添加开发依赖
```

## 技术栈

- **前端**: Vite + Vue 3 (Composition API) + TypeScript + Tailwind CSS v4 + shadcn-vue
- **构建工具**: pnpm monorepo (workspace)
- **本地存储**: IndexedDB (via `idb` 库)
- **模型调用**: `openai` npm package（支持自定义 baseURL 对接任何 OpenAI 兼容接口）
- **状态管理**: Pinia
- **路由**: Vue Router (SPA, history mode)
- **后端 (Phase 3)**: Rust + Axum + PostgreSQL + Redis + `async-openai`

## 项目结构

```
storyclaw/
├── apps/web/                # 前端应用
│   └── src/
│       ├── views/           # 页面组件，按页面分目录，每目录含 components/ 放页面专属组件
│       │   ├── home/        # 书架页
│       │   ├── create/      # 创作入口页
│       │   ├── my/          # 我的/设置页
│       │   ├── story/       # 故事详情（阅读 + Agent 对话）
│       │   └── settings/    # 模型配置等
│       ├── components/      # 跨页面共享组件（reader/, ui/）
│       ├── agent/           # Agent 引擎（Web Worker 中运行）
│       │   ├── loop.ts      # Agent 主循环
│       │   ├── context.ts   # 上下文管理与 compaction
│       │   ├── llm-client.ts # 封装 openai SDK
│       │   ├── tools/       # Agent 工具
│       │   ├── skills/      # Skills 预设
│       │   ├── hooks/       # Agent 生命周期 hooks
│       │   └── multi-agent/ # 多 Agent 协调
│       ├── db/              # IndexedDB 数据访问层
│       ├── stores/          # Pinia stores
│       ├── composables/     # 可复用组合式函数
│       ├── router/          # 路由定义
│       └── lib/             # 工具函数
└── docs/designs/            # 详细设计文档（6 份）
```

## 核心架构决策

### Agent 引擎

- Agent 运行在 Web Worker 中，通过 `postMessage` 与主线程通信
- 主循环：`context.build → compact → llm.chat(stream) → parse response → tool calls loop`
- 最大 tool-call 迭代 15 次/轮，支持用户随时取消
- 流式 tool（write_chapter）通过 `tool_stream_token` 消息逐 token 推送到 UI
- Token 使用量从 API 响应 `usage.prompt_tokens` 获取，不做字符估算

### 上下文策略

- 采用 append-only 前缀匹配策略提高缓存命中率（DeepSeek 等均已支持）
- 四层结构：persona → tools → story state → style → conversation → user message
- Token 达 85% 时自动 compact：保留最近 3 轮对话，压缩之前历史为摘要
- Compaction 尊重 tool-call 边界，不切断 tool-call/result 配对

### 数据存储

- 主存储：IndexedDB，8 个 object stores（novels, outlines, characters, chapters, worldBuilding, conversations, config, operationHistory）
- 每本小说 = 一个会话，不可并行
- undo/redo 基于操作历史栈，最多 50 条记录
- 后端连接是可选的，纯前端即可正常使用

### 前端约定

- `@/` 路径别名指向 `src/`
- views 目录：一个页面一个文件夹，内部 components/ 放页面专属业务组件
- shadcn-vue 组件放在 `components/ui/`
- 通过 `pnpm add` / `pnpm add -D` 安装依赖，不手动编辑 package.json
- API Key 明文存储于 IndexedDB

### 开发任务

具体任务和进度见 `TODO.md`。
