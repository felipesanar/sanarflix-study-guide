import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/utils/logger';

/**
 * Registra uma ação sensível em admin_audit_log via RPC admin_log_action
 * (SECURITY DEFINER; permitida para roles admin e atendimento).
 *
 * Best-effort: falha de auditoria não deve bloquear a ação principal —
 * logamos o erro e seguimos. Ações verdadeiramente críticas (anular questão,
 * liberar tentativa, features de IES) usam RPCs transacionais próprias que
 * gravam a trilha no mesmo commit.
 */
export async function logAdminAction(
  action: string,
  targetUserId?: string | null,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    // RPC ainda não presente nos tipos gerados — cast documentado (padrão do repo).
    const { error } = await (supabase.rpc as CallableFunction)('admin_log_action', {
      p_action: action,
      p_target_user_id: targetUserId ?? null,
      p_metadata: metadata ?? {},
    });
    if (error) throw error;
  } catch (err) {
    Logger.error('logAdminAction falhou (ação segue registrável só no cliente):', err);
  }
}
