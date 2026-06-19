import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalyticsTracker } from '@/hooks/useAnalyticsTracker';
import { Logger } from '@/utils/logger';
import type { ErrorReason } from '@/hooks/useErrorNotebook';
import type { SrsConfidence, SrsOutcome } from '@/lib/srs';
import { recordReviewAttempt, scheduleNextReview, resetLeech } from '@/lib/cadernoSrsApi';

export type RecallMode = 'due' | 'all';
export type RecallPhase = 'answering' | 'confidence' | 'revealed' | 'done';

const BLOCKED_OUTCOMES = ['awaiting_lesson', 'leech_blocked'];
const SCHEDULE_TIMEOUT_MS = 3000;

export interface RecallOption {
  label: string;   // 'A'..'E'
  text: string;
}

export interface RecallCard {
  entryId: string;
  questionId: string | null;
  reason: ErrorReason;
  grandeArea: string | null;
  tema: string | null;
  especialidade: string | null;
  learningText: string | null;
  /** present only when the entry is linked to a question */
  hasQuestion: boolean;
  enunciado: string | null;
  options: RecallOption[];
  correctLabel: string | null;
  comentario: string | null;
}

interface EntryRow {
  id: string;
  question_id: string | null;
  reason: ErrorReason;
  grande_area: string | null;
  tema: string | null;
  especialidade: string | null;
  learning_text: string | null;
  srs_due_at: string | null;
  srs_ease: number | null;
  last_review_outcome: string | null;
  mastered_at: string | null;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E'] as const;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('schedule_timeout')), ms)),
  ]);
}

