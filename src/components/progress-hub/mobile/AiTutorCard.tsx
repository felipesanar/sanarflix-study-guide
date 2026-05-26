import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, RefreshCw, ChevronDown, Clock, Target, 
  AlertTriangle, BookOpen, Copy, Check, Lightbulb, Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { TutorPlanResponse } from '@/types/aiTutor';
import { Logger } from '@/utils/logger';

const CACHE_KEY = 'ai-tutor-plan';
const CACHE_DURATION_MS = 30 * 60 * 1000;

type CardState = 'loading' | 'success' | 'error';

// Collapsible section wrapper
const Section: React.FC<{
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
  children: React.ReactNode;
}> = ({ title, icon, defaultOpen = false, badge, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-border/30 pt-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-left min-h-[36px]"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {badge && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{badge}</Badge>
          )}
        </div>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1, transition: { duration: 0.2 } }}
            exit={{ height: 0, opacity: 0, transition: { duration: 0.15 } }}
            className="overflow-hidden"
          >
            <div className="pt-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Impact badge colors
const impactColors: Record<string, string> = {
  high: 'bg-destructive/10 text-destructive border-destructive/20',
  med: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  low: 'bg-muted text-muted-foreground border-border',
};

export const AiTutorCard: React.FC = () => {
  const [plan, setPlan] = useState<TutorPlanResponse | null>(null);
  const [state, setState] = useState<CardState>('loading');
  const [copied, setCopied] = useState(false);
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());

  const fetchPlan = useCallback(async (skipCache = false) => {
    Logger.info('[AITutorUI]', 'state', 'loading', skipCache ? '(refresh)' : '(initial)');

    if (!skipCache) {
      try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_DURATION_MS && data?.headline) {
            setPlan(data);
            setState('success');
            Logger.info('[AITutorUI]', 'state', 'cache-hit');
            return;
          }
        }
      } catch { /* ignore */ }
    }

    setState('loading');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.access_token) {
        setState('error');
        return;
      }

      const { data, error } = await supabase.functions.invoke('ai-study-recommendation', {
        body: { mode: 'full' },
      });

      if (error) throw error;

      if (data?.plan) {
        setPlan(data.plan);
        setState('success');
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: data.plan, timestamp: Date.now() }));
        setCheckedSteps(new Set());
        Logger.info('[AITutorUI]', 'state', 'success', `latency=${data.plan.meta?.latencyMs}ms`);
      } else if (data?.error) {
        Logger.error('[AITutorUI]', 'error from function:', data.error);
        setState('error');
      } else {
        setState('error');
      }
    } catch (err) {
      Logger.error('[AITutorUI]', 'fetch error:', err);
      setState('error');
    }
  }, []);

  useEffect(() => {
    fetchPlan();
  }, []);

  const handleCopy = useCallback(async () => {
    if (!plan) return;
    const text = [
      `📋 ${plan.headline}`,
      `💡 ${plan.whyThisMatters}`,
      '',
      `⏱️ Plano de hoje (${plan.todayPlan.durationMin} min):`,
      ...plan.todayPlan.steps.map((s, i) => `  ${i + 1}. ${s.title} — ${s.detail}`),
      '',
      '📅 Plano da semana:',
      ...plan.weekPlan.map(d => `  ${d.dayLabel}: ${d.focus} → ${d.outcome}`),
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Plano copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Não foi possível copiar');
    }
  }, [plan]);

  const toggleStep = useCallback((index: number) => {
    setCheckedSteps(prev => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  }, []);

  // Loading skeleton
  if (state === 'loading') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Seu Coach de Estudos</span>
        </div>
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <div className="pt-2 space-y-2">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  // Error state (show retry, or last cached plan)
  if (state === 'error' && !plan) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Seu Coach de Estudos</span>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 p-4 text-center space-y-2">
          <p className="text-sm text-muted-foreground">Não foi possível gerar seu plano agora.</p>
          <Button size="sm" variant="outline" onClick={() => fetchPlan(true)} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  if (!plan) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.3 } }}
      className="space-y-2"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Seu Coach de Estudos</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleCopy}>
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => fetchPlan(true)}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Main card */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
        {/* Headline + Why */}
        <div>
          <h3 className="text-sm font-bold text-foreground leading-snug">{plan.headline}</h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{plan.whyThisMatters}</p>
        </div>

        {/* Today's Plan (always open) */}
        <Section
          title="Plano de Hoje"
          icon={<Clock className="h-3.5 w-3.5 text-primary" />}
          badge={`${plan.todayPlan.durationMin} min`}
          defaultOpen={true}
        >
          <div className="space-y-2">
            {plan.todayPlan.steps.map((step, i) => (
              <button
                key={i}
                onClick={() => toggleStep(i)}
                className={cn(
                  'w-full flex items-start gap-2.5 p-2.5 rounded-lg text-left transition-colors min-h-[44px]',
                  checkedSteps.has(i) ? 'bg-primary/10 opacity-60' : 'bg-background/60 hover:bg-background'
                )}
              >
                <div className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors',
                  checkedSteps.has(i) ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                )}>
                  {checkedSteps.has(i) && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium', checkedSteps.has(i) && 'line-through text-muted-foreground')}>
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{step.detail}</p>
                </div>
              </button>
            ))}
          </div>
        </Section>

        {/* Week Plan */}
        <Section
          title="Plano da Semana"
          icon={<Calendar className="h-3.5 w-3.5 text-primary" />}
          badge={`${plan.weekPlan.length} dias`}
        >
          <div className="space-y-1.5">
            {plan.weekPlan.map((day, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-background/40">
                <Badge variant="outline" className="text-[10px] h-5 px-1.5 flex-shrink-0 mt-0.5 font-semibold">
                  {day.dayLabel}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">{day.focus}</p>
                  <p className="text-[11px] text-muted-foreground">{day.outcome}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Priorities */}
        {plan.priorities.length > 0 && (
          <Section
            title="Prioridades"
            icon={<Target className="h-3.5 w-3.5 text-primary" />}
            badge={`${plan.priorities.length}`}
          >
            <div className="space-y-1.5">
              {plan.priorities.map((p, i) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-background/40">
                  <Badge
                    variant="outline"
                    className={cn('text-[10px] h-5 px-1.5 flex-shrink-0 mt-0.5 uppercase font-bold', impactColors[p.impact] || impactColors.low)}
                  >
                    {p.impact === 'high' ? 'Alta' : p.impact === 'med' ? 'Média' : 'Baixa'}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">{p.item}</p>
                    <p className="text-[11px] text-muted-foreground">{p.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Risks */}
        {plan.risks.length > 0 && (
          <Section
            title="Riscos"
            icon={<AlertTriangle className="h-3.5 w-3.5 text-chart-3" />}
          >
            <div className="space-y-1.5">
              {plan.risks.map((r, i) => (
                <div key={i} className="p-2 rounded-lg bg-chart-3/5 border border-chart-3/10">
                  <p className="text-xs font-medium text-foreground">{r.risk}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">→ {r.mitigation}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Study Methods */}
        {plan.studyMethods.length > 0 && (
          <Section
            title="Métodos de Estudo"
            icon={<Lightbulb className="h-3.5 w-3.5 text-chart-4" />}
          >
            <div className="space-y-1.5">
              {plan.studyMethods.map((m, i) => (
                <div key={i} className="p-2 rounded-lg bg-background/40">
                  <p className="text-xs font-medium text-foreground">{m.method}</p>
                  <p className="text-[11px] text-muted-foreground">{m.whenToUse}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Meta footer */}
        {plan.meta?.latencyMs && (
          <p className="text-[10px] text-muted-foreground/50 text-right pt-1">
            Gerado em {(plan.meta.latencyMs / 1000).toFixed(1)}s
          </p>
        )}
      </div>
    </motion.div>
  );
};
