/**
 * Costura de acesso a flashcards (Caderno de Erros).
 */
import { supabase } from '@/integrations/supabase/client';
import type { SrsOutcome } from '@/lib/srs';

export interface Flashcard {
  id: string;
  front_md: string;
  back_md: string;
  question_id: string | null;
  srs_due_at: string;
  srs_reps: number;
  mastered_at: string | null;
}

const FIELDS = 'id, front_md, back_md, question_id, srs_due_at, srs_reps, mastered_at';

export async function listFlashcards(userId: string): Promise<Flashcard[]> {
  const { data, error } = await supabase
    .from('flashcards')
    .select(FIELDS)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Flashcard[];
}

export async function listDueFlashcards(userId: string): Promise<Flashcard[]> {
  const { data, error } = await supabase
    .from('flashcards')
    .select(FIELDS)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .is('mastered_at', null)
    .lte('srs_due_at', new Date().toISOString())
    .order('srs_due_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Flashcard[];
}

export async function createFlashcard(userId: string, frontMd: string, backMd: string, questionId?: string | null): Promise<void> {
  const { error } = await supabase
    .from('flashcards')
    .insert({ user_id: userId, front_md: frontMd, back_md: backMd, question_id: questionId ?? null });
  if (error) throw new Error(error.message);
}

export async function deleteFlashcard(userId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from('flashcards')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

export async function scheduleFlashcardReview(flashcardId: string, outcome: SrsOutcome): Promise<void> {
  const { error } = await supabase.rpc('schedule_flashcard_review_guarded', {
    p_flashcard_id: flashcardId,
    p_outcome: outcome,
  });
  if (error) throw new Error(error.message);
}
