import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

const DRIVER_STORAGE_KEY = '@88mobility_active_driver';

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [driver, setDriver]               = useState<Driver | null>(null);
  const [isLoginLoading, setLoginLoading] = useState(false);

  // Carrega motorista persistido na inicialização
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(DRIVER_STORAGE_KEY);
        if (stored) {
          setDriver(JSON.parse(stored));
        }
      } catch (e) {
        console.warn('Erro ao restaurar sessão do motorista:', e);
      }
    })();
  }, []);

  const login = (email: string, _password: string) => {
    setLoginLoading(true);
    setTimeout(async () => {
      const isAbel = email.toLowerCase().includes('abel') || email.toLowerCase().includes('magalhaes');
      const driverData: Driver = {
        id: `driver-abel-88`,
        name: isAbel ? 'Abel Magalhães' : (email.split('@')[0] || 'Abel Magalhães'),
        email,
        phone: '(11) 98888-8888',
        vehicle: 'Toyota Corolla 2023',
        vehiclePlate: 'BRA-8888',
        rating: 5.0,
        totalRides: 142,
        isOnline: true,
      };
      setDriver(driverData);
      try {
        await AsyncStorage.setItem(DRIVER_STORAGE_KEY, JSON.stringify(driverData));
      } catch (err) {
        console.warn('Erro ao salvar motorista no storage:', err);
      }
      setLoginLoading(false);
    }, 400);
  };

  const registerDriver = (data: RegisterDriverData) => {
    setLoginLoading(true);
    setTimeout(async () => {
      const driverData: Driver = {
        id: `driver-${Date.now()}`,
        name: data.name.trim() || 'Abel Magalhães',
        email: data.email.trim(),
        phone: data.phone.trim() || '(11) 98888-8888',
        vehicle: data.vehicleModel.trim() || 'Toyota Corolla 2023',
        vehiclePlate: data.vehiclePlate.trim().toUpperCase() || 'BRA-8888',
        rating: 5.0,
        totalRides: 0,
        isOnline: true,
      };
      setDriver(driverData);
      try {
        await AsyncStorage.setItem(DRIVER_STORAGE_KEY, JSON.stringify(driverData));
      } catch (err) {
        console.warn('Erro ao salvar novo motorista:', err);
      }
      setLoginLoading(false);
    }, 500);
  };

  const logout = async () => {
    setDriver(null);
    try {
      await AsyncStorage.removeItem(DRIVER_STORAGE_KEY);
    } catch (e) {
      console.warn('Erro ao limpar storage:', e);
    }
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
