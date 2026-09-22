import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthUser, RegisterRequest, SendOtpRequest, VerifyOtpRequest, AuthResponse } from '../../types/auth';

export const DEMO_USERS: AuthUser[] = [
  {
    id: 'user-alex',
    username: 'alex',
    name: 'Alex Rivera',
    email: 'alex@nexus.internal',
    color: '#6366F1',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    token: 'jwt-token-alex',
  },
  {
    id: 'user-elena',
    username: 'elena',
    name: 'Elena Rostova',
    email: 'elena@nexus.internal',
    color: '#EC4899',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80',
    token: 'jwt-token-elena',
  },
  {
    id: 'user-marcus',
    username: 'marcus',
    name: 'Marcus Chen',
    email: 'marcus@partner.org',
    color: '#10B981',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
    token: 'jwt-token-marcus',
  },
];

interface AuthContextType {
  currentUser: AuthUser | null;
  isAuthenticated: boolean;
  login: (identifier: string, pass: string) => Promise<AuthResponse>;
  register: (req: RegisterRequest) => Promise<AuthResponse>;
  sendOtp: (req: SendOtpRequest) => Promise<AuthResponse>;
  verifyOtp: (req: VerifyOtpRequest) => Promise<AuthResponse>;
  checkUsername: (username: string) => Promise<{ available: boolean; message?: string }>;
  logout: () => void;
  switchUser: (user: AuthUser) => void;
  exploreDemo: (user?: AuthUser) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // IMPORTANT: Default is null. A user is NOT automatically logged in unless they have an existing session in localStorage
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem('nexus_auth_user');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (err) {
      console.error('Failed to parse cached auth session:', err);
    }
    return null; // Not logged in by default
  });

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('nexus_auth_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('nexus_auth_user');
    }
  }, [currentUser]);

  // Check username availability
  const checkUsername = async (username: string): Promise<{ available: boolean; message?: string }> => {
    try {
      const res = await fetch(`/api/v1/auth/check-username?username=${encodeURIComponent(username)}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('Backend username check failed, falling back to local validation:', err);
    }

    // Local fallback validation
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return { available: false, message: 'Username must be 3-20 alphanumeric characters or underscores' };
    }
    const taken = DEMO_USERS.some((u) => u.username?.toLowerCase() === username.toLowerCase());
    return { available: !taken, message: taken ? 'Username already taken' : 'Username is available' };
  };

  // Login with email or username + password
  const login = async (identifier: string, pass: string): Promise<AuthResponse> => {
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password: pass }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.user) {
        const authUser: AuthUser = {
          ...data.user,
          token: data.token,
        };
        setCurrentUser(authUser);
        return { success: true, user: authUser, token: data.token };
      }
      return { success: false, message: data.message || 'Login failed' };
    } catch (err) {
      console.warn('Backend login unavailable, checking demo credentials:', err);
      // Fallback check against demo users
      const found = DEMO_USERS.find(
        (u) =>
          u.email.toLowerCase() === identifier.toLowerCase() ||
          u.username?.toLowerCase() === identifier.toLowerCase()
      );
      if (found) {
        setCurrentUser(found);
        return { success: true, user: found, token: found.token };
      }
      return { success: false, message: 'Invalid username/email or password' };
    }
  };

  // Initiate registration (generates & sends OTP)
  const register = async (req: RegisterRequest): Promise<AuthResponse> => {
    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
      const data = await res.json();
      return data;
    } catch (err) {
      console.warn('Backend register unavailable, providing simulated OTP for dev:', err);
      const devOtp = '123456';
      return {
        success: true,
        message: `Simulated verification code sent to ${req.email}`,
        devOtp,
      };
    }
  };

  // Send or resend OTP
  const sendOtp = async (req: SendOtpRequest): Promise<AuthResponse> => {
    try {
      const res = await fetch('/api/v1/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
      const data = await res.json();
      return data;
    } catch (err) {
      return {
        success: true,
        message: `Simulated OTP resent to ${req.email}`,
        devOtp: '123456',
      };
    }
  };

  // Verify OTP and complete sign-up or activation
  const verifyOtp = async (req: VerifyOtpRequest): Promise<AuthResponse> => {
    try {
      const res = await fetch('/api/v1/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
      const data = await res.json();
      if (res.ok && data.success && data.user) {
        const authUser: AuthUser = {
          ...data.user,
          token: data.token,
        };
        setCurrentUser(authUser);
        return { success: true, user: authUser, token: data.token, message: data.message };
      }
      return { success: false, message: data.message || 'Verification failed' };
    } catch (err) {
      if (req.code === '123456') {
        const fallbackUser: AuthUser = {
          id: `user-${Date.now()}`,
          name: req.email.split('@')[0],
          email: req.email,
          color: '#6366F1',
          token: `jwt-${Date.now()}`,
        };
        setCurrentUser(fallbackUser);
        return { success: true, user: fallbackUser, token: fallbackUser.token };
      }
      return { success: false, message: 'Invalid verification code' };
    }
  };

  const logout = () => {
    setCurrentUser(null);
  };

  const switchUser = (user: AuthUser) => {
    setCurrentUser(user);
  };

  const exploreDemo = (user: AuthUser = DEMO_USERS[0]) => {
    setCurrentUser(user);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: Boolean(currentUser),
        login,
        register,
        sendOtp,
        verifyOtp,
        checkUsername,
        logout,
        switchUser,
        exploreDemo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
