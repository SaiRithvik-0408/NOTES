import { db } from '../storage/db';
import { ConflictRecord, ConflictResolution } from '../../types/sync';
import { Note } from '../../types/note';

export class ConflictResolver {
  public static async getUnresolvedConflicts(): Promise<ConflictRecord[]> {
    return db.conflicts.where('resolved').equals(0).or('resolved').equals(false as any).toArray();
  }

  public static async resolveNoteConflict(
    conflictId: string,
    strategy: 'keep_local' | 'keep_remote' | 'merged',
    mergedNote?: Partial<Note>
  ): Promise<void> {
    const conflict = await db.conflicts.get(conflictId);
    if (!conflict) return;

    const resolution: ConflictResolution = {
      strategy,
      resolvedData: mergedNote,
    };

    if (strategy === 'keep_local') {
      await db.conflicts.update(conflictId, { resolved: true, resolutionStrategy: 'keep_local' });
    } else if (strategy === 'keep_remote') {
      await db.notes.put(conflict.remoteData as any);
      await db.conflicts.update(conflictId, { resolved: true, resolutionStrategy: 'keep_remote' });
    } else if (strategy === 'merged' && mergedNote) {
      const existing = (await db.notes.get(conflict.entityId)) || {};
      const updated: Note = {
        ...existing,
        ...conflict.remoteData,
        ...mergedNote,
        version: Math.max(conflict.localVersion, conflict.remoteVersion) + 1,
        updatedAt: new Date().toISOString(),
      } as Note;
      await db.notes.put(updated);
      await db.conflicts.update(conflictId, { resolved: true, resolutionStrategy: 'merged' });
    }
  }
}
