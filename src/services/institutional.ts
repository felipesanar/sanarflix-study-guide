import { supabase } from '@/integrations/supabase/client';
import { withRetry } from '@/utils/networkRetry';
import type {
  RpcPerformanceResponse,
  RpcEvolutionEntry,
  RpcStudentScoresResponse,
} from '@/types/desempenhoV2';

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
): Promise<InstitutionalTriSnapshot | null> {
  try {
    const result = await withTimeout(
      Promise.resolve(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.rpc as any)('get_institutional_tri', {
          p_simulado_id: simuladoId,
          p_ies_id: iesId,
        }),
      ),
      RPC_TIMEOUT,
      'get_institutional_tri',
    );
    if (result.error) {
      console.warn('[TRI] get_institutional_tri failed:', result.error.message);
      return null;
    }
    const rows = (result.data ?? []) as InstitutionalTriSnapshot[];
    return rows.length > 0 ? rows[0] : null;
  } catch (err) {
    console.warn('[TRI] get_institutional_tri error:', err);
    return null;
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
      console.warn('[TRI] get_institutional_evolution_tri failed:', result.error.message);
      return [];
    }
    return (result.data ?? []) as InstitutionalTriEvolutionEntry[];
  } catch (err) {
    console.warn('[TRI] get_institutional_evolution_tri error:', err);
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
