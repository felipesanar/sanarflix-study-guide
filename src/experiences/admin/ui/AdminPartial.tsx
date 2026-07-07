import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface AdminPartialProps {
  ok: number;
  falhas: number;
  /** Ação "Ver falhas" / "Baixar relatório de falhas". */
  onViewFailures?: () => void;
  viewFailuresLabel?: string;
  className?: string;
}

/** Banner de sucesso parcial: "N ok · N falhas" + ação para ver/baixar as falhas. */
export function AdminPartial({ ok, falhas, onViewFailures, viewFailuresLabel = 'Ver falhas', className }: AdminPartialProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-amber-500/10 px-4 py-3',
        className,
      )}
    >
      <p className="text-sm">
        <span className="font-mono font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{ok} ok</span>
        <span className="text-muted-foreground"> · </span>
        <span className="font-mono font-semibold tabular-nums text-red-600 dark:text-red-400">
          {falhas} falha{falhas === 1 ? '' : 's'}
        </span>
      </p>
      {onViewFailures && falhas > 0 && (
        <Button variant="outline" size="sm" onClick={onViewFailures}>
          <Download className="h-3.5 w-3.5 mr-2" /> {viewFailuresLabel}
        </Button>
      )}
    </div>
  );
}
