// Shared in-memory database for Vercel Serverless Functions
export const users = new Map();
export const otpStore = new Map();
export const workspaces = new Map();
export const notes = new Map();
export const operations = new Map();

// Seed initial users
const now = new Date().toISOString();

users.set('user-alex', {
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

users.set('user-elena', {
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

users.set('user-marcus', {
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
