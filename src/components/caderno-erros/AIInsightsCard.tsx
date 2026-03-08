import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Sparkles, RefreshCw, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorNotebookEntry } from '@/hooks/useErrorNotebook';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface AIInsightsCardProps {
  entries: ErrorNotebookEntry[];
}

const CACHE_KEY = 'ce_ai_insights';
const CACHE_TTL = 30 * 60 * 1000; // 30 min

interface CachedInsight {
  text: string;
  timestamp: number;
  entryCount: number;
}

export const AIInsightsCard: React.FC<AIInsightsCardProps> = ({ entries }) => {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  const loadFromCache = useCallback((): string | null => {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (!cached) return null;
      const parsed: CachedInsight = JSON.parse(cached);
      if (Date.now() - parsed.timestamp > CACHE_TTL) return null;
      if (parsed.entryCount !== entries.length) return null;
      return parsed.text;
    } catch {
      return null;
    }
  }, [entries.length]);

  const saveToCache = useCallback((text: string) => {
    try {
      const data: CachedInsight = { text, timestamp: Date.now(), entryCount: entries.length };
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {}
  }, [entries.length]);

  const fetchInsights = useCallback(async (force = false) => {
    if (entries.length < 3) return;
    if (!force) {
      const cached = loadFromCache();
      if (cached) { setInsight(cached); return; }
    }

    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) throw new Error('No session');

      const payload = entries.slice(0, 50).map(e => ({
        area: e.grande_area,
        tema: e.tema,
        especialidade: e.especialidade,
        reason: e.reason,
        learning: e.learning_text,
      }));

      const { data, error } = await supabase.functions.invoke('analyze-error-patterns', {
        body: { entries: payload },
      });

      if (error) throw error;
      const text = data?.insight || 'Não foi possível gerar insights no momento.';
      setInsight(text);
      saveToCache(text);
    } catch (err: any) {
      console.error('[AIInsights] Error:', err);
      if (err?.status === 429) {
        toast({ title: 'Limite de requisições atingido', description: 'Tente novamente em alguns minutos.', variant: 'destructive' });
      } else if (err?.status === 402) {
        toast({ title: 'Créditos insuficientes', description: 'Adicione créditos para usar insights de IA.', variant: 'destructive' });
      }
      setInsight(null);
    } finally {
      setLoading(false);
    }
  }, [entries, loadFromCache, saveToCache]);

  useEffect(() => {
    if (!fetchedRef.current && entries.length >= 3) {
      fetchedRef.current = true;
      fetchInsights();
    }
  }, [entries.length, fetchInsights]);

  if (entries.length < 3) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Insights por IA</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => fetchInsights(true)}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>

        {loading && !insight ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ) : insight ? (
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{insight}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">Clique em atualizar para gerar insights.</p>
        )}
      </CardContent>
    </Card>
  );
};
