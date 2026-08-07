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
  excelente: 'Excelente desempenho',
  mediano: 'Desempenho mediano',
  critico: 'Desempenho crítico',
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
 * Forma PLURAL e minúscula do grupo de evolução, para o texto corrido dos
 * cartões da Visão de Alunos ("48 alunos consistentemente proficientes",
 * "consistentemente proficientes 46%"). A referência de design escreve o
 * grupo assim — em minúscula, dentro de uma frase — e não como tag.
 *
 * Deliberadamente derivado do MESMO vocabulário de `rotuloGrupo`, não do
 * texto da referência: ela usa "em alternância" e "abaixo do limiar" para o
 * 2º e o 3º grupo, mas "abaixo do limiar" já é o rótulo de OUTRA coisa no
 * portal (`rotuloSituacao` — situação do aluno em UM simulado, que inclui
 * "aguardando resultado"). Repetir o termo com outro significado na mesma
 * tela é o tipo de ambiguidade que `rotulos.ts` existe para evitar.
 */
export const ROTULO_GRUPO_PLURAL: Record<GrupoEvolucao, string> = {
  consistentemente_proficiente: 'consistentemente proficientes',
  em_variacao: 'em variação',
  consistentemente_nao_proficiente: 'consistentemente não proficientes',
};

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
