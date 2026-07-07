import * as React from 'react';
import { cn } from '@/lib/utils';
import { statusFromPercent } from '@/experiences/gestor/ui';

interface StatusProgressBarProps {
  percent: number;
  className?: string;
}

const FILL_CLASS_BY_STATUS: Record<ReturnType<typeof statusFromPercent>, string> = {
  proficiente: 'bg-emerald-500',
  proximo: 'bg-amber-500',
  critico: 'bg-red-500',
};

/**
 * Barra de progresso colorida por status de proficiência (emerald/amber/red).
 * O `Progress` padrão do design system usa uma cor de indicador fixa via
 * variável CSS, então esta tela usa uma barra própria e simples para refletir
 * a cor semântica do recorte (ver `StatusBadge`/`statusFromPercent`).
 */
export const StatusProgressBar: React.FC<StatusProgressBarProps> = ({ percent, className }) => {
  const clamped = Math.max(0, Math.min(100, percent));
  const status = statusFromPercent(percent);
  return (
    <div
      className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn('h-full rounded-full transition-all', FILL_CLASS_BY_STATUS[status])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
};
