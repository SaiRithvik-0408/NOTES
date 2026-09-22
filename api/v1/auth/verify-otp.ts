import type { ApiRequest, ApiResponse } from '../../_types';
import { users, otpStore, decryptVerificationToken, saveUser, getUserByEmailOrUsername, UserRecord } from '../../_db';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { email, code, verificationToken } = req.body || {};
  if (!email || !code) {
    return res.status(400).json({ success: false, message: 'Email and verification code are required' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const inputCode = String(code).trim();

  let verified = false;
  let userData: any = null;

  // 1. Try stateless cryptographic verification token first (works seamlessly on Vercel across different serverless instances)
  if (verificationToken) {
    const tokenData = decryptVerificationToken(verificationToken);
    if (tokenData) {
      if (Date.now() > tokenData.expiresAt) {
        return res.status(400).json({ success: false, message: 'Verification code has expired. Please request a new code.' });
      }

      if (tokenData.email.toLowerCase() === normalizedEmail && tokenData.code === inputCode) {
        verified = true;
        userData = tokenData.userData;
      }
    }
  }

  // 2. Fallback to in-memory challenge (if same process/instance)
  if (!verified) {
    const challenge = otpStore.get(normalizedEmail);
    if (challenge) {
      if (Date.now() > challenge.expiresAt) {
        otpStore.delete(normalizedEmail);
        return res.status(400).json({ success: false, message: 'Verification code has expired. Please request a new one.' });
      }

      if (challenge.code === inputCode) {
        verified = true;
        userData = challenge.userData;
        otpStore.delete(normalizedEmail);
      }
    }
  }

  if (!verified) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired verification code. Please check and try again.',
    });
  }

  // Create or activate user with password persistence
  let userRecord: UserRecord | null = null;
  if (userData) {
    const newUserId = `user-${Date.now()}`;
    const colors = ['#6366F1', '#EC4899', '#10B981', '#3B82F6', '#8B5CF6', '#F59E0B'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    userRecord = {
      id: newUserId,
      username: userData.username || normalizedEmail.split('@')[0],
      name: userData.name || 'User',
      email: normalizedEmail,
      password: userData.password || '',
      color: randomColor,
      isVerified: true,
      createdAt: new Date().toISOString(),
    };

    await saveUser(userRecord);
  } else {
    userRecord = await getUserByEmailOrUsername(normalizedEmail);
    if (userRecord) {
      userRecord.isVerified = true;
      await saveUser(userRecord);
    } else {
      const newUserId = `user-${Date.now()}`;
      userRecord = {
        id: newUserId,
        username: normalizedEmail.split('@')[0],
        name: normalizedEmail.split('@')[0],
        email: normalizedEmail,
        password: '',
        color: '#6366F1',
        isVerified: true,
        createdAt: new Date().toISOString(),
      };
      await saveUser(userRecord);
    }
  }

  const token = `jwt-${Date.now()}-${userRecord.id}`;
  return res.status(200).json({
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
}
