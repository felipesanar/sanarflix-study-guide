import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { GestorPanel, MetricValue } from '@/experiences/gestor/ui';
import type { HeaderSummary } from '@/types/desempenhoV2';

interface ConceitoMecCardProps {
  headerSummary: HeaderSummary;
  /** 3 KPIs mono para o rodapé do card (ex.: % proficientes, TRI médio, total de alunos). */
  footerKpis: { label: string; value: React.ReactNode }[];
}

/** Cor por nota do conceito MEC: 1-2 red / 3 amber / 4 blue / 5 emerald. */
const NOTA_COLOR: Record<number, string> = {
  1: 'text-red-600 dark:text-red-400',
  2: 'text-red-600 dark:text-red-400',
  3: 'text-amber-600 dark:text-amber-400',
  4: 'text-blue-600 dark:text-blue-400',
  5: 'text-emerald-600 dark:text-emerald-400',
};

const BLOCK_COLOR_ACTIVE: Record<number, string> = {
  1: 'bg-red-500/15 border-red-500 text-red-600 dark:text-red-400',
  2: 'bg-red-500/15 border-red-500 text-red-600 dark:text-red-400',
  3: 'bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400',
  4: 'bg-blue-500/15 border-blue-500 text-blue-600 dark:text-blue-400',
  5: 'bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400',
};

/**
 * Card "Conceito MEC" do Panorama — número gigante colorido pela nota (1-5),
 * escala de 5 blocos com o atual preenchido e a meta institucional (conceito
 * 3) tracejada, badge de sanção ativa e quantos alunos proficientes faltam
 * para o conceito-meta.
 */
export const ConceitoMecCard: React.FC<ConceitoMecCardProps> = ({ headerSummary, footerKpis }) => {
  const nota = headerSummary.notaScoped;
  const hasSancao = !!headerSummary.sancao;
  const CONCEITO_META = 3; // meta institucional padrão (conceito 3)

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.3 }}>
      <GestorPanel
        title="Conceito MEC projetado"
        action={hasSancao && (
          <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] font-semibold tracking-wide">
            SANÇÃO ATIVA
          </Badge>
        )}
        className="h-full"
      >
        <div className="space-y-5">
          {nota !== null ? (
            <MetricValue size="xl" className={cn('leading-none', NOTA_COLOR[nota] ?? 'text-foreground')}>
              {nota}
            </MetricValue>
          ) : (
            <MetricValue size="xl" className="leading-none text-muted-foreground">—</MetricValue>
          )}
          <p className="text-xs text-muted-foreground -mt-3">de 5 · escala INEP</p>

          {/* Escala de 5 blocos: atual preenchido, meta (3) tracejada */}
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => {
              const isActive = nota === n;
              const isMeta = n === CONCEITO_META;
              return (
                <div
                  key={n}
                  className={cn(
                    'flex h-9 flex-1 items-center justify-center rounded-md border font-mono text-sm font-semibold transition-colors',
                    isActive
                      ? BLOCK_COLOR_ACTIVE[n]
                      : 'border-border text-muted-foreground bg-muted/30',
                    isMeta && !isActive && 'border-dashed border-foreground/40 text-foreground',
                  )}
                  aria-current={isActive ? 'true' : undefined}
                >
                  {n}
                </div>
              );
            })}
          </div>

          {headerSummary.alunosFaltamMeta > 0 && (
            <p className="text-sm text-foreground leading-relaxed">
              Para alcançar o <span className="font-semibold">conceito {CONCEITO_META}</span> (meta institucional) faltam{' '}
              <span className="font-semibold text-primary">{headerSummary.alunosFaltamMeta} alunos proficientes</span>.
            </p>
          )}

          {/* Rodapé: 3 KPIs mono */}
          {footerKpis.length > 0 && (
            <div className="grid grid-cols-3 gap-2 border-t border-border pt-4">
              {footerKpis.map((kpi) => (
                <div key={kpi.label} className="space-y-0.5">
                  <MetricValue size="lg" className="block leading-none">{kpi.value}</MetricValue>
                  <p className="text-[11px] text-muted-foreground">{kpi.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </GestorPanel>
    </motion.div>
  );
};
