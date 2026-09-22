import { otpStore } from '../../_db.js';

export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { email } = req.body || {};
  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, message: 'Valid email is required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000;

  const existing = otpStore.get(normalizedEmail);
  otpStore.set(normalizedEmail, {
    code,
    expiresAt,
    userData: existing?.userData,
  });

  return res.status(200).json({
    success: true,
    message: `Verification code sent to ${normalizedEmail}`,
    devOtp: code,
  });
}
