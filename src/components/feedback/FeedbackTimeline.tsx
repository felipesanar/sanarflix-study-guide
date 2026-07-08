import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type FeedbackTimelineStatus = 'received' | 'in_review' | 'resolved' | 'archived';

interface Props {
  status: FeedbackTimelineStatus;
  createdAt?: string | Date;
  respondedAt?: string | Date | null;
  slaLabel?: string; // e.g. "até 3 dias úteis"
  className?: string;
  compact?: boolean;
}

const STEPS: Array<{ id: FeedbackTimelineStatus; label: string }> = [
  { id: 'received', label: 'Recebido' },
  { id: 'in_review', label: 'Em análise' },
  { id: 'resolved', label: 'Resolvido' },
];

const rank = (s: FeedbackTimelineStatus) => {
  if (s === 'received') return 0;
  if (s === 'in_review') return 1;
  if (s === 'resolved' || s === 'archived') return 2;
  return 0;
};

const fmt = (d?: string | Date | null) => {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  } catch {
    return '';
  }
};

export const FeedbackTimeline: React.FC<Props> = ({
  status,
  createdAt,
  respondedAt,
  slaLabel = 'até 3 dias úteis',
  className,
  compact,
}) => {
  const current = rank(status);

  return (
    <ol
      className={cn(
        'relative flex flex-col gap-3',
        compact ? 'text-xs' : 'text-sm',
        className,
      )}
      aria-label="Status do feedback"
    >
      {STEPS.map((step, i) => {
        const isDone = i < current;
        const isCurrent = i === current;
        const isFuture = i > current;
        return (
          <li key={step.id} className="relative flex items-start gap-3">
            {i < STEPS.length - 1 && (
              <span
                className={cn(
                  'absolute left-[11px] top-6 h-full w-px',
                  isDone || isCurrent ? 'bg-primary/40' : 'bg-border',
                )}
                aria-hidden
              />
            )}
            <span
              className={cn(
                'relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all',
                isDone && 'bg-primary border-primary text-primary-foreground',
                isCurrent && 'border-primary bg-background text-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.12)]',
                isFuture && 'border-border bg-background text-muted-foreground',
              )}
            >
              {isDone ? (
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              ) : (
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    isCurrent ? 'bg-primary animate-pulse' : 'bg-muted-foreground/40',
                  )}
                />
              )}
            </span>
            <div className="flex-1 min-w-0 pb-1">
              <div
                className={cn(
                  'font-medium leading-tight',
                  isFuture ? 'text-muted-foreground' : 'text-foreground',
                )}
              >
                {step.label}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {step.id === 'received' && (createdAt ? fmt(createdAt) : 'agora')}
                {step.id === 'in_review' && (isDone || isCurrent ? '' : slaLabel)}
                {step.id === 'resolved' &&
                  (isDone
                    ? (respondedAt ? fmt(respondedAt) : 'resposta enviada')
                    : 'você recebe um aviso quando tivermos novidade')}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
};
