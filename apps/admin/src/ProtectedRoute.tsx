import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './stores/auth.store';

/**
 * Guard de rotas protegidas: redireciona para /login se não autenticado
 */
export function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}

/**
 * Guard de rotas públicas: redireciona para /dashboard se já autenticado
 */
export function PublicRoute() {
  const { isAuthenticated } = useAuth();
  return !isAuthenticated ? <Outlet /> : <Navigate to="/dashboard" replace />;
}
