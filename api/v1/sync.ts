import type { ApiRequest, ApiResponse } from '../_types';
import { saveMutation, saveNote, deleteNote, getMutationsSince } from '../_db';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'POST') {
    const op = req.body;
    if (!op || !op.operationId || !op.entityId) {
      return res.status(400).json({ error: 'Invalid mutation payload' });
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
      console.error('Error applying sync mutation:', err.message);
      return res.status(500).json({ error: 'Failed to persist mutation' });
    }
  }

  if (req.method === 'GET') {
    try {
      const since = req.query?.since as string | undefined;
      const changes = await getMutationsSince(since);

      return res.status(200).json({
        serverCheckpoint: new Date().toISOString(),
        changes,
      });
    } catch (err: any) {
      console.error('Error fetching sync mutations:', err.message);
      return res.status(500).json({ error: 'Failed to retrieve mutations' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
