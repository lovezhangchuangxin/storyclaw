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
pnpm lint                     # oxlint 代码检查
pnpm format                   # oxfmt 代码格式化
pnpm format:check             # 检查代码格式（不修改）
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
│       │   ├── my/          # 我的/设置页
│       │   ├── story/       # 故事详情（阅读 + Agent 对话）
│       │   └── settings/    # 模型配置等
│       ├── components/      # 跨页面共享组件（layout/, reader/, ui/）
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
│       ├── locales/         # i18n 翻译文件（zh-CN.json, en-US.json）
│       ├── composables/     # 可复用组合式函数
│       ├── router/          # 路由定义
│       ├── i18n.ts          # vue-i18n 实例配置
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
- Token 达 70% 时自动 compact：保留最近 3 轮对话，压缩之前历史为摘要
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
- 通用布局组件放在 `components/layout/`
- 通过 `pnpm add` / `pnpm add -D` 安装依赖，不手动编辑 package.json
- API Key 明文存储于 IndexedDB
- **Vue 模板内联表达式**：避免在 `@click` 等指令中写多语句表达式（如 `@click="a; b"`），应抽取为方法。
  - 原因：oxfmt 会将长属性值拆成多行，多语句换行后 Vue 模板编译器无法解析。
  - 推荐：`@click="handleClick"` 或 `@click="() => { a; b }"`（箭头函数安全换行）
- `pnpm format`（oxfmt）不了解 Vue 模板语义，对 `<template>` 中内联 JS 表达式按纯文本格式化。

### 布局系统

- `AppLayout` + `AppSidebar` 提供统一的侧边栏 + 顶部导航栏布局
- 桌面端：左侧可折叠侧边栏（展开 216px ↔ 收起 60px），展开/收起按钮位于侧边栏 header 右侧
- 移动端：顶部 hamburger 按钮唤出浮层侧边栏，点击遮罩关闭，不影响内容布局
- 侧边栏收起状态持久化到 localStorage (`storyclaw:sidebar-collapsed`)
- 页面标题通过路由 `meta.title` 注入，由顶部导航栏渲染
- 所有页面统一使用 AppLayout + AppSidebar 布局，故事详情页和设置页通过 `meta.back` 显示返回按钮

### 多语言 (i18n)

- 使用 `vue-i18n`（Composition API 模式，`legacy: false`）
- 支持中文（`zh-CN`）和英文（`en-US`），默认跟随浏览器 `navigator.language`
- 语言偏好持久化到 `localStorage`（`storyclaw:locale`）和 IndexedDB（`AppConfig.locale`）
- 切换入口：我的页面（`/my`）的语言 Segmented Control
- 翻译文件：`src/locales/zh-CN.json`、`src/locales/en-US.json`（~250 个 key）
- i18n 实例：`src/i18n.ts`，Pinia store：`src/stores/locale.ts`

**使用方式：**

- **Vue 模板**：直接使用 `{{ $t('key') }}` 或 `:placeholder="$t('key')"` 等（`$t` 全局注册）
- **`<script setup>`**：`import { useI18n } from 'vue-i18n'` → `const { t } = useI18n()` → `t('key')`
- **纯 TS 模块**（不在组件内）：`import { i18n } from '@/i18n'` → `i18n.global.t('key')`
- **带参数**：`$t('key', { param: value })`（翻译文件中使用 `{param}` 占位）

**注意事项：**

- `defineProps()` 中不能引用 `<script setup>` 局部变量（编译器 hoist），需用 `i18n.global.t()`
- 路由 `meta.title` 已改为 i18n key（如 `'sidebar.bookshelf'`），由 AppLayout 自动翻译

### Docker 部署

- 4 个服务：web (nginx) + backend (Rust) + postgres + redis，通过 `docker-compose.yml` 编排
- 前端 nginx 同时做静态托管和 `/storyclaw/api/` 反向代理到 backend，避免跨域
- nginx 配置了 `proxy_buffering off` 支持 LLM SSE 流式传输
- 密钥通过 `.env` 文件注入，`${VAR:?msg}` 语法确保必要变量已设置
- `STORYCLAW_PRODUCTION=1` 启用时，`JWT_SECRET` 和 `MODEL_ENCRYPTION_KEY` 必须显式设置
- 创建管理员：`docker compose exec -it backend /app/create_admin`
- 部署文件：`.dockerignore`、`docker-compose.yml`、`.env.docker.example`、`apps/web/Dockerfile`、`apps/web/nginx.conf`、`apps/backend/Dockerfile`

### 开发任务

具体任务和进度见 `TODO.md`。
