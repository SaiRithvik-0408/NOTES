import { UserProfile, WorkspaceRole } from './note';

export interface AuthUser extends UserProfile {
  token: string;
}

export interface ShareLink {
  id: string;
  noteId?: string;
  workspaceId: string;
  token: string;
  accessLevel: 'view' | 'edit';
  isEnabled: boolean;
  createdAt: string;
  expiresAt?: string;
}

export interface WorkspaceInvitation {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  invitedBy: string;
  status: 'pending' | 'accepted' | 'expired';
  createdAt: string;
}
