import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Logger } from '@/utils/logger';
import { computeInsights, type Insight } from '@/lib/cadernoInsights';
import type { ErrorReason } from '@/hooks/useErrorNotebook';
import type { SrsConfidence } from '@/lib/srs';

/**
 * Computa os insights estruturados do caderno a partir de error_notebook_entries
 * + review_attempts (ambos RLS own). Determinístico, sem IA.
 */
export function useCadernoInsights() {
  const { user } = useAuth();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const [entriesRes, reviewsRes] = await Promise.all([
          supabase
            .from('error_notebook_entries')
            .select('reason, grande_area, tema, mastered_at')
            .eq('user_id', user.id)
            .is('deleted_at', null),
          supabase
            .from('review_attempts')
            .select('confidence, was_correct')
            .eq('user_id', user.id),
        ]);
        if (entriesRes.error) throw entriesRes.error;
        if (reviewsRes.error) throw reviewsRes.error;

        const entries = (entriesRes.data ?? []).map((e) => ({
          reason: e.reason as ErrorReason,
          grandeArea: e.grande_area,
          tema: e.tema,
          masteredAt: (e as { mastered_at: string | null }).mastered_at ?? null,
        }));
        const reviews = (reviewsRes.data ?? []).map((r) => ({
          confidence: r.confidence as SrsConfidence,
          wasCorrect: !!r.was_correct,
        }));

        if (!cancelled) setInsights(computeInsights({ entries, reviews }));
      } catch (err) {
        Logger.error('[Caderno] insights error:', err);
        if (!cancelled) setInsights([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  return { insights, loading };
}
