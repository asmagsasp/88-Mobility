import React, { createContext, useContext, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Passenger } from '../types';

const TOKEN_KEY = '88mobility_passenger_token';
const USER_KEY  = '88mobility_passenger_user';

interface AuthState {
  passenger: Passenger | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [passenger, setPassenger] = useState<Passenger | null>(null);
  const [token, setToken]         = useState<string | null>(null);
  const [isLoading, setLoading]   = useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const [t, u] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);
        if (t && u) { setToken(t); setPassenger(JSON.parse(u)); }
      } catch {}
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      await new Promise(r => setTimeout(r, 600));
      const mockPassenger: Passenger = {
        id: 'passenger-001',
        name: email.split('@')[0] || 'Passageiro',
        email,
        phone: '(61) 99888-0001',
        totalRides: 28,
      };
      const mockToken = 'mock-passenger-token';

      // Persiste no storage, mas não deixa falha de storage impedir o login
      try {
        await AsyncStorage.setItem(TOKEN_KEY, mockToken);
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(mockPassenger));
      } catch (storageErr) {
        console.warn('[88] AsyncStorage indisponível, sessão só em memória:', storageErr);
      }

      // Atualiza o estado independente do AsyncStorage
      setToken(mockToken);
      setPassenger(mockPassenger);
    } catch (err) {
      // Re-lança para o caller (LoginScreen) mostrar o Alert
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
    setToken(null);
    setPassenger(null);
  }, []);

  return (
    <AuthContext.Provider value={{ passenger, token, isAuthenticated: !!token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}
