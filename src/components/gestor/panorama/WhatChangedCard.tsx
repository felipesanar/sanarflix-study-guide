import * as React from 'react';
import { TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GestorPanel, DeltaChip } from '@/experiences/gestor/ui';
import type { EvolucaoSimulado } from '@/mocks/desempenhoInstitucionalV2';

interface WhatChangedCardProps {
  evolucao: EvolucaoSimulado[];
  /** Piores temas (menor % de acerto) da árvore curricular do recorte atual, para o item "maior queda". */
  piorTema?: { nome: string; percentual: number } | null;
}

interface DeltaItem {
  label: string;
  value: number;
  suffix: string;
  higherIsBetter: boolean;
}

/**
 * Card "O que mudou desde o último simulado" — deltas comparando o simulado
 * mais recente com o anterior na série `evolucao` (% proficientes, TRI
 * médio). Some (oculta o card) quando não há simulado anterior na série.
 */
export const WhatChangedCard: React.FC<WhatChangedCardProps> = ({ evolucao, piorTema }) => {
  if (evolucao.length < 2) return null;

  const atual = evolucao[evolucao.length - 1];
  const anterior = evolucao[evolucao.length - 2];

  const items: DeltaItem[] = [];

  if (atual.percentProficientes !== undefined && anterior.percentProficientes !== undefined) {
    const delta = Math.round((atual.percentProficientes - anterior.percentProficientes) * 10) / 10;
    items.push({
      label: '% proficientes',
      value: delta,
      suffix: 'pp',
      higherIsBetter: true,
    });
  }

  const deltaTri = Math.round((atual.proficiencia - anterior.proficiencia) * 10) / 10;
  items.push({
    label: 'Proficiência média TRI',
    value: deltaTri,
    suffix: '',
    higherIsBetter: true,
  });

  const deltaNota = Math.round((atual.nota - anterior.nota) * 10) / 10;
  if (deltaNota !== 0) {
    items.push({
      label: 'Nota institucional',
      value: deltaNota,
      suffix: '',
      higherIsBetter: true,
    });
  }

  return (
    <div className="h-full">
      <GestorPanel
        title="O que mudou desde o último simulado"
        subtitle={`${anterior.simulado} → ${atual.simulado}`}
        className="h-full"
      >
        <div className="space-y-3">
          {items.map((item) => {
            const isZero = item.value === 0;
            const isGood = item.higherIsBetter ? item.value > 0 : item.value < 0;
            return (
              <div key={item.label} className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                      isZero ? 'bg-muted' : isGood ? 'bg-emerald-500/10' : 'bg-red-500/10',
                    )}
                  >
                    <TrendingUp
                      className={cn(
                        'h-4 w-4',
                        isZero
                          ? 'text-muted-foreground'
                          : isGood
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400',
                      )}
                      aria-hidden="true"
                    />
                  </div>
                  <span className="text-sm text-foreground truncate">{item.label}</span>
                </div>
                <DeltaChip value={item.value} suffix={item.suffix} higherIsBetter={item.higherIsBetter} />
              </div>
            );
          })}

          {piorTema && (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2.5">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/10">
                  <TrendingUp className="h-4 w-4 text-red-600 dark:text-red-400" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-foreground truncate">{piorTema.nome}</p>
                  <p className="text-[11px] text-muted-foreground">Tema com pior desempenho no recorte</p>
                </div>
              </div>
              <span className="font-mono tabular-nums text-sm font-medium text-red-600 dark:text-red-400 shrink-0">
                {piorTema.percentual}%
              </span>
            </div>
          )}
        </div>
      </GestorPanel>
    </div>
  );
};
