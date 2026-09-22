import express from 'express';
import http from 'http';
import cors from 'cors';
import { setupWebSocketServer } from './websocket';
import { serverDb } from './db';
import { ServerSyncPushRequest, ServerSyncPullResponse } from './types';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '25mb' }));

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Nexus Notes Synchronization Service',
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
  const list = Array.from(serverDb.notes.values());
  res.json(list);
});

app.post('/api/v1/notes', (req, res) => {
  const note = req.body;
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
app.get('/api/v1/auth/check-username', (req, res) => {
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

  const existing = Array.from(serverDb.users.values()).find(
    (u) => u.username?.toLowerCase() === username
  );

  if (existing) {
    return res.json({ available: false, message: 'Username is already taken' });
  }

  res.json({ available: true, message: 'Username is available' });
});

// Send or Resend OTP
app.post('/api/v1/auth/send-otp', (req, res) => {
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

  console.log(`🔐 [Nexus Auth] OTP for ${normalizedEmail}: ${code}`);

  res.json({
    success: true,
    message: `Verification code sent to ${normalizedEmail}`,
    devOtp: code, // Dev helper for instant testing
  });
});

// Initiate Registration with OTP
app.post('/api/v1/auth/register', (req, res) => {
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

  // Check username taken
  const usernameTaken = Array.from(serverDb.users.values()).some(
    (u) => u.username?.toLowerCase() === normalizedUsername
  );
  if (usernameTaken) {
    return res.status(400).json({ success: false, message: 'Username is already taken' });
  }

  // Check email registered
  const emailTaken = Array.from(serverDb.users.values()).some(
    (u) => u.email?.toLowerCase() === normalizedEmail
  );
  if (emailTaken) {
    return res.status(400).json({ success: false, message: 'An account with this email already exists' });
  }

  // Generate 6-digit OTP
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000;

  serverDb.otpStore.set(normalizedEmail, {
    code,
    expiresAt,
    userData: {
      name: name.trim(),
      username: normalizedUsername,
      email: normalizedEmail,
      password,
    },
  });

  console.log(`🔐 [Nexus Auth] New Registration OTP for ${normalizedEmail} (${normalizedUsername}): ${code}`);

  res.json({
    success: true,
    message: `Verification code sent to ${normalizedEmail}`,
    devOtp: code,
  });
});

// Verify OTP & finalize registration / login
app.post('/api/v1/auth/verify-otp', (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ success: false, message: 'Email and verification code are required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const challenge = serverDb.otpStore.get(normalizedEmail);

  if (!challenge) {
    return res.status(400).json({ success: false, message: 'No pending verification found. Please request a new code.' });
  }

  if (Date.now() > challenge.expiresAt) {
    serverDb.otpStore.delete(normalizedEmail);
    return res.status(400).json({ success: false, message: 'Verification code has expired. Please request a new one.' });
  }

  if (challenge.code !== code.trim()) {
    return res.status(400).json({ success: false, message: 'Invalid verification code. Please check and try again.' });
  }

  // Code verified! If pending registration exists, finalize user creation:
  let userRecord: any = null;
  if (challenge.userData) {
    const newUserId = `user-${Date.now()}`;
    const colors = ['#6366F1', '#EC4899', '#10B981', '#3B82F6', '#8B5CF6', '#F59E0B'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    userRecord = {
      id: newUserId,
      username: challenge.userData.username,
      name: challenge.userData.name,
      email: challenge.userData.email,
      password: challenge.userData.password,
      color: randomColor,
      isVerified: true,
      createdAt: new Date().toISOString(),
    };

    serverDb.users.set(newUserId, userRecord);

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
    userRecord = Array.from(serverDb.users.values()).find(
      (u) => u.email.toLowerCase() === normalizedEmail
    );
    if (userRecord) {
      userRecord.isVerified = true;
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
app.post('/api/v1/auth/login', (req, res) => {
  const { identifier, email, password } = req.body;
  const loginKey = (identifier || email || '').trim().toLowerCase();

  if (!loginKey || !password) {
    return res.status(400).json({ success: false, message: 'Username/email and password are required' });
  }

  const user = Array.from(serverDb.users.values()).find(
    (u) =>
      u.email.toLowerCase() === loginKey ||
      u.username?.toLowerCase() === loginKey
  );

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
app.get('/api/v1/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.replace('Bearer ', '');
  const userId = token.split('-')[2];
  const user = userId ? serverDb.users.get(userId) : null;
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
const workspaceMembersStore = new Map<string, any[]>();
workspaceMembersStore.set('ws-default-nexus', [
  {
    userId: 'user-alex',
    workspaceId: 'ws-default-nexus',
    role: 'owner',
    joinedAt: new Date().toISOString(),
    user: { id: 'user-alex', name: 'Alex Rivera', email: 'alex@nexus.internal', color: '#6366F1' },
  },
  {
    userId: 'user-elena',
    workspaceId: 'ws-default-nexus',
    role: 'editor',
    joinedAt: new Date().toISOString(),
    user: { id: 'user-elena', name: 'Elena Rostova', email: 'elena@nexus.internal', color: '#EC4899' },
  },
]);

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
app.post('/api/v1/share/create', (req, res) => {
  const { noteId, workspaceId, accessLevel } = req.body;
  const token = `share-${Math.random().toString(36).substring(2, 10)}`;
  const record = {
    token,
    noteId,
    workspaceId,
    accessLevel: accessLevel || 'view',
    createdAt: new Date().toISOString(),
  };
  shareLinksStore.set(token, record);
  res.json(record);
});

app.get('/api/v1/share/:token', (req, res) => {
  const record = shareLinksStore.get(req.params.token);
  if (!record) return res.status(404).json({ error: 'Share link not found or expired' });
  res.json(record);
});

const server = http.createServer(app);

// Only listen to port and spin up WebSockets when running as standalone Node process
if (process.env.VERCEL !== '1') {
  setupWebSocketServer(server);
  server.listen(PORT, () => {
    console.log(`🚀 Nexus Notes backend server listening on http://localhost:${PORT}`);
  });
}

export { app, server };
export default app;
