import * as React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { MetricValue } from '@/experiences/gestor/ui';
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
    <div className="relative overflow-hidden rounded-2xl card-hero-glass h-full">
      <div className="absolute inset-0 gradient-hero-light dark:gradient-hero-dark opacity-60" />
      <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-primary/5 dark:bg-primary/10 blur-3xl" />
      <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-blue-500/5 dark:bg-blue-500/8 blur-3xl" />

      <div className="relative p-5 sm:p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground">Conceito MEC projetado</h3>
          {hasSancao && (
            <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] font-semibold tracking-wide shrink-0">
              SANÇÃO ATIVA
            </Badge>
          )}
        </div>

        <div>
          {nota !== null ? (
            <MetricValue size="xl" className={cn('leading-none', NOTA_COLOR[nota] ?? 'text-foreground')}>
              {nota}
            </MetricValue>
          ) : (
            <MetricValue size="xl" className="leading-none text-muted-foreground">—</MetricValue>
          )}
          <p className="text-xs text-muted-foreground mt-1">de 5 · escala INEP</p>
        </div>

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
    </div>
  );
};
