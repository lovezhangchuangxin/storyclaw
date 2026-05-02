# TODO

## Phase 1 — 纯前端 MVP

目标：Vite + Vue3 PWA，单 Agent 创作 + 阅读器，IndexedDB 存储，OpenAI 兼容模型直连。

### 1.1 项目基础设施
- [x] 初始化 shadcn-vue（`pnpm dlx shadcn-vue@latest init`）
- [x] 配置 Tailwind CSS v4（颜色、字体、阅读主题变量）
- [x] 安装 vite-plugin-pwa，配置 Service Worker 缓存策略
- [x] PWA manifest 与图标

### 1.2 IndexedDB 数据层 (`src/db/`)
- [x] 数据库初始化与 schema 迁移（9 个 object stores）
- [x] novels / outlines / characters / chapters / worldBuilding CRUD 封装
- [x] conversations 读写
- [x] config 与 readingProgress 读写
- [x] operationHistory 读写（undo/redo 栈）

### 1.3 路由与基础 UI
- [x] 底部 Tab Bar（书架 / 创建 / 我的）
- [x] 书架页：故事卡片列表 + 空状态
- [x] 创建页：故事创意输入 + 类型快速开始
- [x] 我的页：设置入口列表
- [x] 模型配置页：API 地址、Key、模型名、参数
- [x] 后端连接/登录页 UI

### 1.4 故事详情页 — 阅读器
- [x] 沉浸式阅读器布局（内容居中，最大宽度 680px）
- [x] 字体/字号/行高/段间距调节
- [x] 文字颜色 + 阅读背景色
- [x] 6 套预设阅读主题
- [x] 上下滚动 / 左右翻页 / 自动滚动
- [x] 底部热区唤出控制栏
- [x] 点击唤出章节目录
- [x] PC 键盘快捷键

### 1.5 Agent 引擎 (`src/agent/`)
- [x] `llm-client.ts`：封装 openai SDK，baseURL 可配，流式 + tool calls
- [x] `context.ts`：构建上下文，四层 structure，token 追踪（从 API 响应取）
- [x] `tools/`：create_outline, update_outline, get_outline
- [x] `tools/`：create_character, update_character, delete_character, get_character, list_characters
- [x] `tools/`：plan_chapters, write_chapter, rewrite_chapter, get_chapter
- [x] `tools/`：set_world_building, get_world_building
- [x] `tools/`：set_style, apply_style_to_chapter
- [x] `tools/`：get_story_status, generate_title, generate_synopsis
- [x] `loop.ts`：Agent 主循环（max 15 次 tool-call 迭代，取消检查，compact）
- [x] postMessage 通信协议定义（`worker-types.ts`）
- [ ] Web Worker 集成（当前主线程运行，Phase 2 迁移到 Worker）

### 1.6 故事详情页 — Agent 对话
- [x] 聊天式界面，结构化卡片（大纲/角色/章节计划）
- [x] 流式渲染 Agent 输出（token by token）
- [x] 底部输入框 + 发送/中断按钮
- [x] 用户命令入口（undo/redo/revert_chapter）
- [x] 阅读模式 ↔ Agent 模式右上角切换

---

## Phase 2 — Agent 增强

目标：Agent 迁移到 Web Worker，上下文优化，更多 tools，自定义主题完善。

- [ ] Agent Loop 迁移到 Web Worker（当前 Phase 1 先做主线程实现）
- [x] context compaction（缓存友好、低频触发、70%/20% 双阈值、tool-call 边界安全）
- [x] 上下文记忆快照与手动整理入口（`contextSnapshots` / `compact_context`）
- [ ] Skills 系统（brainstorm, outline-design, character-create, chapter-write, ending-craft）
- [ ] 更多预设阅读主题 + 用户自定义主题
- [ ] PWA 离线阅读完善（已生成章节离线可读）
- [ ] 自定义字体加载

---

## Phase 3 — 后端 + 多 Agent

目标：可选后端连接，多设备同步，管理员，完整 Agent 系统。

### 3.1 后端 (`backend/`)
- [ ] Rust + Axum 项目初始化
- [ ] PostgreSQL schema + sqlx migrations
- [ ] POST /api/auth/register, /api/auth/login, /api/auth/refresh
- [ ] GET /api/novels, POST /api/novels/:id/push, GET /api/novels/:id/pull, DELETE /api/novels/:id
- [ ] POST /api/llm/chat（async-openai 代理透传）
- [ ] GET /api/health
- [ ] JWT auth 中间件
- [ ] Redis 缓存与速率限制

### 3.2 前端后端集成
- [ ] 登录/注册页面对接后端 API
- [ ] 数据同步（LWW 策略，手动 + 自动 push）
- [ ] 后端 LLM 代理开关

### 3.3 管理后台
- [ ] GET /api/admin/users, GET /api/admin/novels, GET /api/admin/stats
- [ ] 前端管理后台页面（隐藏入口，仅管理员可见）

### 3.4 完整 Agent 系统
- [ ] Multi-Agent（Coordinator + Outline/Character/Writing/Style/Review Agent）
- [ ] 子 Agent 上下文 fork 机制
- [ ] Hooks 系统（before:turn, after:turn, before:tool, after:tool, on:chapter-done, on:error 等）

### 3.5 上下文管理设计同步
- [x] 将 [07 — 上下文压缩与记忆管理](docs/designs/07-context-compaction-and-memory.md) 的 schema 和协议落到实现
