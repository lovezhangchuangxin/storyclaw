<div align="center">

# StoryClaw

**Agent 驱动的中短篇小说创作与阅读平台**

用自然语言描述你的故事想法，AI Agent 为你完成全部创作，你只需阅读和反馈。

[快速开始](#快速开始) · [功能特性](#功能特性) · [技术架构](#技术架构) · [开发指南](#开发指南)

[中文](./README.zh.md) · [English](./README.md)

</div>

---

## 为什么做 StoryClaw

传统 AI 写作工具把用户定位为"编辑者"——需要手动调整大纲、角色、章节结构。但很多人其实只想说"给我写一个赛博朋克风格的短篇，主角是个落魄侦探"，然后读到一篇好故事。

StoryClaw 把创作权完全交给 Agent，用户只负责 **想象、阅读和反馈**。

**核心定位：**

- 专注中短篇小说（5 万字以内），不做长篇
- Agent 全权创作，用户不可手动编辑文本
- 阅读体验优先，而非编辑器优先
- 自然语言交互，而非表单填写

---

## 功能特性

### AI Agent 创作引擎

- **全流程自动化** — Agent 自主设计大纲、角色、世界观和章节，自动完成创作
- **流式输出** — 章节内容逐 token 实时呈现，所见即所得
- **工具系统** — 内置大纲管理、角色创建、章节规划、世界观构建、风格配置等工具
- **上下文管理** — 四层结构化上下文 + 自动 compaction，长对话不丢信息
- **OpenAI 兼容** — 支持任何 OpenAI 兼容 API（DeepSeek、Ollama、本地模型等）

### 沉浸式阅读体验

- **精心设计的阅读器** — 字体、字号、行间距、页宽全可调
- **多主题支持** — 亮色 / 暗色 / 护眼 + 自定义背景图片
- **阅读进度追踪** — 自动记录阅读位置，下次继续

### 本地优先架构

- **纯前端运行** — 所有数据存储在浏览器 IndexedDB，无需服务器
- **PWA 支持** — 可安装到桌面，离线也能阅读已创作的小说
- **隐私安全** — 你的故事和对话永远不离开你的设备

### 更多能力

- **提示词管理** — 内置 + 自定义提示词模板，定制 Agent 行为
- **操作历史** — 撤销/重做支持（最多 50 步）
- **Token 用量统计** — 实时追踪 API 消耗

---

## 技术架构

```
┌─────────────────────────────────────────────────┐
│                   浏览器                          │
│                                                   │
│  ┌──────────┐  postMessage  ┌──────────────────┐ │
│  │          │ ◄────────────► │   Agent Engine   │ │
│  │  Vue 3   │               │   (Web Worker)   │ │
│  │  UI 层   │               │                  │ │
│  │          │  ┌─────────┐  │  ┌────────────┐  │ │
│  └────┬─────┘  │ Indexed │  │  │ LLM Client │  │ │
│       │        │   DB    │  │  │ (OpenAI)   │  │ │
│       ▼        └─────────┘  │  └────────────┘  │ │
│  ┌──────────┐               │  ┌────────────┐  │ │
│  │  Pinia   │               │  │   Tools    │  │ │
│  │  Stores  │               │  │ (7 种工具)  │  │ │
│  └──────────┘               │  └────────────┘  │ │
│                             └──────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Agent 工作流

```
用户消息 → 上下文构建 → Token 检查 → LLM 调用(stream) → 工具执行 → 循环(≤15次) → 回复用户
                              │
                     Token ≥ 70% 时
                         ▼
                   自动 Compaction
                  (保留最近 3 轮对话)
```

### 技术栈

| 层级 | 技术                                 |
| ---- | ------------------------------------ |
| 框架 | Vue 3 + TypeScript + Composition API |
| 样式 | Tailwind CSS v4 + shadcn-vue         |
| 构建 | Vite + pnpm workspace                |
| 存储 | IndexedDB (via idb)                  |
| AI   | OpenAI SDK（兼容任意 OpenAI API）    |
| 状态 | Pinia                                |
| 路由 | Vue Router                           |
| Lint | oxlint + oxfmt                       |
| PWA  | vite-plugin-pwa                      |

---

## 项目结构

```
storyclaw/
├── apps/
│   ├── web/src/
│   │   ├── agent/              # Agent 引擎
│   │   │   ├── loop.ts         # 主循环：上下文构建 → LLM 调用 → 工具执行
│   │   │   ├── context.ts      # 四层结构化上下文管理
│   │   │   ├── llm-client.ts   # OpenAI SDK 封装（流式输出）
│   │   │   ├── tools/          # 7 种工具：大纲、角色、章节、世界观、风格…
│   │   │   ├── skills/         # Skill 预设系统
│   │   │   ├── hooks/          # Agent 生命周期钩子
│   │   │   └── multi-agent/    # 多 Agent 协调（Phase 3）
│   │   ├── db/                 # IndexedDB 数据层（12 个 object store）
│   │   ├── views/              # 页面：书架、故事详情、阅读器、设置、管理后台
│   │   ├── components/         # 共享组件：布局、阅读器、20+ shadcn-vue 组件
│   │   ├── composables/        # 可复用组合式函数
│   │   ├── stores/             # Pinia 状态管理
│   │   ├── lib/                # 工具库：API 客户端、同步逻辑
│   │   └── router/             # 路由配置
│   └── backend/                # Rust + Axum 后端
│       ├── Cargo.toml
│       └── src/
│           ├── main.rs
│           ├── routes/         # 路由：auth, novels, llm, admin
│           ├── models/         # 数据模型
│           ├── auth/           # 认证：JWT, 密码哈希, 中间件
│           ├── sync/           # 小说同步（LWW 策略）
│           ├── llm/            # LLM 代理（SSE 流式透传）
│           └── admin/          # 管理端点
├── docs/designs/               # 8 份详细设计文档
└── TODO.md                     # 开发路线图
```

---

## 快速开始

### 前提条件

- Node.js ≥ 18
- pnpm ≥ 8
- 一个 OpenAI 兼容的 API Key（支持 DeepSeek、Ollama 等）

可选后端：

- Rust（最新 stable）
- PostgreSQL ≥ 14
- Redis（缓存与速率限制）

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/lovezhangchuangxin/storyclaw.git
cd storyclaw

# 安装前端依赖
pnpm install

# 启动前端开发服务器
pnpm dev
```

浏览器打开 `http://localhost:5173`，进入设置页面配置你的 API Key 和模型端点即可开始使用。

#### 可选：启动后端

```bash
# 配置环境变量
cp apps/backend/.env.example apps/backend/.env
# 编辑 apps/backend/.env 填入数据库连接等信息

# 启动后端
cd apps/backend && cargo run --bin storyclaw-backend
```

### Docker 部署

最简单的方式部署完整服务（前端 + 后端 + PostgreSQL + Redis）：

```bash
# 配置环境变量
cp .env.docker.example .env
# 编辑 .env — 设置 DOMAIN、JWT_SECRET、MODEL_ENCRYPTION_KEY 和 CORS_ORIGIN
# 生成密钥：
#   openssl rand -base64 48     （用于 JWT_SECRET）
#   openssl rand -hex 32        （用于 MODEL_ENCRYPTION_KEY）
# CORS_ORIGIN 设为 https://你的域名.com

# 启动所有服务
docker compose up -d

# 创建管理员账号（交互式）
docker compose exec -it backend /app/create_admin
```

浏览器打开 `https://你的域名.com/storyclaw/`，进入设置 → 服务器连接，填入 `https://你的域名.com/storyclaw` 作为后端地址。

Caddy 自动通过 Let's Encrypt 申请和续期 HTTPS 证书。

| 服务        | 镜像                        | 端口         |
| ----------- | --------------------------- | ------------ |
| Caddy       | caddy:2-alpine              | 80, 443      |
| Web (nginx) | 自定义 (node → nginx)       | 内部         |
| Backend     | 自定义 (rust → debian-slim) | 3000（内部） |
| PostgreSQL  | postgres:16-alpine          | 5432（内部） |
| Redis       | redis:7-alpine              | 6379（内部） |

### 源码构建

```bash
pnpm build      # 前端：类型检查 + 生产构建
pnpm preview    # 预览前端构建产物

cd apps/backend && cargo build --release  # 后端：生产构建
```

---

## 开发路线

### Phase 1 — 前端 MVP ✅（进行中）

- [x] Vue 3 + Tailwind CSS v4 + shadcn-vue 基础搭建
- [x] IndexedDB 数据层（11 个 store）
- [x] 路由与页面布局
- [x] 沉浸式阅读器
- [x] Agent 引擎 + 工具系统
- [x] 上下文管理 + Compaction
- [x] 多主题 + 自定义背景
- [x] PWA 支持
- [ ] Web Worker 集成

### Phase 2 — Agent 增强

- [ ] Skills 预设系统
- [ ] 更多主题与自定义主题编辑器
- [ ] PWA 离线阅读优化
- [ ] 提示词市场

### Phase 3 — 后端 + 多 Agent ✅

- [x] Rust + Axum 后端服务（注册/登录、JWT 认证、LWW 数据同步、LLM 代理）
- [x] PostgreSQL + Redis 数据层
- [x] 前端后端集成（登录/注册页面、API 客户端、自动同步）
- [x] 管理后台（用户管理、小说管理、数据统计）
- [ ] 多 Agent 协作系统

---

## 设计文档

项目包含 7 份详细设计文档，位于 [`docs/designs/`](docs/designs/)：

1. **产品概述** — 产品定位、用户旅程、核心差异化
2. **Agent 系统** — Agent 架构、主循环、工具设计
3. **UI/UX 设计** — 设计原则、信息架构、交互规范
4. **技术架构** — 前端架构、数据流、性能策略
5. **数据模型** — IndexedDB schema、数据关系、存储策略
6. **上下文管理** — 四层上下文结构、缓存策略
7. **上下文压缩** — Compaction 机制、Token 管理

---

## 贡献

欢迎贡献！你可以：

- 提交 Issue 反馈 Bug 或建议新功能
- 提交 Pull Request 贡献代码
- 完善设计文档或翻译

## 许可证

MIT License © 2026
