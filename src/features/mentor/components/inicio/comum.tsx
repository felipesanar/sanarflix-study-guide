import { useMemo } from 'react';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import type { ItemPrioridade } from '../../api/types';

/** Carregando: skeletons na anatomia (indicadores 104px; colunas 260px), com a faixa visível acima. */
export function SkeletonInicio() {
  return (
    <>
      <GestorSkeleton altura={104} rotulo="Carregando a visão geral" />
      <div className="flex flex-wrap gap-4">
        <div className="min-w-0 flex-[2_1_520px]"><GestorSkeleton altura={260} rotulo="Carregando as prioridades" /></div>
        <div className="min-w-0 flex-[1_1_300px]"><GestorSkeleton altura={260} rotulo="Carregando sessões e pendências" /></div>
      </div>
    </>
  );
}

/** Momento em que os dados da lista chegaram (para "hoje, 14h"): muda só quando os dados mudam. */
export function useHorarioDados(...dados: unknown[]): Date {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => new Date(), dados);
}

/** "4 alertas · hoje, 14h" (conta só os grupos com alunos, que são os que aparecem). */
export function resumoLista(itens: ItemPrioridade[], singular: string, plural: string, em?: Date): string {
  const n = itens.filter((i) => i.alunoIds.length > 0).length;
  const base = `${n} ${n === 1 ? singular : plural}`;
  return em ? `${base} · hoje, ${em.getHours()}h` : base;
}
