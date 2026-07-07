import * as React from 'react';
import { motion } from 'framer-motion';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GestorPanel, MetricValue } from '@/experiences/gestor/ui';
import type { IesComparisonEntry } from '@/services/gestor/iesComparison';
import { CONCEPT_TEXT_COLOR } from './conceitoColor';

interface IesCompareCardProps {
  entry: IesComparisonEntry;
  /** Iniciais para o avatar (derivadas do nome da IES). */
  initials: string;
  /** Destaca o card da IES ativa (filtro corrente ou IES do usuário). */
  active?: boolean;
  /** Delay de entrada escalonado (framer-motion). */
  delayIndex?: number;
  onClick?: () => void;
}

const fmtPct = (v: number | null): string => (v == null ? '—' : `${Math.round(v)}%`);
const fmtScore = (v: number | null): string => (v == null ? '—' : Math.round(v).toString());

/** Tendência derivada de `delta_pcp`: ▲ subindo (emerald) / ▼ caindo (red) / — estável (muted). */
const Tendencia: React.FC<{ delta: number | null }> = ({ delta }) => {
  if (delta == null || delta === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        <Minus className="h-3 w-3" aria-hidden="true" /> estável
      </span>
    );
  }
  const isUp = delta > 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-mono tabular-nums text-xs font-medium',
        isUp ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600 dark:text-red-400',
      )}
    >
      {isUp ? <ArrowUp className="h-3 w-3" aria-hidden="true" /> : <ArrowDown className="h-3 w-3" aria-hidden="true" />}
      {isUp ? '+' : ''}
      {delta.toFixed(1)}pp
    </span>
  );
};

/**
 * Card de uma IES no comparativo de grupo: avatar de iniciais, nome,
 * conceito MEC colorido em destaque, tendência (delta_pcp) e 3 métricas
 * (proficientes, TRI médio, adesão). A IES ativa recebe `ring-primary`.
 */
export const IesCompareCard: React.FC<IesCompareCardProps> = ({
  entry,
  initials,
  active,
  delayIndex = 0,
  onClick,
}) => {
  const conceito = entry.concept;
  const conceitoColor = conceito != null ? (CONCEPT_TEXT_COLOR[conceito] ?? 'text-foreground') : 'text-muted-foreground';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.03 * delayIndex, duration: 0.3 }}
      {...(onClick ? { whileHover: { scale: 1.01, y: -2 }, whileTap: { scale: 0.98 } } : {})}
    >
      <GestorPanel
        className={cn(
          'h-full transition-shadow',
          active && 'ring-2 ring-primary',
          onClick && 'cursor-pointer hover:shadow-sm',
        )}
        contentClassName="space-y-4"
      >
        <button
          type="button"
          onClick={onClick}
          disabled={!onClick}
          className={cn('flex w-full items-center gap-3 text-left', !onClick && 'cursor-default')}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{entry.ies_nome}</p>
            <Tendencia delta={entry.delta_pcp} />
          </div>
        </button>

        <div className="flex items-baseline gap-2">
          <MetricValue size="xl" className={cn('leading-none', conceitoColor)}>
            {conceito ?? '—'}
          </MetricValue>
          <span className="text-xs text-muted-foreground">conceito MEC</span>
        </div>

        <div className="grid grid-cols-3 gap-2 border-t border-border pt-3">
          <div className="space-y-0.5">
            <MetricValue size="sm" className="block leading-none">{fmtPct(entry.pcp)}</MetricValue>
            <p className="text-[10px] text-muted-foreground">Proficientes</p>
          </div>
          <div className="space-y-0.5">
            <MetricValue size="sm" className="block leading-none">{fmtScore(entry.mean_score)}</MetricValue>
            <p className="text-[10px] text-muted-foreground">TRI médio</p>
          </div>
          <div className="space-y-0.5">
            <MetricValue size="sm" className="block leading-none">{fmtPct(entry.adesao_pct)}</MetricValue>
            <p className="text-[10px] text-muted-foreground">Adesão</p>
          </div>
        </div>
      </GestorPanel>
    </motion.div>
  );
};
