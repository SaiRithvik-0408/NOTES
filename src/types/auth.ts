import { UserProfile, WorkspaceRole } from './note';

export interface AuthUser extends UserProfile {
  token: string;
}

export interface RegisterRequest {
  name: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface SendOtpRequest {
  email: string;
  name?: string;
  username?: string;
  type: 'register' | 'login' | 'reset';
  verificationToken?: string;
}

export interface VerifyOtpRequest {
  email: string;
  code: string;
  verificationToken?: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: AuthUser;
  message?: string;
  devOtp?: string; // Provided in local dev environment for easy testing
  verificationToken?: string;
  emailSent?: boolean;
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
