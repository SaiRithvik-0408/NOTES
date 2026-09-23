import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import pg from 'pg';

const { Pool } = pg;

export interface UserRecord {
  id: string;
  username: string;
  email: string;
  name: string;
  password?: string;
  color?: string;
  isVerified?: boolean;
  createdAt?: string;
  avatarUrl?: string;
}

export interface OtpChallenge {
  code: string;
  expiresAt: number;
  userData?: any;
}

// 1. In-memory caches for fast local lambda execution
export const users = new Map<string, UserRecord>();
export const otpStore = new Map<string, OtpChallenge>();
export const workspaces = new Map<string, any>();
export const notes = new Map<string, any>();
export const operations = new Map<string, any>();
export const shareStore = new Map<string, any>();

const AUTH_SECRET = process.env.JWT_SECRET || 'nexus-secret-key-2026-auth-gate';
const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || null;

// File persistence fallback for Serverless Lambdas when no external Postgres is configured
const PERSISTENT_FILE_PATH = process.env.VERCEL
  ? '/tmp/nexus_users_store.json'
  : path.resolve(process.cwd(), '.nexus_users_store.json');

// Load cached users from disk on cold start (safely guarded)
try {
  if (fs.existsSync(PERSISTENT_FILE_PATH)) {
    const raw = fs.readFileSync(PERSISTENT_FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      parsed.forEach((u: UserRecord) => {
        if (u && u.id) users.set(u.id, u);
      });
    }
  }
} catch (e: any) {
  // Silent fallback to in-memory map
}

function persistUsersToDisk() {
  try {
    const list = Array.from(users.values());
    fs.writeFileSync(PERSISTENT_FILE_PATH, JSON.stringify(list, null, 2), 'utf8');
  } catch (e: any) {
    // Non-critical in serverless environments
  }
}

// 2. PostgreSQL Connection Pool (Lazily initialized singleton)
let pool: pg.Pool | null = null;
let dbInitialized = false;
let isEnsuringTable = false;

export function getPool(): pg.Pool | null {
  if (!DB_URL) return null;
  if (!pool) {
    try {
      const cleanUrl = DB_URL.trim();
      pool = new Pool({
        connectionString: cleanUrl,
        ssl: cleanUrl.includes('localhost') ? false : { rejectUnauthorized: false },
        max: 1, // Single client connection per serverless function to prevent connection exhaustion
        connectionTimeoutMillis: 3500,
        idleTimeoutMillis: 10000,
      });

      pool.on('error', (err) => {
        console.warn('PostgreSQL pool background error (safely caught):', err?.message || err);
      });
    } catch (e: any) {
      console.warn('Failed to initialize PostgreSQL pool:', e?.message || e);
      pool = null;
    }
  }
  return pool;
}

export async function safeQuery(sql: string, params: any[] = [], timeoutMs = 3500): Promise<any> {
  const p = getPool();
  if (!p) return null;

  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('PostgreSQL query timed out')), timeoutMs)
    );

    // Attach .catch handler to the query promise so it NEVER creates an unhandled promise rejection
    const queryPromise = p.query(sql, params).catch((err: any) => {
      console.warn('safeQuery underlying error:', err?.message || err);
      throw err;
    });

    return await Promise.race([queryPromise, timeoutPromise]);
  } catch (err: any) {
    console.warn(`safeQuery warning (${err?.message || err})`);
    return null;
  }
}

