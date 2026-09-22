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


