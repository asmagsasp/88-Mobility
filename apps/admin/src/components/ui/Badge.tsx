import { clsx } from 'clsx';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'default';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

const variantMap: Record<BadgeVariant, string> = {
  success: 'bg-green-900/30 text-green-400 border-green-800',
  warning: 'bg-amber-900/30 text-amber-400 border-amber-800',
  danger: 'bg-red-900/30 text-red-400 border-red-800',
  info: 'bg-blue-900/30 text-blue-400 border-blue-800',
  default: 'bg-slate-800 text-slate-300 border-slate-700',
};

const dotMap: Record<BadgeVariant, string> = {
  success: 'bg-green-400',
  warning: 'bg-amber-400',
  danger: 'bg-red-400',
  info: 'bg-blue-400',
  default: 'bg-slate-400',
};

/**
 * Badge para status e categorias
 */
export function Badge({ variant = 'default', children, className, dot }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border',
        variantMap[variant],
        className
      )}
    >
      {dot && (
        <span className={clsx('w-1.5 h-1.5 rounded-full', dotMap[variant])} />
      )}
      {children}
    </span>
  );
}
