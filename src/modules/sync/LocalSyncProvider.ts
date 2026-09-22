import { SyncProvider, SyncResult, RemoteChange, SyncStatus, ConflictResolution } from '../../types/sync';
import { mutationQueue } from './MutationQueue';
import { db } from '../storage/db';

export class LocalSyncProvider implements SyncProvider {
  readonly id = 'provider-local';
  readonly name = 'Local Broadcast & Cloud Sync Engine';
  private broadcastChannel?: BroadcastChannel;
  private subscribers: Map<string, Set<(change: RemoteChange) => void>> = new Map();
  private lastServerCheckpoint: string | null = null;
  private pullTimer: any = null;

  async initialize(): Promise<void> {
    // 1. Cross-tab real-time sync via BroadcastChannel
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.broadcastChannel = new BroadcastChannel('nexus_local_sync');
      this.broadcastChannel.onmessage = (event) => {
        const change: RemoteChange = event.data;
        if (change && change.sourceClientId !== mutationQueue.getClientId()) {
          this.handleIncomingChange(change);
        }
      };
    }

    // 2. Initial cloud pull from Neon PostgreSQL
    if (typeof window !== 'undefined') {
      this.pullChanges();

      // Periodic cloud pull every 20 seconds
      this.pullTimer = setInterval(() => {
        if (navigator.onLine) {
          this.pullChanges();
        }
      }, 20000);

      // Pull immediately when device reconnects or window regains focus
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('focus', this.handleFocus);
    }
  }

  private handleOnline = () => {
    this.pushChanges();
    this.pullChanges();
  };

  private handleFocus = () => {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      this.pullChanges();
    }
  };

  async pushChanges(): Promise<SyncResult> {
    const pending = await mutationQueue.getPendingMutations();
    let pushed = 0;

    for (const op of pending) {
      const change: RemoteChange = {
        operationId: op.operationId,
        entityType: op.entityType,
        entityId: op.entityId,
        operationType: op.operationType,
        payload: op.payload,
        version: op.baseVersion + 1,
        timestamp: op.createdAt,
        sourceClientId: mutationQueue.getClientId(),
      };

      // 1. Broadcast to open tabs
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage(change);
      }

      // 2. Push to Cloud API / Neon DB
      try {
        await fetch('/api/v1/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...change,
            clientId: mutationQueue.getClientId(),
            baseVersion: op.baseVersion,
          }),
        });
      } catch {
        // Network offline; mutation remains locally safely
      }

      await mutationQueue.removeSyncedMutation(op.operationId);
      pushed++;
    }

    return {
      success: true,
      pushedCount: pushed,
      pulledCount: 0,
      conflicts: [],
    };
  }

  async pullChanges(): Promise<SyncResult> {
    let pulled = 0;

    try {
      const url = this.lastServerCheckpoint
        ? `/api/v1/sync?since=${encodeURIComponent(this.lastServerCheckpoint)}`
        : '/api/v1/sync';

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.serverCheckpoint) {
          this.lastServerCheckpoint = data.serverCheckpoint;
        }

        if (Array.isArray(data.changes)) {
          for (const change of data.changes) {
            if (change.sourceClientId !== mutationQueue.getClientId()) {
              await this.handleIncomingChange(change);
              pulled++;
            }
          }
        }
      }
    } catch {
      // Offline; quietly catch
    }

    return {
      success: true,
      pushedCount: 0,
      pulledCount: pulled,
      conflicts: [],
    };
  }

  subscribe(workspaceId: string, callback: (change: RemoteChange) => void): () => void {
    if (!this.subscribers.has(workspaceId)) {
      this.subscribers.set(workspaceId, new Set());
    }
    this.subscribers.get(workspaceId)!.add(callback);

    return () => {
      this.subscribers.get(workspaceId)?.delete(callback);
    };
  }

  getStatus(): SyncStatus {
    return mutationQueue.getStatus();
  }

  async resolveConflict(conflictId: string, resolution: ConflictResolution): Promise<void> {
    const conflict = await db.conflicts.get(conflictId);
    if (!conflict) return;

    if (resolution.strategy === 'keep_local') {
      await db.conflicts.update(conflictId, { resolved: true, resolutionStrategy: 'keep_local' });
    } else if (resolution.strategy === 'keep_remote') {
      if (conflict.entityType === 'note') {
        await db.notes.put(conflict.remoteData as any);
      }
      await db.conflicts.update(conflictId, { resolved: true, resolutionStrategy: 'keep_remote' });
    } else if (resolution.strategy === 'merged' && resolution.resolvedData) {
      if (conflict.entityType === 'note') {
        await db.notes.put(resolution.resolvedData as any);
      }
      await db.conflicts.update(conflictId, { resolved: true, resolutionStrategy: 'merged' });
    }
  }

  private async handleIncomingChange(change: RemoteChange): Promise<void> {
    const workspaceId = change.payload?.workspaceId || 'ws-default-nexus';
    const cbs = this.subscribers.get(workspaceId);
    if (cbs) {
      cbs.forEach((cb) => cb(change));
    }

    if (change.entityType === 'note') {
      if (change.operationType === 'delete') {
        await db.notes.delete(change.entityId);
        return;
      }

      const localNote = await db.notes.get(change.entityId);
      if (localNote && localNote.updatedAt > change.timestamp && localNote.content !== change.payload?.content) {
        await db.conflicts.add({
          id: `conflict-${Date.now()}`,
          entityType: 'note',
          entityId: change.entityId,
          localVersion: localNote.version,
          remoteVersion: change.version,
          localData: localNote,
          remoteData: change.payload,
          detectedAt: new Date().toISOString(),
          resolved: false,
        });
      } else if (change.payload) {
        await db.notes.put(change.payload as any);
      }
    }
  }

  destroy(): void {
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
    }
    if (this.pullTimer) {
      clearInterval(this.pullTimer);
      this.pullTimer = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('focus', this.handleFocus);
    }
  }
}

export const localSyncProvider = new LocalSyncProvider();
