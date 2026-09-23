import type { ApiRequest, ApiResponse } from '../../_types';
import { setCorsHeaders, parseBody } from '../../_types';
import { generateVerificationToken, isUsernameOrEmailTaken, otpStore } from '../../_db';
import { sendOtpEmail } from '../../_mailer';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    const body = await parseBody(req);
    const { name, username, email, password, confirmPassword } = body || {};

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
    let mailResult: any = { sent: false, reason: 'SMTP not attempted' };
    try {
      mailResult = await sendOtpEmail(normalizedEmail, code, name.trim());
    } catch (mailErr: any) {
      console.warn('Mail send failed (safe catch):', mailErr?.message || mailErr);
    }

    const isProd = process.env.NODE_ENV === 'production';

    return res.status(200).json({
      success: true,
      message: mailResult.sent
        ? `A 6-digit verification code has been delivered to ${normalizedEmail}`
        : `Verification code generated for ${normalizedEmail}`,
      ...(isProd ? {} : { devOtp: code }),
      verificationToken,
      emailSent: mailResult.sent,
      mailReason: mailResult.reason || (mailResult as any).error,
    });
  } catch (err: any) {
    console.error('Unhandled error in /api/v1/auth/register:', err?.message || err);
    return res.status(500).json({ success: false, message: 'An error occurred during registration. Please try again.' });
  }
}
