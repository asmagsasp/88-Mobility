import apiClient from './client';
import type { Ride, PaginatedResponse } from '../types';

// API de corridas
export const ridesApi = {
  /**
   * Lista corridas com filtros e paginação
   */
  getRides: async (params?: {
    status?: string;
    page?: number;
    perPage?: number;
    driverId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<PaginatedResponse<Ride>> => {
    const { data } = await apiClient.get<PaginatedResponse<Ride>>('/admin/rides', { params });
    return data;
  },

  /**
   * Retorna detalhes de uma corrida específica
   */
  getRideById: async (rideId: string): Promise<Ride> => {
    const { data } = await apiClient.get<Ride>(`/admin/rides/${rideId}`);
    return data;
  },

  /**
   * Lista as corridas mais recentes (para o dashboard)
   */
  getRecentRides: async (limit: number = 10): Promise<Ride[]> => {
    const { data } = await apiClient.get<Ride[]>(`/admin/rides/recent?limit=${limit}`);
    return data;
  },
};
