import * as React from 'react';
import { ListOrdered } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GestorPanel, MetricValue } from '@/experiences/gestor/ui';
import { PRIORITY_TAG_CONFIG, priorityTagFromAcerto, type TemaPrioridade } from './priorizacao';

interface FilaIntervencoesProps {
  temas: TemaPrioridade[];
}

/**
 * Fila de intervenções priorizada — mesma lista de temas da matriz, ordenada
 * por impacto (prevalência × (1 − acerto)), maior impacto primeiro.
 */
export const FilaIntervencoes: React.FC<FilaIntervencoesProps> = ({ temas }) => (
  <GestorPanel
    title="Fila de intervenções priorizada"
    subtitle="Ordenada por impacto = prevalência no exame × (1 − % de acerto)"
    icon={ListOrdered}
  >
    <ul className="space-y-2">
      {temas.map((t) => {
        const tag = priorityTagFromAcerto(t.acerto);
        const cfg = PRIORITY_TAG_CONFIG[tag];
        return (
          <li
            key={t.id}
            className={cn(
              'flex items-center justify-between gap-3 rounded-lg border border-l-4 bg-card px-3 py-2.5 transition-colors hover:bg-accent/40',
              cfg.borderClassName,
            )}
          >
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-foreground truncate">{t.tema}</span>
                <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide shrink-0', cfg.className)}>
                  {cfg.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {t.area} · {t.questoes} questões · {t.prevalencia.toFixed(1)}% do exame
              </p>
            </div>
            <MetricValue size="lg" className="shrink-0 text-foreground">
              {t.acerto.toFixed(0)}%
            </MetricValue>
          </li>
        );
      })}
    </ul>
  </GestorPanel>
);
