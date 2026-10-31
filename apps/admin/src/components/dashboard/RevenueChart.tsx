import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import type { RevenueDataPoint } from '../../types';

interface RevenueChartProps {
  data: RevenueDataPoint[];
  isLoading?: boolean;
}

// Tooltip customizado com tema escuro
function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-brand-dark border border-brand-dark-border rounded-lg p-3 shadow-xl">
      <p className="text-slate-400 text-xs mb-2">{label}</p>
      <p className="text-brand-amber font-bold text-sm">
        R$ {payload[0]?.value?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
      </p>
    </div>
  );
}

/**
 * Gráfico de área mostrando receita dos últimos 7 dias
 */
export function RevenueChart({ data, isLoading }: RevenueChartProps) {
  if (isLoading) {
    return (
      <div className="h-64 bg-brand-dark-border/30 rounded-lg animate-pulse" />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={256}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <defs>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
        <XAxis
          dataKey="date"
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#94A3B8', fontSize: 12 }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#94A3B8', fontSize: 12 }}
          tickFormatter={(v) => `R$ ${v}`}
          width={70}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#F59E0B"
          strokeWidth={2}
          fill="url(#revenueGradient)"
          dot={{ fill: '#F59E0B', strokeWidth: 0, r: 4 }}
          activeDot={{ r: 6, fill: '#FCD34D' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
