import type { ApiRequest, ApiResponse } from '../../_types';
import { setCorsHeaders, parseBody } from '../../_types';
import { getUserByEmailOrUsername } from '../../_db';

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
    const { identifier, email, password } = body || {};
    const loginKey = (identifier || email || '').trim().toLowerCase();

    if (!loginKey || !password) {
      return res.status(400).json({ success: false, message: 'Username/email and password are required' });
    }

    const user = await getUserByEmailOrUsername(loginKey);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Account not found with this username or email' });
    }

    if (user.password !== password) {
      return res.status(401).json({ success: false, message: 'Incorrect password' });
    }

    const token = `jwt-${Date.now()}-${user.id}`;
    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        color: user.color,
        avatarUrl: user.avatarUrl,
      },
      message: 'Signed in successfully',
    });
  } catch (err: any) {
    console.error('Unhandled error in /api/v1/auth/login:', err?.message || err);
    return res.status(500).json({ success: false, message: 'An internal authentication error occurred' });
  }
}
