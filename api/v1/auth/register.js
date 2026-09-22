import { users, otpStore } from '../../_db.js';

export default function handler(req, res) {
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

  const usernameTaken = Array.from(users.values()).some(
    (u) => u.username?.toLowerCase() === normalizedUsername
  );
  if (usernameTaken) {
    return res.status(400).json({ success: false, message: 'Username is already taken' });
  }

  const emailTaken = Array.from(users.values()).some(
    (u) => u.email?.toLowerCase() === normalizedEmail
  );
  if (emailTaken) {
    return res.status(400).json({ success: false, message: 'An account with this email already exists' });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000;

  otpStore.set(normalizedEmail, {
    code,
    expiresAt,
    userData: {
      name: name.trim(),
      username: normalizedUsername,
      email: normalizedEmail,
      password,
    },
  });

  return res.status(200).json({
    success: true,
    message: `Verification code sent to ${normalizedEmail}`,
    devOtp: code,
  });
}
