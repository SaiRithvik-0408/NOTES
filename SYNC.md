# Synchronization Architecture & Providers — Nexus Notes

## The SyncProvider Abstraction

To avoid hard-coupling the frontend to a single backend vendor (such as Supabase, Electric, or a custom WebSocket server), the application interfaces exclusively with the `SyncProvider` contract:

```typescript
export interface SyncProvider {
  readonly id: string;
  readonly name: string;
  initialize(): Promise<void>;
  pushChanges(): Promise<SyncResult>;
  pullChanges(): Promise<SyncResult>;
  subscribe(workspaceId: string, callback: (change: RemoteChange) => void): () => void;
  getStatus(): SyncStatus;
  resolveConflict(conflictId: string, resolution: ConflictResolution): Promise<void>;
  destroy(): void;
}
```

### Implementations

1. **`LocalSyncProvider`**:
   - Uses browser `BroadcastChannel` (`nexus_local_sync`) for inter-tab communication.
   - Ideal for testing, offline-first development, and multi-window workflows.
2. **`WebSocketSyncProvider`**:
   - Connects to the Node.js backend on `/ws`.
   - Streams granular CRDT binary packets and receives broadcast events from remote collaborators.
3. **`SupabaseSyncProvider`** (Extensible):
   - Implements PostgreSQL change subscriptions via Supabase Realtime broadcast channels.
4. **`ElectricSyncProvider`** (Extensible):
   - Integrates partial replication shapes directly from Postgres into local client storage.

---

## The Local Mutation Queue

Every state modification creates an idempotent `MutationOperation`:

```typescript
export interface MutationOperation {
  operationId: string;    // e.g. op-uuidv4
  clientId: string;       // client-session-id
  entityType: EntityType; // 'note' | 'folder' | 'comment'
  entityId: string;
  operationType: 'create' | 'update' | 'delete' | 'patch';
  payload: Record<string, any>;
  baseVersion: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict';
  createdAt: string;
}
```

### State Machine Lifecycle

```
[User Action]
      ↓
[Local Write to IndexedDB]
      ↓
[Enqueue Mutation: status = 'pending']
      ↓
[Network Check & Heartbeat]
   ├── Offline → status = 'saved_locally'
   └── Online  → status = 'syncing'
                     ↓
             [Push to Provider]
               ├── Success → status = 'synced' (dequeued)
               ├── Network Error → increment retryCount & backoff
               └── Version Divergence → status = 'conflict' (Prompt 3-way modal)
```
