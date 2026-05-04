# 04 — 技术架构

## 整体架构

```
┌──────────────────────────────────────────────────────────┐
│                    Frontend (Monorepo)                    │
│                                                          │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────┐   │
│  │  Vue3 App  │  │  Web Worker│  │   Service Worker │   │
│  │  (主线程)   │  │ (Agent Loop)│  │   (PWA Cache)   │   │
│  └─────┬──────┘  └──────┬─────┘  └──────────────────┘   │
│        │                │                                 │
│        │     postMessage│                                 │
│        │       token流   │                                 │
│        ▼                ▼                                 │
│  ┌──────────────────────────────┐                        │
│  │        IndexedDB              │                        │
│  │  (novels, chapters, conversations, contextSnapshots, config)  │
│  └──────────────────────────────┘                        │
│        │                                                 │
│        │  openai SDK (直连模型 API 或 后端代理)            │
│        ▼                                                 │
│  ┌─────────────────────┐                                 │
│  │  OpenAI 兼容 API    │                                 │
│  │  (直连 或 via 后端) │                                 │
│  └─────────────────────┘                                 │
└──────────────────────────────────────────────────────────┘
         │
         │ 可选连接
         ▼
┌──────────────────────────────────────────────────────────┐
│                    Backend (Rust + Axum)                  │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │  Auth    │  │  Sync    │  │  LLM     │               │
│  │ (JWT)    │  │ (REST)   │  │  Proxy   │               │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘               │
│       │             │             │                      │
│       ▼             ▼             ▼                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │PostgreSQL│  │  Redis   │  │  LLM API │               │
│  └──────────┘  └──────────┘  └──────────┘               │
└──────────────────────────────────────────────────────────┘
```

## 前端技术栈

| 层级       | 技术                    | 说明                                        |
| ---------- | ----------------------- | ------------------------------------------- |
| 框架       | Vue 3 + Composition API | 单页应用                                    |
| 构建       | Vite                    | 快速开发与构建                              |
| UI 组件    | shadcn-vue              | 无头组件库，基于 Radix Vue                  |
| 样式       | Tailwind CSS v4         | 原子化 CSS，shadcn-vue 已支持 v4            |
| PWA        | vite-plugin-pwa         | Service Worker 生成                         |
| 本地存储   | IndexedDB (via idb)     | 小说、章节、配置                            |
| Agent 引擎 | 自实现 (Web Worker)     | Agent Loop + Tools + Skills                 |
| 模型客户端 | `openai` npm package    | OpenAI 兼容接口，内置 streaming、tool calls |
| 路由       | Vue Router              | SPA 路由                                    |
| 状态管理   | Pinia                   | 全局状态                                    |

### Monorepo 结构

```
storyclaw/
├── package.json              (workspace root)
├── pnpm-workspace.yaml
├── apps/
│   ├── web/                  (Vue3 前端)
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.ts
│   │       ├── App.vue
│   │       ├── router/
│   │       ├── stores/       (Pinia)
│   │       ├── db/           (IndexedDB)
│   │       ├── agent/        (Agent 引擎)
│   │       │   ├── loop.ts
│   │       │   ├── context.ts
│   │       │   ├── tools/
│   │       │   ├── skills/
│   │       │   ├── hooks/
│   │       │   ├── multi-agent/
│   │       │   └── llm-client.ts
│   │       ├── components/
│   │       │   ├── reader/
│   │       │   ├── creation/
│   │       │   ├── shelf/
│   │       │   ├── settings/
│   │       │   └── ui/       (shadcn-vue)
│   │       ├── composables/
│   │       ├── lib/
│   │       └── assets/
│   └── backend/              (Rust 后端)
│       ├── Cargo.toml
│       └── src/
│           ├── main.rs
│           ├── routes/
│           ├── models/
│           ├── auth/
│           └── sync/
```

## 后端技术栈

| 层级     | 技术                   | 说明                                     |
| -------- | ---------------------- | ---------------------------------------- |
| 框架     | Axum                   | 异步 HTTP 框架                           |
| ORM      | SeaORM / sqlx          | 数据库操作                               |
| 数据库   | PostgreSQL             | 主数据库                                 |
| 缓存     | Redis                  | Session、速率限制                        |
| 认证     | JWT (access + refresh) | 无状态认证                               |
| LLM 代理 | `async-openai` crate   | 转发模型请求，兼容所有 OpenAI 接口提供商 |

### API 设计

