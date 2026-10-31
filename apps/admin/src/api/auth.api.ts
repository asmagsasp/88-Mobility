import apiClient from './client';
import type { AuthResponse, LoginCredentials } from '../types';

// API de autenticação do admin
export const authApi = {
  /**
   * Faz login com email e senha
   */
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const { data } = await apiClient.post<AuthResponse>('/auth/admin/login', credentials);
    return data;
  },

  /**
   * Desloga o usuário (invalida token no servidor)
   */
  logout: async (): Promise<void> => {
    await apiClient.post('/auth/admin/logout');
  },

  /**
   * Retorna o perfil do usuário autenticado
   */
  me: async () => {
    const { data } = await apiClient.get('/auth/me');
    return data;
  },
};
