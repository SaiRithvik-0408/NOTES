// server/src/app.ts
import express from "express";
import cors from "cors";

// server/src/db.ts
import "dotenv/config";
import fs from "fs";
import path from "path";
import pg from "pg";
var { Pool } = pg;
var DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || null;
var PERSISTENT_FILE_PATH = process.env.VERCEL ? "/tmp/nexus_users_store.json" : path.resolve(process.cwd(), ".nexus_users_store.json");
var ServerDatabase = class {
  workspaces = /* @__PURE__ */ new Map();
  folders = /* @__PURE__ */ new Map();
  notes = /* @__PURE__ */ new Map();
  comments = /* @__PURE__ */ new Map();
  attachments = /* @__PURE__ */ new Map();
  operations = /* @__PURE__ */ new Map();
  revisions = /* @__PURE__ */ new Map();
  users = /* @__PURE__ */ new Map();
  otpStore = /* @__PURE__ */ new Map();
  pool = null;
  dbInitialized = false;
  constructor() {
    this.seedDefaultData();
    this.loadFromDisk();
    this.initPostgres();
  }
  seedDefaultData() {
    const defaultWorkspaceId = "ws-default-nexus";
    const now = (/* @__PURE__ */ new Date()).toISOString();
    this.workspaces.set(defaultWorkspaceId, {
      id: defaultWorkspaceId,
      name: "Nexus Engineering Workspace",
      slug: "nexus-engineering",
      ownerId: "system-owner",
      createdAt: now,
      updatedAt: now
    });
  }
  loadFromDisk() {
    try {
      if (fs.existsSync(PERSISTENT_FILE_PATH)) {
        const raw = fs.readFileSync(PERSISTENT_FILE_PATH, "utf8");
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          for (const u of list) {
            if (u && u.id) {
              this.users.set(u.id, u);
            }
          }
        }
      }
    } catch (err) {
      console.warn("[serverDb] Could not read .nexus_users_store.json:", err.message);
    }
  }
  persistToDisk() {
    try {
      const list = Array.from(this.users.values());
      fs.writeFileSync(PERSISTENT_FILE_PATH, JSON.stringify(list, null, 2), "utf8");
    } catch (err) {
      console.warn("[serverDb] Could not write .nexus_users_store.json:", err.message);
    }
  }
  isEnsuringTable = false;
  async initPostgres() {
    if (!DB_URL) return;
    try {
      this.pool = new Pool({
        connectionString: DB_URL,
        ssl: DB_URL.includes("localhost") ? false : { rejectUnauthorized: false },
        max: 10,
        connectionTimeoutMillis: 15e3,
        idleTimeoutMillis: 3e4
      });
      this.pool.on("error", (err) => {
        console.warn("[serverDb] PostgreSQL Pool error (falling back to disk/in-memory):", err.message);
      });
      await this.ensurePostgresTable();
      await this.loadUsersFromPostgres();
      console.log("\u2705 [serverDb] Connected to Neon PostgreSQL cloud database successfully.");
    } catch (err) {
      console.warn("[serverDb] Failed to connect to PostgreSQL (falling back to disk/in-memory):", err.message);
    }
  }
  async ensurePostgresTable() {
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

        CREATE TABLE IF NOT EXISTS nexus_notes (
          id VARCHAR(255) PRIMARY KEY,
          workspace_id VARCHAR(255) DEFAULT 'ws-default-nexus',
          folder_id VARCHAR(255),
          title TEXT NOT NULL,
          content TEXT DEFAULT '',
          plain_text TEXT DEFAULT '',
          icon VARCHAR(64) DEFAULT '\u{1F4DD}',
          tags JSONB DEFAULT '[]'::jsonb,
          is_pinned BOOLEAN DEFAULT FALSE,
          is_archived BOOLEAN DEFAULT FALSE,
          is_trash BOOLEAN DEFAULT FALSE,
          version INT DEFAULT 1,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

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
        );
      `);
      this.dbInitialized = true;
    } catch (err) {
      console.warn("[serverDb] Error ensuring PostgreSQL tables:", err.message);
    } finally {
      this.isEnsuringTable = false;
    }
  }
  async loadUsersFromPostgres() {
    if (!this.pool) return;
    try {
      await this.ensurePostgresTable();
      const res = await this.pool.query("SELECT * FROM nexus_users");
      for (const row of res.rows) {
        const u = {
          id: row.id,
          username: row.username,
          name: row.name,
          email: row.email,
          password: row.password,
          color: row.color,
          isVerified: row.is_verified,
          createdAt: row.created_at
        };
        this.users.set(u.id, u);
      }
      this.persistToDisk();
    } catch (err) {
      console.warn("[serverDb] Error loading users from PostgreSQL:", err.message);
    }
  }
  async saveUser(userRecord) {
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
            userRecord.color || "#6366F1",
            userRecord.isVerified ?? true,
            userRecord.createdAt || (/* @__PURE__ */ new Date()).toISOString()
          ]
        );
      } catch (err) {
        console.warn("[serverDb] Error saving user to PostgreSQL:", err.message);
      }
    }
    return userRecord;
  }
  async getUserByEmailOrUsername(identifier) {
    if (!identifier) return null;
    const key = identifier.trim().toLowerCase();
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
          const record = {
            id: row.id,
            username: row.username,
            email: row.email,
            name: row.name,
            password: row.password,
            color: row.color,
            isVerified: row.is_verified,
            createdAt: row.created_at
          };
          this.users.set(record.id, record);
          this.persistToDisk();
          return record;
        }
      } catch (err) {
        console.warn("[serverDb] PostgreSQL getUserByEmailOrUsername error:", err.message);
      }
    }
    let match = Array.from(this.users.values()).find(
      (u) => u.email?.toLowerCase() === key || u.username?.toLowerCase() === key
    );
    if (!match) {
      this.loadFromDisk();
      match = Array.from(this.users.values()).find(
        (u) => u.email?.toLowerCase() === key || u.username?.toLowerCase() === key
      );
    }
    return match ? match : null;
  }
  async isUsernameOrEmailTaken(username, email) {
    const normUser = (username || "").trim().toLowerCase();
    const normEmail = (email || "").trim().toLowerCase();
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
            emailTaken: row.email.toLowerCase() === normEmail
          };
        }
      } catch (err) {
        console.warn("[serverDb] PostgreSQL isUsernameOrEmailTaken error:", err.message);
      }
    }
    this.loadFromDisk();
    const usernameTaken = Array.from(this.users.values()).some((u) => u.username?.toLowerCase() === normUser);
    const emailTaken = Array.from(this.users.values()).some((u) => u.email?.toLowerCase() === normEmail);
    return { usernameTaken, emailTaken };
  }
  applyMutation(op) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    this.operations.set(op.operationId, { id: op.operationId, ...op, appliedAt: now });
    let table = null;
    if (op.entityType === "note") table = this.notes;
    else if (op.entityType === "folder") table = this.folders;
    else if (op.entityType === "comment") table = this.comments;
    else if (op.entityType === "attachment") table = this.attachments;
    else if (op.entityType === "workspace") table = this.workspaces;
    if (!table) return;
    if (op.operationType === "create" || op.operationType === "update") {
      table.set(op.entityId, {
        ...op.payload,
        id: op.entityId,
        updatedAt: now
      });
    } else if (op.operationType === "patch") {
      const existing = table.get(op.entityId) || { id: op.entityId };
      table.set(op.entityId, {
        ...existing,
        ...op.payload,
        updatedAt: now
      });
    } else if (op.operationType === "delete") {
      table.delete(op.entityId);
    }
    if (this.pool) {
      this.ensurePostgresTable().then(async () => {
        try {
          await this.pool.query(
            `INSERT INTO nexus_mutations (operation_id, client_id, workspace_id, entity_type, entity_id, operation_type, payload, base_version, applied_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
             ON CONFLICT (operation_id) DO NOTHING`,
            [
              op.operationId,
              op.clientId || "anonymous-client",
              op.payload?.workspaceId || "ws-default-nexus",
              op.entityType,
              op.entityId,
              op.operationType,
              JSON.stringify(op.payload || {}),
              op.baseVersion || 0
            ]
          );
          if (op.entityType === "note") {
            if (op.operationType === "create" || op.operationType === "update") {
              const p = op.payload || {};
              await this.pool.query(
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
                  op.entityId,
                  p.workspaceId || "ws-default-nexus",
                  p.folderId || null,
                  p.title || "Untitled Note",
                  p.content || "",
                  p.plainText || "",
                  p.icon || "\u{1F4DD}",
                  JSON.stringify(p.tags || []),
                  Boolean(p.isPinned),
                  Boolean(p.isArchived),
                  Boolean(p.isTrash),
                  p.version || 1
                ]
              );
            } else if (op.operationType === "delete") {
              await this.pool.query(`DELETE FROM nexus_notes WHERE id = $1`, [op.entityId]);
            }
          }
        } catch (err) {
          console.warn("[serverDb] Error persisting mutation to PostgreSQL:", err.message);
        }
      });
    }
  }
};
var serverDb = new ServerDatabase();

// server/src/app.ts
import crypto from "crypto";

// server/src/mailer.ts
import nodemailer from "nodemailer";
async function sendOtpEmail(email, code, name = "there") {
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "465");
  if (!user || !pass) {
    console.log(`\u{1F510} [Nexus Notes] No SMTP credentials in environment. Simulated OTP for ${email}: ${code}`);
    return {
      sent: false,
      reason: "No SMTP credentials configured. In dev/preview, use the Dev Mode OTP code displayed in the app."
    };
  }
  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });
    const info = await transporter.sendMail({
      from: `"Nexus Notes" <${user}>`,
      to: email,
      subject: `\u{1F510} Your Nexus Notes Verification Code: ${code}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8" /></head>
        <body style="margin: 0; padding: 0; background-color: #0B0F19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0B0F19; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="100%" style="max-width: 480px; background-color: #0F1626; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); padding: 36px 28px; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
                  <tr>
                    <td align="center" style="padding-bottom: 20px;">
                      <h2 style="color: #FFFFFF; font-size: 22px; font-weight: 800; margin: 0; letter-spacing: -0.02em;">Nexus Notes</h2>
                      <p style="color: #94A3B8; font-size: 13px; margin: 6px 0 0 0;">Local-First Collaborative Intelligence Platform</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="color: #E2E8F0; font-size: 15px; line-height: 1.6; padding-bottom: 15px;">
                      Hi <strong>${name}</strong>,
                    </td>
                  </tr>
                  <tr>
                    <td style="color: #94A3B8; font-size: 14px; line-height: 1.6; padding-bottom: 25px;">
                      Please use the 6-digit verification code below to activate your account:
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-bottom: 25px;">
                      <div style="display: inline-block; background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.4); border-radius: 14px; padding: 16px 32px;">
                        <span style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #FFFFFF; font-family: monospace;">${code}</span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="color: #64748B; font-size: 13px; line-height: 1.5; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 20px;">
                      This code expires in 10 minutes. If you did not create a Nexus Notes account, you can safely ignore this email.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `
    });
    console.log(`\u2709\uFE0F [Nexus Notes] Email sent to ${email}: ${info.messageId}`);
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error(`\u274C [Nexus Notes] Failed to send email to ${email}:`, err);
    return { sent: false, error: err.message };
  }
}
async function sendChessInviteEmail(email, inviterName, inviteUrl, roomCode) {
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "465");
  if (!user || !pass) {
    console.log(`\u265F\uFE0F [Nexus Chess] Simulated email invite to ${email} for room ${roomCode}: ${inviteUrl}`);
    return {
      sent: true,
      reason: "Simulated email sent in dev mode."
    };
  }
  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });
    const info = await transporter.sendMail({
      from: `"Nexus Chess" <${user}>`,
      to: email,
      subject: `\u265F\uFE0F ${inviterName} challenged you to a game of Chess!`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8" /></head>
        <body style="margin: 0; padding: 0; background-color: #0B0F19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0B0F19; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="100%" style="max-width: 480px; background-color: #0F1626; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); padding: 36px 28px; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
                  <tr>
                    <td align="center" style="padding-bottom: 20px;">
                      <div style="font-size: 40px; line-height: 1; margin-bottom: 8px;">\u265F\uFE0F \u{1F451}</div>
                      <h2 style="color: #FFFFFF; font-size: 22px; font-weight: 800; margin: 0; letter-spacing: -0.02em;">Nexus Chess Challenge</h2>
                      <p style="color: #94A3B8; font-size: 13px; margin: 6px 0 0 0;">Real-Time 3D & 2D Multiplayer Match</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="color: #E2E8F0; font-size: 15px; line-height: 1.6; padding-bottom: 15px;">
                      <strong>${inviterName}</strong> has invited you to join a live chess match!
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-bottom: 25px;">
                      <div style="display: inline-block; background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.4); border-radius: 12px; padding: 12px 24px;">
                        <span style="font-size: 12px; color: #94A3B8; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 4px;">Room Code</span>
                        <span style="font-size: 24px; font-weight: 800; letter-spacing: 4px; color: #6366F1; font-family: monospace;">${roomCode}</span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-bottom: 25px;">
                      <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366F1, #8B5CF6); color: #FFFFFF; text-decoration: none; font-size: 15px; font-weight: 700; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);">
                        Join Match or Spectate &rarr;
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td style="color: #64748B; font-size: 13px; line-height: 1.5; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 20px;">
                      Please note: You will need to log into your Nexus Notes account to play as an active participant. You can also join as a spectator to watch the match live.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `
    });
    console.log(`\u2709\uFE0F [Nexus Chess] Invite sent to ${email}: ${info.messageId}`);
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error(`\u274C [Nexus Chess] Failed to send email invite to ${email}:`, err);
    return { sent: false, error: err.message };
  }
}

