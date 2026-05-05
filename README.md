<div align="center">

# StoryClaw

**An Agent-Driven Platform for Creating and Reading Short Stories**

Describe your story idea in natural language, and the AI Agent handles the rest. You just read and give feedback.

[Quick Start](#quick-start) · [Features](#features) · [Architecture](#architecture) · [Development](#development)

[中文](./README.zh.md) · [English](./README.md)

</div>

---

## Why StoryClaw

Traditional AI writing tools position the user as an "editor" — you have to manually tweak outlines, characters, and chapter structures. But most people just want to say "write me a cyberpunk short story about a down-and-out detective" and read a good tale.

StoryClaw hands full creative control to the Agent. The user is only responsible for **imagining, reading, and giving feedback**.

**Core positioning:**

- Focus on short to medium-length fiction (up to 50,000 words), no novels
- Agent handles all writing; users never manually edit text
- Reading experience first, not editor-first
- Natural language interaction, not form-filling

---

## Features

### AI Agent Writing Engine

- **Fully automated pipeline** — Agent autonomously designs outlines, characters, worldbuilding, and chapters, then writes the story
- **Streaming output** — Chapter content streams token by token in real time, WYSIWYG
- **Tool system** — Built-in tools for outline management, character creation, chapter planning, worldbuilding, style configuration, and more
- **Context management** — Four-layer structured context + automatic compaction, no information loss in long conversations
- **OpenAI compatible** — Works with any OpenAI-compatible API (DeepSeek, Ollama, local models, etc.)

### Immersive Reading Experience

- **Carefully crafted reader** — Adjustable font, font size, line spacing, and page width
- **Multiple themes** — Light / Dark / Eye-care + custom background images
- **Reading progress tracking** — Automatically saves your position, pick up where you left off

### Local-First Architecture

- **Runs entirely in the browser** — All data stored in IndexedDB, no server required
- **PWA support** — Installable on desktop; read your stories offline
- **Privacy & security** — Your stories and conversations never leave your device

### More Capabilities

- **Prompt management** — Built-in + custom prompt templates to tailor Agent behavior
- **Operation history** — Undo/redo support (up to 50 steps)
- **Token usage statistics** — Real-time API consumption tracking

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Browser                         │
│                                                   │
│  ┌──────────┐  postMessage  ┌──────────────────┐ │
│  │          │ ◄────────────► │   Agent Engine   │ │
│  │  Vue 3   │               │   (Web Worker)   │ │
│  │  UI      │               │                  │ │
│  │          │  ┌─────────┐  │  ┌────────────┐  │ │
│  └────┬─────┘  │ Indexed │  │  │ LLM Client │  │ │
│       │        │   DB    │  │  │ (OpenAI)   │  │ │
│       ▼        └─────────┘  │  └────────────┘  │ │
│  ┌──────────┐               │  ┌────────────┐  │ │
│  │  Pinia   │               │  │   Tools    │  │ │
│  │  Stores  │               │  │  (7 tools) │  │ │
│  └──────────┘               │  └────────────┘  │ │
│                             └──────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Agent Workflow

```
User message → Context build → Token check → LLM call (stream) → Tool execution → Loop (≤15) → Reply
                                    │
                           Token ≥ 85%
                               ▼
                       Auto Compaction
                   (keeps last 3 turns)
```

### Tech Stack

| Layer     | Technology                             |
| --------- | -------------------------------------- |
| Framework | Vue 3 + TypeScript + Composition API   |
| Styling   | Tailwind CSS v4 + shadcn-vue           |
| Build     | Vite + pnpm workspace                  |
| Storage   | IndexedDB (via idb)                    |
| AI        | OpenAI SDK (any OpenAI-compatible API) |
| State     | Pinia                                  |
| Router    | Vue Router                             |
| Lint      | oxlint + oxfmt                         |
| PWA       | vite-plugin-pwa                        |

---

## Project Structure

```
storyclaw/
├── apps/
│   ├── web/src/
│   │   ├── agent/              # Agent engine
│   │   │   ├── loop.ts         # Main loop: context → LLM → tool execution
│   │   │   ├── context.ts      # Four-layer structured context management
│   │   │   ├── llm-client.ts   # OpenAI SDK wrapper (streaming)
│   │   │   ├── tools/          # 7 tools: outline, character, chapter, worldbuilding, style…
│   │   │   ├── skills/         # Skill preset system
│   │   │   ├── hooks/          # Agent lifecycle hooks
│   │   │   └── multi-agent/    # Multi-agent coordination (Phase 3)
│   │   ├── db/                 # IndexedDB data layer (12 object stores)
│   │   ├── views/              # Pages: bookshelf, story detail, reader, settings, admin
│   │   ├── components/         # Shared components: layout, reader, 20+ shadcn-vue components
│   │   ├── composables/        # Reusable composable functions
│   │   ├── stores/             # Pinia state management
│   │   ├── lib/                # Utilities: API client, sync logic
│   │   └── router/             # Route configuration
│   └── backend/                # Rust + Axum backend
│       ├── Cargo.toml
│       └── src/
│           ├── main.rs
│           ├── routes/         # Routes: auth, novels, llm, admin
│           ├── models/         # Data models
│           ├── auth/           # Authentication: JWT, password hashing, middleware
│           ├── sync/           # Novel sync (LWW strategy)
│           ├── llm/            # LLM proxy (SSE streaming relay)
│           └── admin/          # Admin endpoints
├── docs/designs/               # 8 detailed design documents
└── TODO.md                     # Development roadmap
```

---

## Quick Start

### Prerequisites

- Node.js ≥ 18
- pnpm ≥ 8
- An OpenAI-compatible API Key (works with DeepSeek, Ollama, etc.)

Optional backend:

- Rust (latest stable)
- PostgreSQL ≥ 14
- Redis (caching & rate limiting)

### Installation & Running

```bash
# Clone the repository
git clone https://github.com/lovezhangchuangxin/storyclaw.git
cd storyclaw

# Install frontend dependencies
pnpm install

# Start the frontend dev server
pnpm dev
```

Open `http://localhost:5173` in your browser. Go to settings to configure your API Key and model endpoint — then you're ready to go.

#### Optional: Start the Backend

```bash
# Configure environment variables
cp apps/backend/.env.example apps/backend/.env
# Edit apps/backend/.env with your database connection details

# Start the backend
cd apps/backend && cargo run --bin storyclaw-backend
```

### Docker Deployment

The easiest way to deploy the full stack (frontend + backend + PostgreSQL + Redis):

```bash
# Configure environment variables
cp .env.docker.example .env
# Edit .env — set DOMAIN, JWT_SECRET, MODEL_ENCRYPTION_KEY, and CORS_ORIGIN
# Generate secrets:
#   openssl rand -base64 48     (for JWT_SECRET)
#   openssl rand -hex 32        (for MODEL_ENCRYPTION_KEY)
# Set CORS_ORIGIN to https://your-domain.com

# Start all services
docker compose up -d

# Create an admin user (interactive)
docker compose exec -it backend /app/create_admin
```

Open `https://your-domain.com/storyclaw/` in your browser. Go to Settings → Server Connection and enter `https://your-domain.com/storyclaw` as the backend URL.

Caddy automatically provisions and renews HTTPS certificates via Let's Encrypt.

| Service     | Image                       | Port            |
| ----------- | --------------------------- | --------------- |
| Caddy       | caddy:2-alpine              | 80, 443         |
| Web (nginx) | Custom (node → nginx)       | internal        |
| Backend     | Custom (rust → debian-slim) | 3000 (internal) |
| PostgreSQL  | postgres:16-alpine          | 5432 (internal) |
| Redis       | redis:7-alpine              | 6379 (internal) |

### Build from Source

```bash
pnpm build      # Frontend: type check + production build
pnpm preview    # Preview the frontend build

cd apps/backend && cargo build --release  # Backend: production build
```

---

## Roadmap

### Phase 1 — Frontend MVP ✅ (In Progress)

- [x] Vue 3 + Tailwind CSS v4 + shadcn-vue scaffold
- [x] IndexedDB data layer (11 stores)
- [x] Routing & page layout
- [x] Immersive reader
- [x] Agent engine + tool system
- [x] Context management + Compaction
- [x] Multiple themes + custom backgrounds
- [x] PWA support
- [ ] Web Worker integration

### Phase 2 — Agent Enhancement

- [ ] Skills preset system
- [ ] More themes & custom theme editor
- [ ] PWA offline reading optimization
- [ ] Prompt marketplace

### Phase 3 — Backend + Multi-Agent ✅

- [x] Rust + Axum backend (signup/login, JWT auth, LWW data sync, LLM proxy)
- [x] PostgreSQL + Redis data layer
- [x] Frontend-backend integration (login/register pages, API client, auto-sync)
- [x] Admin dashboard (user management, novel management, statistics)
- [ ] Multi-agent coordination system

---

## Design Docs

The project includes 7 detailed design documents in [`docs/designs/`](docs/designs/):

1. **Product Overview** — Positioning, user journey, key differentiators
2. **Agent System** — Agent architecture, main loop, tool design
3. **UI/UX Design** — Design principles, information architecture, interaction specs
4. **Technical Architecture** — Frontend architecture, data flow, performance strategy
5. **Data Model** — IndexedDB schema, data relationships, storage strategy
6. **Context Management** — Four-layer context structure, caching strategy
7. **Context Compaction** — Compaction mechanism, token management

---

## Contributing

Contributions are welcome! You can:

- Submit an Issue to report bugs or suggest features
- Submit a Pull Request to contribute code
- Improve design docs or translations

## License

MIT License © 2026
