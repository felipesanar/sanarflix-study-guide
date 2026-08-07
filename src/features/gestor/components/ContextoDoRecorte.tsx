import * as React from 'react';
import { TooltipRastreabilidade } from '@/features/gestor/components/TooltipRastreabilidade';
import type { FiltroSemestre, Meta } from '@/features/gestor/api/types';

/** Rótulo pt-BR do recorte de semestre em foco (spec §4.5). */
export function rotuloSemestre(semestre: FiltroSemestre): string {
  if (semestre === '6ano') return '6º ano (11º e 12º em evidência)';
  if (semestre === 'geral') return 'Todos os semestres';
  return `${semestre}º semestre`;
}

export interface ContextoDoRecorteProps {
  semestre: FiltroSemestre;
  meta: Meta;
  /**
   * `true` quando a `meta` recebida é a do recorte ANTERIOR, servida pelo
   * `placeholderData` enquanto o recorte novo está em voo
   * (`ResultadoGestor.isPlaceholderData`). O `semestre` vem da URL e já é o
   * NOVO — então emparelhar os dois aqui afirmaria "6º ano · Período 2026.1"
   * quando 2026.1 é o período do recorte que a gestora acabou de abandonar
   * (cenário 1 da revisão de 05/08). Neste estado o componente não mostra
   * período nenhum e não oferece rastreabilidade: não existe `meta` deste
   * recorte ainda, e um número velho aqui é pior que nenhum.
   */
  emTransicao?: boolean;
}

/**
 * Contexto textual do recorte ao lado do `FiltroSemestre`, com a
 * rastreabilidade (Período · Fonte · Atualizado em · Critério) do bloco de
 * KPIs — a mesma pergunta "de onde vem este número" vale para a tela inteira.
 */
export function ContextoDoRecorte({ semestre, meta, emTransicao = false }: ContextoDoRecorteProps) {
  return (
    <p data-testid="contexto-recorte" className="flex items-center gap-1.5 text-xs text-muted-foreground">
      Recorte: {rotuloSemestre(semestre)}
      {emTransicao ? (
        <span data-testid="contexto-recorte-atualizando"> · atualizando…</span>
      ) : (
        <>
          {' '}
          · Período {meta.periodo}
          <TooltipRastreabilidade meta={meta} />
        </>
      )}
    </p>
  );
}
