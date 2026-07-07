import * as React from 'react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, X, ArrowRight, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { CopilotoInsight, CopilotoTone } from './insightEngine';

const SESSION_STORAGE_KEY = 'gestor.copiloto.dismissed';

function readDismissed(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

function persistDismissed(ids: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // sessionStorage indisponível (modo privado etc.) — dispensa não persiste, sem quebrar a UI.
  }
}

const TONE_CONFIG: Record<CopilotoTone, { border: string; bg: string; icon: string; iconBg: string }> = {
  critical: {
    border: 'border-destructive/15',
    bg: 'bg-gradient-to-br from-destructive/[0.07] to-destructive/[0.02]',
    icon: 'text-destructive',
    iconBg: 'bg-destructive/10',
  },
  opportunity: {
    border: 'border-amber-500/15',
    bg: 'bg-gradient-to-br from-amber-500/[0.07] to-amber-500/[0.02]',
    icon: 'text-amber-600 dark:text-amber-400',
    iconBg: 'bg-amber-500/10',
  },
  positive: {
    border: 'border-emerald-500/15',
    bg: 'bg-gradient-to-br from-emerald-500/[0.07] to-emerald-500/[0.02]',
    icon: 'text-emerald-600 dark:text-emerald-400',
    iconBg: 'bg-emerald-500/10',
  },
  info: {
    border: 'border-primary/15',
    bg: 'bg-gradient-to-br from-primary/[0.07] to-primary/[0.02]',
    icon: 'text-primary',
    iconBg: 'bg-primary/10',
  },
};

interface CopilotoRowProps {
  insight: CopilotoInsight;
  onDismiss: (id: string) => void;
  onAskQuestion?: (question: string) => void;
}

const CopilotoRow: React.FC<CopilotoRowProps> = ({ insight, onDismiss, onAskQuestion }) => {
  const tone = TONE_CONFIG[insight.tone];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn(
        'flex items-center gap-3 rounded-2xl border px-3.5 py-2 sm:px-4',
        tone.border,
        tone.bg,
      )}
    >
      <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', tone.iconBg)}>
        <Sparkles className={cn('h-3.5 w-3.5', tone.icon)} aria-hidden="true" />
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <p className="min-w-0 flex-1 truncate text-xs sm:text-sm text-foreground">{insight.text}</p>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs">
          {insight.text}
        </TooltipContent>
      </Tooltip>

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {insight.action && (
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="group h-7 gap-1 text-xs text-foreground hover:bg-background/60"
          >
            <Link to={insight.action.to}>
              {insight.action.label}
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Button>
        )}
        {insight.question && onAskQuestion && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground hover:bg-background/60"
            onClick={() => onAskQuestion(insight.question as string)}
          >
            <MessageCircle className="h-3 w-3" />
            Perguntar
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground/60 hover:text-muted-foreground"
          onClick={() => onDismiss(insight.id)}
          aria-label="Dispensar insight"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </motion.div>
  );
};

export interface CopilotoStripProps {
  /** Insights já derivados por {@link deriveInsights} para a rota ativa. */
  insights: CopilotoInsight[];
  /** Abre o drawer de conversa com a pergunta pré-preenchida. */
  onAskQuestion?: (question: string) => void;
  className?: string;
}

/**
 * Faixa compacta do copiloto condutor — renderiza entre o recorte (barra de
 * filtros) e o conteúdo da tela. Cada insight é dispensável (X) e a dispensa
 * é lembrada em `sessionStorage` pelo `id` do insight (não reaparece na
 * mesma sessão do navegador, mas volta em uma nova sessão ou quando o `id`
 * muda, ex.: pior tema diferente após trocar o recorte).
 *
 * Puramente apresentacional: não busca dados, não decide texto — só
 * renderiza o que `deriveInsights` calculou.
 */
export const CopilotoStrip: React.FC<CopilotoStripProps> = ({ insights, onAskQuestion, className }) => {
  const [dismissed, setDismissed] = useState<Set<string>>(() => readDismissed());

  const visible = useMemo(
    () => insights.filter((i) => !dismissed.has(i.id)),
    [insights, dismissed],
  );

  const handleDismiss = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      persistDismissed(next);
      return next;
    });
  };

  if (visible.length === 0) return null;

  return (
    <div className={cn('space-y-2', className)}>
      <AnimatePresence initial={false} mode="popLayout">
        {visible.map((insight) => (
          <CopilotoRow
            key={insight.id}
            insight={insight}
            onDismiss={handleDismiss}
            onAskQuestion={onAskQuestion}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};
