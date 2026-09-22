import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthUser } from '../../types/auth';
import { v4 as uuidv4 } from 'uuid';

export const DEMO_USERS: AuthUser[] = [
  {
    id: 'user-alex',
    name: 'Alex Rivera',
    email: 'alex@nexus.internal',
    color: '#6366F1',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    token: 'jwt-token-alex',
  },
  {
    id: 'user-elena',
    name: 'Elena Rostova',
    email: 'elena@nexus.internal',
    color: '#EC4899',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80',
    token: 'jwt-token-elena',
  },
  {
    id: 'user-marcus',
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
  login: (email: string, pass: string) => Promise<boolean>;
  register: (name: string, email: string, pass: string) => Promise<boolean>;
  logout: () => void;
  switchUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem('nexus_auth_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEMO_USERS[0];
      }
    }
    return DEMO_USERS[0]; // Default logged-in as Alex Rivera
  });

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('nexus_auth_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('nexus_auth_user');
    }
  }, [currentUser]);

  const login = async (email: string, _pass: string): Promise<boolean> => {
    const found = DEMO_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (found) {
      setCurrentUser(found);
      return true;
    }
    // Generic user login
    const customUser: AuthUser = {
      id: `user-${uuidv4().slice(0, 8)}`,
      name: email.split('@')[0],
      email,
      color: '#A855F7',
      token: `jwt-${Date.now()}`,
    };
    setCurrentUser(customUser);
    return true;
  };

  const register = async (name: string, email: string, _pass: string): Promise<boolean> => {
    const newUser: AuthUser = {
      id: `user-${uuidv4().slice(0, 8)}`,
      name,
      email,
      color: '#6366F1',
      token: `jwt-${Date.now()}`,
    };
    setCurrentUser(newUser);
    return true;
  };

  const logout = () => {
    setCurrentUser(null);
  };

  const switchUser = (user: AuthUser) => {
    setCurrentUser(user);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: Boolean(currentUser),
        login,
        register,
        logout,
        switchUser,
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
