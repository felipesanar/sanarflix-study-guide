import * as React from 'react';
import { MetricValue } from '@/experiences/gestor/ui';

interface AdesaoCornerProps {
  /** % de adesão (0-100), já arredondado. */
  percent: number;
  respondentes: number;
  base: number;
}

/** Métrica de canto do hero do Panorama — adesão ao simulado ativo. */
export const AdesaoCorner: React.FC<AdesaoCornerProps> = ({ percent, respondentes, base }) => (
  <div className="text-right">
    <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
      Adesão ao simulado
    </p>
    <div className="flex items-baseline justify-end gap-1.5">
      <MetricValue size="lg" className="text-emerald-600 dark:text-emerald-400">
        {percent}%
      </MetricValue>
      <span className="font-mono tabular-nums text-xs text-muted-foreground">
        · {respondentes}/{base}
      </span>
    </div>
  </div>
);
