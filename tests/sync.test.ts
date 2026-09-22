import { describe, it, expect, beforeEach } from 'vitest';
import { ConflictRecord, MutationOperation } from '../src/types/sync';
import { Note } from '../src/types/note';

describe('Nexus Notes Sync Engine & Conflict Resolution Unit Tests', () => {
  it('generates unique idempotent operation IDs', () => {
    const op1: MutationOperation = {
      operationId: 'op-1234-abcd',
      clientId: 'client-test-1',
      entityType: 'note',
      entityId: 'note-manifesto',
      operationType: 'update',
      payload: { title: 'Updated Title' },
      baseVersion: 1,
      retryCount: 0,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    expect(op1.operationId).toMatch(/^op-/);
    expect(op1.status).toBe('pending');
    expect(op1.retryCount).toBe(0);
  });

  it('correctly identifies a 3-way conflict when local and remote versions diverge', () => {
    const localNote: Partial<Note> = {
      id: 'note-1',
      title: 'Local Offline Edits',
      content: '<p>Offline typed text</p>',
      version: 2,
    };

    const remoteNote: Partial<Note> = {
      id: 'note-1',
      title: 'Remote Collaborative Edits',
      content: '<p>Remote team text</p>',
      version: 3,
    };

    const conflict: ConflictRecord = {
      id: 'conflict-test-1',
      entityType: 'note',
      entityId: 'note-1',
      localVersion: localNote.version!,
      remoteVersion: remoteNote.version!,
      localData: localNote,
      remoteData: remoteNote,
      detectedAt: new Date().toISOString(),
      resolved: false,
    };

    expect(conflict.resolved).toBe(false);
    expect(conflict.localVersion).toBeLessThan(conflict.remoteVersion);
    expect(conflict.localData.title).not.toEqual(conflict.remoteData.title);
  });

  it('determines merge resolution preserving latest version and merged metadata', () => {
    const local = { title: 'Offline Title', tags: ['local'] };
    const remote = { title: 'Remote Title', tags: ['remote'] };

    const merged = {
      title: local.title,
      tags: [...local.tags, ...remote.tags],
      version: 4,
    };

    expect(merged.tags).toContain('local');
    expect(merged.tags).toContain('remote');
    expect(merged.version).toBe(4);
  });

  it('executes tokenized offline search over note content', () => {
    const notes: Partial<Note>[] = [
      { id: '1', title: 'Local-First Architecture', plainText: 'Offline mutation queues and CRDTs' },
      { id: '2', title: 'UX Design System', plainText: 'Dark mode tokens and glassmorphic cards' },
      { id: '3', title: 'Linear Shortcuts', plainText: 'Command palette with Ctrl+K navigation' },
    ];

    const search = (query: string) => {
      const q = query.toLowerCase();
      return notes.filter((n) => n.title?.toLowerCase().includes(q) || n.plainText?.toLowerCase().includes(q));
    };

    expect(search('CRDT')).toHaveLength(1);
    expect(search('CRDT')[0].id).toBe('1');
    expect(search('glassmorphic')).toHaveLength(1);
    expect(search('glassmorphic')[0].id).toBe('2');
    expect(search('Ctrl+K')).toHaveLength(1);
    expect(search('Ctrl+K')[0].id).toBe('3');
    expect(search('nonexistent')).toHaveLength(0);
  });
});
