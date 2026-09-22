import type { ApiRequest, ApiResponse } from '../_types';

export default function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({
    status: 'ok',
    service: 'Nexus Notes Synchronization Service on Vercel',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
}
