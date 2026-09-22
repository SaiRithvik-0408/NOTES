import { generateVerificationToken, isUsernameOrEmailTaken, otpStore } from '../../_db.js';
import { sendOtpEmail } from '../../_mailer.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { name, username, email, password, confirmPassword } = req.body || {};

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

  const { usernameTaken, emailTaken } = await isUsernameOrEmailTaken(normalizedUsername, normalizedEmail);

  if (usernameTaken) {
    return res.status(400).json({ success: false, message: 'Username is already taken' });
  }

  if (emailTaken) {
    return res.status(400).json({ success: false, message: 'An account with this email already exists' });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const userData = {
    name: name.trim(),
    username: normalizedUsername,
    email: normalizedEmail,
    password,
  };

  // Generate stateless encrypted verification token (guaranteed to survive any serverless cold start / routing)
  const verificationToken = generateVerificationToken(normalizedEmail, code, userData);

  // In-memory challenge store (for local/single-process fallback)
  otpStore.set(normalizedEmail, {
    code,
    expiresAt: Date.now() + 10 * 60 * 1000,
    userData,
  });

  // Attempt real email delivery if SMTP credentials configured
  const mailResult = await sendOtpEmail(normalizedEmail, code, name.trim());

  return res.status(200).json({
    success: true,
    message: mailResult.sent
      ? `A 6-digit verification code has been delivered to ${normalizedEmail}`
      : `Verification code generated for ${normalizedEmail}`,
    devOtp: code,
    verificationToken,
    emailSent: mailResult.sent,
    mailReason: mailResult.reason || mailResult.error,
  });
}
