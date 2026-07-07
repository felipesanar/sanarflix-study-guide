import * as React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GestorPanel, MetricValue } from '@/experiences/gestor/ui';
import { flattenTemas } from './curricularUtils';
import type { CurricularBreakdown, CurricularTemaNode } from '@/types/desempenhoV2';

interface OndeIntervirCardProps {
  curricular: CurricularBreakdown;
}

type ActionTag = 'CRITICO' | 'GANHO_RAPIDO' | 'RESGATE';

interface ActionItem {
  tema: CurricularTemaNode;
  impacto: number;
  tag: ActionTag;
}

const TAG_CONFIG: Record<ActionTag, { label: string; className: string }> = {
  CRITICO: {
    label: 'CRÍTICO',
    className: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  },
  GANHO_RAPIDO: {
    label: 'GANHO RÁPIDO',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  },
  RESGATE: {
    label: 'RESGATE',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  },
};

/**
 * Classifica um tema em uma tag de ação:
 * - CRÍTICO: alta prevalência (muito cobrado) e acerto muito baixo (<40%)
 * - GANHO RÁPIDO: acerto já próximo da proficiência (>=45%) — pequeno esforço destrava conceito
 * - RESGATE: acerto muito baixo mas prevalência menor — ainda prioritário, esforço maior
 */
function tagFor(tema: CurricularTemaNode, maxPrevalencia: number): ActionTag {
  const prevalenciaRelativa = maxPrevalencia > 0 ? tema.total / maxPrevalencia : 0;
  if (tema.percentual < 40 && prevalenciaRelativa >= 0.5) return 'CRITICO';
  if (tema.percentual >= 45) return 'GANHO_RAPIDO';
  return 'RESGATE';
}

/**
 * Card "Onde intervir primeiro" — 3 cards de ação derivados dos piores temas
 * da árvore curricular por impacto = prevalência (nº de questões, proxy de
 * quanto o tema pesa na prova) × (1 − % de acerto). Cada card linka para o
 * simulador de impacto do tema.
 */
export const OndeIntervirCard: React.FC<OndeIntervirCardProps> = ({ curricular }) => {
  const temas = flattenTemas(curricular).filter((t) => t.total > 0);
  if (temas.length === 0) return null;

  const maxPrevalencia = Math.max(...temas.map((t) => t.total));

  const items: ActionItem[] = temas
    .map((tema) => ({
      tema,
      impacto: tema.total * (1 - tema.percentual / 100),
      tag: tagFor(tema, maxPrevalencia),
    }))
    .sort((a, b) => b.impacto - a.impacto)
    .slice(0, 3);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.3 }}>
      <GestorPanel
        title="Onde intervir primeiro"
        subtitle="Temas priorizados por impacto no exame (prevalência × lacuna de acerto)"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {items.map(({ tema, tag }) => {
            const config = TAG_CONFIG[tag];
            return (
              <Link
                key={`${tema.areaName}-${tema.specialtyName}-${tema.name}`}
                to="/gestor/intervencao-impacto"
                className="group flex flex-col justify-between gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/30"
              >
                <div className="space-y-2">
                  <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide', config.className)}>
                    {config.label}
                  </span>
                  <p className="text-sm font-semibold text-foreground leading-snug">{tema.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {tema.areaName} · {tema.specialtyName}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <MetricValue size="lg" className="leading-none">{tema.percentual}%</MetricValue>
                    <p className="text-[11px] text-muted-foreground mt-0.5">de acerto · {tema.total} questões</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
                </div>
              </Link>
            );
          })}
        </div>
      </GestorPanel>
    </motion.div>
  );
};
