/**
 * Costura de acesso às RPCs de SRS do Caderno de Erros.
 *
 * Os tipos das RPCs (record_review_attempt_guarded, schedule_next_review_guarded,
 * reset_leech_guarded, add_to_notebook_bulk_guarded) vivem em
 * src/integrations/supabase/types.ts, gerados após a migração da Fase 1.
 */
import { supabase } from '@/integrations/supabase/client';
import type { SrsConfidence, SrsOutcome } from '@/lib/srs';
import type { ErrorReason } from '@/hooks/useErrorNotebook';

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
  const { data, error } = await supabase.rpc('record_review_attempt_guarded', {
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
  const { data, error } = await supabase.rpc('schedule_next_review_guarded', {
    p_entry_id: p.entryId,
    p_outcome: p.outcome,
    p_confidence: p.confidence,
  });
  if (error) throw new Error(error.message);
  return data as unknown as ScheduleResult;
}

/** Desbloqueia um item em leech (mantém histórico de lapses). */
export async function resetLeech(entryId: string): Promise<void> {
  const { error } = await supabase.rpc('reset_leech_guarded', { p_entry_id: entryId });
  if (error) throw new Error(error.message);
}

export interface BulkEntry {
  question_id: string | null;
  simulado_id: string | null;
  simulado_nome?: string | null;
  grande_area?: string | null;
  especialidade?: string | null;
  tema?: string | null;
  reason: ErrorReason;
  learning_text?: string | null;
  was_correct: boolean;
  confidence_at_answer?: SrsConfidence | null;
}

export interface BulkResult {
  added: number;
  skipped: number;
  entry_ids: string[];
}

/** Adiciona em lote a partir da triagem pós-prova (limite 100, dedup por questão). */
export async function addToNotebookBulk(entries: BulkEntry[]): Promise<BulkResult> {
  const { data, error } = await supabase.rpc('add_to_notebook_bulk_guarded', {
    p_entries: entries as unknown as never,
  });
  if (error) throw new Error(error.message);
  const r = (data ?? {}) as Partial<BulkResult>;
  return { added: r.added ?? 0, skipped: r.skipped ?? 0, entry_ids: r.entry_ids ?? [] };
}
