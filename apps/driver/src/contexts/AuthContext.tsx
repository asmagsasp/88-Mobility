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
  updateVehicle: (vehicle: string, vehiclePlate: string) => Promise<void>;
  logout: () => void;
}

const DRIVER_STORAGE_KEY = '@88mobility_active_driver';
const DRIVERS_MAP_KEY    = '@88mobility_registered_drivers_map';

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
      const normalizedEmail = email.trim().toLowerCase();
      let matchedDriver: Driver | null = null;

      try {
        const mapStr = await AsyncStorage.getItem(DRIVERS_MAP_KEY);
        if (mapStr) {
          const map = JSON.parse(mapStr);
          if (map[normalizedEmail]) {
            matchedDriver = map[normalizedEmail];
          }
        }
        if (!matchedDriver) {
          const activeStr = await AsyncStorage.getItem(DRIVER_STORAGE_KEY);
          if (activeStr) {
            const active = JSON.parse(activeStr);
            if (active.email?.toLowerCase() === normalizedEmail) {
              matchedDriver = active;
            }
          }
        }
      } catch (err) {
        console.warn('Erro ao buscar motorista salvo:', err);
      }

      // Se encontrou dados reais previamente cadastrados pelo usuário, usa exatamente esses dados!
      const driverData: Driver = matchedDriver || {
        id: `driver-${Date.now()}`,
        name: email.split('@')[0] || 'Abel Magalhães',
        email: email.trim(),
        phone: '(11) 98888-8888',
        vehicle: 'Carro Cadastrado',
        vehiclePlate: 'BRA-8888',
        rating: 5.0,
        totalRides: 0,
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
      // Salva ESTRITAMENTE o que o motorista digitou nos campos
      const driverData: Driver = {
        id: `driver-${Date.now()}`,
        name: data.name.trim() || 'Motorista Parceiro',
        email: data.email.trim(),
        phone: data.phone.trim() || '(11) 98888-8888',
        vehicle: data.vehicleModel.trim() || 'Carro Cadastrado',
        vehiclePlate: data.vehiclePlate.trim().toUpperCase() || 'BRA-8888',
        rating: 5.0,
        totalRides: 0,
        isOnline: true,
      };

      setDriver(driverData);
      try {
        await AsyncStorage.setItem(DRIVER_STORAGE_KEY, JSON.stringify(driverData));
        const mapStr = await AsyncStorage.getItem(DRIVERS_MAP_KEY);
        const map = mapStr ? JSON.parse(mapStr) : {};
        map[data.email.trim().toLowerCase()] = driverData;
        await AsyncStorage.setItem(DRIVERS_MAP_KEY, JSON.stringify(map));
      } catch (err) {
        console.warn('Erro ao salvar novo motorista:', err);
      }
      setLoginLoading(false);
    }, 400);
  };

  // Permite atualizar os dados do veículo a qualquer momento pela tela de perfil
  const updateVehicle = async (vehicle: string, vehiclePlate: string) => {
    if (!driver) return;
    const updated: Driver = {
      ...driver,
      vehicle: vehicle.trim(),
      vehiclePlate: vehiclePlate.trim().toUpperCase(),
    };
    setDriver(updated);
    try {
      await AsyncStorage.setItem(DRIVER_STORAGE_KEY, JSON.stringify(updated));
      const mapStr = await AsyncStorage.getItem(DRIVERS_MAP_KEY);
      const map = mapStr ? JSON.parse(mapStr) : {};
      map[driver.email.trim().toLowerCase()] = updated;
      await AsyncStorage.setItem(DRIVERS_MAP_KEY, JSON.stringify(map));
    } catch (e) {
      console.warn('Erro ao atualizar veículo:', e);
    }
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
      updateVehicle,
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
