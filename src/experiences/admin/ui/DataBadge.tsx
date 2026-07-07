import { cn } from '@/lib/utils';

export type DataBadgeKind = 'real' | 'requires_backend' | 'requires_instrumentation';

interface DataBadgeConfig {
  label: string;
  className: string;
  dotClassName: string;
  pulse: boolean;
}

const CONFIG: Record<DataBadgeKind, DataBadgeConfig> = {
  real: {
    label: 'DADOS REAIS',
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    dotClassName: 'bg-emerald-500',
    pulse: true,
  },
  requires_backend: {
    label: 'REQUER BACKEND',
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    dotClassName: 'bg-amber-500',
    pulse: false,
  },
  requires_instrumentation: {
    label: 'REQUER INSTRUMENTAÇÃO',
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    dotClassName: 'bg-amber-500',
    pulse: false,
  },
};

export interface DataBadgeProps {
  kind: DataBadgeKind;
  /** Sobrescreve o texto padrão (mantém as cores do kind). */
  label?: string;
  className?: string;
}

/**
 * Honestidade de dados como componente: "DADOS REAIS" (emerald, ponto pulsante) /
 * "REQUER BACKEND" (amber) / "REQUER INSTRUMENTAÇÃO" (amber). Nunca inventar dado —
 * toda métrica sem fonte real deve exibir este badge em vez de um número.
 */
export function DataBadge({ kind, label, className }: DataBadgeProps) {
  const cfg = CONFIG[kind];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide',
        cfg.className,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dotClassName, cfg.pulse && 'animate-pulse')} />
      {label ?? cfg.label}
    </span>
  );
}
