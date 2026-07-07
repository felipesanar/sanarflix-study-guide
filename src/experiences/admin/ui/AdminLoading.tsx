import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface AdminLoadingProps {
  /** Quantidade de linhas de skeleton. */
  rows?: number;
  /** Classe de altura de cada linha (tailwind), ex.: 'h-10'. */
  rowHeight?: string;
  className?: string;
}

/** Estado de carregamento padrão do console admin — skeletons parametrizáveis por linhas/altura. */
export function AdminLoading({ rows = 5, rowHeight = 'h-10', className }: AdminLoadingProps) {
  return (
    <div className={cn('space-y-2', className)} role="status" aria-label="Carregando">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={cn('w-full rounded-lg', rowHeight)} />
      ))}
    </div>
  );
}
