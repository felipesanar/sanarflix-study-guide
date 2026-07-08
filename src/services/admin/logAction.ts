import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
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
    // RPC tipada em src/integrations/supabase/types.ts (Args/Returns já gerados).
    const { error } = await supabase.rpc('admin_log_action', {
      p_action: action,
      p_target_user_id: targetUserId ?? null,
      // metadata é `Record<string, unknown>` no call-site; serializa como Json para a RPC.
      p_metadata: (metadata ?? {}) as Json,
    });
    if (error) throw error;
  } catch (err) {
    Logger.error('logAdminAction falhou (ação segue registrável só no cliente):', err);
  }
}
