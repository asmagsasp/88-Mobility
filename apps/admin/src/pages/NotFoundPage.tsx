import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';
import { Button } from '../components/ui/Button';

/**
 * Página 404 — rota não encontrada
 */
export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-8xl font-black text-brand-amber mb-4">404</div>
        <h1 className="text-2xl font-bold text-white mb-2">Página não encontrada</h1>
        <p className="text-slate-400 mb-8">
          A rota que você acessou não existe no painel 88 Mobility.
        </p>
        <Link to="/dashboard">
          <Button variant="primary" leftIcon={<Home size={18} />}>
            Voltar ao Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
