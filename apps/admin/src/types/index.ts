// Tipos TypeScript do 88 Mobility Admin Panel

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'operator';
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export type DriverStatus = 'online' | 'offline' | 'pending' | 'blocked';

export interface Driver {
  id: string;
  name: string;
  email: string;
  phone: string;
  cpf: string;
  vehicle: string;
  vehiclePlate: string;
  vehicleYear: number;
  rating: number;
  totalRides: number;
  totalKm: number;
  status: DriverStatus;
  createdAt: string;
  approvedAt?: string;
}

export type RideStatus = 'requested' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';

export interface Ride {
  id: string;
  passengerId: string;
  passengerName: string;
  driverId: string;
  driverName: string;
  origin: string;
  destination: string;
  distanceKm: number;
  pricePerKm: number;
  totalAmount: number;
  driverShare: number;   // 88%
  platformShare: number; // 12%
  status: RideStatus;
  requestedAt: string;
  completedAt?: string;
}

export interface PricingConfig {
  id: string;
  pricePerKm: number;  // em reais
  platformFee?: number; // taxa fixa de manutenção em reais
  setBy: string;       // nome do admin
  setAt: string;       // ISO timestamp
  notes?: string;
}

export interface DashboardStats {
  totalRides: number;
  totalRevenue: number;
  totalKm: number;
  activeDrivers: number;
  ridesGrowth: number;     // % comparado à semana anterior
  revenueGrowth: number;
  kmGrowth: number;
  driversGrowth: number;
}

export interface RevenueDataPoint {
  date: string;   // formato 'DD/MM'
  revenue: number;
  rides: number;
  km: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface ApiError {
  message: string;
  statusCode: number;
}

// Tipos de formulário
export interface PricingFormData {
  pricePerKm: number;
  notes?: string;
}

// Simulação de corrida
export interface RideSimulation {
  distanceKm: number;
  pricePerKm: number;
  totalAmount: number;
  driverEarning: number;   // 88%
  platformEarning: number; // 12%
}

// Faixa de horário de pico (ex: 07:00–09:00)
export interface PeakHourSlot {
  start: string; // "HH:mm"
  end: string;   // "HH:mm"
}

// Configuração completa de horários de pico
export interface PeakHourConfig {
  id: string;
  enabled: boolean;
  surgeAmount: number;          // Valor fixo por corrida em reais (ex: 2.00)
  surgeType: 'per_ride';        // Atualmente só suporta flat fee por corrida
  slots: PeakHourSlot[];        // Lista de faixas de horário
  weekdays: number[];           // 0=Dom, 1=Seg … 6=Sáb
  updatedAt: string;
  updatedBy: string;
}

// Estado atual do pico (calculado em runtime)
export interface PeakHourStatus {
  isActive: boolean;            // Se está em horário de pico AGORA
  currentSlot?: PeakHourSlot;  // Qual faixa está ativa
  nextSlot?: PeakHourSlot;     // Próxima faixa do dia
  effectivePrice: number;       // pricePerKm atual (base)
  surgeFee: number;             // Acréscimo ativo (0 se fora do pico)
}
