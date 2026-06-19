import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Logger } from '@/utils/logger';
import { computeCalibration, type CalibrationInput, type CalibrationResult } from '@/lib/confidenceCalibration';

/** Lê review_attempts do usuário (RLS own) e computa a calibração client-side. */
export function useConfidenceCalibration() {
  const { user } = useAuth();
  const [result, setResult] = useState<CalibrationResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('review_attempts')
          .select('confidence, was_correct')
          .eq('user_id', user.id);
        if (error) throw error;
        const rows: CalibrationInput[] = (data ?? []).map((r) => ({
          confidence: r.confidence as CalibrationInput['confidence'],
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
