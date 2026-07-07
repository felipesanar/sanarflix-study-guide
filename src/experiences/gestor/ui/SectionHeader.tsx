import * as React from 'react';
import { motion } from 'framer-motion';
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
 * opcional de métrica de canto (alinhado à direita em telas >= sm). Entra com
 * motion sutil fade+y (padrão dos heros de tela da Home do aluno).
 */
export const SectionHeader: React.FC<SectionHeaderProps> = ({
  eyebrow,
  title,
  corner,
  className,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, ease: 'easeOut' }}
    className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}
  >
    <div className="space-y-1">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {eyebrow}
      </p>
      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-foreground">
        {title}
      </h1>
    </div>
    {corner && <div className="shrink-0">{corner}</div>}
  </motion.div>
);
