/**
 * Status SRS derivado de uma entrada do caderno + ease inicial por causa.
 * Usado para badges na lista (Meus Erros) e para o add manual ficar consistente
 * com a triagem. Espelha a prioridade do motor (mastered → leech → awaiting → due).
 */
import type { ErrorReason } from '@/hooks/useErrorNotebook';

export type EntryStatus = 'mastered' | 'leech' | 'awaiting_lesson' | 'due' | 'scheduled';

export interface EntryStatusInput {
  srs_due_at: string | null;
  mastered_at: string | null;
  srs_lapses: number | null;
  last_review_outcome: string | null;
}

const LEECH_THRESHOLD = 4;

export function cadernoEntryStatus(e: EntryStatusInput, now: number = Date.now()): EntryStatus {
  if (e.mastered_at) return 'mastered';
  if ((e.srs_lapses ?? 0) >= LEECH_THRESHOLD || e.last_review_outcome === 'leech_blocked') return 'leech';
  if (e.last_review_outcome === 'awaiting_lesson') return 'awaiting_lesson';
  if (e.srs_due_at == null || Date.parse(e.srs_due_at) <= now) return 'due';
  return 'scheduled';
}

/** Ease inicial por causa do erro (igual ao add_to_notebook_bulk_guarded / srs.ts). */
export function easeForReason(reason: ErrorReason): number {
  switch (reason) {
    case 'did_not_know':
    case 'answered_without_confidence':
      return 2.1;
    case 'did_not_understand_statement':
      return 2.8;
    case 'did_not_remember':
    default:
      return 2.5;
  }
}
