import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Sparkles, RefreshCw, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorNotebookEntry } from '@/hooks/useErrorNotebook';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Logger } from '@/utils/logger';

interface AIInsightsCardProps {
  entries: ErrorNotebookEntry[];
}

const CACHE_KEY = 'ce_ai_insights';
const CACHE_TTL = 30 * 60 * 1000;

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
      Logger.error('[AIInsights] Error:', err);
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
    <Card className="border-primary/15 bg-gradient-to-br from-primary/5 via-transparent to-transparent rounded-2xl">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground">Insights por IA</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg hover:bg-accent/50"
            onClick={() => fetchInsights(true)}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>

        {loading && !insight ? (
          <div className="space-y-2.5">
            <Skeleton className="h-4 w-full rounded-lg" />
            <Skeleton className="h-4 w-3/4 rounded-lg" />
            <Skeleton className="h-4 w-5/6 rounded-lg" />
          </div>
        ) : insight ? (
          <div className="text-sm text-muted-foreground leading-relaxed space-y-3">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <p className="leading-relaxed">{children}</p>,
                strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
                ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1.5 marker:text-muted-foreground/60">{children}</ol>,
                ul: ({ children }) => <ul className="list-disc pl-5 space-y-1.5 marker:text-muted-foreground/60">{children}</ul>,
                li: ({ children }) => <li className="leading-relaxed pl-1">{children}</li>,
                code: ({ children }) => <code className="px-1.5 py-0.5 rounded bg-muted text-foreground text-[0.85em] font-mono">{children}</code>,
                h1: ({ children }) => <h4 className="text-sm font-semibold text-foreground mt-2">{children}</h4>,
                h2: ({ children }) => <h4 className="text-sm font-semibold text-foreground mt-2">{children}</h4>,
                h3: ({ children }) => <h4 className="text-sm font-semibold text-foreground mt-2">{children}</h4>,
                a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:opacity-80">{children}</a>,
              }}
            >
              {insight}
            </ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground/60 italic">Clique em atualizar para gerar insights.</p>
        )}
      </CardContent>
    </Card>
  );
};
