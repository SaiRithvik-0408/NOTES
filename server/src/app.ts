import express from 'express';
import http from 'http';
import cors from 'cors';
import { serverDb } from './db';
import { ServerSyncPushRequest, ServerSyncPullResponse } from './types';
import crypto from 'crypto';
import { sendOtpEmail, sendChessInviteEmail } from './mailer';

const AUTH_SECRET = process.env.JWT_SECRET || 'nexus-secret-key-2026-auth-gate';

function generateVerificationToken(email: string, code: string, userData: any = null) {
  const expiresAt = Date.now() + 10 * 60 * 1000;
  const payload = JSON.stringify({ email: email.toLowerCase(), code: String(code).trim(), userData, expiresAt });
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', crypto.createHash('sha256').update(AUTH_SECRET).digest(), iv);
  let encrypted = cipher.update(payload, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

function decryptVerificationToken(token: string) {
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
  } catch {
    return null;
  }
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '25mb' }));

const workspaceMembersStore = new Map<string, any[]>();
workspaceMembersStore.set('ws-default-nexus', []);

// Health check endpoints
app.get(['/api/v1/health', '/api/health', '/health'], (req, res) => {
  res.json({
    status: 'ok',
    service: 'Nexus Notes Synchronization Service on Vercel',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Workspaces
app.get('/api/v1/workspaces', (req, res) => {
  const list = Array.from(serverDb.workspaces.values());
  res.json(list);
});

// Notes CRUD
app.get('/api/v1/notes', (req, res) => {
  const noteId = (req.query.id as string) || (req.query.noteId as string);
  if (noteId) {
    const note = serverDb.notes.get(noteId);
    if (!note) return res.status(404).json({ error: 'Note not found' });
    return res.json(note);
  }
  const list = Array.from(serverDb.notes.values());
  res.json(list);
});

app.get('/api/v1/notes/:id', (req, res) => {
  const note = serverDb.notes.get(req.params.id);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  res.json(note);
});

app.post('/api/v1/notes', (req, res) => {
  const note = req.body;
  if (!note || !note.id) return res.status(400).json({ error: 'Invalid note payload' });
  serverDb.notes.set(note.id, note);
  res.status(201).json(note);
});

// Folders
app.get('/api/v1/folders', (req, res) => {
  const list = Array.from(serverDb.folders.values());
  res.json(list);
});

// Comments
app.get('/api/v1/comments', (req, res) => {
  const noteId = req.query.noteId as string;
  const list = Array.from(serverDb.comments.values()).filter((c) => !noteId || c.noteId === noteId);
  res.json(list);
});

// Sync Ingestion Endpoint
app.post('/api/v1/sync', (req, res) => {
  const op: ServerSyncPushRequest = req.body;

  if (!op || !op.operationId || !op.entityId) {
    return res.status(400).json({ error: 'Invalid mutation payload' });
  }

  // Idempotent ingestion
  serverDb.applyMutation(op);

  res.json({
    success: true,
    operationId: op.operationId,
    timestamp: new Date().toISOString(),
  });
});

// Pull remote changes
app.get('/api/v1/sync', (req, res) => {
  const since = req.query.since as string;
  const operations = Array.from(serverDb.operations.values());

  const changes = operations
    .filter((op) => !since || op.appliedAt > since)
    .map((op) => ({
      operationId: op.operationId,
      entityType: op.entityType,
      entityId: op.entityId,
      operationType: op.operationType,
      payload: op.payload,
      version: op.baseVersion + 1,
      timestamp: op.appliedAt,
      sourceClientId: op.clientId,
    }));

  const response: ServerSyncPullResponse = {
    serverCheckpoint: new Date().toISOString(),
    changes,
  };

  res.json(response);
});

// ==========================================
// Authentication Routes (Username, OTP, Login)
// ==========================================

// Check username availability
app.get('/api/v1/auth/check-username', async (req, res) => {
  const username = (req.query.username as string || '').trim().toLowerCase();
  if (!username) {
    return res.status(400).json({ available: false, message: 'Username is required' });
  }

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return res.json({
      available: false,
      message: 'Username must be 3-20 alphanumeric characters or underscores',
    });
  }

  const existing = await serverDb.getUserByEmailOrUsername(username);

  if (existing) {
    return res.json({ available: false, message: 'Username is already taken' });
  }

  res.json({ available: true, message: 'Username is available' });
});

// Send or Resend OTP
app.post('/api/v1/auth/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, message: 'Valid email is required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes expiry

  const existingOtp = serverDb.otpStore.get(normalizedEmail);
  serverDb.otpStore.set(normalizedEmail, {
    code,
    expiresAt,
    userData: existingOtp?.userData,
  });

  const verificationToken = generateVerificationToken(normalizedEmail, code, existingOtp?.userData);
  console.log(`🔐 [Nexus Auth] OTP for ${normalizedEmail}: ${code}`);

  // Dispatch real email via nodemailer if SMTP credentials configured
  let mailResult: { sent: boolean; reason?: string; error?: string } = { sent: false, reason: '' };
  try {
    mailResult = await sendOtpEmail(normalizedEmail, code, existingOtp?.userData?.name || 'there');
  } catch (err: any) {
    console.warn('[Nexus Auth] Could not send OTP email via SMTP:', err.message);
  }

  const isProd = process.env.NODE_ENV === 'production';

  res.json({
    success: true,
    message: mailResult.sent
      ? `Verification code delivered to ${normalizedEmail}`
      : `Verification code generated for ${normalizedEmail}`,
    // Only suppress devOtp in production if email was actually dispatched via SMTP:
    ...(isProd && mailResult.sent ? {} : { devOtp: code }),
    verificationToken,
    emailSent: mailResult.sent,
    mailError: mailResult.error || mailResult.reason,
  });
});

// Initiate Registration with OTP
app.post('/api/v1/auth/register', async (req, res) => {
  const { name, username, email, password, confirmPassword } = req.body;

  if (!name || !username || !email || !password) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ success: false, message: 'Passwords do not match' });
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
  }

  const normalizedUsername = username.trim().toLowerCase();
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(normalizedUsername)) {
    return res.status(400).json({
      success: false,
      message: 'Username must be 3-20 alphanumeric characters or underscores',
    });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const { usernameTaken, emailTaken } = await serverDb.isUsernameOrEmailTaken(normalizedUsername, normalizedEmail);

  if (usernameTaken) {
    return res.status(400).json({ success: false, message: 'Username is already taken' });
  }

  if (emailTaken) {
    return res.status(400).json({ success: false, message: 'An account with this email already exists' });
  }

  // Generate 6-digit OTP
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000;
  const userData = {
    name: name.trim(),
    username: normalizedUsername,
    email: normalizedEmail,
    password,
  };

  const verificationToken = generateVerificationToken(normalizedEmail, code, userData);

  serverDb.otpStore.set(normalizedEmail, {
    code,
    expiresAt,
    userData,
  });

  console.log(`🔐 [Nexus Auth] New Registration OTP for ${normalizedEmail} (${normalizedUsername}): ${code}`);

  // Dispatch real email via nodemailer if SMTP credentials configured
  let mailResult: { sent: boolean; reason?: string; error?: string } = { sent: false, reason: '' };
  try {
    mailResult = await sendOtpEmail(normalizedEmail, code, name.trim());
  } catch (err: any) {
    console.warn('[Nexus Auth] Could not send OTP email via SMTP:', err.message);
  }

  const isProd = process.env.NODE_ENV === 'production';

  res.json({
    success: true,
    message: mailResult.sent
      ? `Verification code delivered to ${normalizedEmail}`
      : `Verification code generated for ${normalizedEmail}`,
    // Only suppress devOtp in production if email was actually dispatched via SMTP:
    ...(isProd && mailResult.sent ? {} : { devOtp: code }),
    verificationToken,
    emailSent: mailResult.sent,
    mailError: mailResult.error || mailResult.reason,
  });
});

