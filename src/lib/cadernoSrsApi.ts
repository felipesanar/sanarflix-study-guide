/**
 * Costura de acesso às RPCs de SRS do Caderno de Erros.
 *
 * As RPCs (schedule_next_review_guarded, record_review_attempt_guarded,
 * reset_leech_guarded) e as colunas SRS de error_notebook_entries ainda NÃO
 * estão em src/integrations/supabase/types.ts porque as migrações
 * (supabase/migrations/20260618120000_*, ..120100_*) não foram aplicadas.
 *
 * Enquanto isso, este módulo isola o cast `as any`. Ao aplicar as migrações e
 * regenerar os tipos, este é o ÚNICO arquivo a revisar.
 */
import { supabase } from '@/integrations/supabase/client';
import type { SrsConfidence, SrsOutcome } from '@/lib/srs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseRpc = (name: string, params?: Record<string, unknown>) => Promise<{ data: any; error: { message: string } | null }>;
const looseRpc = supabase.rpc.bind(supabase) as unknown as LooseRpc;

export interface ScheduleResult {
  srs_due_at: string;
  srs_interval: number;
  srs_reps: number;
  srs_ease: number;
  srs_lapses: number;
  mastered: boolean;
  is_leech: boolean;
}

/** Registra a tentativa de revisão (log imutável). DEVE rodar ANTES de scheduleNextReview. */
export async function recordReviewAttempt(p: {
  entryId: string;
  wasCorrect: boolean;
  confidence: SrsConfidence;
  selfGrade: SrsOutcome;
}): Promise<string> {
  const { data, error } = await looseRpc('record_review_attempt_guarded', {
    p_entry_id: p.entryId,
    p_was_correct: p.wasCorrect,
    p_confidence: p.confidence,
    p_self_grade: p.selfGrade,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/** Aplica o motor SM-2-lite e agenda a próxima revisão. */
export async function scheduleNextReview(p: {
  entryId: string;
  outcome: SrsOutcome;
  confidence: SrsConfidence;
}): Promise<ScheduleResult> {
  const { data, error } = await looseRpc('schedule_next_review_guarded', {
    p_entry_id: p.entryId,
    p_outcome: p.outcome,
    p_confidence: p.confidence,
  });
  if (error) throw new Error(error.message);
  return data as ScheduleResult;
}

/** Desbloqueia um item em leech (mantém histórico de lapses). */
export async function resetLeech(entryId: string): Promise<void> {
  const { error } = await looseRpc('reset_leech_guarded', { p_entry_id: entryId });
  if (error) throw new Error(error.message);
}
