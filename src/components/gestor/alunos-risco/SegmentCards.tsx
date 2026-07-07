import * as React from 'react';
import { motion } from 'framer-motion';
import { Shield, Zap, TrendingDown, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MetricValue } from '@/experiences/gestor/ui';
import type { SegmentoAluno } from './useAlunosRisco';

interface SegmentDef {
  value: SegmentoAluno;
  label: string;
  description: string;
  icon: React.ElementType;
  colorClass: string;
  ringClass: string;
  iconBgClass: string;
}

const SEGMENTS: SegmentDef[] = [
  {
    value: 'proficiente',
    label: 'Proficientes',
    description: 'TRI ≥ 500',
    icon: Shield,
    colorClass: 'text-emerald-600 dark:text-emerald-400',
    ringClass: 'ring-emerald-500',
    iconBgClass: 'bg-emerald-500/10',
  },
  {
    value: 'proximo',
    label: 'Próximos',
    description: 'A até 50 pts de 500',
    icon: Zap,
    colorClass: 'text-primary',
    ringClass: 'ring-primary',
    iconBgClass: 'bg-primary/10',
  },
  {
    value: 'abaixo',
    label: 'Abaixo',
    description: 'Fora da faixa de proficiência',
    icon: TrendingDown,
    colorClass: 'text-amber-600 dark:text-amber-400',
    ringClass: 'ring-amber-500',
    iconBgClass: 'bg-amber-500/10',
  },
  {
    value: 'critico',
    label: 'Risco crítico',
    description: '< 45% de acerto',
    icon: AlertTriangle,
    colorClass: 'text-red-600 dark:text-red-400',
    ringClass: 'ring-red-500',
    iconBgClass: 'bg-red-500/10',
  },
];

interface SegmentCardsProps {
  counts: Record<SegmentoAluno, number>;
  active: SegmentoAluno | null;
  onSelect: (segment: SegmentoAluno | null) => void;
}

/**
 * 4 cards-segmento clicáveis (Proficientes / Próximos / Abaixo / Risco
 * crítico) que filtram a tabela de alunos. Clicar no segmento já ativo
 * limpa o filtro. Contagens são derivadas de `allStudents` + TRI — nunca
 * estimadas.
 */
export const SegmentCards: React.FC<SegmentCardsProps> = ({ counts, active, onSelect }) => (
  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
    {SEGMENTS.map((seg, i) => {
      const Icon = seg.icon;
      const isActive = active === seg.value;
      return (
        <motion.button
          key={seg.value}
          type="button"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, duration: 0.3 }}
          whileHover={{ scale: 1.01, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelect(isActive ? null : seg.value)}
          className={cn(
            'rounded-lg border border-border bg-card p-4 text-left shadow-none transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isActive && `ring-2 ${seg.ringClass} border-transparent`,
          )}
          aria-pressed={isActive}
        >
          <div className="flex items-center justify-between">
            <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', seg.iconBgClass)}>
              <Icon className={cn('h-4 w-4', seg.colorClass)} aria-hidden="true" />
            </div>
            <MetricValue size="lg" className={seg.colorClass}>{counts[seg.value]}</MetricValue>
          </div>
          <p className="mt-3 text-sm font-semibold text-foreground">{seg.label}</p>
          <p className="text-xs text-muted-foreground">{seg.description}</p>
        </motion.button>
      );
    })}
  </div>
);
