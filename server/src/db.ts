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
      ownerId: 'user-alex',
      createdAt: now,
      updatedAt: now,
    });

    // Seed initial demo users with usernames
    this.users.set('user-alex', {
      id: 'user-alex',
      username: 'alex',
      name: 'Alex Rivera',
      email: 'alex@nexus.internal',
      password: 'password123',
      color: '#6366F1',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      isVerified: true,
      createdAt: now,
    });

    this.users.set('user-elena', {
      id: 'user-elena',
      username: 'elena',
      name: 'Elena Rostova',
      email: 'elena@nexus.internal',
      password: 'password123',
      color: '#EC4899',
      avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80',
      isVerified: true,
      createdAt: now,
    });

    this.users.set('user-marcus', {
      id: 'user-marcus',
      username: 'marcus',
      name: 'Marcus Chen',
      email: 'marcus@partner.org',
      password: 'password123',
      color: '#10B981',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
      isVerified: true,
      createdAt: now,
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
