/**
 * Client-Side Zero-Knowledge Cryptography Vault
 * Uses native Web Crypto API (SubtleCrypto) with AES-GCM-256 and PBKDF2 (100,000 iterations).
 * 100% private: Keys and plaintext never leave the browser.
 */

export interface EncryptedVaultPayload {
  version: 1;
  salt: string; // base64
  iv: string; // base64
  ciphertext: string; // base64
  hint?: string;
  createdAt: string;
}

/**
 * Convert Uint8Array to base64 string
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Convert base64 string to Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = window.atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derive AES-256-GCM CryptoKey from passphrase using PBKDF2-SHA-256
 */
export async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt note content using AES-256-GCM
 */
export async function encryptNoteContent(
  content: string,
  passphrase: string,
  hint?: string
): Promise<EncryptedVaultPayload> {
  if (!passphrase || passphrase.trim().length === 0) {
    throw new Error('Passphrase cannot be empty.');
  }

  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);

  const enc = new TextEncoder();
  const encryptedBuf = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    enc.encode(content)
  );

  return {
    version: 1,
    salt: uint8ArrayToBase64(salt),
    iv: uint8ArrayToBase64(iv),
    ciphertext: uint8ArrayToBase64(new Uint8Array(encryptedBuf)),
    hint: hint?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Decrypt note content using AES-256-GCM
 */
export async function decryptNoteContent(
  payload: EncryptedVaultPayload,
  passphrase: string
): Promise<string> {
  if (!passphrase) {
    throw new Error('Please enter your passphrase.');
  }

  const salt = base64ToUint8Array(payload.salt);
  const iv = base64ToUint8Array(payload.iv);
  const ciphertext = base64ToUint8Array(payload.ciphertext);

  const key = await deriveKey(passphrase, salt);

  try {
    const decryptedBuf = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      key,
      ciphertext as unknown as BufferSource
    );
    const dec = new TextDecoder();
    return dec.decode(decryptedBuf);
  } catch {
    throw new Error('Incorrect password or PIN. Decryption failed.');
  }
}

/**
 * Quick password strength calculator for the lock UI
 */
export function estimatePasswordStrength(passphrase: string): {
  score: number;
  label: 'Weak' | 'Fair' | 'Good' | 'Strong';
  color: string;
} {
  if (!passphrase) return { score: 0, label: 'Weak', color: '#EF4444' };

  let score = 0;
  if (passphrase.length >= 6) score += 1;
  if (passphrase.length >= 10) score += 1;
  if (/[0-9]/.test(passphrase)) score += 1;
  if (/[a-zA-Z]/.test(passphrase)) score += 1;
  if (/[^A-Za-z0-9]/.test(passphrase)) score += 1;

  if (score <= 2) return { score: 25, label: 'Weak', color: '#EF4444' };
  if (score === 3) return { score: 50, label: 'Fair', color: '#F59E0B' };
  if (score === 4) return { score: 75, label: 'Good', color: '#3B82F6' };
  return { score: 100, label: 'Strong', color: '#10B981' };
}
