import { sendChessInviteEmail } from '../../_mailer';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, inviterName, inviteUrl, roomCode } = req.body;
  if (!email || !inviteUrl || !roomCode) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const result = await sendChessInviteEmail(
    email,
    inviterName || 'A Player',
    inviteUrl,
    roomCode
  );

  return res.json({ success: true, ...result });
}
