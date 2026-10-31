import { clsx } from 'clsx';
import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  change?: number;     // % de mudança (positivo = crescimento)
  iconColor?: string;
  suffix?: string;
}

/**
 * Card de estatística com ícone, valor e indicador de crescimento
 */
export function StatsCard({ title, value, icon: Icon, change, iconColor = 'text-brand-amber', suffix }: StatsCardProps) {
  const isPositive = (change ?? 0) >= 0;

  return (
    <div className="bg-brand-dark-card border border-brand-dark-border rounded-xl p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-slate-400 font-medium">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">
            {value}
            {suffix && <span className="text-base font-normal text-slate-400 ml-1">{suffix}</span>}
          </p>
          {change !== undefined && (
            <div className={clsx(
              'flex items-center gap-1 mt-2 text-sm font-medium',
              isPositive ? 'text-green-400' : 'text-red-400'
            )}>
              {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              <span>
                {isPositive ? '+' : ''}{change.toFixed(1)}% vs semana anterior
              </span>
            </div>
          )}
        </div>
        <div className={clsx(
          'flex items-center justify-center w-12 h-12 rounded-xl bg-brand-dark-border',
          iconColor
        )}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
}
