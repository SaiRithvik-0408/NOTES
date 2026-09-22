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

// Authentication Routes
app.post('/api/v1/auth/login', (req, res) => {
  const { email, password } = req.body;
  res.json({
    success: true,
    token: `jwt-${Date.now()}`,
    user: {
      id: `user-${email.split('@')[0]}`,
      email,
      name: email.split('@')[0],
      color: '#6366F1',
    },
  });
});

app.post('/api/v1/auth/register', (req, res) => {
  const { name, email, password } = req.body;
  res.json({
    success: true,
    token: `jwt-${Date.now()}`,
    user: {
      id: `user-${Date.now()}`,
      email,
      name,
      color: '#6366F1',
    },
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
setupWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`🚀 Nexus Notes backend server listening on http://localhost:${PORT}`);
});
