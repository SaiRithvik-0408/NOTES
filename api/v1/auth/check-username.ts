import type { ApiRequest, ApiResponse } from '../../_types';
import { setCorsHeaders } from '../../_types';
import { getUserByEmailOrUsername } from '../../_db';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    const username = ((req.query?.username as string) || '').trim().toLowerCase();

    if (!username) {
      return res.status(400).json({ available: false, message: 'Username is required' });
    }

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return res.status(200).json({
        available: false,
        message: 'Username must be 3-20 alphanumeric characters or underscores',
      });
    }

    const existing = await getUserByEmailOrUsername(username);

    if (existing) {
      return res.status(200).json({ available: false, message: 'Username is already taken' });
    }

    return res.status(200).json({ available: true, message: 'Username is available' });
  } catch (err: any) {
    console.error('Unhandled error in /api/v1/auth/check-username:', err?.message || err);
    return res.status(200).json({ available: true, message: 'Username is available' });
  }
}
