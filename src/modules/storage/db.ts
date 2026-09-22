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

// Helper seed function for initial workspace and notes if IndexedDB is empty
export async function seedInitialLocalData(): Promise<void> {
  const count = await db.workspaces.count();
  if (count > 0) return;

  const now = new Date().toISOString();
  const defaultWorkspaceId = 'ws-default-nexus';

  const defaultWorkspace: Workspace = {
    id: defaultWorkspaceId,
    name: 'Nexus Engineering Workspace',
    slug: 'nexus-engineering',
    icon: '⚡',
    description: 'Local-first collaborative intelligence, product planning, and technical architecture.',
    ownerId: 'user-self',
    createdAt: now,
    updatedAt: now,
  };

  const folders: Folder[] = [
    {
      id: 'folder-product',
      workspaceId: defaultWorkspaceId,
      name: 'Product & Vision',
      icon: '🚀',
      order: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'folder-engineering',
      workspaceId: defaultWorkspaceId,
      name: 'Architecture & RFCs',
      icon: '⚙️',
      order: 2,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'folder-designs',
      workspaceId: defaultWorkspaceId,
      name: 'UX & Design Systems',
      icon: '🎨',
      order: 3,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const initialNotes: Note[] = [
    {
      id: 'note-manifesto',
      workspaceId: defaultWorkspaceId,
      folderId: 'folder-product',
      title: 'Nexus Notes: The Local-First Manifesto',
      icon: '✨',
      content: `<h1>Nexus Notes: The Local-First Manifesto</h1><p>Welcome to <strong>Nexus Notes</strong> — the hybrid convergence of <em>Notion</em>, <em>Google Docs</em>, <em>Obsidian</em>, and <em>Linear</em>.</p><h3>Why Local-First?</h3><blockquote><p>Your thoughts shouldn't wait for a cloud round-trip. Offline isn't an error state; it's a first-class operating reality.</p></blockquote><ul><li><strong>Zero-Latency Typing</strong>: All writes happen instantly against your local IndexedDB.</li><li><strong>CRDT Synchronization</strong>: Collaborative document updates merge deterministically using Yjs.</li><li><strong>Interactive Knowledge Graph</strong>: Navigate your interconnected thinking in 3D.</li><li><strong>Command Palette</strong>: Press <kbd>Ctrl+K</kbd> anywhere to search, jump, or execute actions.</li></ul><p>Explore your backlinks: [[System Architecture RFC]] and [[Bespoke Design Philosophy]].</p>`,
      plainText: 'Nexus Notes: The Local-First Manifesto. Welcome to Nexus Notes. Why Local-First? Zero-latency typing, CRDT synchronization, 3D knowledge graph, Command Palette.',
      tags: ['manifesto', 'vision', 'local-first'],
      authorId: 'user-self',
      authorName: 'Alex Rivera',
      isPinned: true,
      isFavorite: true,
      isArchived: false,
      backlinks: ['note-arch-rfc', 'note-design-spec'],
      version: 1,
      lastSyncedAt: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'note-arch-rfc',
      workspaceId: defaultWorkspaceId,
      folderId: 'folder-engineering',
      title: 'System Architecture RFC: Sync & CRDTs',
      icon: '📐',
      content: `<h2>Architecture RFC: Mutation Pipeline</h2><p>This RFC outlines the synchronization engine powering Nexus Notes.</p><pre><code>Client Mutation Queue -> UUID Operation IDs -> Exponential Backoff -> WebSocket / Supabase SyncProvider</code></pre><p>Key tenets:</p><ol><li><strong>Idempotency</strong>: Every change carries a unique UUID operation ID.</li><li><strong>Deterministic Merging</strong>: TipTap rich text utilizes Y.Doc binary updates.</li><li><strong>Interactive Resolution</strong>: Metadata conflicts present a 3-way visual resolution dialog.</li></ol><p>See also [[Nexus Notes: The Local-First Manifesto]].</p>`,
      plainText: 'System Architecture RFC: Sync & CRDTs. Client Mutation Queue, UUID Operation IDs, Exponential Backoff, Idempotency, Deterministic Merging.',
      tags: ['architecture', 'sync', 'crdt', 'rfc'],
      authorId: 'user-self',
      authorName: 'Alex Rivera',
      isPinned: true,
      isFavorite: false,
      isArchived: false,
      backlinks: ['note-manifesto'],
      version: 1,
      lastSyncedAt: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'note-design-spec',
      workspaceId: defaultWorkspaceId,
      folderId: 'folder-designs',
      title: 'Bespoke Design Philosophy',
      icon: '🎨',
      content: `<h2>Bespoke Design Philosophy</h2><p>Crafting a workspace that feels calm, intelligent, fast, and creative.</p><ul><li><strong>Deep Cosmic Palette</strong>: High-contrast obsidian backgrounds (#090D16) with vibrant indigo accents (#6366F1).</li><li><strong>Typography Precision</strong>: Headings set in Plus Jakarta Sans, body copy in Inter, code in JetBrains Mono.</li><li><strong>Glassmorphic HUD</strong>: Backdrops with subtle 16px blur filters and frosted borders.</li></ul>`,
      plainText: 'Bespoke Design Philosophy. Crafting a workspace that feels calm, intelligent, fast, and creative. Deep Cosmic Palette, Typography Precision, Glassmorphic HUD.',
      tags: ['design', 'tokens', 'mui'],
      authorId: 'user-self',
      authorName: 'Alex Rivera',
      isPinned: false,
      isFavorite: true,
      isArchived: false,
      backlinks: ['note-manifesto'],
      version: 1,
      lastSyncedAt: now,
      createdAt: now,
      updatedAt: now,
    },
  ];

  await db.transaction('rw', [db.workspaces, db.folders, db.notes], async () => {
    await db.workspaces.add(defaultWorkspace);
    await db.folders.bulkAdd(folders);
    await db.notes.bulkAdd(initialNotes);
  });
}
