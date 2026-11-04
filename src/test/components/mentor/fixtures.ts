import type { AlunoTurma, Segmento } from '@/services/mentor/turma';

/** Aluno com fonte de consumo: contagens de 7d/30d (30d = 7d + 10 por padrão). */
export function comConsumo(email: string, nome: string, videos7: number, docs7: number, over: Partial<AlunoTurma> = {}): AlunoTurma {
  return aluno({
    email,
    nome,
    segmento: 'ativo',
    dias_sem_atividade: 1,
    tem_dado_consumo: true,
    conteudos_7d: { videos: videos7, documentos: docs7, total: videos7 + docs7 },
    conteudos_30d: { videos: videos7 + 6, documentos: docs7 + 4, total: videos7 + docs7 + 10 },
    ...over,
  });
}

/** Aluno sem fonte (B2C hoje): o backend devolve o objeto com campos nulos. */
export function semConsumo(email: string, nome: string, over: Partial<AlunoTurma> = {}): AlunoTurma {
  const nulo = { videos: null, documentos: null, total: null };
  return aluno({
    email,
    nome,
    segmento: 'ativo',
    dias_sem_atividade: 2,
    tem_dado_consumo: false,
    conteudos_7d: nulo,
    conteudos_30d: nulo,
    ...over,
  });
}

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

import type { AlunoDesempenho, DesempenhoTurma, SimuladoB2C } from '@/services/mentor/desempenho';

export const SIM1 = 'sim-1';
export const SIM2 = 'sim-2';
export const SIM3 = 'sim-3';

/** Simulado B2C da lista devolvida pela RPC (por padrão encerrado). */
export function simuladoB2C(id: string, sequence_number: number, over: Partial<SimuladoB2C> = {}): SimuladoB2C {
  return {
    id,
    sequence_number,
    titulo: `Simulado ${sequence_number} — título`,
    janela_fim: '2026-10-01T00:00:00Z',
    encerrado: true,
    ...over,
  };
}

/** Lista padrão da RPC: os 3 simulados publicados, todos encerrados. */
export const SIMULADOS_PADRAO: SimuladoB2C[] = [simuladoB2C(SIM1, 1), simuladoB2C(SIM2, 2), simuladoB2C(SIM3, 3)];

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
    simulados: SIMULADOS_PADRAO,
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
