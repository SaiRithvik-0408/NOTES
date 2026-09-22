import Dexie, { Table } from 'dexie';
import { Note, Folder, Workspace, NoteRevision, NoteComment, NoteAttachment, Tag, Activity } from '../../types/note';
import { MutationOperation, ConflictRecord } from '../../types/sync';

export interface SyncCheckpoint {
  workspaceId: string;
  lastPulledAt: string;
  lastPushedAt: string;
  serverVersion: number;
}

export class NexusDatabase extends Dexie {
  workspaces!: Table<Workspace, string>;
  folders!: Table<Folder, string>;
  notes!: Table<Note, string>;
  revisions!: Table<NoteRevision, string>;
  comments!: Table<NoteComment, string>;
  attachments!: Table<NoteAttachment, string>;
  tags!: Table<Tag, string>;
  activities!: Table<Activity, string>;
  mutations!: Table<MutationOperation, string>;
  conflicts!: Table<ConflictRecord, string>;
  checkpoints!: Table<SyncCheckpoint, string>;

  constructor() {
    super('NexusNotesDB');

    this.version(1).stores({
      workspaces: 'id, slug, ownerId, updatedAt',
      folders: 'id, workspaceId, parentId, order, updatedAt',
      notes: 'id, workspaceId, folderId, title, isPinned, isFavorite, isArchived, updatedAt, *tags, *backlinks',
      revisions: 'id, noteId, createdAt',
      comments: 'id, noteId, resolved, createdAt',
      attachments: 'id, noteId, uploadStatus, createdAt',
      tags: 'id, workspaceId, name',
      activities: 'id, workspaceId, noteId, timestamp',
      mutations: 'operationId, clientId, entityType, entityId, status, createdAt',
      conflicts: 'id, entityType, entityId, resolved, detectedAt',
      checkpoints: 'workspaceId',
    });
  }
}

export const db = new NexusDatabase();

// Helper seed function for initial workspace and notes with 1 sample folder and 1 document
export async function seedInitialLocalData(): Promise<void> {
  const count = await db.workspaces.count();
  const now = new Date().toISOString();
  const defaultWorkspaceId = 'ws-default-nexus';

  const defaultWorkspace: Workspace = {
    id: defaultWorkspaceId,
    name: 'Personal Workspace',
    slug: 'personal-workspace',
    icon: '⚡',
    description: 'Local-first collaborative intelligence, product planning, and technical architecture.',
    ownerId: 'user-self',
    createdAt: now,
    updatedAt: now,
  };

  const sampleFolder: Folder = {
    id: 'folder-sample',
    workspaceId: defaultWorkspaceId,
    name: 'Sample Folder',
    icon: '📁',
    order: 1,
    createdAt: now,
    updatedAt: now,
  };

  const sampleNote: Note = {
    id: 'note-sample',
    workspaceId: defaultWorkspaceId,
    folderId: 'folder-sample',
    title: 'Sample Note',
    icon: '📝',
    content: '<h1>Sample Note</h1><p>Welcome to Nexus Notes! This is your sample document. Start editing, organize notes into folders, explore relationships in the 3D Knowledge Graph, or brainstorm on the visual whiteboard.</p>',
    plainText: 'Sample Note. Welcome to Nexus Notes! This is your sample document.',
    tags: ['sample'],
    authorId: 'user-self',
    authorName: 'Workspace Author',
    isPinned: false,
    isFavorite: false,
    isArchived: false,
    backlinks: [],
    version: 1,
    lastSyncedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  if (count === 0) {
    await db.transaction('rw', [db.workspaces, db.folders, db.notes], async () => {
      await db.workspaces.add(defaultWorkspace);
      await db.folders.add(sampleFolder);
      await db.notes.add(sampleNote);
    });
    return;
  }

  // Automatic Migration: if old 3-folder demo seeds exist, clean them up
  const oldFolder = await db.folders.get('folder-product');
  if (oldFolder) {
    await db.transaction('rw', [db.folders, db.notes], async () => {
      await db.folders.where('id').anyOf(['folder-product', 'folder-engineering', 'folder-designs']).delete();
      await db.notes.where('id').anyOf(['note-manifesto', 'note-arch-rfc', 'note-design-spec']).delete();

      const existingFolders = await db.folders.count();
      if (existingFolders === 0) {
        await db.folders.add(sampleFolder);
      }
      const existingNotes = await db.notes.count();
      if (existingNotes === 0) {
        await db.notes.add(sampleNote);
      }
    });
  }
}
