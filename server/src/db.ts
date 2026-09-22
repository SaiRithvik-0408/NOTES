// Server database adapter supporting in-memory storage, persistent disk cache,
// and PostgreSQL compatibility for production deployment.
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import pg from 'pg';

const { Pool } = pg;

export interface ServerRecord {
  id: string;
  [key: string]: any;
}

export interface UserRecord extends ServerRecord {
  id: string;
  username: string;
  name: string;
  email: string;
  password: string;
  color?: string;
  avatarUrl?: string;
  isVerified?: boolean;
  createdAt?: string;
}

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || null;
const PERSISTENT_FILE_PATH = path.resolve(process.cwd(), '.nexus_users_store.json');

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

  private pool: pg.Pool | null = null;
  private dbInitialized = false;

  constructor() {
    this.seedDefaultData();
    this.loadFromDisk();
    this.initPostgres();
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

  private loadFromDisk() {
    try {
      if (fs.existsSync(PERSISTENT_FILE_PATH)) {
        const raw = fs.readFileSync(PERSISTENT_FILE_PATH, 'utf8');
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          for (const u of list) {
            if (u && u.id) {
              this.users.set(u.id, u);
            }
          }
        }
      }
    } catch (err: any) {
      console.warn('[serverDb] Could not read .nexus_users_store.json:', err.message);
    }
  }

  private persistToDisk() {
    try {
      const list = Array.from(this.users.values());
      fs.writeFileSync(PERSISTENT_FILE_PATH, JSON.stringify(list, null, 2), 'utf8');
    } catch (err: any) {
      console.warn('[serverDb] Could not write .nexus_users_store.json:', err.message);
    }
  }

  private isEnsuringTable = false;

  private async initPostgres() {
    if (!DB_URL) return;
    try {
      this.pool = new Pool({
        connectionString: DB_URL,
        ssl: DB_URL.includes('localhost') ? false : { rejectUnauthorized: false },
        max: 10,
        connectionTimeoutMillis: 15000,
        idleTimeoutMillis: 30000,
      });

      this.pool.on('error', (err) => {
        console.warn('[serverDb] PostgreSQL Pool error (falling back to disk/in-memory):', err.message);
      });

      await this.ensurePostgresTable();
      await this.loadUsersFromPostgres();
    } catch (err: any) {
      console.warn('[serverDb] Failed to connect to PostgreSQL (falling back to disk/in-memory):', err.message);
    }
  }

  public async ensurePostgresTable() {
    if (!this.pool || this.dbInitialized || this.isEnsuringTable) return;
    this.isEnsuringTable = true;
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS nexus_users (
          id VARCHAR(255) PRIMARY KEY,
          username VARCHAR(255) UNIQUE NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          password VARCHAR(255) NOT NULL,
          color VARCHAR(32) DEFAULT '#6366F1',
          is_verified BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      this.dbInitialized = true;
    } catch (err: any) {
      console.warn('[serverDb] Error ensuring PostgreSQL nexus_users table:', err.message);
    } finally {
      this.isEnsuringTable = false;
    }
  }

  public async loadUsersFromPostgres() {
    if (!this.pool) return;
    try {
      await this.ensurePostgresTable();
      const res = await this.pool.query('SELECT * FROM nexus_users');
      for (const row of res.rows) {
        const u: UserRecord = {
          id: row.id,
          username: row.username,
          name: row.name,
          email: row.email,
          password: row.password,
          color: row.color,
          isVerified: row.is_verified,
          createdAt: row.created_at,
        };
        this.users.set(u.id, u);
      }
      this.persistToDisk();
    } catch (err: any) {
      console.warn('[serverDb] Error loading users from PostgreSQL:', err.message);
    }
  }

  public async saveUser(userRecord: UserRecord): Promise<UserRecord> {
    this.users.set(userRecord.id, userRecord);
    this.persistToDisk();

    if (this.pool) {
      try {
        await this.ensurePostgresTable();
        await this.pool.query(
          `INSERT INTO nexus_users (id, username, email, name, password, color, is_verified, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
           ON CONFLICT (email) DO UPDATE SET
             name = EXCLUDED.name,
             username = EXCLUDED.username,
             password = EXCLUDED.password,
             color = EXCLUDED.color,
             is_verified = EXCLUDED.is_verified,
             updated_at = NOW()`,
          [
            userRecord.id,
            userRecord.username.toLowerCase(),
            userRecord.email.toLowerCase(),
            userRecord.name,
            userRecord.password,
            userRecord.color || '#6366F1',
            userRecord.isVerified ?? true,
            userRecord.createdAt || new Date().toISOString(),
          ]
        );
      } catch (err: any) {
        console.warn('[serverDb] Error saving user to PostgreSQL:', err.message);
      }
    }

    return userRecord;
  }

  public async getUserByEmailOrUsername(identifier: string): Promise<UserRecord | null> {
    if (!identifier) return null;
    const key = identifier.trim().toLowerCase();

    // 1. Try PostgreSQL
    if (this.pool) {
      try {
        await this.ensurePostgresTable();
        const res = await this.pool.query(
          `SELECT id, username, email, name, password, color, is_verified, created_at
           FROM nexus_users
           WHERE LOWER(email) = $1 OR LOWER(username) = $1
           LIMIT 1`,
          [key]
        );
        if (res.rows.length > 0) {
          const row = res.rows[0];
          const record: UserRecord = {
            id: row.id,
            username: row.username,
            email: row.email,
            name: row.name,
            password: row.password,
            color: row.color,
            isVerified: row.is_verified,
            createdAt: row.created_at,
          };
          this.users.set(record.id, record);
          this.persistToDisk();
          return record;
        }
      } catch (err: any) {
        console.warn('[serverDb] PostgreSQL getUserByEmailOrUsername error:', err.message);
      }
    }

    // 2. Try in-memory
    let match = Array.from(this.users.values()).find(
      (u) => u.email?.toLowerCase() === key || u.username?.toLowerCase() === key
    );

    // 3. Try re-reading disk in case written by api/
    if (!match) {
      this.loadFromDisk();
      match = Array.from(this.users.values()).find(
        (u) => u.email?.toLowerCase() === key || u.username?.toLowerCase() === key
      );
    }

    return match ? (match as UserRecord) : null;
  }

  public async isUsernameOrEmailTaken(username: string, email: string): Promise<{ usernameTaken: boolean; emailTaken: boolean }> {
    const normUser = (username || '').trim().toLowerCase();
    const normEmail = (email || '').trim().toLowerCase();

    if (this.pool) {
      try {
        await this.ensurePostgresTable();
        const res = await this.pool.query(
          `SELECT username, email FROM nexus_users WHERE LOWER(username) = $1 OR LOWER(email) = $2 LIMIT 1`,
          [normUser, normEmail]
        );
        if (res.rows.length > 0) {
          const row = res.rows[0];
          return {
            usernameTaken: row.username.toLowerCase() === normUser,
            emailTaken: row.email.toLowerCase() === normEmail,
          };
        }
      } catch (err: any) {
        console.warn('[serverDb] PostgreSQL isUsernameOrEmailTaken error:', err.message);
      }
    }

    this.loadFromDisk();
    const usernameTaken = Array.from(this.users.values()).some((u) => u.username?.toLowerCase() === normUser);
    const emailTaken = Array.from(this.users.values()).some((u) => u.email?.toLowerCase() === normEmail);

    return { usernameTaken, emailTaken };
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
