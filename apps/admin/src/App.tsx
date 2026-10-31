import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './stores/auth.store.tsx';
import { Layout } from './components/layout/Layout';
import { ProtectedRoute, PublicRoute } from './ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { PricingPage } from './pages/PricingPage';
import { DriversPage } from './pages/DriversPage';
import { RidesPage } from './pages/RidesPage';
import { NotFoundPage } from './pages/NotFoundPage';

// Configuração do React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,       // 30 segundos
      gcTime: 5 * 60_000,      // 5 minutos
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

/**
 * Componente raiz do painel admin 88 Mobility
 * Configura providers globais e roteamento
 */
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Rota raiz — redireciona para dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* Rotas públicas (não autenticadas) */}
            <Route element={<PublicRoute />}>
              <Route path="/login" element={<LoginPage />} />
            </Route>

            {/* Rotas protegidas (autenticadas) */}
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/drivers" element={<DriversPage />} />
                <Route path="/rides" element={<RidesPage />} />
              </Route>
            </Route>

            {/* 404 */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
