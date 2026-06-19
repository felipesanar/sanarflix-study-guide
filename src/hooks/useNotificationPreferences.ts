import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Logger } from '@/utils/logger';

/**
 * Preferências de notificação do caderno. Tolerante: se a migração
 * 20260619140000 (tabela notification_preferences + upsert RPC) ainda não foi
 * aplicada, `available` fica false e a UI se esconde. Cast `as any` até os tipos
 * serem regenerados.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prefsTable = () => (supabase as any).from('notification_preferences');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const looseRpc = (supabase.rpc as any).bind(supabase) as (name: string, params?: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;

export function useNotificationPreferences() {
  const { user } = useAuth();
  const [cadernoDailyReview, setValue] = useState(true);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await prefsTable()
          .select('caderno_daily_review')
          .eq('user_id', user.id)
          .maybeSingle();
        if (error) throw error;
        if (cancelled) return;
        setAvailable(true);
        if (data) setValue(data.caderno_daily_review !== false);
      } catch (err) {
        // tabela ausente (migração não aplicada) ou outro erro → esconde a UI
        if (!cancelled) setAvailable(false);
        Logger.info('[Caderno] notification_preferences indisponível (migração pendente?)');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const setCadernoDailyReview = useCallback(async (next: boolean) => {
    const prev = cadernoDailyReview;
    setValue(next); // otimista
    const { error } = await looseRpc('upsert_notification_preferences', { p_caderno_daily_review: next });
    if (error) { Logger.error('[Caderno] upsert pref error:', error); setValue(prev); }
  }, [cadernoDailyReview]);

  return { cadernoDailyReview, setCadernoDailyReview, loading, available };
}
