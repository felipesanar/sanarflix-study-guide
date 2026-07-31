import * as React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EstadoErroProps {
  titulo?: string;
  descricao?: string;
  /** Refaz APENAS a query deste bloco (spec §8.4). */
  onRetry: () => void;
  altura?: number | string;
  className?: string;
}

/** Falha de um bloco, com retry local — a tela inteira continua utilizável. */
export const EstadoErro: React.FC<EstadoErroProps> = ({
  titulo = 'Não foi possível carregar este bloco',
  descricao,
  onRetry,
  altura,
  className,
}) => (
  <div
    role="alert"
    style={altura ? { minHeight: typeof altura === 'number' ? `${altura}px` : altura } : undefined}
    className={cn(
      'flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center',
      className,
    )}
  >
    <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
    <p className="text-sm font-medium text-foreground">{titulo}</p>
    {descricao && <p className="max-w-sm text-xs text-muted-foreground">{descricao}</p>}
    <Button variant="outline" size="sm" className="mt-1 gap-1.5 text-xs" onClick={onRetry}>
      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
      Tentar novamente
    </Button>
  </div>
);