```
POST   /api/auth/register        — 注册
POST   /api/auth/login           — 登录
POST   /api/auth/refresh         — 刷新 token

GET    /api/novels               — 获取用户的小说列表（分页）
POST   /api/novels/:id/push    — 推送小说到后端
GET    /api/novels/:id/pull    — 从后端拉取小说
DELETE /api/novels/:id         — 删除小说

POST   /api/llm/chat             — LLM 代理（透传 OpenAI 格式）
GET    /api/health               — 健康检查

GET    /api/admin/users          — [管理员] 用户列表（分页）
GET    /api/admin/users/:id      — [管理员] 用户详情
GET    /api/admin/novels         — [管理员] 所有小说（分页）
GET    /api/admin/stats          — [管理员] 统计数据
```

## LLM 客户端选型

### 前端：`openai` npm package

使用 OpenAI 官方 JS SDK，而非自行封装 fetch：

- 内置流式响应（`stream: true`），通过 `for await (const chunk of stream)` 逐 token 消费
- 内置 tool calls 处理，自动解析 `tool_calls` 并支持提交 tool results
- 支持自定义 `baseURL`，可对接任何 OpenAI 兼容接口（DeepSeek、Qwen、OpenRouter、Ollama 等）
- 类型完备，TypeScript 原生支持
- 在 Web Worker 中直接使用，不需要适配层

```typescript
import OpenAI from 'openai'

const client = new OpenAI({
  baseURL: config.apiBase, // 用户配置的兼容 endpoint
  apiKey: config.apiKey,
  dangerouslyAllowBrowser: true, // 浏览器端使用
})

const stream = await client.chat.completions.create({
  model: config.model,
  messages,
  tools,
  stream: true,
})
```

Agent 框架通过 `llm-client.ts` 封装 `openai` SDK，提供统一的 chat、stream、tool call 接口和错误重试逻辑。

### 后端：`async-openai` crate

使用 Rust 社区最成熟的 OpenAI 异步库：

- 基于 OpenAPI spec 自动生成，接口完整
- 天然支持 Axum 的 async 生态（tokio-based）
- 支持自定义 `baseURL` 对接任何 OpenAI 兼容接口
- 内置 SSE streaming 处理
- 配置简单，通过环境变量或代码配置 API key 和 endpoint

```rust
use async_openai::{Client, config::OpenAIConfig};

let config = OpenAIConfig::new()
    .with_api_base("https://api.deepseek.com/v1")
    .with_api_key("sk-...");

let client = Client::with_config(config);
```

后端 LLM 代理路由将前端请求原样转发给 `async-openai` client，流式透传响应。

## PWA 架构

```
┌───────────────────────────────┐
│        Service Worker         │
│                               │
│  Cache Strategy:              │
│  - App Shell: Cache First     │
│  - 静态资源: Cache First      │
│  - 章节内容: Cache First      │
│  - API: Network First         │
│                               │
│  Offline Support:             │
│  - 已缓存的章节离线可读       │
│  - Agent 功能需要网络         │
│  - 本地操作（主题/设置）离线  │
└───────────────────────────────┘
```

PWA Manifest 配置：

- `display: standalone` — 独立窗口
- `theme_color` — 跟随应用主题变化
- 图标适配各尺寸
- 快捷方式：新故事、继续阅读

## 安全设计

### 前端安全

- API Key 明文存储在 IndexedDB，不经过后端（直连模式）
- 敏感数据不写入 localStorage（易被 XSS 读取）
- CSP 头限制可执行脚本来源

### 后端安全

- 密码使用 argon2 哈希
- JWT access token 短期有效（15min），refresh token 长期
- CORS 白名单
- 速率限制（登录、LLM 代理）
- 管理员接口独立鉴权

## 测试策略

| 层级     | 工具                     | 范围                                               |
| -------- | ------------------------ | -------------------------------------------------- |
| 单元测试 | Vitest                   | Tool 执行函数、Context 构建、消息回放与状态迁移    |
| 组件测试 | Vitest + @vue/test-utils | 阅读器渲染、主题切换、Agent 消息卡片顺序与状态显示 |
| E2E      | Playwright               | 完整用户旅程：创建故事 → Agent 创作 → 阅读         |
| API 测试 | Rust test + reqwest      | 后端路由、认证、同步逻辑                           |

CI/CD：GitHub Actions，lint + format:check + build + deploy to Pages。

## 依赖安装

所有依赖通过包管理工具安装，不手动编辑 `package.json` 或 `Cargo.toml`：

```bash
# 前端
pnpm add openai idb pinia vue-router
pnpm add -D vite-plugin-pwa tailwindcss @tailwindcss/vite

# shadcn-vue 组件按需添加
npx shadcn-vue@latest add button

# 后端
cargo add axum tokio serde sqlx async-openai jsonwebtoken argon2
```
