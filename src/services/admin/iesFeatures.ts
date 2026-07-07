import { supabase } from '@/integrations/supabase/client';
import { withRetry } from '@/utils/networkRetry';

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

/** Retorno da RPC `admin_set_ies_features` (contrato de implementação do Admin, §Backend·6). */
export interface AdminSetIesFeaturesResult {
  applied: number;
}

/**
 * Aplica um diff de features de uma IES via RPC `admin_set_ies_features`
 * (SECURITY DEFINER, upsert transacional + auditoria `ies_features_update`).
 * Substitui o antigo loop client-side de upserts em `ies_features`.
 *
 * A RPC ainda não está nos tipos gerados do Supabase — cast local documentado
 * (mesmo padrão de `src/services/admin/logAction.ts` e `useAdminAttention.ts`).
 */
export async function setIesFeatures(
  iesId: string,
  changes: Record<string, boolean>,
): Promise<AdminSetIesFeaturesResult> {
  if (Object.keys(changes).length === 0) return { applied: 0 };

  return withRetry(async () => {
    const rpcPromise = Promise.resolve(
      (supabase.rpc as (
        fn: string,
        args: Record<string, unknown>,
      ) => PromiseLike<{ data: unknown; error: { message: string } | null }>)('admin_set_ies_features', {
        p_ies_id: iesId,
        p_changes: changes,
      }),
    );
    const result = await withTimeout(rpcPromise, RPC_TIMEOUT, 'admin_set_ies_features');
    if (result.error) throw new Error(`admin_set_ies_features: ${result.error.message}`);
    return result.data as unknown as AdminSetIesFeaturesResult;
  });
}
