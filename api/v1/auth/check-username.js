import { users } from '../../_db.js';

export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  const username = (req.query.username || '').trim().toLowerCase();

  if (!username) {
    return res.status(400).json({ available: false, message: 'Username is required' });
  }

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return res.status(200).json({
      available: false,
      message: 'Username must be 3-20 alphanumeric characters or underscores',
    });
  }

  const existing = Array.from(users.values()).find(
    (u) => u.username?.toLowerCase() === username
  );

  if (existing) {
    return res.status(200).json({ available: false, message: 'Username is already taken' });
  }

  return res.status(200).json({ available: true, message: 'Username is available' });
}
