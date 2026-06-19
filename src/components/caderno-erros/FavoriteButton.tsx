import React, { useEffect, useState, useCallback } from 'react';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalyticsTracker } from '@/hooks/useAnalyticsTracker';
import { Logger } from '@/utils/logger';

interface FavoriteButtonProps {
  questionId: string;
  simuladoId?: string | null;
  grandeArea?: string | null;
  tema?: string | null;
  className?: string;
}

/** Botão de favoritar uma questão (auto-contido: checa e alterna o próprio estado). */
export const FavoriteButton: React.FC<FavoriteButtonProps> = ({ questionId, simuladoId, grandeArea, tema, className }) => {
  const { user } = useAuth();
  const { trackEvent } = useAnalyticsTracker();
  const [fav, setFav] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user?.id || !questionId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('question_favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('question_id', questionId)
        .limit(1);
      if (!cancelled) setFav((data?.length ?? 0) > 0);
    })();
    return () => { cancelled = true; };
  }, [user?.id, questionId]);

  const toggle = useCallback(async () => {
    if (!user?.id || busy) return;
    setBusy(true);
    const next = !fav;
    setFav(next); // otimista
    try {
      if (next) {
        const { error } = await supabase.from('question_favorites').insert({
          user_id: user.id,
          question_id: questionId,
          simulado_id: simuladoId ?? null,
          grande_area: grandeArea ?? null,
          tema: tema ?? null,
        });
        if (error && error.code !== '23505') throw error;
        trackEvent({ eventName: 'ce_favorite_added', category: 'interaction', data: { question_id: questionId } });
      } else {
        const { error } = await supabase
          .from('question_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('question_id', questionId);
        if (error) throw error;
        trackEvent({ eventName: 'ce_favorite_removed', category: 'interaction', data: { question_id: questionId } });
      }
    } catch (err) {
      Logger.error('[FavoriteButton] toggle error:', err);
      setFav(!next); // reverte
    } finally {
      setBusy(false);
    }
  }, [user?.id, busy, fav, questionId, simuladoId, grandeArea, tema, trackEvent]);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggle}
      disabled={busy}
      aria-pressed={fav}
      className={cn('gap-1.5', fav && 'border-amber-400/50 text-amber-600 dark:text-amber-400', className)}
    >
      <Star className={cn('h-4 w-4', fav && 'fill-current')} />
      {fav ? 'Favoritado' : 'Favoritar'}
    </Button>
  );
};
