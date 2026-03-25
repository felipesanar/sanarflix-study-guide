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
    const { data, error } = await withTimeout(
      supabase.rpc('get_institutional_performance', {
        p_simulado_id: simuladoId,
        p_ies_id: iesId,
      }),
      RPC_TIMEOUT,
      'get_institutional_performance',
    );
    if (error) throw new Error(`Performance: ${error.message}`);
    return data as unknown as RpcPerformanceResponse;
  });
}

export async function fetchStudentScores(
  simuladoId: string,
  iesId: string,
): Promise<RpcStudentScoresResponse> {
  return withRetry(async () => {
    const { data, error } = await withTimeout(
      supabase.rpc('get_institutional_student_scores', {
        p_simulado_id: simuladoId,
        p_ies_id: iesId,
      }),
      RPC_TIMEOUT,
      'get_institutional_student_scores',
    );
    if (error) throw new Error(`Scores: ${error.message}`);
    return data as unknown as RpcStudentScoresResponse;
  });
}

export async function fetchInstitutionalEvolution(
  iesId: string,
): Promise<RpcEvolutionEntry[]> {
  return withRetry(async () => {
    const { data, error } = await withTimeout(
      supabase.rpc('get_institutional_evolution', { p_ies_id: iesId }),
      RPC_TIMEOUT,
      'get_institutional_evolution',
    );
    if (error) throw new Error(`Evolution: ${error.message}`);
    return (data ?? []) as unknown as RpcEvolutionEntry[];
  });
}

export async function resolveIesId(explicitIesId?: string): Promise<string> {
  if (explicitIesId) return explicitIesId;
  const { data, error } = await supabase.rpc('get_user_ies_id');
  if (error) throw new Error(`IES do usuário não encontrada: ${error.message}`);
  if (!data) throw new Error('IES do usuário não encontrada');
  return data as string;
}
