import axios from 'axios';
import { registerMockInterceptor } from './mock';

// Instância axios configurada com a URL base do backend
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Em desenvolvimento, ativa o mock local (sem backend necessário)
// O mock intercepta as requisições ANTES de chegarem à rede
if (import.meta.env.DEV) {
  registerMockInterceptor(apiClient);
}

// Interceptor de REQUEST: adiciona Bearer token do localStorage
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('88mobility_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor de RESPONSE: trata 401 → logout automático
// Exceção: rota de login (401 = credenciais erradas, não sessão expirada)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginRoute = error.config?.url?.includes('/auth/admin/login');
    if (error.response?.status === 401 && !isLoginRoute) {
      localStorage.removeItem('88mobility_token');
      localStorage.removeItem('88mobility_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
