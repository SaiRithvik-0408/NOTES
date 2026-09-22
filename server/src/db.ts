// Server database adapter supporting in-memory storage for immediate local dev
// and PostgreSQL compatibility for production deployment.

export interface ServerRecord {
  id: string;
  [key: string]: any;
}

class ServerDatabase {
  public workspaces: Map<string, ServerRecord> = new Map();
  public folders: Map<string, ServerRecord> = new Map();
  public notes: Map<string, ServerRecord> = new Map();
  public comments: Map<string, ServerRecord> = new Map();
  public attachments: Map<string, ServerRecord> = new Map();
  public operations: Map<string, ServerRecord> = new Map();
  public revisions: Map<string, ServerRecord> = new Map();
  public users: Map<string, ServerRecord> = new Map();
  public otpStore: Map<string, { code: string; expiresAt: number; userData?: any }> = new Map();

  constructor() {
    this.seedDefaultData();
  }

  private seedDefaultData() {
    const defaultWorkspaceId = 'ws-default-nexus';
    const now = new Date().toISOString();

    // Default workspace
    this.workspaces.set(defaultWorkspaceId, {
      id: defaultWorkspaceId,
      name: 'Nexus Engineering Workspace',
      slug: 'nexus-engineering',
      ownerId: 'system-owner',
      createdAt: now,
      updatedAt: now,
    });
  }

  public applyMutation(op: {
    operationId: string;
    clientId: string;
    entityType: string;
    entityId: string;
    operationType: string;
    payload: Record<string, any>;
    baseVersion: number;
  }) {
    const now = new Date().toISOString();
    this.operations.set(op.operationId, { id: op.operationId, ...op, appliedAt: now });

    let table: Map<string, ServerRecord> | null = null;
    if (op.entityType === 'note') table = this.notes;
    else if (op.entityType === 'folder') table = this.folders;
    else if (op.entityType === 'comment') table = this.comments;
    else if (op.entityType === 'attachment') table = this.attachments;
    else if (op.entityType === 'workspace') table = this.workspaces;

    if (!table) return;

    if (op.operationType === 'create' || op.operationType === 'update') {
      table.set(op.entityId, {
        ...op.payload,
        id: op.entityId,
        updatedAt: now,
      });
    } else if (op.operationType === 'patch') {
      const existing = table.get(op.entityId) || { id: op.entityId };
      table.set(op.entityId, {
        ...existing,
        ...op.payload,
        updatedAt: now,
      });
    } else if (op.operationType === 'delete') {
      table.delete(op.entityId);
    }
  }
}

export const serverDb = new ServerDatabase();
