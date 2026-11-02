import React, { createContext, useContext, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Passenger } from '../types';

const TOKEN_KEY = '88mobility_passenger_token';
const USER_KEY  = '88mobility_passenger_user';
const PASSENGERS_MAP_KEY = '@88mobility_registered_passengers_map';

export interface RegisterPassengerData {
  name: string;
  email: string;
  phone: string;
  password?: string;
}

interface AuthState {
  passenger: Passenger | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  registerPassenger: (data: RegisterPassengerData) => Promise<void>;
  updateProfile: (data: { name?: string; phone?: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function formatDisplayName(email: string): string {
  const prefix = email.split('@')[0] || 'Passageiro';
  return prefix
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

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
        if (t && u) {
          setToken(t);
          setPassenger(JSON.parse(u));
        }
      } catch {}
    })();
  }, []);

  const login = useCallback(async (email: string, _password: string) => {
    setLoading(true);
    try {
      await new Promise(r => setTimeout(r, 400));
      const normalizedEmail = email.trim().toLowerCase();

      let matchedPassenger: Passenger | null = null;
      try {
        const mapStr = await AsyncStorage.getItem(PASSENGERS_MAP_KEY);
        if (mapStr) {
          const map = JSON.parse(mapStr);
          if (map[normalizedEmail]) {
            matchedPassenger = map[normalizedEmail];
          }
        }
      } catch (err) {
        console.warn('Erro ao consultar cadastro de passageiros:', err);
      }

      const passengerData: Passenger = matchedPassenger || {
        id: `passenger-${Date.now()}`,
        name: formatDisplayName(email),
        email: email.trim(),
        phone: '(11) 98888-8888',
        totalRides: 0,
      };

      const authToken = `auth-session-${Date.now()}`;

      try {
        await AsyncStorage.setItem(TOKEN_KEY, authToken);
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(passengerData));
      } catch (storageErr) {
        console.warn('[88] AsyncStorage indisponível, sessão só em memória:', storageErr);
      }

      setToken(authToken);
      setPassenger(passengerData);
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const registerPassenger = useCallback(async (data: RegisterPassengerData) => {
    setLoading(true);
    try {
      await new Promise(r => setTimeout(r, 400));
      const normalizedEmail = data.email.trim().toLowerCase();
      const passengerData: Passenger = {
        id: `passenger-${Date.now()}`,
        name: data.name.trim() || 'Passageiro',
        email: data.email.trim(),
        phone: data.phone.trim() || '',
        totalRides: 0,
      };

      const authToken = `auth-session-${Date.now()}`;

      try {
        await AsyncStorage.setItem(TOKEN_KEY, authToken);
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(passengerData));
        const mapStr = await AsyncStorage.getItem(PASSENGERS_MAP_KEY);
        const map = mapStr ? JSON.parse(mapStr) : {};
        map[normalizedEmail] = passengerData;
        await AsyncStorage.setItem(PASSENGERS_MAP_KEY, JSON.stringify(map));
      } catch (storageErr) {
        console.warn('[88] Erro ao persistir passageiro:', storageErr);
      }

      setToken(authToken);
      setPassenger(passengerData);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProfile = useCallback(async (data: { name?: string; phone?: string }) => {
    if (!passenger) return;
    const updated: Passenger = {
      ...passenger,
      name: data.name !== undefined ? data.name.trim() : passenger.name,
      phone: data.phone !== undefined ? data.phone.trim() : passenger.phone,
    };
    setPassenger(updated);
    try {
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(updated));
      const mapStr = await AsyncStorage.getItem(PASSENGERS_MAP_KEY);
      const map = mapStr ? JSON.parse(mapStr) : {};
      map[updated.email.toLowerCase()] = updated;
      await AsyncStorage.setItem(PASSENGERS_MAP_KEY, JSON.stringify(map));
    } catch (e) {
      console.warn('Erro ao atualizar perfil do passageiro:', e);
    }
  }, [passenger]);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
    setToken(null);
    setPassenger(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      passenger,
      token,
      isAuthenticated: !!token,
      isLoading,
      login,
      registerPassenger,
      updateProfile,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}
