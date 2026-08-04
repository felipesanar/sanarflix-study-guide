/**
 * Formatadores do Portal do Gestor v2. Locale pt-BR.
 *
 * Regra que atravessa todos: valor `null` devolve `TRACO`. Nunca preencher
 * lacuna com zero, média do grupo ou estimativa (spec §4.10).
 */

import type { AlunoNoSimulado, GrupoEvolucao } from '../api/types';

/** Em-dash. Único símbolo de ausência da interface do gestor. */
export const TRACO = '—';

const LOCALE = 'pt-BR';

/**
 * Percentual 0–100 com `%` colado. Sem decimais por padrão.
 * `0` formata como `'0%'` — zero é dado, ausência é `TRACO`.
 */
export function formatPct(valor: number | null, decimals = 0): string {
  if (valor === null) return TRACO;
  const numero = valor.toLocaleString(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${numero}%`;
}

/** Inteiro ou decimal com separadores pt-BR (`1.234,5`). */
export function formatNumero(valor: number | null): string {
  if (valor === null) return TRACO;
  return valor.toLocaleString(LOCALE, { maximumFractionDigits: 1 });
}

/**
 * Conceito ENAMED projetado, escala 1–5 inteira (spec §4.1).
 * Formato `N/5` para a escala ficar explícita no card.
 */
export function formatConceito(valor: number | null): string {
  if (valor === null) return TRACO;
  return `${Math.round(valor)}/5`;
}

/**
 * `dd/MM/yyyy` a partir do que o servidor mandou.
 *
 * Lê os dígitos da porção de data do ISO em vez de instanciar `Date`: um
 * `new Date('2026-07-24')` é meia-noite UTC e, em UTC-3, renderizaria
 * `23/07/2026` — data errada no cronograma. A data exibida é a data-calendário
 * que a RPC devolveu, sem reinterpretação de fuso no cliente.
 */
export function formatData(iso: string | null): string {
  if (iso === null) return TRACO;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return TRACO;
  const [, ano, mes, dia] = match;
  return `${dia}/${mes}/${ano}`;
}

/**
 * Variação com sinal explícito, para a régua `1º · anterior · atual` (spec §4.8).
 * `0` sai sem sinal; positivo ganha `+`; negativo já vem com `-` do locale.
 */
export function formatDelta(valor: number | null): string {
  if (valor === null) return TRACO;
  const numero = formatNumero(valor);
  if (valor > 0) return `+${numero}`;
  return numero;
}

/**
 * Rótulo pt-BR de `AlunoNoSimulado.situacao` — nenhum componente reimplementa
 * este mapeamento (mesmo princípio de `regras.ts`, §4.4).
 *
 * `aguardando_resultado` (03/08) é deliberadamente diferente de
 * `abaixo_do_limiar`: o aluno participou e ainda não tem nota TRI, e dizer
 * "abaixo do limiar" afirmaria uma nota baixa que não existe. Quando
 * `situacao` é `aguardando_resultado`, `proficiencia` é sempre `null` — a UI
 * mostra `TRACO` ali via `formatNumero`/`formatPct`, não um rótulo próprio.
 */
export function rotuloSituacao(situacao: AlunoNoSimulado['situacao']): string {
  switch (situacao) {
    case 'proficiente':
      return 'Proficiente';
    case 'abaixo_do_limiar':
      return 'Abaixo do limiar';
    case 'aguardando_resultado':
      return 'Aguardando resultado';
    case 'nao_participou':
      return 'Não participou';
    default: {
      const exaustivo: never = situacao;
      return exaustivo;
    }
  }
}

/**
 * Rótulo pt-BR de `LinhaAluno.grupo` (achado 4 da revisão de 03/08).
 *
 * `grupo` é anulável: `null` é o aluno que ainda não tem NENHUM resultado de
 * TRI na janela (a nota chega depois, por pipeline Python — mesma família de
 * decisão que originou `aguardando_resultado` em `rotuloSituacao`). Isso não é
 * "em variação" — em_variacao pressupõe pelo menos um resultado. A UI mostra
 * `TRACO`, nunca a tag de um grupo, seguindo o precedente do handoff
 * ("cada aluno traz a tag do grupo; ausência = '—'", docs/handoff/gestor).
 */
export function rotuloGrupo(grupo: GrupoEvolucao | null): string {
  if (grupo === null) return TRACO;
  switch (grupo) {
    case 'consistentemente_proficiente':
      return 'Consistentemente proficiente';
    case 'em_variacao':
      return 'Em variação';
    case 'consistentemente_nao_proficiente':
      return 'Consistentemente não proficiente';
    default: {
      const exaustivo: never = grupo;
      return exaustivo;
    }
  }
}
