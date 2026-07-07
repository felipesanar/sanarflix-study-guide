import * as React from 'react';
import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  /** Rótulo curto em maiúsculas acima do título (ex.: "PANORAMA EXECUTIVO"). */
  eyebrow: string;
  /** Título principal da seção (H1). */
  title: string;
  /** Slot opcional no canto direito (ex.: métrica de adesão). */
  corner?: React.ReactNode;
  className?: string;
}

/**
 * Cabeçalho padrão de tela do console de Gestão: eyebrow (rótulo) + H1 + slot
 * opcional de métrica de canto (alinhado à direita em telas >= sm).
 */
export const SectionHeader: React.FC<SectionHeaderProps> = ({
  eyebrow,
  title,
  corner,
  className,
}) => (
  <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
    <div className="space-y-1">
      <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
        {eyebrow}
      </p>
      <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
        {title}
      </h1>
    </div>
    {corner && <div className="shrink-0">{corner}</div>}
  </div>
);
