# Real-Time Collaboration & CRDTs — Nexus Notes

## Yjs CRDT Integration

For concurrent editing, traditional "Last-Write-Wins" destroys user text. Nexus Notes adopts Conflict-free Replicated Data Types (CRDTs) using **Yjs** and **TipTap ProseMirror**:

```
Document Model
      │
      ├── Y.Doc (CRDT Binary State)
      │     ├── Paragraphs
      │     ├── Headings
      │     ├── Task Lists
      │     └── Tables
      │
      ├── Local IndexedDB Persistence (y-indexeddb)
      │
      └── Remote Realtime Synchronization (y-websocket / Supabase Realtime)
```

### Ephemeral Presence & Collaborative Cursors

Active participants broadcast ephemeral presence packets over the WebSocket channel:
- `clientId` & `userId`
- `name` & `color`
- `activeNoteId`
- `cursor: { x, y, line, ch }`
- `selection: { from, to }`

Cursors display as colored tags anchored directly in the ProseMirror editor surface, providing live spatial awareness without persisting cursor state to disk.
