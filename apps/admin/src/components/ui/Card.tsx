import React from 'react';
import { clsx } from 'clsx';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  rightContent?: React.ReactNode;
  noPadding?: boolean;
}

/**
 * Card com fundo escuro e borda sutil — usado em todo o painel
 */
export function Card({ children, className, title, subtitle, rightContent, noPadding }: CardProps) {
  return (
    <div
      className={clsx(
        'bg-brand-dark-card border border-brand-dark-border rounded-xl',
        !noPadding && 'p-6',
        className
      )}
    >
      {(title || rightContent) && (
        <div className={clsx('flex items-start justify-between', !noPadding && 'mb-4')}>
          <div>
            {title && <h3 className="text-base font-semibold text-white">{title}</h3>}
            {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          {rightContent && <div>{rightContent}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
