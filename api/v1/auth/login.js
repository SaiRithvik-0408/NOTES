import { getUserByEmailOrUsername } from '../../_db.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { identifier, email, password } = req.body || {};
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
}
