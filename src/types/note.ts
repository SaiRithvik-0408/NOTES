export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'commenter' | 'viewer';

export interface UserProfile {
  id: string;
  name: string;
  username?: string;
  email: string;
  avatarUrl?: string;
  color: string;
}

export interface WorkspaceMember {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
  joinedAt: string;
  user: UserProfile;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  description?: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Folder {
  id: string;
  workspaceId: string;
  parentId?: string | null;
  name: string;
  icon?: string;
  color?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Tag {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface NoteRevision {
  id: string;
  noteId: string;
  title: string;
  content: string; // JSON or markdown snapshot
  authorId: string;
  authorName: string;
  createdAt: string;
  summary?: string;
}

export interface NoteCommentReply {
  id: string;
  commentId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface NoteComment {
  id: string;
  noteId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  anchorText?: string;
  anchorRange?: { from: number; to: number };
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  replies: NoteCommentReply[];
  createdAt: string;
  updatedAt: string;
}

export interface NoteAttachment {
  id: string;
  noteId: string;
  name: string;
  fileType: string;
  fileSize: number;
  url?: string;
  localBlob?: Blob;
  uploadStatus: 'pending' | 'uploading' | 'uploaded' | 'failed';
  uploadedAt?: string;
  createdAt: string;
}

export interface Note {
  id: string;
  workspaceId: string;
  folderId?: string | null;
  title: string;
  icon?: string;
  coverImage?: string;
  content: string; // TipTap JSON string or markdown
  plainText: string; // Used for ultra-fast local search
  tags: string[];
  authorId: string;
  authorName: string;
  isPinned: boolean;
  isFavorite: boolean;
  isArchived: boolean;
  backlinks: string[]; // IDs of linked notes
  version: number;
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  workspaceId: string;
  noteId?: string;
  userId: string;
  userName: string;
  action: 'create_note' | 'edit_note' | 'delete_note' | 'comment' | 'resolve_comment' | 'restore_revision';
  details: string;
  timestamp: string;
}
