import { StatCard } from '@/experiences/admin/ui/StatCard';
import { cn } from '@/lib/utils';
import { FEEDBACK_CATEGORY_META, FEEDBACK_CATEGORY_ORDER, type FeedbackCategory } from './feedbackMeta';

export interface FeedbackStatCardsProps {
  counts: Record<FeedbackCategory, number>;
}

/** 4 StatCards com a contagem real por categoria de feedback. */
export function FeedbackStatCards({ counts }: FeedbackStatCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {FEEDBACK_CATEGORY_ORDER.map((key) => {
        const meta = FEEDBACK_CATEGORY_META[key];
        const Icon = meta.icon;
        return (
          <StatCard
            key={key}
            label={meta.label}
            value={counts[key] ?? 0}
            accent={meta.statAccent}
            icon={<Icon className={cn('h-4 w-4', meta.iconClassName)} />}
          />
        );
      })}
    </div>
  );
}

export default FeedbackStatCards;
