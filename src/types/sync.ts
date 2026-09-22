export type OperationStatus = 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict' | 'cancelled';

export type EntityType = 'note' | 'folder' | 'comment' | 'attachment' | 'tag' | 'workspace';

export type OperationType = 'create' | 'update' | 'delete' | 'patch';

export interface MutationOperation {
  operationId: string; // Unique UUID
  clientId: string; // Machine/session client identifier
  entityType: EntityType;
  entityId: string;
  operationType: OperationType;
  payload: Record<string, any>;
  baseVersion: number;
  retryCount: number;
  status: OperationStatus;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export type SyncState = 'offline' | 'saved_locally' | 'syncing' | 'synced' | 'conflict' | 'error';

export interface SyncStatus {
  state: SyncState;
  pendingCount: number;
  lastSyncedAt?: string;
  isOnline: boolean;
  errorMessage?: string;
}

export interface RemoteChange {
  operationId: string;
  entityType: EntityType;
  entityId: string;
  operationType: OperationType;
  payload: Record<string, any>;
  version: number;
  timestamp: string;
  sourceClientId: string;
}

export interface SyncResult {
  success: boolean;
  pushedCount: number;
  pulledCount: number;
  conflicts: ConflictRecord[];
  newCheckpoint?: string;
  error?: string;
}

export interface ConflictRecord {
  id: string;
  entityType: EntityType;
  entityId: string;
  localVersion: number;
  remoteVersion: number;
  localData: Record<string, any>;
  remoteData: Record<string, any>;
  detectedAt: string;
  resolved: boolean;
  resolutionStrategy?: 'keep_local' | 'keep_remote' | 'merged';
}

export interface ConflictResolution {
  strategy: 'keep_local' | 'keep_remote' | 'merged';
  resolvedData?: Record<string, any>;
}

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
