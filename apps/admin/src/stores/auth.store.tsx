import React, { createContext, useContext, useState, useCallback } from 'react';
import type { User, AuthState, LoginCredentials } from '../types';
import { authApi } from '../api/auth.api';

const TOKEN_KEY = '88mobility_token';
const USER_KEY  = '88mobility_user';

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const s = localStorage.getItem(USER_KEY);
      return s ? (JSON.parse(s) as User) : null;
    } catch { return null; }
  });

  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem(TOKEN_KEY)
  );

  const [isLoading, setIsLoading] = useState(false);

  const isAuthenticated = !!token && !!user;

  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      // Em DEV: aceita qualquer email/senha preenchidos, sem bater no backend
      if (import.meta.env.DEV && credentials.email && credentials.password) {
        const mockUser: User = {
          id: 'admin-001',
          name: 'Admin 88',
          email: credentials.email,
          role: 'admin',
          createdAt: new Date().toISOString(),
        };
        const mockToken = 'mock-jwt-dev';
        localStorage.setItem(TOKEN_KEY, mockToken);
        localStorage.setItem(USER_KEY, JSON.stringify(mockUser));
        setToken(mockToken);
        setUser(mockUser);
        return;
      }

      // Em produção: chama o backend real
      const res = await authApi.login(credentials);
      localStorage.setItem(TOKEN_KEY, res.token);
      localStorage.setItem(USER_KEY, JSON.stringify(res.user));
      setToken(res.token);
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    authApi.logout().catch(() => {});
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
