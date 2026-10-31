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
  | 'searching'
  | 'accepted'
  | 'arriving'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

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
  origin: Location;
  destination: Location;
  distanceKm: number;
  pricePerKm: number;
  surgeFee: number;
  totalAmount: number;
  driverShare: number;
  platformShare: number;
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
