import * as React from 'react';
import { Button } from '@/components/ui/button';

/** Mensagem de erro com "Tentar de novo" — padrão dos estados de falha do portal do mentor. */
export const EstadoErro: React.FC<{ mensagem: string; onRetry: () => void }> = ({ mensagem, onRetry }) => (
  <div role="alert" className="flex flex-col items-start gap-2 text-sm">
    <p className="text-destructive">{mensagem}</p>
    <Button variant="outline" size="sm" onClick={onRetry}>
      Tentar de novo
    </Button>
  </div>
);
