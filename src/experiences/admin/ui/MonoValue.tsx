import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface MonoValueProps {
  children: ReactNode;
  /** Aplica text-muted-foreground (ex.: valores secundários/"—"). */
  muted?: boolean;
  className?: string;
}

/** Número, ID, e-mail ou timestamp em `font-mono tabular-nums` — vocabulário do console admin. */
export function MonoValue({ children, muted, className }: MonoValueProps) {
  return <span className={cn('font-mono tabular-nums', muted && 'text-muted-foreground', className)}>{children}</span>;
}
