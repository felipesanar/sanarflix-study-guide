import React, { useEffect, useState } from 'react';
import { Star, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useFavorites } from '@/hooks/useFavorites';

export const FavoritesList: React.FC = () => {
  const { favorites, loading, remove } = useFavorites();
  const [enunciados, setEnunciados] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const ids = favorites.map((f) => f.question_id);
    if (ids.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('questoes_simulado').select('id, enunciado').in('id', ids);
      if (cancelled || !data) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setEnunciados(new Map((data as any[]).map((q) => [q.id, q.enunciado as string])));
    })();
    return () => { cancelled = true; };
  }, [favorites]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-5">
          <Star className="h-7 w-7 text-amber-500/70" />
        </div>
        <h3 className="text-base font-semibold text-foreground mb-1.5">Nenhuma questão favoritada</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Favorite questões na correção do simulado para revisá-las depois.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {favorites.map((f, i) => (
        <motion.div key={f.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.2) }}>
          <Card>
            <CardContent className="p-4 flex items-start gap-3">
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  {f.grande_area && <Badge variant="outline" className="text-xs">{f.grande_area}</Badge>}
                  {f.tema && <span className="text-xs text-muted-foreground">{f.tema}</span>}
                </div>
                <p className="text-sm text-foreground line-clamp-2 leading-relaxed">
                  {enunciados.get(f.question_id) ?? 'Questão favoritada'}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => remove(f.question_id)}
                aria-label="Remover dos favoritos"
                className="shrink-0 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
              >
                <Star className="h-4 w-4 fill-current" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
};
