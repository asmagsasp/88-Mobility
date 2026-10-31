import { Bell, Search, Zap } from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';
import { usePeakHour } from '../../hooks/usePeakHour';
import { clsx } from 'clsx';

// Mapa de títulos por rota
const routeTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/pricing': 'Configuração de Preço por Km',
  '/drivers': 'Motoristas',
  '/rides': 'Corridas',
};

/**
 * Header superior do painel admin com indicador de horário de pico em tempo real
 */
export function Header() {
  const location = useLocation();
  const title = routeTitles[location.pathname] ?? 'Painel Admin';
  const { peakStatus, peakConfig } = usePeakHour();

  const formatBRL = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <header className="h-16 bg-brand-dark border-b border-brand-dark-border flex items-center justify-between px-6 sticky top-0 z-10">
      {/* Título da página atual */}
      <h1 className="text-lg font-semibold text-white">{title}</h1>

      {/* Ações do header */}
      <div className="flex items-center gap-3">
        {/* Indicador de horário de pico — aparece quando ativo */}
        {peakConfig.enabled && (
          <Link
            to="/pricing"
            className={clsx(
              'hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
              peakStatus.isActive
                ? 'bg-orange-500/20 border-orange-500/40 text-orange-300 animate-pulse'
                : 'bg-brand-dark-card border-brand-dark-border text-slate-400 hover:text-slate-200'
            )}
            title={peakStatus.isActive ? `Pico ativo: +${formatBRL(peakConfig.surgeAmount)}/corrida` : 'Horário de pico configurado'}
          >
            <Zap
              size={13}
              className={peakStatus.isActive ? 'text-orange-400' : 'text-slate-500'}
            />
            {peakStatus.isActive ? (
              <>
                Pico ativo ·{' '}
                <span className="font-bold">+{formatBRL(peakConfig.surgeAmount)}</span>
              </>
            ) : (
              <>Pico: {peakStatus.nextSlot?.start ?? 'configurado'}</>
            )}
          </Link>
        )}

        {/* Busca rápida (visual) */}
        <div className="hidden md:flex items-center gap-2 bg-brand-dark-card border border-brand-dark-border rounded-lg px-3 py-2 text-slate-400">
          <Search size={16} />
          <span className="text-sm">Buscar...</span>
          <kbd className="ml-4 text-xs bg-brand-dark-border rounded px-1.5 py-0.5">⌘K</kbd>
        </div>

        {/* Notificações */}
        <button className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-brand-dark-card transition-colors">
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-amber rounded-full" />
        </button>
      </div>
    </header>
  );
}
