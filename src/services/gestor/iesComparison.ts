import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { withRetry } from '@/utils/networkRetry';
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

/** Uma linha do comparativo de IES do grupo (`get_group_ies_comparison`). */
export interface IesComparisonEntry {
  ies_id: string;
  ies_nome: string;
  concept: number | null;
  pcp: number | null;
  mean_score: number | null;
  num_students: number | null;
  respondentes: number | null;
  adesao_pct: number | null;
  delta_pcp: number | null;
}

/**
 * Comparativo entre as IES acessíveis pelo usuário (gestor de grupo).
 * Retorna array vazio (nunca lança) quando a RPC falha — a tela degrada para
 * `GestorEmpty`/`GestorError` conforme o caller decidir.
 */
export async function fetchGroupIesComparison(
  simuladoId?: string | null,
): Promise<IesComparisonEntry[]> {
  return withRetry(async () => {
    const rpcPromise = Promise.resolve(
      supabase.rpc('get_group_ies_comparison', {
        p_simulado_id: simuladoId ?? undefined,
      }),
    );
    const result = await withTimeout(rpcPromise, RPC_TIMEOUT, 'get_group_ies_comparison');
    if (result.error) throw new Error(`ComparativoIES: ${result.error.message}`);
    return (result.data ?? []) as unknown as IesComparisonEntry[];
  });
}

/** Hook React Query para o comparativo de IES do grupo. */
export function useGroupIesComparison(simuladoId?: string | null) {
  return useQuery({
    queryKey: ['gestor', 'group-ies-comparison', simuladoId ?? null],
    queryFn: () => fetchGroupIesComparison(simuladoId),
    staleTime: 5 * 60 * 1000,
    retry: false,
    meta: { onError: (err: unknown) => Logger.warn('[IesComparison] falhou:', err) },
  });
}
