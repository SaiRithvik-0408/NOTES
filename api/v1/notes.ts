import type { ApiRequest, ApiResponse } from '../_types';
import { getNotes, getNoteById, saveNote, deleteNote } from '../_db';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET') {
    try {
      const noteId = (req.query?.id as string) || (req.query?.noteId as string);
      if (noteId) {
        const note = await getNoteById(noteId);
        if (!note) {
          return res.status(404).json({ error: 'Note not found' });
        }
        return res.status(200).json(note);
      }

      const allNotes = await getNotes();
      return res.status(200).json(allNotes);
    } catch (err: any) {
      console.error('Error in GET /api/v1/notes:', err.message);
      return res.status(500).json({ error: 'Failed to retrieve notes' });
    }
  }

  if (req.method === 'POST') {
    try {
      const note = req.body;
      if (!note || !note.id) {
        return res.status(400).json({ error: 'Invalid note payload' });
      }

      await saveNote(note);
      return res.status(200).json({ success: true, note });
    } catch (err: any) {
      console.error('Error in POST /api/v1/notes:', err.message);
      return res.status(500).json({ error: 'Failed to save note' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const noteId = (req.query?.id as string) || req.body?.id;
      if (!noteId) {
        return res.status(400).json({ error: 'Missing note ID' });
      }

      await deleteNote(noteId);
      return res.status(200).json({ success: true, deletedId: noteId });
    } catch (err: any) {
      console.error('Error in DELETE /api/v1/notes:', err.message);
      return res.status(500).json({ error: 'Failed to delete note' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
