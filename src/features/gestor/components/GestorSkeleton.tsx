import * as React from 'react';
import { cn } from '@/lib/utils';

interface GestorSkeletonProps {
  /** Altura final do bloco — reservada agora para não haver salto (CLS < 0,1, spec §8.5). */
  altura: number | string;
  rotulo?: string;
  className?: string;
}

/** Carregamento de um bloco, com a altura do conteúdo final já reservada (spec §8.4). */
export const GestorSkeleton: React.FC<GestorSkeletonProps> = ({
  altura,
  rotulo = 'Carregando',
  className,
}) => (
  <div
    role="status"
    aria-busy="true"
    aria-label={rotulo}
    style={{ minHeight: typeof altura === 'number' ? `${altura}px` : altura }}
    className={cn('w-full animate-pulse rounded-xl bg-muted/60', className)}
  />
);
