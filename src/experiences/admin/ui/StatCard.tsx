import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type StatAccent = 'default' | 'emerald' | 'amber' | 'red' | 'blue' | 'violet' | 'muted';

const ACCENT_VALUE_CLASS: Record<StatAccent, string> = {
  default: 'text-foreground',
  emerald: 'text-emerald-600 dark:text-emerald-400',
  amber: 'text-amber-600 dark:text-amber-400',
  red: 'text-red-600 dark:text-red-400',
  blue: 'text-blue-600 dark:text-blue-400',
  violet: 'text-violet-600 dark:text-violet-400',
  muted: 'text-muted-foreground',
};

export interface StatCardProps {
  /** Rótulo curto — renderizado mono/uppercase. */
  label: string;
  value: ReactNode;
  /** Acento semântico opcional aplicado ao valor (e ao ícone, se houver). */
  accent?: StatAccent;
  icon?: ReactNode;
  /** Texto de apoio abaixo do valor (ex.: comparação com período anterior). */
  hint?: ReactNode;
  className?: string;
}

/**
 * Card de KPI do console admin: rótulo mono uppercase + valor font-mono tabular-nums grande.
 */
export function StatCard({ label, value, accent = 'default', icon, hint, className }: StatCardProps) {
  return (
    <div className={cn('rounded-xl border bg-card p-4', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        {icon && <span className={cn('shrink-0', ACCENT_VALUE_CLASS[accent])}>{icon}</span>}
      </div>
      <div className={cn('mt-2 font-mono text-2xl font-semibold tabular-nums', ACCENT_VALUE_CLASS[accent])}>
        {value}
      </div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
