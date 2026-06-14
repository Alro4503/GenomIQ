'use client';

import React, { createContext, useContext, useState } from 'react';

interface User {
  id: number;
  email: string;
  full_name: string | null;
  language_preference: string;
  dark_mode: boolean;
  is_active: boolean;
  created_at: string;
  is_oauth_account?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  token: string | null;
  setToken: (token: string) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName?: string, language?: string) => Promise<void>;
  logout: () => void;
  updateUserPreferences: (language?: string, darkMode?: boolean) => Promise<void>;
  initiateGoogleLogin: () => Promise<any>;
  processGoogleCallback: (code: string, state: string) => Promise<boolean>;
  setError: (error: string | null) => void;
}

// Portfolio demo: always logged in as demo user
const DEMO_USER: User = {
  id: 1,
  email: 'demo@genomiq.cat',
  full_name: 'Demo User',
  language_preference: 'en',
  dark_mode: false,
  is_active: true,
  created_at: new Date().toISOString(),
  is_oauth_account: false,
};

export const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user] = useState<User | null>(DEMO_USER);

  const noop = async () => {};

  return (
    <AuthContext.Provider value={{
      user,
      loading: false,
      error: null,
      token: 'demo-token',
      setToken: () => {},
      login: noop,
      register: noop,
      logout: () => {},
      updateUserPreferences: noop,
      initiateGoogleLogin: async () => ({}),
      processGoogleCallback: async () => true,
      setError: () => {},
    }}>
      {children}
    </AuthContext.Provider>
  );
};
