/**
 * Costura de acesso a flashcards (Caderno de Erros).
 *
 * A tabela `flashcards` e a RPC `schedule_flashcard_review_guarded` ainda NÃO
 * estão em src/integrations/supabase/types.ts (migração 20260619130000 não
 * aplicada). Cast `as any` isolado aqui — ao aplicar + regenerar tipos, este é o
 * único arquivo a revisar.
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fcTable = () => supabase.from('flashcards') as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const looseRpc = supabase.rpc.bind(supabase) as unknown as (name: string, params?: Record<string, unknown>) => Promise<{ data: any; error: { message: string } | null }>;

const FIELDS = 'id, front_md, back_md, question_id, srs_due_at, srs_reps, mastered_at';

export async function listFlashcards(userId: string): Promise<Flashcard[]> {
  const { data, error } = await fcTable()
    .select(FIELDS)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Flashcard[];
}

export async function listDueFlashcards(userId: string): Promise<Flashcard[]> {
  const { data, error } = await fcTable()
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
  const { error } = await fcTable().insert({ user_id: userId, front_md: frontMd, back_md: backMd, question_id: questionId ?? null });
  if (error) throw new Error(error.message);
}

export async function deleteFlashcard(userId: string, id: string): Promise<void> {
  const { error } = await fcTable().update({ deleted_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId);
  if (error) throw new Error(error.message);
}

export async function scheduleFlashcardReview(flashcardId: string, outcome: SrsOutcome): Promise<void> {
  const { error } = await looseRpc('schedule_flashcard_review_guarded', { p_flashcard_id: flashcardId, p_outcome: outcome });
  if (error) throw new Error(error.message);
}
