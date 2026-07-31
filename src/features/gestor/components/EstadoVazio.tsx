import * as React from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EstadoVazioProps {
  titulo: string;
  descricao?: string;
  altura?: number | string;
  className?: string;
}

/**
 * Bloco sem dado. Nunca preenche lacuna com zero, média ou estimativa
 * (spec §4.10) — diz que não há dado e para de falar.
 */
export const EstadoVazio: React.FC<EstadoVazioProps> = ({
  titulo,
  descricao,
  altura,
  className,
}) => (
  <div
    style={altura ? { minHeight: typeof altura === 'number' ? `${altura}px` : altura } : undefined}
    className={cn(
      'flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-6 text-center',
      className,
    )}
  >
    <Inbox className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
    <p className="text-sm font-medium text-foreground">{titulo}</p>
    {descricao && <p className="max-w-sm text-xs text-muted-foreground">{descricao}</p>}
  </div>
);
