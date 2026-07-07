import { useQuery, type UseQueryResult } from '@tanstack/react-query';
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

/**
 * Uma linha da trilha de auditoria (`admin_audit_log`), no formato devolvido
 * por `admin_get_audit_log` (contrato §Backend·2).
 */
export interface AuditLogRow {
  id: string;
  created_at: string;
  action: string;
  admin_id: string | null;
  admin_nome: string | null;
  admin_email: string | null;
  target_user_id: string | null;
  target_nome: string | null;
  target_email: string | null;
  metadata: Record<string, unknown> | null;
}

/**
 * Payload da RPC `admin_get_audit_log` (contrato §Backend·2). A RPC ainda NÃO
 * está nos tipos gerados do Supabase — mesmo padrão de cast documentado usado
 * em {@link ../logAction.logAdminAction} e `useAdminAttention.ts`.
 */
export interface AuditLogPayload {
  total: number;
  rows: AuditLogRow[];
}

export interface AuditLogFilters {
  /** Casa ator/alvo/ação (ilike no banco). */
  search?: string;
  /** Action crua (ver `AUDIT_ACTION_OPTIONS`); vazio/undefined = todas. */
  action?: string;
  /** Início do período (ISO); undefined = sem piso (tudo). */
  from?: string | null;
  limit?: number;
  offset?: number;
}

type AuditRpcResult = { data: unknown; error: { message: string } | null };

async function fetchAuditLog(filters: AuditLogFilters): Promise<AuditLogPayload> {
  return withRetry(async () => {
    const rpcPromise = Promise.resolve(
      (
        supabase.rpc as (fn: string, params: Record<string, unknown>) => PromiseLike<AuditRpcResult>
      )('admin_get_audit_log', {
        p_search: filters.search?.trim() || null,
        p_action: filters.action || null,
        p_from: filters.from ?? null,
        p_to: null,
        p_limit: filters.limit ?? 50,
        p_offset: filters.offset ?? 0,
      }),
    );
    const result = await withTimeout(rpcPromise, RPC_TIMEOUT, 'admin_get_audit_log');
    if (result.error) throw new Error(`admin_get_audit_log: ${result.error.message}`);
    const payload = result.data as unknown as AuditLogPayload | null;
    return payload ?? { total: 0, rows: [] };
  });
}

/**
 * Trilha de auditoria paginada (`/admin/auditoria`) — React Query sobre
 * `admin_get_audit_log`. `enabled` deve ser `false` quando o usuário não tem
 * `admin.tools` (a página degrada para `AdminEmpty` antes de chamar o hook,
 * mas o `enabled` evita a chamada mesmo se a página remontar).
 */
export function useAuditLog(
  filters: AuditLogFilters,
  options: { enabled?: boolean } = {},
): UseQueryResult<AuditLogPayload, Error> {
  const { enabled = true } = options;

  return useQuery({
    queryKey: ['admin', 'audit-log', filters],
    queryFn: () => fetchAuditLog(filters),
    enabled,
    staleTime: 15_000,
    retry: false, // fetchAuditLog já faz retry com backoff.
    placeholderData: (previous) => previous,
  });
}
