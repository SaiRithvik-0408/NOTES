# System Architecture — Nexus Notes

## High-Level Topology

```
┌─────────────────────────────────────────────────────────┐
│                   Client Layer (PWA)                    │
│   React 18 + TypeScript + Vite                          │
│   MUI Custom Design System (Tokens, Dark/Light modes)   │
│   TipTap + ProseMirror + Yjs CRDTs                      │
│   Three.js + R3F 3D Knowledge Graph                     │
│   Global Command Palette (Ctrl+K)                       │
└────────────────────────────┬────────────────────────────┘
                             │
                  Zero-Latency Data Flow
                             │
┌────────────────────────────▼────────────────────────────┐
│               Local Persistence & Search                │
│   IndexedDB (Dexie)                                     │
│   - Workspaces, Folders, Notes, Comments, Attachments   │
│   - Y.Doc binary state snapshots                        │
│   - Offline Full-Text Search Engine                     │
└────────────────────────────┬────────────────────────────┘
                             │
                Local Mutation Queue Pipeline
                             │
┌────────────────────────────▼────────────────────────────┐
│              Sync Engine & Pluggable Providers          │
│   - Mutation Queue (Idempotent UUID Operation IDs)      │
│   - Status: pending → syncing → synced / conflict       │
│   - Exponential backoff & jitter                        │
│   - Pluggable SyncProvider Interface                    │
│     ├── LocalSyncProvider (Multi-tab broadcast)         │
│     ├── WebSocketSyncProvider (Node.js realtime)        │
│     └── SupabaseSyncProvider (PostgreSQL realtime)      │
└────────────────────────────┬────────────────────────────┘
                             │
                 WebSocket / HTTP REST API
                             │
┌────────────────────────────▼────────────────────────────┐
│            Backend Service (Node.js / TS)               │
│   - Express REST API (/api/v1/*)                        │
│   - Y-WebSocket Room Provider & Presence Broadcast      │
│   - Ingestion Pipeline & Checkpoint Manager             │
└────────────────────────────┬────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────┐
│            Database (PostgreSQL 14+)                    │
│   - Normalized Relational Tables                        │
│   - Row Level Security (RLS) Policies                   │
│   - Optimized Compound Indexes                          │
└─────────────────────────────────────────────────────────┘
```

## Modular Domain Model

The data layer separates operational domains into normalized models:
- **Workspace & Membership**: Multi-tenant boundaries with roles (`owner`, `admin`, `editor`, `commenter`, `viewer`).
- **Hierarchy & Organization**: Folders with nested tree references, tags, pinned, and favorite state.
- **Documents & Blocks**: TipTap JSON structures and plain-text projections for fast local search.
- **Collaboration & Presence**: Ephemeral cursor locations, active note identifiers, and participant color flags.
- **Discussions**: Threaded comments, anchor ranges, and resolution state.
- **Mutation Journal**: Monotonically tracked operations with client identifiers and status state machine.