// server/src/app.ts
var AUTH_SECRET = process.env.JWT_SECRET || "nexus-secret-key-2026-auth-gate";
function generateVerificationToken(email, code, userData = null) {
  const expiresAt = Date.now() + 10 * 60 * 1e3;
  const payload = JSON.stringify({ email: email.toLowerCase(), code: String(code).trim(), userData, expiresAt });
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", crypto.createHash("sha256").update(AUTH_SECRET).digest(), iv);
  let encrypted = cipher.update(payload, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
}
function decryptVerificationToken(token) {
  if (!token || typeof token !== "string") return null;
  try {
    const parts = token.split(":");
    if (parts.length !== 2) return null;
    const [ivHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", crypto.createHash("sha256").update(AUTH_SECRET).digest(), iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return JSON.parse(decrypted);
  } catch {
    return null;
  }
}
var app = express();
var PORT = process.env.PORT || 3001;
app.use(cors());
app.use(express.json({ limit: "25mb" }));
var workspaceMembersStore = /* @__PURE__ */ new Map();
workspaceMembersStore.set("ws-default-nexus", []);
app.get(["/api/v1/health", "/api/health", "/health"], (req, res) => {
  res.json({
    status: "ok",
    service: "Nexus Notes Synchronization Service on Vercel",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    version: "1.0.0"
  });
});
app.get("/api/v1/workspaces", (req, res) => {
  const list = Array.from(serverDb.workspaces.values());
  res.json(list);
});
app.get("/api/v1/notes", (req, res) => {
  const noteId = req.query.id || req.query.noteId;
  if (noteId) {
    const note = serverDb.notes.get(noteId);
    if (!note) return res.status(404).json({ error: "Note not found" });
    return res.json(note);
  }
  const list = Array.from(serverDb.notes.values());
  res.json(list);
});
app.get("/api/v1/notes/:id", (req, res) => {
  const note = serverDb.notes.get(req.params.id);
  if (!note) return res.status(404).json({ error: "Note not found" });
  res.json(note);
});
app.post("/api/v1/notes", (req, res) => {
  const note = req.body;
  if (!note || !note.id) return res.status(400).json({ error: "Invalid note payload" });
  serverDb.notes.set(note.id, note);
  res.status(201).json(note);
});
app.get("/api/v1/folders", (req, res) => {
  const list = Array.from(serverDb.folders.values());
  res.json(list);
});
app.get("/api/v1/comments", (req, res) => {
  const noteId = req.query.noteId;
  const list = Array.from(serverDb.comments.values()).filter((c) => !noteId || c.noteId === noteId);
  res.json(list);
});
app.post("/api/v1/sync", (req, res) => {
  const op = req.body;
  if (!op || !op.operationId || !op.entityId) {
    return res.status(400).json({ error: "Invalid mutation payload" });
  }
  serverDb.applyMutation(op);
  res.json({
    success: true,
    operationId: op.operationId,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.get("/api/v1/sync", (req, res) => {
  const since = req.query.since;
  const operations = Array.from(serverDb.operations.values());
  const changes = operations.filter((op) => !since || op.appliedAt > since).map((op) => ({
    operationId: op.operationId,
    entityType: op.entityType,
    entityId: op.entityId,
    operationType: op.operationType,
    payload: op.payload,
    version: op.baseVersion + 1,
    timestamp: op.appliedAt,
    sourceClientId: op.clientId
  }));
  const response = {
    serverCheckpoint: (/* @__PURE__ */ new Date()).toISOString(),
    changes
  };
  res.json(response);
});
app.get("/api/v1/auth/check-username", async (req, res) => {
  const username = (req.query.username || "").trim().toLowerCase();
  if (!username) {
    return res.status(400).json({ available: false, message: "Username is required" });
  }
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return res.json({
      available: false,
      message: "Username must be 3-20 alphanumeric characters or underscores"
    });
  }
  const existing = await serverDb.getUserByEmailOrUsername(username);
  if (existing) {
    return res.json({ available: false, message: "Username is already taken" });
  }
  res.json({ available: true, message: "Username is available" });
});
app.post("/api/v1/auth/send-otp", async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes("@")) {
    return res.status(400).json({ success: false, message: "Valid email is required" });
  }
  const normalizedEmail = email.trim().toLowerCase();
  const code = Math.floor(1e5 + Math.random() * 9e5).toString();
  const expiresAt = Date.now() + 10 * 60 * 1e3;
  const existingOtp = serverDb.otpStore.get(normalizedEmail);
  serverDb.otpStore.set(normalizedEmail, {
    code,
    expiresAt,
    userData: existingOtp?.userData
  });
  const verificationToken = generateVerificationToken(normalizedEmail, code, existingOtp?.userData);
  console.log(`\u{1F510} [Nexus Auth] OTP for ${normalizedEmail}: ${code}`);
  let mailResult = { sent: false, reason: "" };
  try {
    mailResult = await sendOtpEmail(normalizedEmail, code, existingOtp?.userData?.name || "there");
  } catch (err) {
    console.warn("[Nexus Auth] Could not send OTP email via SMTP:", err.message);
  }
  const isProd = process.env.NODE_ENV === "production";
  res.json({
    success: true,
    message: mailResult.sent ? `Verification code delivered to ${normalizedEmail}` : `Verification code generated for ${normalizedEmail}`,
    // Disable devOtp in production for security:
    ...isProd ? {} : { devOtp: code },
    verificationToken,
    emailSent: mailResult.sent
  });
});
app.post("/api/v1/auth/register", async (req, res) => {
  const { name, username, email, password, confirmPassword } = req.body;
  if (!name || !username || !email || !password) {
    return res.status(400).json({ success: false, message: "All fields are required" });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ success: false, message: "Passwords do not match" });
  }
  if (password.length < 6) {
    return res.status(400).json({ success: false, message: "Password must be at least 6 characters long" });
  }
  const normalizedUsername = username.trim().toLowerCase();
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(normalizedUsername)) {
    return res.status(400).json({
      success: false,
      message: "Username must be 3-20 alphanumeric characters or underscores"
    });
  }
  const normalizedEmail = email.trim().toLowerCase();
  const { usernameTaken, emailTaken } = await serverDb.isUsernameOrEmailTaken(normalizedUsername, normalizedEmail);
  if (usernameTaken) {
    return res.status(400).json({ success: false, message: "Username is already taken" });
  }
  if (emailTaken) {
    return res.status(400).json({ success: false, message: "An account with this email already exists" });
  }
  const code = Math.floor(1e5 + Math.random() * 9e5).toString();
  const expiresAt = Date.now() + 10 * 60 * 1e3;
  const userData = {
    name: name.trim(),
    username: normalizedUsername,
    email: normalizedEmail,
    password
  };
  const verificationToken = generateVerificationToken(normalizedEmail, code, userData);
  serverDb.otpStore.set(normalizedEmail, {
    code,
    expiresAt,
    userData
  });
  console.log(`\u{1F510} [Nexus Auth] New Registration OTP for ${normalizedEmail} (${normalizedUsername}): ${code}`);
  let mailResult = { sent: false, reason: "" };
  try {
    mailResult = await sendOtpEmail(normalizedEmail, code, name.trim());
  } catch (err) {
    console.warn("[Nexus Auth] Could not send OTP email via SMTP:", err.message);
  }
  const isProd = process.env.NODE_ENV === "production";
  res.json({
    success: true,
    message: mailResult.sent ? `Verification code delivered to ${normalizedEmail}` : `Verification code generated for ${normalizedEmail}`,
    // Disable devOtp in production for security:
    ...isProd ? {} : { devOtp: code },
    verificationToken,
    emailSent: mailResult.sent
  });
});
app.post("/api/v1/auth/verify-otp", async (req, res) => {
  const { email, code, verificationToken } = req.body;
  if (!email || !code) {
    return res.status(400).json({ success: false, message: "Email and verification code are required" });
  }
  const normalizedEmail = email.trim().toLowerCase();
  const inputCode = String(code).trim();
  let verified = false;
  let userData = null;
  if (verificationToken) {
    const tokenData = decryptVerificationToken(verificationToken);
    if (tokenData && tokenData.email.toLowerCase() === normalizedEmail && tokenData.code === inputCode) {
      if (Date.now() <= tokenData.expiresAt) {
        verified = true;
        userData = tokenData.userData;
      }
    }
  }
  if (!verified) {
    const challenge = serverDb.otpStore.get(normalizedEmail);
    if (challenge && challenge.code === inputCode && Date.now() <= challenge.expiresAt) {
      verified = true;
      userData = challenge.userData;
      serverDb.otpStore.delete(normalizedEmail);
    }
  }
  if (!verified) {
    return res.status(400).json({ success: false, message: "Invalid or expired verification code. Please check and try again." });
  }
  let userRecord = null;
  if (userData) {
    const newUserId = `user-${Date.now()}`;
    const colors = ["#6366F1", "#EC4899", "#10B981", "#3B82F6", "#8B5CF6", "#F59E0B"];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    userRecord = {
      id: newUserId,
      username: userData.username,
      name: userData.name,
      email: userData.email,
      password: userData.password,
      color: randomColor,
      isVerified: true,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await serverDb.saveUser(userRecord);
    const defaultWsMembers = workspaceMembersStore.get("ws-default-nexus") || [];
    defaultWsMembers.push({
      userId: newUserId,
      workspaceId: "ws-default-nexus",
      role: "editor",
      joinedAt: (/* @__PURE__ */ new Date()).toISOString(),
      user: {
        id: newUserId,
        username: userRecord.username,
        name: userRecord.name,
        email: userRecord.email,
        color: userRecord.color
      }
    });
    workspaceMembersStore.set("ws-default-nexus", defaultWsMembers);
  } else {
    userRecord = await serverDb.getUserByEmailOrUsername(normalizedEmail);
    if (userRecord) {
      userRecord.isVerified = true;
      await serverDb.saveUser(userRecord);
    }
  }
  serverDb.otpStore.delete(normalizedEmail);
  if (!userRecord) {
    return res.status(400).json({ success: false, message: "User record could not be located." });
  }
  const token = `jwt-${Date.now()}-${userRecord.id}`;
  res.json({
    success: true,
    token,
    user: {
      id: userRecord.id,
      username: userRecord.username,
      name: userRecord.name,
      email: userRecord.email,
      color: userRecord.color,
      avatarUrl: userRecord.avatarUrl
    },
    message: "Account verified and authenticated successfully!"
  });
});
app.post("/api/v1/auth/login", async (req, res) => {
  const { identifier, email, password } = req.body;
  const loginKey = (identifier || email || "").trim().toLowerCase();
  if (!loginKey || !password) {
    return res.status(400).json({ success: false, message: "Username/email and password are required" });
  }
  const user = await serverDb.getUserByEmailOrUsername(loginKey);
  if (!user) {
    return res.status(401).json({ success: false, message: "Account not found with this username or email" });
  }
  if (user.password !== password) {
    return res.status(401).json({ success: false, message: "Incorrect password" });
  }
  const token = `jwt-${Date.now()}-${user.id}`;
  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      color: user.color,
      avatarUrl: user.avatarUrl
    },
    message: "Signed in successfully"
  });
});
app.get("/api/v1/auth/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = authHeader.replace("Bearer ", "");
  const userId = token.split("-")[2];
  const user = userId ? serverDb.users.get(userId) || await serverDb.getUserByEmailOrUsername(userId) : null;
  if (!user) {
    return res.status(401).json({ error: "Session invalid or expired" });
  }
  res.json({
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    color: user.color,
    avatarUrl: user.avatarUrl
  });
});
app.get("/api/v1/workspaces/:id/members", (req, res) => {
  const members = workspaceMembersStore.get(req.params.id) || [];
  res.json(members);
});
app.post("/api/v1/workspaces/:id/invite", (req, res) => {
  const { email, role } = req.body;
  const workspaceId = req.params.id;
  const members = workspaceMembersStore.get(workspaceId) || [];
  const newMember = {
    userId: `user-${Date.now()}`,
    workspaceId,
    role: role || "editor",
    joinedAt: (/* @__PURE__ */ new Date()).toISOString(),
    user: {
      id: `user-${Date.now()}`,
      name: email.split("@")[0],
      email,
      color: "#10B981"
    }
  };
  members.push(newMember);
  workspaceMembersStore.set(workspaceId, members);
  res.status(201).json(newMember);
});
var shareLinksStore = /* @__PURE__ */ new Map();
app.post(["/api/v1/share/create", "/api/v1/share"], (req, res) => {
  const { token, noteId, workspaceId, accessLevel, noteData } = req.body;
  const shareToken = token || (noteId ? `note-${noteId.replace("note-", "")}` : `share-${Math.random().toString(36).substring(2, 10)}`);
  const record = {
    token: shareToken,
    noteId: noteId || noteData?.id,
    workspaceId: workspaceId || noteData?.workspaceId || "ws-default-nexus",
    accessLevel: accessLevel || "view",
    noteData: noteData || (noteId ? serverDb.notes.get(noteId) : null),
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  shareLinksStore.set(shareToken, record);
  if (record.noteId) {
    shareLinksStore.set(record.noteId, record);
  }
  if (noteData && noteData.id) {
    serverDb.notes.set(noteData.id, noteData);
  }
  res.json({ success: true, record });
});
app.get(["/api/v1/share/:token", "/api/v1/share"], (req, res) => {
  const token = req.params.token || req.query.token || req.query.share || req.query.id;
  if (!token) return res.status(400).json({ error: "Missing share token or note id" });
  const record = shareLinksStore.get(token);
  if (record && record.noteData) {
    return res.json({
      success: true,
      note: record.noteData,
      accessLevel: record.accessLevel || "view",
      workspaceId: record.workspaceId || "ws-default-nexus"
    });
  }
  const directNote = serverDb.notes.get(token);
  if (directNote) {
    return res.json({
      success: true,
      note: directNote,
      accessLevel: "view",
      workspaceId: directNote.workspaceId || "ws-default-nexus"
    });
  }
  return res.status(404).json({ error: "Share link not found or expired" });
});
app.post("/api/v1/chess/invite", async (req, res) => {
  const { email, inviterName, inviteUrl, roomCode } = req.body;
  if (!email || !inviteUrl || !roomCode) {
    return res.status(400).json({ error: "Missing email, inviteUrl, or roomCode" });
  }
  try {
    const result = await sendChessInviteEmail(
      email,
      inviterName || "A Player",
      inviteUrl,
      roomCode
    );
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("Failed to dispatch chess invite email:", err);
    res.json({ success: true, simulated: true, message: "Invite registered in dev mode" });
  }
});
var app_default = app;
export {
  app,
  app_default as default
};
