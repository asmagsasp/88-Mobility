import { UserRole } from '@prisma/client';

// ============================================================
// Tipos compartilhados do sistema 88 Mobility
// ============================================================

/**
 * Payload armazenado no JWT (access token)
 */
export interface JwtPayload {
  userId: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

/**
 * Par de tokens retornado no login/register
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // segundos até expirar o access token
}

/**
 * Extensão do Request do Express para incluir o usuário autenticado
 */
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Resultado de estimativa de corrida
 */
export interface RideEstimate {
  estimatedKm: number;
  pricePerKm: number;
  platformFee?: number;
  estimatedTotal: number;
  driverAmount: number;    // 88%
  platformAmount: number;  // 12% + taxa de manutenção
  estimatedMinutes: number;
}

/**
 * Dados de localização do motorista
 */
export interface DriverLocation {
  driverId: string;
  lat: number;
  lng: number;
  heading?: number; // direção em graus
  timestamp: number;
}

/**
 * Motorista próximo retornado pelo Redis GEOSEARCH
 */
export interface NearbyDriver {
  driverId: string;
  distanceKm: number;
  lat: number;
  lng: number;
}

/**
 * Parâmetros de paginação
 */
export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

/**
 * Resposta paginada
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Estatísticas gerais da plataforma
 */
export interface PlatformStats {
  totalRides: number;
  completedRides: number;
  cancelledRides: number;
  totalRevenue: number;
  platformRevenue: number;
  driverRevenue: number;
  totalKm: number;
  activeDrivers: number;
  totalPassengers: number;
  averageRating: number;
}
