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

const AUTH_SECRET = process.env.JWT_SECRET || 'nexus-secret-key-2026-auth-gate';
const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || null;

// File persistence fallback for Serverless Lambdas when no external Postgres is configured
const PERSISTENT_FILE_PATH = process.env.VERCEL
  ? '/tmp/nexus_users_store.json'
  : path.resolve(process.cwd(), '.nexus_users_store.json');

// Load cached users from disk on cold start
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
  console.warn('Could not read persistent users store file:', e.message);
}

function persistUsersToDisk() {
  try {
    const list = Array.from(users.values());
    fs.writeFileSync(PERSISTENT_FILE_PATH, JSON.stringify(list, null, 2), 'utf8');
  } catch (e: any) {
    console.warn('Could not persist users to disk:', e.message);
  }
}

// 2. PostgreSQL Connection Pool (if DATABASE_URL is configured)
let pool: pg.Pool | null = null;
let dbInitialized = false;

if (DB_URL) {
  try {
    pool = new Pool({
      connectionString: DB_URL,
      ssl: DB_URL.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 5,
      connectionTimeoutMillis: 5000,
    });
  } catch (e) {
    console.error('Failed to initialize PostgreSQL pool:', e);
  }
}

async function ensurePostgresTable() {
  if (!pool || dbInitialized) return;
  try {
    await pool.query(`
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
    dbInitialized = true;
  } catch (err: any) {
    console.error('Error ensuring PostgreSQL nexus_users table:', err.message);
  }
}

/**
 * Saves a user record to PostgreSQL (if connected) and local persistent cache
 */
export async function saveUser(userRecord: UserRecord): Promise<UserRecord> {
  // Always update memory & disk
  users.set(userRecord.id, userRecord);
  persistUsersToDisk();

  // If Postgres is configured, persist to database
  if (pool) {
    try {
      await ensurePostgresTable();
      await pool.query(
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
      console.error('Error saving user to PostgreSQL:', err.message);
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
  if (pool) {
    try {
      await ensurePostgresTable();
      const res = await pool.query(
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
        // Refresh local cache
        users.set(record.id, record);
        persistUsersToDisk();
        return record;
      }
    } catch (err: any) {
      console.error('PostgreSQL lookup error:', err.message);
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

  if (pool) {
    try {
      await ensurePostgresTable();
      const res = await pool.query(
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
      console.error('PostgreSQL check taken error:', err.message);
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
    console.error('Error decrypting verification token:', err);
    return null;
  }
}
