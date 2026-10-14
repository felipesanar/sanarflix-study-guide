import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/utils/logger';

/**
 * Wrappers das RPCs de desempenho B2C (Onda 3). Mesmo cast de
 * `src/services/mentor/turma.ts`: as RPCs ainda não estão nos tipos gerados.
 * Métrica: % de acerto (0-100).
 */

export type SituacaoMeta = 'acima' | 'proximo' | 'longe' | 'sem_meta' | 'sem_simulado';

export interface NotaSimulado {
  simulado_id: string;
  sequence_number: number;
  acerto_pct: number;
  finalizada_em: string;
}

export interface AlunoDesempenho {
  email: string;
  nome: string | null;
  notas: NotaSimulado[];
  ultimo_acerto: number | null;
  corte_mais_dificil: number | null;
  vs_corte_pp: number | null;
  situacao: SituacaoMeta;
  /** null quando não dá para avaliar (menos de 2/3 simulados no escopo). */
  regrediu: boolean | null;
  estagnado: boolean | null;
  /** null quando não há simulado encerrado no escopo. */
  fez_ultimo: boolean | null;
}

export interface DesempenhoTurma {
  alunos: AlunoDesempenho[];
  possivel_aprovacao_pct: number | null;
  acerto_medio_ultimo: number | null;
  participacao_ultimo: { simulado_id: string | null; fizeram: number; total: number };
}

export interface TemaDesempenho {
  tema: string;
  acerto_pct: number;
  respostas: number;
}

export interface AreaDesempenho {
  grande_area: string;
  acerto_pct: number;
  respostas: number;
  temas: TemaDesempenho[];
}

export interface QuestaoDetalhe {
  questao_id: string;
  numero: number;
  sequence_number: number;
  grande_area: string;
  tema: string;
  correta_label: string | null;
  acerto_pct: number;
  respostas: number;
  /** {A: 12, B: 3, branco: 1} */
  distribuicao: Record<string, number>;
  /** e-mails de quem marcou cada alternativa (só da turma). */
  emails: Record<string, string[]>;
}

export interface Detalhamento {
  areas: AreaDesempenho[];
  questoes: QuestaoDetalhe[];
}

export interface AlunoNotas {
  email: string;
  notas: (NotaSimulado & { titulo: string })[];
  areas: AreaDesempenho[];
}

async function callRpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase.rpc as CallableFunction)(fn, args);
  if (error) {
    Logger.error(`[services/mentor/desempenho] ${fn} falhou:`, error);
    throw new Error(error.message ?? `Falha ao executar ${fn}.`);
  }
  return data as T;
}

/** `simulados` omitido = todos os simulados espelhados. */
export async function fetchDesempenhoTurma(simulados?: string[]): Promise<DesempenhoTurma> {
  return callRpc<DesempenhoTurma>('mentor_desempenho_turma', { p_simulados: simulados ?? null });
}

export async function fetchDetalhamento(simulados: string[]): Promise<Detalhamento> {
  return callRpc<Detalhamento>('mentor_detalhamento', { p_simulados: simulados });
}

export async function fetchAlunoNotas(email: string): Promise<AlunoNotas> {
  return callRpc<AlunoNotas>('mentor_aluno_notas', { p_email: email });
}
