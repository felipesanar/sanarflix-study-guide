import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Logger } from '@/utils/logger';
import { computeCalibration, type CalibrationInput, type CalibrationResult } from '@/lib/confidenceCalibration';

/**
 * Lê review_attempts do usuário (RLS own) e computa a calibração client-side.
 * review_attempts ainda não está nos tipos gerados → cast localizado.
 */
export function useConfidenceCalibration() {
  const { user } = useAuth();
  const [result, setResult] = useState<CalibrationResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.from('review_attempts') as any)
          .select('confidence, was_correct')
          .eq('user_id', user.id);
        if (error) throw error;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows: CalibrationInput[] = ((data ?? []) as any[]).map((r) => ({
          confidence: r.confidence,
          wasCorrect: !!r.was_correct,
        }));
        if (!cancelled) setResult(computeCalibration(rows));
      } catch (err) {
        Logger.error('[Caderno] calibration error:', err);
        if (!cancelled) setResult(computeCalibration([]));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  return { result, loading };
}
