import * as React from 'react';
import { cn } from '@/lib/utils';

export type StatusLevel = 'proficiente' | 'proximo' | 'critico';

interface StatusBadgeProps {
  /** Nível explícito. Quando omitido, é derivado de `percent`. */
  status?: StatusLevel;
  /** % de acerto/proficiência — deriva o status quando `status` não é informado. */
  percent?: number;
  className?: string;
}

const STATUS_CONFIG: Record<StatusLevel, { label: string; className: string }> = {
  proficiente: {
    label: 'Proficiente',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  },
  proximo: {
    label: 'Próximo',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  },
  critico: {
    label: 'Crítico',
    className: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  },
};

/** Deriva o {@link StatusLevel} a partir de um percentual: >=60 proficiente, >=50 próximo, <50 crítico. */
export const statusFromPercent = (percent: number): StatusLevel =>
  percent >= 60 ? 'proficiente' : percent >= 50 ? 'proximo' : 'critico';

/**
 * Badge de status de proficiência — Proficiente (>=60%, emerald) / Próximo
 * (>=50%, amber) / Crítico (<50%, red). Mesmo padrão de cor do
 * `InstitutionalHeader`.
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, percent, className }) => {
  const level = status ?? statusFromPercent(percent ?? 0);
  const config = STATUS_CONFIG[level];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
};
