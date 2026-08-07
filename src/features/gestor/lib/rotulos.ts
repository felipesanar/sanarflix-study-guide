/**
 * Fonte da verdade dos rótulos pt-BR do Portal do Gestor v2.
 *
 * Substitui as cópias locais de rótulos que existiam em `ChipNivel.tsx`,
 * `TabelaAlunos.tsx` e `TabelaAlunosSimulado.tsx` — mesmo princípio de
 * `regras.ts` para regra de negócio: nenhum componente reimplementa um
 * mapeamento chave/rótulo que já existe aqui.
 */

import type { AlunoNoSimulado, GrupoEvolucao, NivelDesempenho, Tendencia } from '../api/types';

/** Em-dash. Único símbolo de ausência da interface do gestor. */
export const TRACO = '—';

/** Níveis de desempenho sobre % de acerto (spec §4.4). */
export const ROTULO_NIVEL: Record<NivelDesempenho, string> = {
  excelente: 'Excelente',
  mediano: 'Mediano',
  critico: 'Crítico',
};

/** Rótulo pt-BR da tendência (spec §4.11). */
export const ROTULO_TENDENCIA: Record<Tendencia, string> = {
  subindo: 'Subindo',
  descendo: 'Descendo',
  alternando: 'Alternando',
  estavel: 'Estável',
};

/**
 * Rótulo pt-BR de `AlunoNoSimulado.situacao`.
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
