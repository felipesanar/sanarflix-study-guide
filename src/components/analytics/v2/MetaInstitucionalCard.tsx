import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Target, TrendingUp, Users, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { MetaInstitucional } from '@/mocks/desempenhoInstitucionalV2';

interface Props {
  meta: MetaInstitucional;
}

export const MetaInstitucionalCard: React.FC<Props> = ({ meta }) => {
  const percent = meta.percentProficientes ?? 0;
  const conceito =
    percent < 40 ? 'Conceito 1' :
    percent < 60 ? 'Conceito 2' :
    percent < 75 ? 'Conceito 3' :
    percent < 90 ? 'Conceito 4' : 'Conceito 5';

  const progressColor = meta.progresso >= 80 ? 'bg-emerald-500' : meta.progresso >= 50 ? 'bg-amber-500' : 'bg-red-500';

  const metrics = [
    { label: 'Gap de Proficiência', value: `${meta.gapProficiencia} pts`, icon: TrendingUp },
    { label: 'Taxa de Adesão', value: `${meta.taxaAdesao}%`, icon: Users },
    { label: 'Conceito Atual', value: conceito, icon: ShieldAlert },
    { label: 'Percentil Médio', value: `${meta.percentilMedio}º`, icon: Target },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.3 }}>
      <Card className="h-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Meta Institucional</CardTitle>
            <Badge
              variant="secondary"
              className={cn(
                'text-[11px]',
                meta.progresso >= 80
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
              )}
            >
              {meta.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Proficiência</span>
              <span className="font-semibold text-foreground">{meta.proficienciaAtual} / {meta.meta.toFixed(0)}</span>
            </div>
            <div className="relative">
              <Progress value={meta.progresso} className="h-2.5" />
            </div>
            <p className="text-[11px] text-muted-foreground text-right">{meta.progresso}% da meta</p>
          </div>

          {/* Key metrics */}
          <div className="grid grid-cols-2 gap-2">
            {metrics.map((m) => (
              <div key={m.label} className="rounded-lg bg-muted/30 p-2.5 space-y-0.5">
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <m.icon className="h-3 w-3" />
                  {m.label}
                </p>
                <p className="text-sm font-semibold text-foreground">{m.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
