import type { ApiRequest, ApiResponse } from '../../_types';
import { setCorsHeaders, parseBody } from '../../_types';
import { sendChessInviteEmail } from '../../_mailer';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const body = await parseBody(req);
    const { email, inviterName, inviteUrl, roomCode } = body || {};
    if (!email || !inviteUrl || !roomCode) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    let result: any = { sent: false, reason: 'SMTP not configured' };
    try {
      result = await sendChessInviteEmail(
        email,
        inviterName || 'A Player',
        inviteUrl,
        roomCode
      );
    } catch (mailErr: any) {
      console.warn('Chess invite email error:', mailErr?.message || mailErr);
    }

    return res.status(200).json({ success: true, ...result });
  } catch (err: any) {
    console.error('Unhandled error in /api/v1/chess/invite:', err?.message || err);
    return res.status(500).json({ error: 'Failed to process chess invitation' });
  }
}
