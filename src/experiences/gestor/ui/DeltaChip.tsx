import * as React from 'react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeltaChipProps {
  /** Valor do delta. Sinal positivo/negativo define seta e cor semântica. */
  value: number;
  /** Sufixo textual (ex.: "pp"). @default 'pp' */
  suffix?: string;
  /**
   * Quando `false`, inverte a semântica de cor (delta negativo é bom).
   * Use para métricas onde "menor é melhor". @default true
   */
  higherIsBetter?: boolean;
  /** Não exibe cor/seta — apenas texto neutro (mudança sem juízo de valor). */
  neutral?: boolean;
  className?: string;
}

/**
 * Chip de variação (delta) com seta e cor semântica: emerald quando a
 * variação é boa, red quando é ruim. Usa `pp` (pontos percentuais) como
 * sufixo padrão — comum aos KPIs do console de Gestão.
 */
export const DeltaChip: React.FC<DeltaChipProps> = ({
  value,
  suffix = 'pp',
  higherIsBetter = true,
  neutral = false,
  className,
}) => {
  const isZero = value === 0;
  const isGood = higherIsBetter ? value > 0 : value < 0;
  const Icon = isZero ? Minus : value > 0 ? ArrowUp : ArrowDown;

  const colorClass = neutral || isZero
    ? 'text-muted-foreground'
    : isGood
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-red-600 dark:text-red-400';

  const sign = value > 0 ? '+' : '';

  return (
    <span className={cn('inline-flex items-center gap-0.5 font-mono tabular-nums text-sm font-medium', colorClass, className)}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {sign}{value}{suffix}
    </span>
  );
};
