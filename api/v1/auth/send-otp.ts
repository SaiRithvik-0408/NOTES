import type { ApiRequest, ApiResponse } from '../../_types';
import { setCorsHeaders, parseBody } from '../../_types';
import { otpStore, generateVerificationToken, decryptVerificationToken } from '../../_db';
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
    const { email, name, username, verificationToken: prevToken } = body || {};
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'Valid email is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Try to preserve userData from previous token or memory
    let userData: any = null;
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

    let mailResult: any = { sent: false, reason: 'SMTP not attempted' };
    try {
      mailResult = await sendOtpEmail(normalizedEmail, code, name || 'there');
    } catch (mailErr: any) {
      console.warn('Mail send failed (safe catch):', mailErr?.message || mailErr);
    }

    const isProd = process.env.NODE_ENV === 'production';

    return res.status(200).json({
      success: true,
      message: mailResult.sent
        ? `Verification code delivered to ${normalizedEmail}`
        : `New verification code generated for ${normalizedEmail}`,
      ...(isProd ? {} : { devOtp: code }),
      verificationToken,
      emailSent: mailResult.sent,
      mailReason: mailResult.reason || (mailResult as any).error,
    });
  } catch (err: any) {
    console.error('Unhandled error in /api/v1/auth/send-otp:', err?.message || err);
    return res.status(500).json({ success: false, message: 'Failed to generate verification code' });
  }
}
