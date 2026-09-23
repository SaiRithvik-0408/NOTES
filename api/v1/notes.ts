import type { ApiRequest, ApiResponse } from '../_types';
import { setCorsHeaders, parseBody } from '../_types';
import { getNotes, getNoteById, saveNote, deleteNote } from '../_db';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method === 'GET') {
      const noteId = (req.query?.id as string) || (req.query?.noteId as string);
      if (noteId) {
        const note = await getNoteById(noteId);
        if (!note) {
          return res.status(404).json({ error: 'Note not found' });
        }
        return res.status(200).json(note);
      }

      const allNotes = await getNotes();
      return res.status(200).json(Array.isArray(allNotes) ? allNotes : []);
    }

    if (req.method === 'POST') {
      const note = await parseBody(req);
      if (!note || !note.id) {
        return res.status(400).json({ error: 'Invalid note payload' });
      }

      await saveNote(note);
      return res.status(200).json({ success: true, note });
    }

    if (req.method === 'DELETE') {
      const body = await parseBody(req);
      const noteId = (req.query?.id as string) || body?.id;
      if (!noteId) {
        return res.status(400).json({ error: 'Missing note ID' });
      }

      await deleteNote(noteId);
      return res.status(200).json({ success: true, deletedId: noteId });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('Unhandled error in /api/v1/notes:', err?.message || err);
    return res.status(200).json([]);
  }
}
