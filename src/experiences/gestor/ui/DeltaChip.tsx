import * as React from 'react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeltaChipProps {
  /** Valor do delta. Sinal positivo/negativo define seta e cor semântica. `null` é tratado como neutro/indefinido. */
  value: number | null;
  /** Sufixo textual (ex.: "pp"). @default 'pp' */
  suffix?: string;
  /**
   * Quando `false`, inverte a semântica de cor (delta negativo é bom).
   * Use para métricas onde "menor é melhor". @default true
   */
  higherIsBetter?: boolean;
  /** Não exibe cor/seta — apenas texto neutro (mudança sem juízo de valor). */
  neutral?: boolean;
  /** Casas decimais fixas para o valor numérico (ex.: 1 → "3.0"). Sem isto, exibe o número como veio. */
  decimals?: number;
  /**
   * Texto exibido no lugar do número quando o delta é neutro (zero ou
   * `null`/indefinido) — ex.: "estável". Sem este prop, mostra o valor
   * numérico normalmente (ou "—" quando `value` é `null`).
   */
  neutralLabel?: string;
  className?: string;
}

/**
 * Chip de variação (delta) com seta, cor semântica e fundo tintado em pill:
 * emerald quando a variação é boa, red quando é ruim, neutro (sem
 * destaque) quando zero/`null`/neutral. Usa `pp` (pontos percentuais) como
 * sufixo padrão — comum aos KPIs do console de Gestão.
 */
export const DeltaChip: React.FC<DeltaChipProps> = ({
  value,
  suffix = 'pp',
  higherIsBetter = true,
  neutral = false,
  decimals,
  neutralLabel,
  className,
}) => {
  const isNeutral = value == null || value === 0;
  const isGood = !isNeutral && (higherIsBetter ? value > 0 : value < 0);
  const Icon = isNeutral ? Minus : value > 0 ? ArrowUp : ArrowDown;

  const colorClass = neutral || isNeutral
    ? 'text-muted-foreground'
    : isGood
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-red-600 dark:text-red-400';

  const bgClass = neutral || isNeutral
    ? 'bg-muted/40'
    : isGood
      ? 'bg-emerald-500/10'
      : 'bg-red-500/10';

  const sign = !isNeutral && value > 0 ? '+' : '';
  const formattedValue = value == null ? '—' : decimals != null ? value.toFixed(decimals) : value;
  const content = isNeutral && neutralLabel
    ? neutralLabel
    : `${sign}${formattedValue}${value == null ? '' : suffix}`;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-mono tabular-nums text-sm font-medium',
        colorClass,
        bgClass,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {content}
    </span>
  );
};
