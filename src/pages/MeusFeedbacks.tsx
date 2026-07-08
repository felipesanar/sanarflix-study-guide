import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Bug, Lightbulb, Sparkles, Heart, MessageSquarePlus, Inbox, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useFeedback } from '@/components/feedback/FeedbackProvider';
import { FeedbackTimeline } from '@/components/feedback/FeedbackTimeline';
import { cn } from '@/lib/utils';

type Row = {
  id: string;
  category: 'bug' | 'suggestion' | 'feature_request' | 'praise';
  message: string;
  status: 'received' | 'in_review' | 'resolved' | 'archived';
  admin_response: string | null;
  responded_at: string | null;
  screenshot_url: string | null;
  page_url: string | null;
  created_at: string;
};

const CAT_META: Record<Row['category'], { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  bug: { label: 'Problema', icon: Bug, color: 'text-destructive' },
  suggestion: { label: 'Sugestão', icon: Lightbulb, color: 'text-primary' },
  feature_request: { label: 'Funcionalidade', icon: Sparkles, color: 'text-accent-foreground' },
  praise: { label: 'Elogio', icon: Heart, color: 'text-rose-500' },
};

const STATUS_META: Record<Row['status'], { label: string; cls: string }> = {
  received: { label: 'Recebido', cls: 'bg-muted text-muted-foreground' },
  in_review: { label: 'Em análise', cls: 'bg-primary/15 text-primary border-primary/30' },
  resolved: { label: 'Resolvido', cls: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
  archived: { label: 'Arquivado', cls: 'bg-muted/60 text-muted-foreground' },
};

const MeusFeedbacks: React.FC = () => {
  const { user } = useAuth();
  const { openFeedback, audience } = useFeedback();
  const isGestor = audience === 'gestor';
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Row | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_feedback')
        .select('id, category, message, status, admin_response, responded_at, screenshot_url, page_url, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (!error && data) setRows(data as Row[]);
      setLoading(false);
    })();
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setScreenshotUrl(null);
      if (selected?.screenshot_url) {
        const { data } = await supabase.storage
          .from('feedback-screenshots')
          .createSignedUrl(selected.screenshot_url, 3600);
        if (!cancelled) setScreenshotUrl(data?.signedUrl ?? null);
      }
    })();
    return () => { cancelled = true; };
  }, [selected]);

  const grouped = useMemo(() => {
    return {
      open: rows.filter((r) => r.status === 'received' || r.status === 'in_review'),
      done: rows.filter((r) => r.status === 'resolved' || r.status === 'archived'),
    };
  }, [rows]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-8 md:py-12">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Você falou, a gente ouviu</div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mt-1">Meus feedbacks</h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-xl">
              Acompanhe o status de cada feedback que você enviou. Recebido, em análise ou resolvido — você sempre sabe onde está.
            </p>
          </div>
          <Button onClick={() => openFeedback()} className="rounded-xl">
            <MessageSquarePlus className="h-4 w-4" /> Novo feedback
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando…
          </div>
        ) : rows.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-dashed border-border bg-card/40 p-12 text-center"
          >
            <Inbox className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">Nenhum feedback ainda</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1 mb-5">
              Sua opinião molda a plataforma. Conta o que está bom, o que poderia melhorar ou algo que travou.
            </p>
            <Button onClick={() => openFeedback()} className="rounded-xl">
              <MessageSquarePlus className="h-4 w-4" /> Enviar primeiro feedback
            </Button>
          </motion.div>
        ) : (
          <div className="space-y-8">
            {grouped.open.length > 0 && (
              <Section title="Em andamento" items={grouped.open} onPick={setSelected} />
            )}
            {grouped.done.length > 0 && (
              <Section title="Histórico" items={grouped.done} onPick={setSelected} />
            )}
          </div>
        )}
      </div>

      <Sheet open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (() => {
            const meta = CAT_META[selected.category];
            const status = STATUS_META[selected.status];
            const Icon = meta.icon;
            return (
              <div className="space-y-5">
                <div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Icon className={cn('h-4 w-4', meta.color)} />
                    {meta.label} · {new Date(selected.created_at).toLocaleString('pt-BR')}
                  </div>
                  <Badge variant="outline" className={cn('mt-2 rounded-full px-3 py-1 text-xs border', status.cls)}>
                    {status.label}
                  </Badge>
                </div>

                <div>
                  <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1.5">Sua mensagem</div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{selected.message}</p>
                </div>

                {screenshotUrl && (
                  <div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1.5">Print anexado</div>
                    <img src={screenshotUrl} alt="Print" className="rounded-xl border border-border w-full" />
                  </div>
                )}

                {selected.page_url && (
                  <div className="text-xs text-muted-foreground">
                    Página: <span className="text-foreground">{selected.page_url}</span>
                  </div>
                )}

                <div className="rounded-2xl border border-border bg-card/50 p-4">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1.5">Resposta da equipe</div>
                  {selected.admin_response ? (
                    <>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{selected.admin_response}</p>
                      {selected.responded_at && (
                        <div className="text-xs text-muted-foreground mt-2">
                          em {new Date(selected.responded_at).toLocaleString('pt-BR')}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      Ainda sem resposta — assim que a equipe avaliar, você verá aqui.
                    </p>
                  )}
                </div>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
};

const Section: React.FC<{ title: string; items: Row[]; onPick: (r: Row) => void }> = ({ title, items, onPick }) => (
  <div>
    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3">{title}</h2>
    <div className="space-y-2.5">
      {items.map((r) => {
        const meta = CAT_META[r.category];
        const status = STATUS_META[r.status];
        const Icon = meta.icon;
        return (
          <motion.button
            key={r.id}
            whileHover={{ y: -1 }}
            onClick={() => onPick(r)}
            className="w-full text-left rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all p-4 flex gap-4"
          >
            <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
              <Icon className={cn('h-5 w-5', meta.color)} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-muted-foreground">{meta.label}</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString('pt-BR')}
                </span>
              </div>
              <p className="text-sm line-clamp-2 text-foreground">{r.message}</p>
            </div>
            <Badge variant="outline" className={cn('rounded-full px-2.5 py-0.5 text-xs border self-start whitespace-nowrap', status.cls)}>
              {status.label}
            </Badge>
          </motion.button>
        );
      })}
    </div>
  </div>
);

export default MeusFeedbacks;
