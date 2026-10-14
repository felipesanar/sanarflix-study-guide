import type { AlunoTurma, Segmento } from '@/services/mentor/turma';

export function aluno(over: Partial<AlunoTurma> & { email: string }): AlunoTurma {
  return {
    nome: null,
    telefone: null,
    semestre: 5,
    acesso_ate: '2027-06-30',
    b2b: false,
    academy_user_id: null,
    sanarflix_user_id: null,
    ultima_atividade: null,
    dias_sem_atividade: null,
    segmento: 'sem_dado',
    ...over,
  };
}

export function comSegmento(email: string, nome: string, segmento: Segmento, dias: number | null): AlunoTurma {
  return aluno({ email, nome, segmento, dias_sem_atividade: dias });
}

import type { AlunoDesempenho, DesempenhoTurma } from '@/services/mentor/desempenho';

export const SIM1 = 'sim-1';
export const SIM2 = 'sim-2';

export function desempAluno(over: Partial<AlunoDesempenho> & { email: string }): AlunoDesempenho {
  return {
    nome: null,
    notas: [],
    ultimo_acerto: null,
    corte_mais_dificil: null,
    vs_corte_pp: null,
    situacao: 'sem_simulado',
    regrediu: false,
    estagnado: false,
    fez_ultimo: null,
    ...over,
  };
}

export function nota(simulado_id: string, sequence_number: number, acerto_pct: number) {
  return { simulado_id, sequence_number, acerto_pct, finalizada_em: '2026-10-01T12:00:00Z' };
}

export function desempenho(alunos: AlunoDesempenho[], over: Partial<DesempenhoTurma> = {}): DesempenhoTurma {
  return {
    alunos,
    possivel_aprovacao_pct: null,
    acerto_medio_ultimo: null,
    participacao_ultimo: { simulado_id: null, fizeram: 0, total: alunos.length },
    ...over,
  };
}

export const SEM_DESEMPENHO: DesempenhoTurma = desempenho([]);

/** Aluno com 1 simulado só: a RPC devolve regrediu/estagnado = null (não avaliável). */
export function desempAlunoNulos(over: Partial<AlunoDesempenho> & { email: string }): AlunoDesempenho {
  return desempAluno({ regrediu: null, estagnado: null, ...over });
}

export const SIM3 = 'sim-3';