export function useActiveRecallSession(mode: RecallMode = 'due') {
  const { user } = useAuth();
  const { trackEvent } = useAnalyticsTracker();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<RecallCard[]>([]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<RecallPhase>('answering');

  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [wasCorrect, setWasCorrect] = useState<boolean | null>(null);
  const [confidence, setConfidenceState] = useState<SrsConfidence | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const [leechEntryId, setLeechEntryId] = useState<string | null>(null);
  const [stats, setStats] = useState({ reviewed: 0, correct: 0 });

  const startedRef = useRef(false);

  const current = queue[index] ?? null;

  // ---- load queue ----
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        let q = supabase
          .from('error_notebook_entries')
          .select('id,question_id,reason,grande_area,tema,especialidade,learning_text,srs_due_at,srs_ease,last_review_outcome,mastered_at')
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .is('mastered_at', null);
        if (mode === 'due') q = q.lte('srs_due_at', new Date().toISOString());
        const ordered = q.order('srs_due_at', { ascending: true }).order('srs_ease', { ascending: true });

        const { data, error: fetchErr } = await ordered;
        if (fetchErr) throw fetchErr;

        // bloqueados (awaiting_lesson / leech_blocked) saem da fila — feito em JS
        // para não excluir entradas nunca revisadas (last_review_outcome = null).
        const entries = ((data ?? []) as unknown as EntryRow[]).filter(
          (e) => !BLOCKED_OUTCOMES.includes(e.last_review_outcome ?? ''),
        );

        const qIds = entries.map((e) => e.question_id).filter((id): id is string => !!id);
        const questionMap = new Map<string, { enunciado: string; opts: RecallOption[]; correta: string; comentario: string | null }>();

        if (qIds.length > 0) {
          const { data: qData, error: qErr } = await supabase
            .from('questoes_simulado')
            .select('id, enunciado, alternativa_a, alternativa_b, alternativa_c, alternativa_d, alternativa_e, correta, comentario')
            .in('id', qIds);
          if (qErr) throw qErr;
          for (const r of qData ?? []) {
            const opts: RecallOption[] = [
              { label: 'A', text: r.alternativa_a },
              { label: 'B', text: r.alternativa_b },
              { label: 'C', text: r.alternativa_c },
              { label: 'D', text: r.alternativa_d },
              { label: 'E', text: r.alternativa_e ?? '' },
            ].filter((o) => o.text != null && o.text !== '');
            questionMap.set(r.id, { enunciado: r.enunciado, opts, correta: r.correta, comentario: r.comentario });
          }
        }

        const cards: RecallCard[] = entries.map((e) => {
          const qd = e.question_id ? questionMap.get(e.question_id) : undefined;
          return {
            entryId: e.id,
            questionId: e.question_id,
            reason: e.reason,
            grandeArea: e.grande_area,
            tema: e.tema,
            especialidade: e.especialidade,
            learningText: e.learning_text,
            hasQuestion: !!qd,
            enunciado: qd?.enunciado ?? null,
            options: qd?.opts ?? [],
            correctLabel: qd?.correta ?? null,
            comentario: qd?.comentario ?? null,
          };
        });

        if (cancelled) return;
        setQueue(cards);
        setIndex(0);
        setPhase(cards[0]?.hasQuestion ? 'answering' : 'confidence');
        if (!startedRef.current) {
          trackEvent({ eventName: 'ce_recall_started', category: 'interaction', data: { mode, total: cards.length } });
          startedRef.current = true;
        }
      } catch (err) {
        Logger.error('[Recall] load error:', err);
        if (!cancelled) setError('Erro ao carregar a sessão de revisão');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id, mode, trackEvent]);

  // ---- phase transitions ----
  const submitAnswer = useCallback(() => {
    if (!current) return;
    const correct = !!current.correctLabel && selectedLabel === current.correctLabel;
    setWasCorrect(correct);
    trackEvent({ eventName: 'ce_recall_answer_selected', category: 'interaction', data: { entry_id: current.entryId, was_correct: correct } });
    setPhase('confidence');
  }, [current, selectedLabel, trackEvent]);

  const setConfidence = useCallback((c: SrsConfidence) => {
    setConfidenceState(c);
    if (current) trackEvent({ eventName: 'ce_recall_confidence_set', category: 'interaction', data: { entry_id: current.entryId, confidence: c } });
    setPhase('revealed');
  }, [current, trackEvent]);

  const advance = useCallback((reviewedCorrect: boolean) => {
    setStats((s) => ({ reviewed: s.reviewed + 1, correct: s.correct + (reviewedCorrect ? 1 : 0) }));
    setSelectedLabel(null);
    setWasCorrect(null);
    setConfidenceState(null);
    setLeechEntryId(null);
    setIndex((i) => {
      const next = i + 1;
      const nextCard = queue[next];
      if (!nextCard) {
        setPhase('done');
        trackEvent({ eventName: 'ce_recall_session_ended', category: 'interaction', data: { reviewed: stats.reviewed + 1 } });
      } else {
        setPhase(nextCard.hasQuestion ? 'answering' : 'confidence');
      }
      return next;
    });
  }, [queue, stats.reviewed, trackEvent]);

  const submitSelfGrade = useCallback(async (outcome: SrsOutcome) => {
    if (!current || confidence == null) return;
    // 'facil' não é permitido quando a resposta foi errada
    if (outcome === 'facil' && current.hasQuestion && wasCorrect === false) return;

    const effectiveCorrect = current.hasQuestion ? !!wasCorrect : outcome !== 'errei';
    setIsCommitting(true);
    try {
      // ORDEM CRÍTICA: registrar a tentativa ANTES de agendar (o schedule lê as 2 últimas).
      await recordReviewAttempt({ entryId: current.entryId, wasCorrect: effectiveCorrect, confidence, selfGrade: outcome });
      const result = await withTimeout(
        scheduleNextReview({ entryId: current.entryId, outcome, confidence }),
        SCHEDULE_TIMEOUT_MS,
      );
      trackEvent({ eventName: 'ce_recall_self_graded', category: 'interaction', data: { entry_id: current.entryId, outcome, mastered: result.mastered } });

      if (result.is_leech) {
        setLeechEntryId(current.entryId);
        trackEvent({ eventName: 'ce_entry_leech_triggered', category: 'interaction', data: { entry_id: current.entryId } });
        setIsCommitting(false);
        return; // espera o usuário decidir (LeechBanner) antes de avançar
      }
      advance(effectiveCorrect);
    } catch (err) {
      Logger.error('[Recall] commit error:', err);
      setError('Não foi possível salvar sua revisão. Tente novamente.');
    } finally {
      setIsCommitting(false);
    }
  }, [current, confidence, wasCorrect, advance, trackEvent]);

  const handleResetLeech = useCallback(async () => {
    if (!leechEntryId) return;
    try {
      await resetLeech(leechEntryId);
    } catch (err) {
      Logger.error('[Recall] reset leech error:', err);
    }
    advance(false);
  }, [leechEntryId, advance]);

  return {
    loading,
    error,
    total: queue.length,
    index,
    current,
    phase,
    selectedLabel,
    setSelectedLabel,
    wasCorrect,
    confidence,
    isCommitting,
    leechEntryId,
    stats,
    submitAnswer,
    setConfidence,
    submitSelfGrade,
    handleResetLeech,
    done: phase === 'done',
  };
}
