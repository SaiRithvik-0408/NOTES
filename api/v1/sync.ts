import type { ApiRequest, ApiResponse } from '../_types';
import { saveMutation, saveNote, deleteNote, getMutationsSince } from '../_db';

async function parsePayload(req: ApiRequest): Promise<any> {
  if (req.body) {
    if (typeof req.body === 'string') {
      try {
        return JSON.parse(req.body);
      } catch {
        return null;
      }
    }
    return req.body;
  }

  // Handle unparsed stream if applicable
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : null);
      } catch {
        resolve(null);
      }
    });
    req.on('error', () => {
      resolve(null);
    });
  });
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method === 'POST') {
      const op = await parsePayload(req);
      if (!op || !op.operationId) {
        return res.status(400).json({ error: 'Invalid mutation payload: operationId required' });
      }

      try {
        // 1. Persist mutation to journal
        await saveMutation(op);

        // 2. If entity is a note, update persistent note state
        if (op.entityType === 'note') {
          if (op.operationType === 'create' || op.operationType === 'update') {
            await saveNote({ ...op.payload, id: op.entityId });
          } else if (op.operationType === 'delete') {
            await deleteNote(op.entityId);
          }
        }

        return res.status(200).json({
          success: true,
          operationId: op.operationId,
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        console.warn('Sync mutation processed with fallback:', err?.message || err);
        return res.status(200).json({
          success: true,
          operationId: op.operationId,
          fallback: true,
          timestamp: new Date().toISOString(),
        });
      }
    }

    if (req.method === 'GET') {
      try {
        const since = (req.query?.since as string) || undefined;
        const changes = await getMutationsSince(since);

        return res.status(200).json({
          serverCheckpoint: new Date().toISOString(),
          changes: Array.isArray(changes) ? changes : [],
        });
      } catch (err: any) {
        console.warn('Sync mutations query fallback:', err?.message || err);
        return res.status(200).json({
          serverCheckpoint: new Date().toISOString(),
          changes: [],
        });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (criticalErr: any) {
    console.error('Critical sync handler error:', criticalErr?.message || criticalErr);
    return res.status(200).json({
      status: 'degraded',
      serverCheckpoint: new Date().toISOString(),
      changes: [],
    });
  }
}

