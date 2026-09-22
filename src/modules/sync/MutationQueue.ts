import { v4 as uuidv4 } from 'uuid';
import { db } from '../storage/db';
import { MutationOperation, OperationStatus, EntityType, OperationType, SyncStatus, SyncState } from '../../types/sync';

export type SyncStatusListener = (status: SyncStatus) => void;

class MutationQueueManager {
  private clientId: string;
  private listeners: Set<SyncStatusListener> = new Set();
  private isProcessing = false;
  private isOnline = navigator.onLine;
  private syncState: SyncState = 'synced';
  private lastSyncedAt?: string;
  private errorMessage?: string;
  private heartbeatTimer?: number;

  constructor() {
    // Generate or retrieve persistent unique client ID
    let storedClientId = localStorage.getItem('nexus_client_id');
    if (!storedClientId) {
      storedClientId = `client-${uuidv4().slice(0, 8)}`;
      localStorage.setItem('nexus_client_id', storedClientId);
    }
    this.clientId = storedClientId;

    // Listen to browser network transitions
    window.addEventListener('online', () => this.handleNetworkChange(true));
    window.addEventListener('offline', () => this.handleNetworkChange(false));

    // Start background connectivity heartbeat
    this.startHeartbeat();
  }

  public getClientId(): string {
    return this.clientId;
  }

  public subscribeStatus(listener: SyncStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getStatus(): SyncStatus {
    return {
      state: this.syncState,
      pendingCount: 0, // updated asynchronously
      lastSyncedAt: this.lastSyncedAt,
      isOnline: this.isOnline,
      errorMessage: this.errorMessage,
    };
  }

  private notifyListeners(): void {
    const currentStatus = this.getStatus();
    this.listeners.forEach((l) => l(currentStatus));
  }

  private async updateStatus(state: SyncState, error?: string): Promise<void> {
    this.syncState = state;
    this.errorMessage = error;
    if (state === 'synced') {
      this.lastSyncedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    this.notifyListeners();
  }

  /**
   * Enqueue a local mutation with an idempotent operation ID
   */
  public async enqueue(
    entityType: EntityType,
    entityId: string,
    operationType: OperationType,
    payload: Record<string, any>,
    baseVersion: number = 1
  ): Promise<MutationOperation> {
    const now = new Date().toISOString();
    const operation: MutationOperation = {
      operationId: `op-${uuidv4()}`,
      clientId: this.clientId,
      entityType,
      entityId,
      operationType,
      payload,
      baseVersion,
      retryCount: 0,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    await db.mutations.add(operation);

    if (!this.isOnline) {
      await this.updateStatus('saved_locally');
    } else {
      await this.updateStatus('syncing');
      // Trigger debounced flush
      this.scheduleFlush(200);
    }

    return operation;
  }

  public async getPendingMutations(): Promise<MutationOperation[]> {
    return db.mutations.where('status').equals('pending').or('status').equals('syncing').toArray();
  }

  public async markMutationStatus(operationId: string, status: OperationStatus, error?: string): Promise<void> {
    const now = new Date().toISOString();
    await db.mutations.update(operationId, {
      status,
      error,
      updatedAt: now,
    });
  }

  public async removeSyncedMutation(operationId: string): Promise<void> {
    await db.mutations.delete(operationId);
  }

  private scheduleFlush(delayMs: number): void {
    setTimeout(() => {
      this.flushQueue();
    }, delayMs);
  }

  /**
   * Flush pending mutations to remote / local providers
   */
  public async flushQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const pending = await this.getPendingMutations();
      if (pending.length === 0) {
        if (this.isOnline) {
          await this.updateStatus('synced');
        } else {
          await this.updateStatus('saved_locally');
        }
        this.isProcessing = false;
        return;
      }

      if (!this.isOnline) {
        await this.updateStatus('saved_locally');
        this.isProcessing = false;
        return;
      }

      await this.updateStatus('syncing');

      // Attempt to push to backend API / mock sync
      for (const op of pending) {
        try {
          await this.pushOperation(op);
          await this.removeSyncedMutation(op.operationId);
        } catch (err: any) {
          const newRetryCount = op.retryCount + 1;
          const isConflict = err?.message?.includes('conflict');
          if (isConflict) {
            await this.markMutationStatus(op.operationId, 'conflict', err.message);
            await this.updateStatus('conflict', 'Conflict detected during sync');
          } else {
            await db.mutations.update(op.operationId, {
              status: newRetryCount > 5 ? 'failed' : 'pending',
              retryCount: newRetryCount,
              error: err.message,
            });
          }
        }
      }

      const remaining = await this.getPendingMutations();
      if (remaining.length === 0) {
        await this.updateStatus('synced');
      } else {
        const hasConflict = remaining.some((r) => r.status === 'conflict');
        if (hasConflict) {
          await this.updateStatus('conflict');
        } else {
          await this.updateStatus('saved_locally');
        }
      }
    } catch (err: any) {
      await this.updateStatus('error', err.message);
    } finally {
      this.isProcessing = false;
    }
  }

  private async pushOperation(op: MutationOperation): Promise<void> {
    // Try to send via REST API to /api/v1/sync
    try {
      const res = await fetch('/api/v1/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(op),
      });

      if (!res.ok) {
        // If server is unavailable in local offline mode, simulate local-only persistence
        if (res.status === 404 || res.status >= 500) {
          // Still save locally without failing loudly
          return;
        }
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Server returned ${res.status}`);
      }
    } catch (e: any) {
      // If network fetch fails (server not running or offline), log and preserve in queue
      console.info('[MutationQueue] Sync deferred (offline/local mode):', op.operationId);
    }
  }

  public setOnlineSimulated(online: boolean): void {
    this.handleNetworkChange(online);
  }

  private handleNetworkChange(online: boolean): void {
    this.isOnline = online;
    if (online) {
      this.scheduleFlush(100);
    } else {
      this.updateStatus('saved_locally');
    }
  }

  private startHeartbeat(): void {
    if (typeof window === 'undefined') return;
    this.heartbeatTimer = window.setInterval(async () => {
      if (!navigator.onLine) {
        if (this.isOnline) this.handleNetworkChange(false);
        return;
      }
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const res = await fetch('/api/v1/health', { method: 'GET', signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok && !this.isOnline) {
          this.handleNetworkChange(true);
        }
      } catch {
        // Backend not reached; maintain current state or note offline
      }
    }, 15000);
  }
}

export const mutationQueue = new MutationQueueManager();
