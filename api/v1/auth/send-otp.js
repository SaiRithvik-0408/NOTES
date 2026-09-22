import { otpStore, generateVerificationToken, decryptVerificationToken } from '../../_db.js';
import { sendOtpEmail } from '../../_mailer.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { email, name, username, verificationToken: prevToken } = req.body || {};
  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, message: 'Valid email is required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  // Try to preserve userData from previous token or memory
  let userData = null;
  if (prevToken) {
    const decrypted = decryptVerificationToken(prevToken);
    if (decrypted?.userData) {
      userData = decrypted.userData;
    }
  }

  if (!userData) {
    const existing = otpStore.get(normalizedEmail);
    if (existing?.userData) {
      userData = existing.userData;
    } else if (name || username) {
      userData = { name: name || 'User', username: username || normalizedEmail.split('@')[0], email: normalizedEmail };
    }
  }

  const verificationToken = generateVerificationToken(normalizedEmail, code, userData);

  otpStore.set(normalizedEmail, {
    code,
    expiresAt: Date.now() + 10 * 60 * 1000,
    userData,
  });

  const mailResult = await sendOtpEmail(normalizedEmail, code, name || 'there');

  return res.status(200).json({
    success: true,
    message: mailResult.sent
      ? `Verification code delivered to ${normalizedEmail}`
      : `New verification code generated for ${normalizedEmail}`,
    devOtp: code,
    verificationToken,
    emailSent: mailResult.sent,
    mailReason: mailResult.reason || mailResult.error,
  });
}
