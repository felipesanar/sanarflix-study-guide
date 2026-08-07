import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Users, ShieldAlert, Target } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { MetaInstitucional } from '@/mocks/desempenhoInstitucionalV2';

interface Props {
  meta: MetaInstitucional;
}

const CONCEITO_THRESHOLDS = [
  { min: 0, max: 40, conceito: 1 },
  { min: 40, max: 60, conceito: 2 },
  { min: 60, max: 75, conceito: 3 },
  { min: 75, max: 90, conceito: 4 },
  { min: 90, max: 100, conceito: 5 },
];

function getConceitoInfo(percentProficientes: number) {
  const current = CONCEITO_THRESHOLDS.find(
    (t) => percentProficientes < t.max
  ) ?? CONCEITO_THRESHOLDS[CONCEITO_THRESHOLDS.length - 1];

  const currentConceito = current.conceito;
  const previousThreshold = current.min;
  const nextThreshold = current.max;
  const isTop = currentConceito === 5 && percentProficientes >= 90;
  const gap = isTop ? 0 : Math.round((nextThreshold - percentProficientes) * 10) / 10;

  // Progress toward next threshold from previous threshold
  const range = nextThreshold - previousThreshold;
  const covered = percentProficientes - previousThreshold;
  const progressPercent = range > 0 ? Math.min(100, Math.round((covered / range) * 1000) / 10) : 100;

  return { currentConceito, previousThreshold, nextThreshold, gap, progressPercent, isTop };
}

export const MetaInstitucionalCard: React.FC<Props> = ({ meta }) => {
  const percent = meta.percentProficientes ?? 0;
  const info = getConceitoInfo(percent);

  const taxaAdesao = (meta.totalIesUsers && meta.totalIesUsers > 0 && meta.totalStudentsSimulado !== undefined)
    ? Math.round((meta.totalStudentsSimulado / meta.totalIesUsers) * 1000) / 10
    : meta.taxaAdesao;

  const sancaoLabel = meta.sancaoRegulatoriaLabel ?? 'Nenhuma';

  const metrics = [
    {
      label: 'Gap de Proficiência',
      value: info.isTop ? '0 p.p.' : `${info.gap} p.p.`,
      icon: TrendingUp,
    },
    {
      label: 'Taxa de Adesão',
      value: `${taxaAdesao}%`,
      icon: Users,
    },
    {
      label: 'Conceito Atual',
      value: `Conceito ${info.currentConceito}`,
      icon: Target,
    },
    {
      label: 'Sanção Regulatória',
      value: sancaoLabel,
      icon: ShieldAlert,
    },
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
                info.isTop
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                  : info.progressPercent >= 50
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400'
              )}
            >
              {info.isTop ? 'Meta alcançada' : meta.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">Conceito {info.currentConceito}</span>
              <span className="text-xs text-muted-foreground">
                {info.isTop
                  ? 'Conceito 5 alcançado'
                  : `${info.progressPercent}% do caminho para Conceito ${info.currentConceito + 1}`}
              </span>
            </div>
            <div className="relative">
              <Progress value={info.progressPercent} className="h-2.5" />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>{info.previousThreshold}%</span>
                <span className="font-medium text-foreground">{percent}% proficientes</span>
                <span>{info.isTop ? '100%' : `${info.nextThreshold}%`}</span>
              </div>
            </div>
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
