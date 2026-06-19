import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalyticsTracker } from '@/hooks/useAnalyticsTracker';
import { Logger } from '@/utils/logger';

export interface FavoriteRow {
  id: string;
  question_id: string;
  simulado_id: string | null;
  grande_area: string | null;
  tema: string | null;
  created_at: string;
}

export interface FavoriteMeta {
  questionId: string;
  simuladoId?: string | null;
  grandeArea?: string | null;
  tema?: string | null;
}

/** Lista completa de favoritos + helpers (para a aba Favoritos). */
export function useFavorites() {
  const { user } = useAuth();
  const { trackEvent } = useAnalyticsTracker();
  const [favorites, setFavorites] = useState<FavoriteRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('question_favorites')
        .select('id, question_id, simulado_id, grande_area, tema, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setFavorites((data ?? []) as FavoriteRow[]);
    } catch (err) {
      Logger.error('[Favorites] load error:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { refresh(); }, [refresh]);

  const isFavorite = useCallback(
    (questionId: string) => favorites.some((f) => f.question_id === questionId),
    [favorites],
  );

  const add = useCallback(async (meta: FavoriteMeta) => {
    if (!user?.id) return;
    const { error } = await supabase.from('question_favorites').insert({
      user_id: user.id,
      question_id: meta.questionId,
      simulado_id: meta.simuladoId ?? null,
      grande_area: meta.grandeArea ?? null,
      tema: meta.tema ?? null,
    });
    if (error && error.code !== '23505') { // ignora violação de unique (já favoritado)
      Logger.error('[Favorites] add error:', error);
      return;
    }
    trackEvent({ eventName: 'ce_favorite_added', category: 'interaction', data: { question_id: meta.questionId } });
    refresh();
  }, [user?.id, refresh, trackEvent]);

  const remove = useCallback(async (questionId: string) => {
    if (!user?.id) return;
    const { error } = await supabase
      .from('question_favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('question_id', questionId);
    if (error) { Logger.error('[Favorites] remove error:', error); return; }
    trackEvent({ eventName: 'ce_favorite_removed', category: 'interaction', data: { question_id: questionId } });
    setFavorites((prev) => prev.filter((f) => f.question_id !== questionId));
  }, [user?.id, trackEvent]);

  const toggle = useCallback(async (meta: FavoriteMeta) => {
    if (isFavorite(meta.questionId)) await remove(meta.questionId);
    else await add(meta);
  }, [isFavorite, add, remove]);

  return { favorites, loading, isFavorite, add, remove, toggle, refresh };
}
