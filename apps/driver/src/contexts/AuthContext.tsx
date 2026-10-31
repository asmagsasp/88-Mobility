import React, { createContext, useContext, useState } from 'react';
import type { Driver } from '../types';

interface RegisterDriverData {
  name: string;
  email: string;
  phone: string;
  vehicleModel: string;
  vehiclePlate: string;
  password: string;
}

interface AuthState {
  driver: Driver | null;
  isAuthenticated: boolean;
  isLoginLoading: boolean;
  login: (email: string, password: string) => void;
  registerDriver: (data: RegisterDriverData) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [driver, setDriver]               = useState<Driver | null>(null);
  const [isLoginLoading, setLoginLoading] = useState(false);

  const login = (email: string, _password: string) => {
    setLoginLoading(true);
    setTimeout(() => {
      setDriver({
        id: `driver-${Date.now()}`,
        name: email.split('@')[0] || 'Motorista Parceiro',
        email,
        phone: '(11) 98888-8888',
        vehicle: 'Carro Cadastrado',
        vehiclePlate: 'BRA8888',
        rating: 5.0,
        totalRides: 0,
        isOnline: false,
      });
      setLoginLoading(false);
    }, 400);
  };

  const registerDriver = (data: RegisterDriverData) => {
    setLoginLoading(true);
    setTimeout(() => {
      setDriver({
        id: `driver-${Date.now()}`,
        name: data.name,
        email: data.email,
        phone: data.phone,
        vehicle: data.vehicleModel,
        vehiclePlate: data.vehiclePlate,
        rating: 5.0,
        totalRides: 0,
        isOnline: false,
      });
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
      registerDriver,
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
