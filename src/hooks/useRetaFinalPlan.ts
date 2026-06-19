import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Logger } from '@/utils/logger';
import { buildRetaFinalPlan, type PlanEntryInput, type DayPlan, type PlanItem } from '@/lib/retaFinalPlan';

export function useRetaFinalPlan(daysUntilExam: number, dailyCapacity = 15) {
  const { user } = useAuth();
  const [ranked, setRanked] = useState<PlanItem[]>([]);
  const [days, setDays] = useState<DayPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('error_notebook_entries')
          .select('id, grande_area, tema, srs_due_at, srs_lapses, srs_reps')
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .is('mastered_at', null);
        if (error) throw error;

        const entries: PlanEntryInput[] = (data ?? []).map((e) => {
          const row = e as typeof e & { srs_due_at: string | null; srs_lapses: number; srs_reps: number };
          return {
            id: row.id,
            grandeArea: row.grande_area,
            tema: row.tema,
            srsDueAt: row.srs_due_at ?? null,
            srsLapses: row.srs_lapses ?? 0,
            srsReps: row.srs_reps ?? 0,
          };
        });

        const plan = buildRetaFinalPlan(entries, {
          now: new Date().toISOString(),
          daysUntilExam,
          dailyCapacity,
        });
        if (!cancelled) { setRanked(plan.ranked); setDays(plan.days); }
      } catch (err) {
        Logger.error('[RetaFinal] load error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, daysUntilExam, dailyCapacity]);

  return { ranked, days, loading };
}
