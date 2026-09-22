import { SyncProvider, SyncResult, RemoteChange, SyncStatus, ConflictResolution } from '../../types/sync';
import { mutationQueue } from './MutationQueue';
import { db } from '../storage/db';

export class LocalSyncProvider implements SyncProvider {
  readonly id = 'provider-local';
  readonly name = 'Local Broadcast & Offline Engine';
  private broadcastChannel?: BroadcastChannel;
  private subscribers: Map<string, Set<(change: RemoteChange) => void>> = new Map();

  async initialize(): Promise<void> {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.broadcastChannel = new BroadcastChannel('nexus_local_sync');
      this.broadcastChannel.onmessage = (event) => {
        const change: RemoteChange = event.data;
        if (change && change.sourceClientId !== mutationQueue.getClientId()) {
          this.handleIncomingChange(change);
        }
      };
    }
  }

  async pushChanges(): Promise<SyncResult> {
    const pending = await mutationQueue.getPendingMutations();
    let pushed = 0;

    for (const op of pending) {
      if (this.broadcastChannel) {
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
        this.broadcastChannel.postMessage(change);
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
    return {
      success: true,
      pushedCount: 0,
      pulledCount: 0,
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
      // Local version kept, mark resolved
      await db.conflicts.update(conflictId, { resolved: true, resolutionStrategy: 'keep_local' });
    } else if (resolution.strategy === 'keep_remote') {
      // Overwrite local record with remoteData
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
    // Notify workspace subscribers
    const workspaceId = change.payload.workspaceId || 'ws-default-nexus';
    const cbs = this.subscribers.get(workspaceId);
    if (cbs) {
      cbs.forEach((cb) => cb(change));
    }

    // Apply change into IndexedDB if needed
    if (change.entityType === 'note') {
      const localNote = await db.notes.get(change.entityId);
      if (localNote && localNote.updatedAt > change.timestamp && localNote.content !== change.payload.content) {
        // Potential conflict!
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
      } else {
        await db.notes.put(change.payload as any);
      }
    }
  }

  destroy(): void {
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
    }
  }
}

export const localSyncProvider = new LocalSyncProvider();
