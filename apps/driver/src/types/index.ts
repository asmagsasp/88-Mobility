// Tipos compartilhados entre apps do motorista e passageiro

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
}

export interface Driver extends User {
  vehicle: string;
  vehiclePlate: string;
  rating: number;
  totalRides: number;
  isOnline: boolean;
}

export interface Passenger extends User {
  totalRides: number;
}

export type RideStatus =
  | 'searching'      // Buscando motorista
  | 'accepted'       // Motorista aceitou
  | 'arriving'       // Motorista a caminho
  | 'in_progress'    // Corrida em andamento
  | 'completed'      // Concluída
  | 'cancelled';     // Cancelada

export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface Ride {
  id: string;
  passengerId: string;
  passengerName: string;
  driverId?: string;
  driverName?: string;
  driverVehicle?: string;
  driverPlate?: string;
  driverRating?: number;
  driverPhone?: string;
  origin: Location;
  destination: Location;
  distanceKm: number;
  pricePerKm: number;
  surgeFee: number;        // Acréscimo de pico
  totalAmount: number;
  driverShare: number;     // 88%
  platformShare: number;   // 12%
  status: RideStatus;
  requestedAt: string;
  acceptedAt?: string;
  completedAt?: string;
  estimatedMinutes?: number;
}

export interface Earnings {
  today: number;
  week: number;
  month: number;
  totalRides: number;
  totalKm: number;
}

export interface RideHistory extends Ride {
  earnings?: number; // para motorista
}
