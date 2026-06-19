import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalyticsTracker } from '@/hooks/useAnalyticsTracker';
import { Logger } from '@/utils/logger';
import { listFlashcards, createFlashcard, deleteFlashcard, type Flashcard } from '@/lib/flashcardsApi';

export function useFlashcards() {
  const { user } = useAuth();
  const { trackEvent } = useAnalyticsTracker();
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    try {
      setFlashcards(await listFlashcards(user.id));
    } catch (err) {
      Logger.error('[Flashcards] load error:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { refresh(); }, [refresh]);

  const create = useCallback(async (frontMd: string, backMd: string) => {
    if (!user?.id) return;
    await createFlashcard(user.id, frontMd, backMd);
    trackEvent({ eventName: 'ce_flashcard_created', category: 'interaction' });
    refresh();
  }, [user?.id, refresh, trackEvent]);

  const remove = useCallback(async (id: string) => {
    if (!user?.id) return;
    setFlashcards((prev) => prev.filter((f) => f.id !== id));
    try { await deleteFlashcard(user.id, id); } catch (err) { Logger.error('[Flashcards] delete error:', err); }
  }, [user?.id]);

  const dueCount = flashcards.filter((f) => !f.mastered_at && new Date(f.srs_due_at).getTime() <= Date.now()).length;

  return { flashcards, dueCount, loading, create, remove, refresh };
}
