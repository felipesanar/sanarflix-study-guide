import * as React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
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
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.3 }} className="h-full">
      <GestorPanel
        title="O que mudou desde o último simulado"
        subtitle={`${anterior.simulado} → ${atual.simulado}`}
        className="h-full"
      >
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <TrendingUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                <span className="text-sm text-foreground truncate">{item.label}</span>
              </div>
              <DeltaChip value={item.value} suffix={item.suffix} higherIsBetter={item.higherIsBetter} />
            </div>
          ))}

          {piorTema && (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm text-foreground truncate">{piorTema.nome}</p>
                <p className="text-[11px] text-muted-foreground">Tema com pior desempenho no recorte</p>
              </div>
              <span className="font-mono tabular-nums text-sm font-medium text-red-600 dark:text-red-400 shrink-0">
                {piorTema.percentual}%
              </span>
            </div>
          )}
        </div>
      </GestorPanel>
    </motion.div>
  );
};
