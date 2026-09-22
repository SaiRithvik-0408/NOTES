import { operations, notes } from '../_db.js';

export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'POST') {
    const op = req.body;
    if (!op || !op.operationId || !op.entityId) {
      return res.status(400).json({ error: 'Invalid mutation payload' });
    }

    operations.set(op.operationId, {
      ...op,
      appliedAt: new Date().toISOString(),
    });

    if (op.entityType === 'note') {
      if (op.operationType === 'create' || op.operationType === 'update') {
        notes.set(op.entityId, { ...op.payload, id: op.entityId, updatedAt: new Date().toISOString() });
      } else if (op.operationType === 'delete') {
        notes.delete(op.entityId);
      }
    }

    return res.status(200).json({
      success: true,
      operationId: op.operationId,
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method === 'GET') {
    const since = req.query.since;
    const ops = Array.from(operations.values());
    const changes = ops
      .filter((op) => !since || op.appliedAt > since)
      .map((op) => ({
        operationId: op.operationId,
        entityType: op.entityType,
        entityId: op.entityId,
        operationType: op.operationType,
        payload: op.payload,
        version: (op.baseVersion || 0) + 1,
        timestamp: op.appliedAt,
        sourceClientId: op.clientId,
      }));

    return res.status(200).json({
      serverCheckpoint: new Date().toISOString(),
      changes,
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
