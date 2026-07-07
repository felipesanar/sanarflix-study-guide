import * as React from 'react';
import { cn } from '@/lib/utils';

interface MetricValueProps {
  children: React.ReactNode;
  /** Tamanho tipográfico do valor. @default 'md' */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<MetricValueProps['size']>, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-2xl',
  xl: 'text-7xl',
};

/**
 * Valor numérico/quantitativo do console de Gestão — sempre em `font-mono
 * tabular-nums` (tradução do JetBrains Mono do design). Use para todo dado
 * quantitativo: percentuais, contagens, TRI, etc.
 */
export const MetricValue: React.FC<MetricValueProps> = ({ children, size = 'md', className }) => (
  <span className={cn('font-mono tabular-nums font-bold', SIZE_CLASSES[size], className)}>
    {children}
  </span>
);
