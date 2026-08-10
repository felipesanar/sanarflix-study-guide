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
  /**
   * Nome do simulado MAIS RECENTE do recorte — o ponto "atual" da régua dos
   * KPIs. Os quatro cartões do Panorama falam dele o tempo todo ("projetado
   * no último simulado", "no simulado mais recente"), a régua o rotula como
   * ATUAL e o delta compara contra o ANTERIOR — mas em lugar nenhum a tela
   * dizia QUAL simulado é esse. Com 4 simulados no período, "o mais recente"
   * é uma incógnita que só o gráfico logo abaixo resolvia, e só para quem
   * fosse conferir o último ponto do eixo.
   *
   * Fica aqui, na linha do recorte, e não no rodapé de um dos cartões: é a
   * mesma resposta para os quatro, e repetir o nome quatro vezes só encheria
   * o Panorama. `undefined` quando o recorte não tem simulado nenhum com
   * resultado — aí não há o que nomear.
   */
  simuladoAtual?: string;
}

/**
 * Contexto textual do recorte ao lado do `FiltroSemestre`, com a
 * rastreabilidade (Período · Fonte · Atualizado em · Critério) do bloco de
 * KPIs — a mesma pergunta "de onde vem este número" vale para a tela inteira.
 */
export function ContextoDoRecorte({
  semestre,
  meta,
  emTransicao = false,
  simuladoAtual,
}: ContextoDoRecorteProps) {
  return (
    <p
      data-testid="contexto-recorte"
      className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground"
    >
      Recorte: {rotuloSemestre(semestre)}
      {emTransicao ? (
        <span data-testid="contexto-recorte-atualizando"> · atualizando…</span>
      ) : (
        <>
          {' '}
          · Período {meta.periodo}
          {/* O nome vem DEPOIS do período e antes da rastreabilidade: o "i"
              fecha a linha, como já fechava. Em negrito porque é o único
              dado próprio desta linha — recorte e período a gestora acabou
              de escolher; o simulado é a consequência deles. */}
          {simuladoAtual ? (
            <>
              {' '}
              · Simulado mais recente:{' '}
              <b data-testid="contexto-simulado-atual" className="font-semibold text-foreground">
                {simuladoAtual}
              </b>
            </>
          ) : null}
          <TooltipRastreabilidade meta={meta} />
        </>
      )}
    </p>
  );
}
