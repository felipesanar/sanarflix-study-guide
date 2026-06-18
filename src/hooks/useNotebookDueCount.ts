import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Logger } from '@/utils/logger';

/**
 * Conta as entradas do caderno devidas para revisão agora: srs_due_at <= now,
 * não deletadas, não dominadas e não bloqueadas (awaiting_lesson/leech_blocked).
 * Mantém entradas nunca revisadas (last_review_outcome = null) na contagem.
 */
export function useNotebookDueCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count: c, error } = await (supabase
        .from('error_notebook_entries')
        .select('id', { count: 'exact', head: true }) as any)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .is('mastered_at', null)
        .lte('srs_due_at', new Date().toISOString())
        .or('last_review_outcome.is.null,and(last_review_outcome.neq.awaiting_lesson,last_review_outcome.neq.leech_blocked)');
      if (error) throw error;
      setCount(c ?? 0);
    } catch (err) {
      Logger.error('[Caderno] due count error:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { refresh(); }, [refresh]);

  return { count, loading, refresh };
}
