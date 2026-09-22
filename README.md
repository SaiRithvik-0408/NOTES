# Nexus Notes — Local-First Intelligent Collaborative Workspace

![Nexus Notes Brand](/public/logo.svg)

> A production-grade, local-first collaborative notes platform blending the best of **Notion** (flexible blocks & slash commands), **Google Docs** (real-time CRDT multi-user editing & comments), **Obsidian** (interconnected backlinks & 3D knowledge graph), and **Linear** (high-speed keyboard shortcuts & offline mutation queue).

---

## 🚀 Key Features

- **True Offline-First Architecture**: Work completely offline with zero latency. Every stroke and mutation is recorded into IndexedDB and buffered in an idempotent mutation queue.
- **Dynamic Status Indicator**: Real-time feedback transitioning cleanly across:
  - `● Saved locally`
  - `☁ Syncing...`
  - `✓ Synced`
  - `⚠ Conflict detected`
- **TipTap / ProseMirror Rich Text Editor**: Headings, Callouts, Tables, Task Checklists, Code Blocks, Blockquotes, Backlinks (`[[Note Title]]`), Floating Bubble Menu, and `/` Slash Command Palette.
- **3D Knowledge Nexus Graph**: Interactive force-directed 3D visualization using Three.js and React Three Fiber with glowing nodes, particle connections, auto-rotation, and direct note jumping.
- **Interactive Whiteboard**: Freehand sketching, geometric shapes, and visual canvases.
- **Collaborative Discussions**: Inline comments, threaded replies, `@user` mentions, and resolution workflows.
- **3-Way Visual Conflict Resolver**: Never lose offline data. Compare offline and remote versions with `Keep Mine`, `Keep Remote`, or `Merge` strategies.
- **Centralized Keyboard Shortcuts & Command Palette**: Press `Ctrl+K` (`Cmd+K`) anywhere to search notes, jump documents, or trigger actions.
- **Bespoke Design System**: Custom Material UI v6 tokens, high-contrast dark mode, radiant gradients, and glassmorphism.

---

## 🛠️ Architecture Stack

- **Frontend**: React 18, TypeScript, Vite, Material UI (Custom tokens), TipTap ProseMirror, Yjs CRDTs, Three.js, React Three Fiber, Dexie.js (IndexedDB).
- **Backend**: Node.js, Express, WebSockets (`ws`), Y-WebSocket room provider.
- **Database**: Dual PostgreSQL / embedded relational store with normalized UUID schema and migrations.

---

## 🏃 Quick Start

### 1. Install & Start Development Servers
```bash
# Start frontend client + backend API/WebSocket concurrently
npm run dev:all
```
Frontend runs on: `http://localhost:5173`  
Backend runs on: `http://localhost:3001`

### 2. Run Automated Tests
```bash
npm test
```

### 3. Build for Production
```bash
npm run build
```

---

## 📚 Technical Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — System layers, domain models, and design patterns.
- [SYNC.md](./SYNC.md) — Pluggable SyncProvider abstraction and mutation pipeline.
- [OFFLINE_FIRST.md](./OFFLINE_FIRST.md) — IndexedDB storage, retry backoff, and local search.
- [COLLABORATION.md](./COLLABORATION.md) — Yjs CRDT document convergence and presence.
- [DATABASE.md](./DATABASE.md) — PostgreSQL relational schema and indexing strategy.
- [API.md](./API.md) — REST endpoints and WebSocket protocol specification.
- [SECURITY.md](./SECURITY.md) — Data isolation, authorization, and sanitization guidelines.
