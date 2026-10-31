import React, { createContext, useContext, useState } from 'react';
import type { Driver } from '../types';

interface AuthState {
  driver: Driver | null;
  isAuthenticated: boolean;
  isLoginLoading: boolean;
  login: (email: string, password: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const MOCK_DRIVER: Driver = {
  id: 'driver-001',
  name: 'Motorista Teste',
  email: 'motorista@88mobility.com',
  phone: '(61) 99999-0001',
  vehicle: 'Toyota Corolla 2021',
  vehiclePlate: 'ABC-1234',
  rating: 4.8,
  totalRides: 342,
  isOnline: false,
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [driver, setDriver]               = useState<Driver | null>(null);
  const [isLoginLoading, setLoginLoading] = useState(false);

  const login = (email: string, _password: string) => {
    setLoginLoading(true);
    // Simula delay mínimo e loga imediatamente
    setTimeout(() => {
      setDriver({ ...MOCK_DRIVER, name: email.split('@')[0] || 'Motorista', email });
      setLoginLoading(false);
    }, 500);
  };

  const logout = () => {
    setDriver(null);
  };

  return (
    <AuthContext.Provider value={{
      driver,
      isAuthenticated: driver !== null,
      isLoginLoading,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro do AuthProvider');
  return ctx;
}
