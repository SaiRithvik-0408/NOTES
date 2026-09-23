import type { ApiRequest, ApiResponse } from '../_types';
import { setCorsHeaders, parseBody } from '../_types';
import { saveShareRecord, getShareRecord, getNoteById, saveNote } from '../_db';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method === 'GET') {
      const token = (req.query?.token as string) || (req.query?.share as string) || (req.query?.id as string);
      if (!token) {
        return res.status(400).json({ error: 'Missing share token or note id' });
      }

      // 1. Try share records
      const record = await getShareRecord(token);
      if (record && record.noteData) {
        return res.status(200).json({
          success: true,
          note: record.noteData,
          accessLevel: record.accessLevel || 'view',
          workspaceId: record.workspaceId || 'ws-default-nexus',
        });
      }

      // 2. Try direct note lookup by token / id
      const directNote = await getNoteById(token);
      if (directNote) {
        return res.status(200).json({
          success: true,
          note: directNote,
          accessLevel: 'view',
          workspaceId: directNote.workspaceId || 'ws-default-nexus',
        });
      }

      return res.status(404).json({ error: 'Shared note not found' });
    }

    if (req.method === 'POST') {
      const body = await parseBody(req);
      const { token, noteId, workspaceId, accessLevel, noteData } = body || {};
      const shareToken = token || `note-${(noteId || '').replace('note-', '')}`;

      const record = {
        token: shareToken,
        noteId,
        workspaceId: workspaceId || 'ws-default-nexus',
        accessLevel: accessLevel || 'view',
        noteData,
        createdAt: new Date().toISOString(),
      };

      await saveShareRecord(record);

      // Also persist note directly if provided
      if (noteData && noteData.id) {
        await saveNote(noteData);
      }

      return res.status(200).json({ success: true, record });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('Unhandled error in /api/v1/share:', err?.message || err);
    return res.status(500).json({ error: 'Failed to process share request' });
  }
}
