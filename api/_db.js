import crypto from 'crypto';

// Shared in-memory database for Vercel Serverless Functions
export const users = new Map();
export const otpStore = new Map();
export const workspaces = new Map();
export const notes = new Map();
export const operations = new Map();

const AUTH_SECRET = process.env.JWT_SECRET || 'nexus-secret-key-2026-auth-gate';

// Stateless encrypted verification token generator for Serverless Lambdas
export function generateVerificationToken(email, code, userData = null) {
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
  const payload = JSON.stringify({ email: email.toLowerCase(), code: String(code).trim(), userData, expiresAt });
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', crypto.createHash('sha256').update(AUTH_SECRET).digest(), iv);
  let encrypted = cipher.update(payload, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

// Stateless token decryptor
export function decryptVerificationToken(token) {
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

// Seed initial demo accounts
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
