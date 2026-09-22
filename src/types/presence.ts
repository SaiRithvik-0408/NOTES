export interface CollaboratorCursor {
  x: number;
  y: number;
  line?: number;
  ch?: number;
}

export interface CollaboratorSelection {
  from: number;
  to: number;
}

export interface CollaboratorPresence {
  clientId: string;
  userId: string;
  name: string;
  avatarUrl?: string;
  color: string;
  activeNoteId?: string;
  cursor?: CollaboratorCursor;
  selection?: CollaboratorSelection;
  lastActive: number;
}
