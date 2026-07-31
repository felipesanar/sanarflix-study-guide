import { supabase } from '@/integrations/supabase/client';
import { withRetry } from '@/utils/networkRetry';
import type {
  RpcPerformanceResponse,
  RpcEvolutionEntry,
  RpcStudentScoresResponse,
} from '@/types/desempenhoV2';
import { Logger } from '@/utils/logger';

const RPC_TIMEOUT = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}: timeout após ${ms / 1000}s`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

export async function fetchInstitutionalPerformance(
  simuladoId: string,
  iesId: string,
): Promise<RpcPerformanceResponse> {
  return withRetry(async () => {
    const rpcPromise = Promise.resolve(
      supabase.rpc('get_institutional_performance', {
        p_simulado_id: simuladoId,
        p_ies_id: iesId,
      }),
    );
    const result = await withTimeout(rpcPromise, RPC_TIMEOUT, 'get_institutional_performance');
    if (result.error) throw new Error(`Performance: ${result.error.message}`);
    return result.data as unknown as RpcPerformanceResponse;
  });
}

export async function fetchStudentScores(
  simuladoId: string,
  iesId: string,
): Promise<RpcStudentScoresResponse> {
  return withRetry(async () => {
    const rpcPromise = Promise.resolve(
      supabase.rpc('get_institutional_student_scores', {
        p_simulado_id: simuladoId,
        p_ies_id: iesId,
      }),
    );
    const result = await withTimeout(rpcPromise, RPC_TIMEOUT, 'get_institutional_student_scores');
    if (result.error) throw new Error(`Scores: ${result.error.message}`);
    return result.data as unknown as RpcStudentScoresResponse;
  });
}

/**
 * Contato nominal de UM aluno (telefone), sob demanda ao abrir o drawer.
 *
 * RPC dedicada (`get_gestor_aluno_contato`, migration
 * 20260731143924_b020effc-…) em vez de somar `telefone` a
 * get_institutional_student_scores por dois motivos:
 *   1. aquela RPC devolve a turma inteira -> despejaria o telefone de todos os
 *      alunos da IES em cada carregamento da tela;
 *   2. o corpo real dela em produção tem o guard de feature injetado pelo patch
 *      de 20260709171344 — recriá-la a partir do .sql apagaria o guard.
 *
 * Erro `aluno_nao_encontrado` é a MESMA mensagem para ID inexistente e para
 * aluno de outra IES (mensagens distintas permitiriam enumerar UUIDs).
 * A RPC é STABLE, logo não grava trilha de auditoria de acesso a dado nominal.
 */
export async function fetchAlunoContato(
  alunoId: string,
): Promise<{ telefone: string | null }> {
  const rpcPromise = Promise.resolve(
    supabase.rpc('get_gestor_aluno_contato', { p_aluno_id: alunoId }),
  );
  const result = await withTimeout(rpcPromise, RPC_TIMEOUT, 'get_gestor_aluno_contato');
  if (result.error) throw new Error(`Contato: ${result.error.message}`);
  const data = (result.data ?? {}) as { telefone?: string | null };
  return { telefone: data.telefone ?? null };
}

export async function fetchInstitutionalEvolution(
  iesId: string,
): Promise<RpcEvolutionEntry[]> {
  return withRetry(async () => {
    const rpcPromise = Promise.resolve(
      supabase.rpc('get_institutional_evolution', { p_ies_id: iesId }),
    );
    const result = await withTimeout(rpcPromise, RPC_TIMEOUT, 'get_institutional_evolution');
    if (result.error) throw new Error(`Evolution: ${result.error.message}`);
    return (result.data ?? []) as unknown as RpcEvolutionEntry[];
  });
}

// ── TRI (Item Response Theory) data ──

export interface InstitutionalTriSnapshot {
  college_id: string;
  simulado_id: string;
  num_students: number | null;
  num_proficient: number | null;
  pcp: number | null;
  mean_score: number | null;
  median_score: number | null;
  std_score: number | null;
  min_score: number | null;
  max_score: number | null;
  concept: number | null;
  sanctions: string | null;
  is_restricted: boolean | null;
  num_below_expected: number | null;
  /** % de proficientes considerando apenas alunos do 6º ano (semestres 11 e 12). */
  pcp_sixth_year: number | null;
  /** Quantidade de alunos do 6º ano que entraram no cálculo de `pcp_sixth_year`. */
  num_students_sixth_year: number | null;
}

export interface InstitutionalTriEvolutionEntry {
  simulado_id: string;
  simulado_nome: string;
  data_liberacao: string | null;
  num_students: number | null;
  mean_score: number | null;
  pcp: number | null;
  concept: number | null;
}

export async function fetchInstitutionalTri(
  simuladoId: string,
  iesId: string,
  semestres: number[] | null = null,
): Promise<InstitutionalTriSnapshot | null> {
  try {
    const params: Record<string, unknown> = {
      p_simulado_id: simuladoId,
      p_ies_id: iesId,
      p_semestres: semestres ?? null,
    };
    const result = await withTimeout(
      Promise.resolve(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.rpc as any)('get_institutional_tri', params),
      ),
      RPC_TIMEOUT,
      'get_institutional_tri',
    );
    if (result.error) {
      Logger.warn('[TRI] get_institutional_tri failed:', result.error.message);
      return null;
    }
    const rows = (result.data ?? []) as InstitutionalTriSnapshot[];
    return rows.length > 0 ? rows[0] : null;
  } catch (err) {
    Logger.warn('[TRI] get_institutional_tri error:', err);
    return null;
  }
}

export async function fetchSimuladoTemTri(
  simuladoId: string,
  iesId: string,
): Promise<boolean> {
  try {
    const result = await withTimeout(
      Promise.resolve(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.rpc as any)('get_simulado_tem_tri', {
          p_simulado_id: simuladoId,
          p_ies_id: iesId,
        }),
      ),
      RPC_TIMEOUT,
      'get_simulado_tem_tri',
    );
    if (result.error) {
      Logger.warn('[TRI] get_simulado_tem_tri failed:', result.error.message);
      return false;
    }
    return Boolean(result.data);
  } catch (err) {
    Logger.warn('[TRI] get_simulado_tem_tri error:', err);
    return false;
  }
}

export async function fetchInstitutionalTriEvolution(
  iesId: string,
): Promise<InstitutionalTriEvolutionEntry[]> {
  try {
    const result = await withTimeout(
      Promise.resolve(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.rpc as any)('get_institutional_evolution_tri', { p_ies_id: iesId }),
      ),
      RPC_TIMEOUT,
      'get_institutional_evolution_tri',
    );
    if (result.error) {
      Logger.warn('[TRI] get_institutional_evolution_tri failed:', result.error.message);
      return [];
    }
    return (result.data ?? []) as InstitutionalTriEvolutionEntry[];
  } catch (err) {
    Logger.warn('[TRI] get_institutional_evolution_tri error:', err);
    return [];
  }
}

// ── Per-student TRI scores for a given simulado ──

export interface StudentTriScore {
  student_id: string;
  score_proprio: number | null;
}

export async function fetchStudentTriScores(
  simuladoId: string,
  iesId: string,
): Promise<StudentTriScore[]> {
  try {
    const { data, error } = await supabase
      .from('resultados_alunos_tri')
      .select('student_id, score_proprio')
      .eq('simulado_id', simuladoId)
      .eq('college_id', iesId);
    if (error) {
      Logger.warn('[TRI] fetchStudentTriScores failed:', error.message);
      return [];
    }
    return (data ?? []) as StudentTriScore[];
  } catch (err) {
    Logger.warn('[TRI] fetchStudentTriScores error:', err);
    return [];
  }
}



export interface StudentGrowthEntry {
  student_id: string;
  num_simulados: number;
  first_theta: number | null;
  last_theta: number | null;
  delta_theta: number | null;
  first_score_enamed: number | null;
  last_score_enamed: number | null;
  delta_score_enamed: number | null;
}

export async function fetchStudentGrowthTri(
  iesId: string,
): Promise<StudentGrowthEntry[]> {
  try {
    const result = await withTimeout(
      Promise.resolve(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.rpc as any)('get_student_growth_tri', { p_ies_id: iesId }),
      ),
      RPC_TIMEOUT,
      'get_student_growth_tri',
    );
    if (result.error) {
      Logger.warn('[TRI] get_student_growth_tri failed:', result.error.message);
      return [];
    }
    return (result.data ?? []) as StudentGrowthEntry[];
  } catch (err) {
    Logger.warn('[TRI] get_student_growth_tri error:', err);
    return [];
  }
}

export async function resolveIesId(explicitIesId?: string): Promise<string> {
  if (explicitIesId) return explicitIesId;
  const { data, error } = await supabase.rpc('get_user_ies_id');
  if (error) throw new Error(`IES do usuário não encontrada: ${error.message}`);
  if (!data) throw new Error('IES do usuário não encontrada');
  return data as string;
}

/**
 * Total de alunos matriculados na IES, opcionalmente filtrado por semestres.
 * `null` = todos os semestres (geral). Array = lista explícita (ex.: [11,12]).
 */
export async function fetchIesStudentCount(
  iesId: string,
  semestres: number[] | null = null,
): Promise<number> {
  try {
    const params: Record<string, unknown> = { p_ies_id: iesId };
    if (semestres && semestres.length > 0) params.p_semestres = semestres;
    const { data, error } = await supabase.rpc('get_ies_student_count', params as { p_ies_id: string; p_semestres?: number[] });
    if (error) {
      Logger.warn('[IES] get_ies_student_count failed:', error.message);
      return 0;
    }
    return (data as number | null) ?? 0;
  } catch (err) {
    Logger.warn('[IES] get_ies_student_count error:', err);
    return 0;
  }
}