async function ensurePostgresTable() {
  const p = getPool();
  if (!p || dbInitialized || isEnsuringTable) return;
  isEnsuringTable = true;

  try {
    // Execute each table creation individually to comply with PostgreSQL extended query protocol
    await safeQuery(`
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
      )
    `);

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS nexus_notes (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) DEFAULT 'ws-default-nexus',
        folder_id VARCHAR(255),
        title TEXT NOT NULL,
        content TEXT DEFAULT '',
        plain_text TEXT DEFAULT '',
        icon VARCHAR(64) DEFAULT '📝',
        tags JSONB DEFAULT '[]'::jsonb,
        is_pinned BOOLEAN DEFAULT FALSE,
        is_archived BOOLEAN DEFAULT FALSE,
        is_trash BOOLEAN DEFAULT FALSE,
        version INT DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS nexus_mutations (
        operation_id VARCHAR(255) PRIMARY KEY,
        client_id VARCHAR(255) NOT NULL,
        workspace_id VARCHAR(255) DEFAULT 'ws-default-nexus',
        entity_type VARCHAR(64) NOT NULL,
        entity_id VARCHAR(255) NOT NULL,
        operation_type VARCHAR(32) NOT NULL,
        payload JSONB NOT NULL,
        base_version INT DEFAULT 0,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await safeQuery(`
      CREATE TABLE IF NOT EXISTS nexus_shares (
        token VARCHAR(255) PRIMARY KEY,
        note_id VARCHAR(255),
        workspace_id VARCHAR(255) DEFAULT 'ws-default-nexus',
        access_level VARCHAR(32) DEFAULT 'view',
        note_data JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    dbInitialized = true;
  } catch (err: any) {
    console.warn('Could not ensure PostgreSQL tables (fallback to memory/cache):', err?.message || err);
  } finally {
    isEnsuringTable = false;
  }
}

/**
 * Saves a user record to PostgreSQL (if connected) and local persistent cache
 */
export async function saveUser(userRecord: UserRecord): Promise<UserRecord> {
  // Always update memory & disk first
  users.set(userRecord.id, userRecord);
  persistUsersToDisk();

  // If Postgres is configured, persist to database
  if (getPool()) {
    try {
      await ensurePostgresTable();
      await safeQuery(
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
          userRecord.password || '',
          userRecord.color || '#6366F1',
          userRecord.isVerified ?? true,
          userRecord.createdAt || new Date().toISOString(),
        ]
      );
    } catch (err: any) {
      console.warn('Error saving user to PostgreSQL:', err?.message || err);
    }
  }

  return userRecord;
}

/**
 * Retrieves a user by email or username from PostgreSQL or local cache
 */
export async function getUserByEmailOrUsername(identifier: string): Promise<UserRecord | null> {
  if (!identifier) return null;
  const key = identifier.trim().toLowerCase();

  // 1. Try PostgreSQL if configured
  if (getPool()) {
    try {
      await ensurePostgresTable();
      const res = await safeQuery(
        `SELECT id, username, email, name, password, color, is_verified, created_at
         FROM nexus_users
         WHERE LOWER(email) = $1 OR LOWER(username) = $1
         LIMIT 1`,
        [key]
      );
      if (res && res.rows && res.rows.length > 0) {
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
        users.set(record.id, record);
        persistUsersToDisk();
        return record;
      }
    } catch (err: any) {
      console.warn('PostgreSQL lookup error:', err?.message || err);
    }
  }

  // 2. Fallback to memory and persistent disk store
  const localMatch = Array.from(users.values()).find(
    (u) =>
      u.email?.toLowerCase() === key ||
      u.username?.toLowerCase() === key
  );

  return localMatch || null;
}

/**
 * Checks if username or email is already taken
 */
export async function isUsernameOrEmailTaken(username: string, email: string): Promise<{ usernameTaken: boolean; emailTaken: boolean }> {
  const normUser = (username || '').trim().toLowerCase();
  const normEmail = (email || '').trim().toLowerCase();

  if (getPool()) {
    try {
      await ensurePostgresTable();
      const res = await safeQuery(
        `SELECT username, email FROM nexus_users WHERE LOWER(username) = $1 OR LOWER(email) = $2 LIMIT 1`,
        [normUser, normEmail]
      );
      if (res && res.rows && res.rows.length > 0) {
        const row = res.rows[0];
        return {
          usernameTaken: row.username.toLowerCase() === normUser,
          emailTaken: row.email.toLowerCase() === normEmail,
        };
      }
    } catch (err: any) {
      console.warn('PostgreSQL check taken error:', err?.message || err);
    }
  }

  const userFound = Array.from(users.values()).some((u) => u.username?.toLowerCase() === normUser);
  const emailFound = Array.from(users.values()).some((u) => u.email?.toLowerCase() === normEmail);

  return { usernameTaken: userFound, emailTaken: emailFound };
}

// Stateless encrypted verification token generator for Serverless Lambdas
export function generateVerificationToken(email: string, code: string, userData: any = null): string {
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
  const payload = JSON.stringify({ email: email.toLowerCase(), code: String(code).trim(), userData, expiresAt });
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', crypto.createHash('sha256').update(AUTH_SECRET).digest(), iv);
  let encrypted = cipher.update(payload, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

// Stateless token decryptor
export function decryptVerificationToken(token: string): { email: string; code: string; userData: any; expiresAt: number } | null {
  if (!token || typeof token !== 'string') return null;
  try {
    const parts = token.split(':');
    if (parts.length !== 2) return null;
    const [ivHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', crypto.createHash('sha256').update(AUTH_SECRET).digest(), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch (err) {
    return null;
  }
}

/**
 * Persists an idempotent mutation record into memory and Neon PostgreSQL
 */
export async function saveMutation(op: any): Promise<void> {
  if (!op || !op.operationId) return;
  const now = new Date().toISOString();
  const mutationRecord = { ...op, appliedAt: now };
  operations.set(op.operationId, mutationRecord);

  if (getPool()) {
    try {
      await ensurePostgresTable();
      await safeQuery(
        `INSERT INTO nexus_mutations (operation_id, client_id, workspace_id, entity_type, entity_id, operation_type, payload, base_version, applied_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT (operation_id) DO NOTHING`,
        [
          op.operationId,
          op.clientId || 'anonymous-client',
          op.workspaceId || 'ws-default-nexus',
          op.entityType,
          op.entityId,
          op.operationType,
          JSON.stringify(op.payload || {}),
          op.baseVersion || 0,
        ],
        3500
      );
    } catch (err: any) {
      console.warn('Error saving mutation to PostgreSQL (cached in memory):', err?.message || err);
    }
  }
}

/**
 * Fetches mutations applied since a specific checkpoint timestamp
 */
export async function getMutationsSince(since?: string): Promise<any[]> {
  if (getPool()) {
    try {
      await ensurePostgresTable();
      let query = `SELECT operation_id, client_id, workspace_id, entity_type, entity_id, operation_type, payload, base_version, applied_at FROM nexus_mutations`;
      const params: any[] = [];
      if (since) {
        query += ` WHERE applied_at > $1`;
        params.push(since);
      }
      query += ` ORDER BY applied_at ASC`;
      const res = await safeQuery(query, params, 3500);
      if (res && Array.isArray(res.rows)) {
        return res.rows.map((row: any) => ({
          operationId: row.operation_id,
          clientId: row.client_id,
          workspaceId: row.workspace_id,
          entityType: row.entity_type,
          entityId: row.entity_id,
          operationType: row.operation_type,
          payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
          version: (row.base_version || 0) + 1,
          timestamp: row.applied_at?.toISOString ? row.applied_at.toISOString() : (row.applied_at || new Date().toISOString()),
          sourceClientId: row.client_id,
        }));
      }
    } catch (err: any) {
      console.warn('Error fetching mutations from PostgreSQL (falling back to memory):', err?.message || err);
    }
  }

  // Fallback to in-memory operations cache
  const ops = Array.from(operations.values());
  return ops
    .filter((op) => !since || (op.appliedAt && op.appliedAt > since))
    .map((op) => ({
      operationId: op.operationId,
      entityType: op.entityType,
      entityId: op.entityId,
      operationType: op.operationType,
      payload: op.payload,
      version: (op.baseVersion || 0) + 1,
      timestamp: op.appliedAt || new Date().toISOString(),
      sourceClientId: op.clientId,
    }));
}

/**
 * Saves or updates a note in memory and Neon PostgreSQL
 */
export async function saveNote(note: any): Promise<void> {
  if (!note || !note.id) return;
  notes.set(note.id, note);

  if (getPool()) {
    try {
      await ensurePostgresTable();
      await safeQuery(
        `INSERT INTO nexus_notes (id, workspace_id, folder_id, title, content, plain_text, icon, tags, is_pinned, is_archived, is_trash, version, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           content = EXCLUDED.content,
           plain_text = EXCLUDED.plain_text,
           icon = EXCLUDED.icon,
           tags = EXCLUDED.tags,
           is_pinned = EXCLUDED.is_pinned,
           is_archived = EXCLUDED.is_archived,
           is_trash = EXCLUDED.is_trash,
           version = EXCLUDED.version,
           updated_at = NOW()`,
        [
          note.id,
          note.workspaceId || 'ws-default-nexus',
          note.folderId || null,
          note.title || 'Untitled Note',
          note.content || '',
          note.plainText || '',
          note.icon || '📝',
          JSON.stringify(note.tags || []),
          Boolean(note.isPinned),
          Boolean(note.isArchived),
          Boolean(note.isTrash),
          note.version || 1,
        ],
        3500
      );
    } catch (err: any) {
      console.warn('Error saving note to PostgreSQL (saved to memory):', err?.message || err);
    }
  }
}

/**
 * Deletes a note from memory and Neon PostgreSQL
 */
export async function deleteNote(noteId: string): Promise<void> {
  if (!noteId) return;
  notes.delete(noteId);

  if (getPool()) {
    try {
      await ensurePostgresTable();
      await safeQuery(`DELETE FROM nexus_notes WHERE id = $1`, [noteId], 3500);
    } catch (err: any) {
      console.warn('Error deleting note from PostgreSQL:', err?.message || err);
    }
  }
}

/**
 * Retrieves all notes from Neon PostgreSQL (or in-memory fallback)
 */
export async function getNotes(): Promise<any[]> {
  if (getPool()) {
    try {
      await ensurePostgresTable();
      const res = await safeQuery(`SELECT * FROM nexus_notes WHERE is_trash = FALSE ORDER BY updated_at DESC`, [], 3500);
      if (res && Array.isArray(res.rows)) {
        return res.rows.map((row: any) => ({
          id: row.id,
          workspaceId: row.workspace_id,
          folderId: row.folder_id,
          title: row.title,
          content: row.content,
          plainText: row.plain_text,
          icon: row.icon,
          tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags,
          isPinned: row.is_pinned,
          isArchived: row.is_archived,
          isTrash: row.is_trash,
          version: row.version,
          updatedAt: row.updated_at?.toISOString ? row.updated_at.toISOString() : (row.updated_at || new Date().toISOString()),
          createdAt: row.created_at?.toISOString ? row.created_at.toISOString() : (row.created_at || new Date().toISOString()),
        }));
      }
    } catch (err: any) {
      console.warn('Error fetching notes from PostgreSQL (fallback to memory):', err?.message || err);
    }
  }

  return Array.from(notes.values());
}

/**
 * Retrieves a single note by ID from Neon PostgreSQL or local cache
 */
export async function getNoteById(noteId: string): Promise<any | null> {
  if (!noteId) return null;

  if (getPool()) {
    try {
      await ensurePostgresTable();
      const res = await safeQuery(`SELECT * FROM nexus_notes WHERE id = $1 LIMIT 1`, [noteId], 3500);
      if (res && res.rows && res.rows.length > 0) {
        const row = res.rows[0];
        return {
          id: row.id,
          workspaceId: row.workspace_id,
          folderId: row.folder_id,
          title: row.title,
          content: row.content,
          plainText: row.plain_text,
          icon: row.icon,
          tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags,
          isPinned: row.is_pinned,
          isArchived: row.is_archived,
          isTrash: row.is_trash,
          version: row.version,
          updatedAt: row.updated_at?.toISOString ? row.updated_at.toISOString() : (row.updated_at || new Date().toISOString()),
          createdAt: row.created_at?.toISOString ? row.created_at.toISOString() : (row.created_at || new Date().toISOString()),
        };
      }
    } catch (err: any) {
      console.warn('Error fetching note by id from PostgreSQL:', err?.message || err);
    }
  }

  return notes.get(noteId) || null;
}

/**
 * Saves a shared link record containing the note payload
 */
export async function saveShareRecord(record: any): Promise<void> {
  if (!record || !record.token) return;
  shareStore.set(record.token, record);
  if (record.noteId) {
    shareStore.set(record.noteId, record);
  }

  if (getPool()) {
    try {
      await ensurePostgresTable();
      await safeQuery(
        `INSERT INTO nexus_shares (token, note_id, workspace_id, access_level, note_data, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (token) DO UPDATE SET
           note_id = EXCLUDED.note_id,
           workspace_id = EXCLUDED.workspace_id,
           access_level = EXCLUDED.access_level,
           note_data = EXCLUDED.note_data`,
        [
          record.token,
          record.noteId || null,
          record.workspaceId || 'ws-default-nexus',
          record.accessLevel || 'view',
          JSON.stringify(record.noteData || null),
        ],
        3500
      );
    } catch (err: any) {
      console.warn('Error saving share record to PostgreSQL:', err?.message || err);
    }
  }
}

/**
 * Retrieves a shared link record by token or noteId
 */
export async function getShareRecord(token: string): Promise<any | null> {
  if (!token) return null;

  if (getPool()) {
    try {
      await ensurePostgresTable();
      const res = await safeQuery(
        `SELECT * FROM nexus_shares WHERE token = $1 OR note_id = $1 LIMIT 1`,
        [token],
        3500
      );
      if (res && res.rows && res.rows.length > 0) {
        const row = res.rows[0];
        return {
          token: row.token,
          noteId: row.note_id,
          workspaceId: row.workspace_id,
          accessLevel: row.access_level,
          noteData: typeof row.note_data === 'string' ? JSON.parse(row.note_data) : row.note_data,
          createdAt: row.created_at?.toISOString ? row.created_at.toISOString() : (row.created_at || new Date().toISOString()),
        };
      }
    } catch (err: any) {
      console.warn('Error fetching share record from PostgreSQL:', err?.message || err);
    }
  }

  return shareStore.get(token) || null;
}
