import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type StatusPillVariant = 'emerald' | 'amber' | 'red' | 'blue' | 'violet' | 'muted';

const VARIANT_CLASS: Record<StatusPillVariant, string> = {
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  red: 'bg-red-500/10 text-red-600 dark:text-red-400',
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  muted: 'bg-muted text-muted-foreground',
};

const DOT_CLASS: Record<StatusPillVariant, string> = {
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  violet: 'bg-violet-500',
  muted: 'bg-muted-foreground',
};

export interface StatusPillProps {
  /** emerald = sucesso/ativo/real · amber = atenção/encerrando/requer-backend · red = erro/falha/crítico · blue = agendado/info · violet = especial · muted = neutro/encerrado. */
  variant: StatusPillVariant;
  children: ReactNode;
  icon?: ReactNode;
  /** Ponto sólido antes do texto (ex.: para reforçar "ao vivo"). */
  dot?: boolean;
  className?: string;
}

/** Badge pill (rounded-full) fundo `<cor>/10` texto na cor — vocabulário de status do console admin. */
export function StatusPill({ variant, children, icon, dot, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium',
        VARIANT_CLASS[variant],
        className,
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DOT_CLASS[variant])} />}
      {icon}
      {children}
    </span>
  );
}
