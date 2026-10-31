import apiClient from './client';
import type { DashboardStats, RevenueDataPoint, PaginatedResponse, Driver, PricingConfig, PricingFormData, PeakHourConfig } from '../types';

// API do painel admin: dashboard, pricing, drivers
export const adminApi = {
  // ─── Dashboard ───────────────────────────────────────────────────────────
  
  /**
   * Retorna estatísticas gerais do dashboard
   */
  getDashboardStats: async (): Promise<DashboardStats> => {
    const { data } = await apiClient.get<DashboardStats>('/admin/dashboard/stats');
    return data;
  },

  /**
   * Retorna dados de receita dos últimos N dias para o gráfico
   */
  getRevenueChart: async (days: number = 7): Promise<RevenueDataPoint[]> => {
    const { data } = await apiClient.get<RevenueDataPoint[]>(`/admin/dashboard/revenue?days=${days}`);
    return data;
  },

  // ─── Pricing (Preço por Km) ───────────────────────────────────────────────
  
  /**
   * Retorna a configuração de preço atual
   */
  getCurrentPricing: async (): Promise<PricingConfig> => {
    const { data } = await apiClient.get<PricingConfig>('/admin/pricing/current');
    return data;
  },

  /**
   * Retorna histórico das últimas configurações de preço
   */
  getPricingHistory: async (): Promise<PricingConfig[]> => {
    const { data } = await apiClient.get<PricingConfig[]>('/admin/pricing/history');
    return data;
  },

  /**
   * Atualiza o preço por Km (tela principal do diferencial 88 Mobility)
   */
  updatePricing: async (payload: PricingFormData): Promise<PricingConfig> => {
    const { data } = await apiClient.post<PricingConfig>('/admin/pricing', payload);
    return data;
  },

  // ─── Peak Hour Pricing (Horário de Pico) ─────────────────────────────────

  /**
   * Retorna a configuração atual de horários de pico
   */
  getPeakHourConfig: async (): Promise<PeakHourConfig> => {
    const { data } = await apiClient.get<PeakHourConfig>('/admin/pricing/peak-hours');
    return data;
  },

  /**
   * Salva nova configuração de horários de pico
   */
  updatePeakHourConfig: async (payload: Omit<PeakHourConfig, 'id' | 'updatedAt' | 'updatedBy'>): Promise<PeakHourConfig> => {
    const { data } = await apiClient.put<PeakHourConfig>('/admin/pricing/peak-hours', payload);
    return data;
  },

  /**
   * Ativa ou desativa o modo de pico instantaneamente (sem alterar config)
   */
  togglePeakHour: async (enabled: boolean): Promise<PeakHourConfig> => {
    const { data } = await apiClient.patch<PeakHourConfig>('/admin/pricing/peak-hours/toggle', { enabled });
    return data;
  },

  // ─── Drivers (Motoristas) ─────────────────────────────────────────────────
  
  /**
   * Lista motoristas com filtros e paginação
   */
  getDrivers: async (params?: {
    status?: string;
    page?: number;
    perPage?: number;
    search?: string;
  }): Promise<PaginatedResponse<Driver>> => {
    const { data } = await apiClient.get<PaginatedResponse<Driver>>('/admin/drivers', { params });
    return data;
  },

  /**
   * Aprova um motorista pendente
   */
  approveDriver: async (driverId: string): Promise<Driver> => {
    const { data } = await apiClient.patch<Driver>(`/admin/drivers/${driverId}/approve`);
    return data;
  },

  /**
   * Bloqueia um motorista
   */
  blockDriver: async (driverId: string, reason?: string): Promise<Driver> => {
    const { data } = await apiClient.patch<Driver>(`/admin/drivers/${driverId}/block`, { reason });
    return data;
  },
};
