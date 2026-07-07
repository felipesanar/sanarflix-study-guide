import type { ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface AdminErrorProps {
  message: ReactNode;
  title?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

/** Estado de erro padrão do console admin — ícone + mensagem + "Tentar novamente" com retry. */
export function AdminError({
  message,
  title = 'Não foi possível carregar',
  onRetry,
  retryLabel = 'Tentar novamente',
  className,
}: AdminErrorProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-12 text-center',
        className,
      )}
    >
      <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCcw className="h-3.5 w-3.5 mr-2" /> {retryLabel}
        </Button>
      )}
    </div>
  );
}
