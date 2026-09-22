import { v4 as uuidv4 } from 'uuid';
import { db } from '../modules/storage/db';
import { Note, NoteRevision } from '../types/note';

/**
 * Creates an immutable snapshot revision of a note and saves it to Dexie IndexedDB
 */
export async function createNoteSnapshot(
  note: Note,
  authorName: string = 'Current User',
  authorId: string = 'user-self',
  summary?: string
): Promise<NoteRevision> {
  const now = new Date().toISOString();
  const wordCount = note.plainText ? note.plainText.trim().split(/\s+/).length : 0;
  const defaultSummary = summary || `Snapshot with ${wordCount} words`;

  const revision: NoteRevision = {
    id: `rev-${uuidv4().slice(0, 8)}`,
    noteId: note.id,
    title: note.title || 'Untitled Note',
    content: note.content || '',
    authorId: authorId || 'user-self',
    authorName: authorName || 'Workspace Author',
    createdAt: now,
    summary: defaultSummary,
  };

  await db.revisions.add(revision);
  await pruneOldRevisions(note.id, 30);

  return revision;
}

/**
 * Prunes older revisions if they exceed maxKeep to keep local storage optimized
 */
export async function pruneOldRevisions(noteId: string, maxKeep: number = 30): Promise<void> {
  try {
    const list = await db.revisions
      .where('noteId')
      .equals(noteId)
      .reverse()
      .sortBy('createdAt');

    if (list.length > maxKeep) {
      const toRemove = list.slice(maxKeep);
      for (const item of toRemove) {
        await db.revisions.delete(item.id);
      }
    }
  } catch (err) {
    console.warn('Failed to prune old revisions:', err);
  }
}

/**
 * Formats an ISO date into human-readable relative time
 */
export function formatTimeAgo(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 45) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
}
