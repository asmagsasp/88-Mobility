import { NavLink } from 'react-router-dom';
import { LayoutDashboard, DollarSign, Users, Car, LogOut, Star, Zap } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../../stores/auth.store.tsx';
import { usePeakHour } from '../../hooks/usePeakHour';

// Itens do menu de navegação
const navItems = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    highlight: false,
  },
  {
    to: '/pricing',
    label: 'Preço por Km',
    icon: DollarSign,
    highlight: true, // ⭐ Diferencial do app
  },
  {
    to: '/drivers',
    label: 'Motoristas',
    icon: Users,
    highlight: false,
  },
  {
    to: '/rides',
    label: 'Corridas',
    icon: Car,
    highlight: false,
  },
];

/**
 * Sidebar escura com logo 88, navegação e indicador de horário de pico
 */
export function Sidebar() {
  const { logout, user } = useAuth();
  const { peakStatus, peakConfig } = usePeakHour();

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-brand-dark border-r border-brand-dark-border">
      {/* Logo 88 */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-brand-dark-border">
        <img
          src="/logo.jpg"
          alt="88 Mobility Logo"
          className="w-10 h-10 rounded-xl object-cover border border-brand-amber/30"
        />
        <div>
          <p className="text-white font-bold text-sm leading-tight">88 Mobility</p>
          <p className="text-slate-500 text-xs">Painel Admin</p>
        </div>
      </div>

      {/* Indicador de pico — aparece na sidebar quando configurado */}
      {peakConfig.enabled && (
        <div
          className={clsx(
            'mx-3 mt-3 px-3 py-2 rounded-lg border text-xs font-medium flex items-center gap-2 transition-all',
            peakStatus.isActive
              ? 'bg-orange-500/15 border-orange-500/30 text-orange-400'
              : 'bg-brand-dark-card border-brand-dark-border text-slate-500'
          )}
        >
          <Zap
            size={13}
            className={clsx(
              peakStatus.isActive ? 'text-orange-400' : 'text-slate-600',
              peakStatus.isActive && 'animate-pulse'
            )}
          />
          {peakStatus.isActive ? (
            <span>
              Pico <span className="font-bold text-orange-300">ativo</span>
              {' '}· {peakStatus.currentSlot?.start}–{peakStatus.currentSlot?.end}
            </span>
          ) : (
            <span>
              {peakStatus.nextSlot
                ? `Pico às ${peakStatus.nextSlot.start}`
                : 'Pico configurado'}
            </span>
          )}
        </div>
      )}

      {/* Navegação */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, label, icon: Icon, highlight }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group',
                isActive
                  ? 'bg-brand-amber text-brand-dark'
                  : highlight
                  ? 'text-brand-amber hover:bg-brand-amber/10'
                  : 'text-slate-400 hover:bg-brand-dark-card hover:text-white'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={18}
                  className={clsx(
                    'flex-shrink-0',
                    isActive ? 'text-brand-dark' : highlight ? 'text-brand-amber' : ''
                  )}
                />
                <span>{label}</span>
                {highlight && !isActive && (
                  <Star size={12} className="ml-auto text-brand-amber fill-brand-amber" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Rodapé com usuário e logout */}
      <div className="px-3 py-4 border-t border-brand-dark-border">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-brand-dark-border flex items-center justify-center text-xs font-semibold text-white">
            {user?.name?.charAt(0).toUpperCase() ?? 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name ?? 'Admin'}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-red-900/20 hover:text-red-400 transition-all duration-200"
        >
          <LogOut size={18} />
          Sair
        </button>
      </div>
    </aside>
  );
}
