export interface ServerSyncPushRequest {
  operationId: string;
  clientId: string;
  entityType: 'note' | 'folder' | 'comment' | 'attachment' | 'tag' | 'workspace';
  entityId: string;
  operationType: 'create' | 'update' | 'delete' | 'patch';
  payload: Record<string, any>;
  baseVersion: number;
}

export interface ServerSyncPullResponse {
  serverCheckpoint: string;
  changes: Array<{
    operationId: string;
    entityType: string;
    entityId: string;
    operationType: string;
    payload: Record<string, any>;
    version: number;
    timestamp: string;
    sourceClientId: string;
  }>;
}
