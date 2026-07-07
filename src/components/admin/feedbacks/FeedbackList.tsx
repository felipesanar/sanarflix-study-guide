import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { StatusPill } from '@/experiences/admin/ui/StatusPill';
import { cn } from '@/lib/utils';
import { FEEDBACK_CATEGORY_META, FEEDBACK_STATUS_META } from './feedbackMeta';
import type { FeedbackRow, FeedbackUserInfo } from './types';

export interface FeedbackListProps {
  rows: FeedbackRow[];
  users: Record<string, FeedbackUserInfo>;
  onSelect: (row: FeedbackRow) => void;
}

/** Lista de cards clicáveis de feedback — abre o {@link FeedbackDetailSheet} ao clicar. */
export function FeedbackList({ rows, users, onSelect }: FeedbackListProps) {
  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const meta = FEEDBACK_CATEGORY_META[row.category];
        const statusMeta = FEEDBACK_STATUS_META[row.status];
        const Icon = meta.icon;
        const u = users[row.user_id];
        const when = formatDistanceToNow(new Date(row.created_at), { locale: ptBR, addSuffix: true });
        return (
          <button
            key={row.id}
            type="button"
            onClick={() => onSelect(row)}
            className="flex w-full items-start gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/40"
          >
            <span className={cn('mt-0.5 shrink-0', meta.iconClassName)}>
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 space-y-1">
              <span className="block font-mono text-xs text-muted-foreground">
                {u?.nome ?? '—'} · {u?.email ?? row.user_id.slice(0, 8)} · {when}
              </span>
              <span className="block line-clamp-2 text-sm">{row.message}</span>
            </span>
            <StatusPill variant={statusMeta.variant} className="mt-0.5 shrink-0">
              {statusMeta.label}
            </StatusPill>
          </button>
        );
      })}
    </div>
  );
}

export default FeedbackList;