// Verify OTP & finalize registration / login
app.post('/api/v1/auth/verify-otp', async (req, res) => {
  const { email, code, verificationToken } = req.body;
  if (!email || !code) {
    return res.status(400).json({ success: false, message: 'Email and verification code are required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const inputCode = String(code).trim();
  let verified = false;
  let userData: any = null;

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
    return res.status(400).json({ success: false, message: 'Invalid or expired verification code. Please check and try again.' });
  }

  // Code verified! If pending registration exists, finalize user creation:
  let userRecord: any = null;
  if (userData) {
    const newUserId = `user-${Date.now()}`;
    const colors = ['#6366F1', '#EC4899', '#10B981', '#3B82F6', '#8B5CF6', '#F59E0B'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    userRecord = {
      id: newUserId,
      username: userData.username,
      name: userData.name,
      email: userData.email,
      password: userData.password,
      color: randomColor,
      isVerified: true,
      createdAt: new Date().toISOString(),
    };

    await serverDb.saveUser(userRecord);

    // Auto-join default workspace
    const defaultWsMembers = workspaceMembersStore.get('ws-default-nexus') || [];
    defaultWsMembers.push({
      userId: newUserId,
      workspaceId: 'ws-default-nexus',
      role: 'editor',
      joinedAt: new Date().toISOString(),
      user: {
        id: newUserId,
        username: userRecord.username,
        name: userRecord.name,
        email: userRecord.email,
        color: userRecord.color,
      },
    });
    workspaceMembersStore.set('ws-default-nexus', defaultWsMembers);
  } else {
    // Existing user verification
    userRecord = await serverDb.getUserByEmailOrUsername(normalizedEmail);
    if (userRecord) {
      userRecord.isVerified = true;
      await serverDb.saveUser(userRecord);
    }
  }

  // Clear challenge
  serverDb.otpStore.delete(normalizedEmail);

  if (!userRecord) {
    return res.status(400).json({ success: false, message: 'User record could not be located.' });
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
      avatarUrl: userRecord.avatarUrl,
    },
    message: 'Account verified and authenticated successfully!',
  });
});

// Login with Email or Username + Password
app.post('/api/v1/auth/login', async (req, res) => {
  const { identifier, email, password } = req.body;
  const loginKey = (identifier || email || '').trim().toLowerCase();

  if (!loginKey || !password) {
    return res.status(400).json({ success: false, message: 'Username/email and password are required' });
  }

  const user = await serverDb.getUserByEmailOrUsername(loginKey);

  if (!user) {
    return res.status(401).json({ success: false, message: 'Account not found with this username or email' });
  }

  if (user.password !== password) {
    return res.status(401).json({ success: false, message: 'Incorrect password' });
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
      avatarUrl: user.avatarUrl,
    },
    message: 'Signed in successfully',
  });
});

