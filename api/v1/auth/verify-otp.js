import { users, otpStore } from '../../_db.js';

export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { email, code } = req.body || {};
  if (!email || !code) {
    return res.status(400).json({ success: false, message: 'Email and verification code are required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const challenge = otpStore.get(normalizedEmail);

  if (!challenge) {
    return res.status(400).json({ success: false, message: 'No pending verification found. Please request a new code.' });
  }

  if (Date.now() > challenge.expiresAt) {
    otpStore.delete(normalizedEmail);
    return res.status(400).json({ success: false, message: 'Verification code has expired. Please request a new one.' });
  }

  if (challenge.code !== String(code).trim()) {
    return res.status(400).json({ success: false, message: 'Invalid verification code. Please check and try again.' });
  }

  let userRecord = null;
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

    users.set(newUserId, userRecord);
  } else {
    userRecord = Array.from(users.values()).find(
      (u) => u.email.toLowerCase() === normalizedEmail
    );
    if (userRecord) {
      userRecord.isVerified = true;
    }
  }

  otpStore.delete(normalizedEmail);

  if (!userRecord) {
    return res.status(400).json({ success: false, message: 'User record could not be located.' });
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
