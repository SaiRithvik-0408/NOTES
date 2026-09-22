export default function handler(req, res) {
  res.status(200).json({
    status: 'ok',
    service: 'Nexus Notes Synchronization Service on Vercel',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
}