// Get current session info
app.get('/api/v1/auth/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.replace('Bearer ', '');
  const userId = token.split('-')[2];
  const user = userId ? serverDb.users.get(userId) || (await serverDb.getUserByEmailOrUsername(userId)) : null;
  if (!user) {
    return res.status(401).json({ error: 'Session invalid or expired' });
  }
  res.json({
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    color: user.color,
    avatarUrl: user.avatarUrl,
  });
});

// Workspace Invitations & Members
app.get('/api/v1/workspaces/:id/members', (req, res) => {
  const members = workspaceMembersStore.get(req.params.id) || [];
  res.json(members);
});

app.post('/api/v1/workspaces/:id/invite', (req, res) => {
  const { email, role } = req.body;
  const workspaceId = req.params.id;
  const members = workspaceMembersStore.get(workspaceId) || [];
  const newMember = {
    userId: `user-${Date.now()}`,
    workspaceId,
    role: role || 'editor',
    joinedAt: new Date().toISOString(),
    user: {
      id: `user-${Date.now()}`,
      name: email.split('@')[0],
      email,
      color: '#10B981',
    },
  };
  members.push(newMember);
  workspaceMembersStore.set(workspaceId, members);
  res.status(201).json(newMember);
});

// Share Links Store
const shareLinksStore = new Map<string, any>();

app.post(['/api/v1/share/create', '/api/v1/share'], (req, res) => {
  const { token, noteId, workspaceId, accessLevel, noteData } = req.body;
  const shareToken = token || (noteId ? `note-${noteId.replace('note-', '')}` : `share-${Math.random().toString(36).substring(2, 10)}`);
  
  const record = {
    token: shareToken,
    noteId: noteId || noteData?.id,
    workspaceId: workspaceId || noteData?.workspaceId || 'ws-default-nexus',
    accessLevel: accessLevel || 'view',
    noteData: noteData || (noteId ? serverDb.notes.get(noteId) : null),
    createdAt: new Date().toISOString(),
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

app.get(['/api/v1/share/:token', '/api/v1/share'], (req, res) => {
  const token = req.params.token || (req.query.token as string) || (req.query.share as string) || (req.query.id as string);
  if (!token) return res.status(400).json({ error: 'Missing share token or note id' });

  const record = shareLinksStore.get(token);
  if (record && record.noteData) {
    return res.json({
      success: true,
      note: record.noteData,
      accessLevel: record.accessLevel || 'view',
      workspaceId: record.workspaceId || 'ws-default-nexus',
    });
  }

  // Direct note lookup fallback
  const directNote = serverDb.notes.get(token);
  if (directNote) {
    return res.json({
      success: true,
      note: directNote,
      accessLevel: 'view',
      workspaceId: directNote.workspaceId || 'ws-default-nexus',
    });
  }

  return res.status(404).json({ error: 'Share link not found or expired' });
});

// Chess Email Invite
app.post('/api/v1/chess/invite', async (req, res) => {
  const { email, inviterName, inviteUrl, roomCode } = req.body;
  if (!email || !inviteUrl || !roomCode) {
    return res.status(400).json({ error: 'Missing email, inviteUrl, or roomCode' });
  }

  try {
    const result = await sendChessInviteEmail(
      email,
      inviterName || 'A Player',
      inviteUrl,
      roomCode
    );
    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('Failed to dispatch chess invite email:', err);
    res.json({ success: true, simulated: true, message: 'Invite registered in dev mode' });
  }
});

export { app };
export default app;
