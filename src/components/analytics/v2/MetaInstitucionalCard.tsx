import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Target, TrendingUp, Award, Users, ShieldAlert } from 'lucide-react';
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
  const sancao =
    percent >= 50 && percent < 60 ? 'Proibição de aumento de vagas' :
    percent >= 40 && percent < 50 ? 'Redução de 25% das vagas' :
    percent >= 30 && percent < 40 ? 'Redução de 50% das vagas' : 'Sem sanção';

  const subCards = [
    { label: 'Gap de Proficiência', value: `${meta.gapProficiencia} pts`, icon: TrendingUp, color: 'text-amber-600 dark:text-amber-400' },
    { label: 'Nota Atual → Meta', value: `${meta.notaAtual} → ${meta.notaMeta.toFixed(2)}`, icon: Target, color: 'text-muted-foreground' },
    { label: 'Percentil Médio', value: `${meta.percentilMedio}º`, icon: Award, color: 'text-muted-foreground' },
    { label: 'Taxa de Adesão', value: `${meta.taxaAdesao}%`, icon: Users, color: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Conceito da IES', value: `${conceito} (${percent.toFixed(1)}%)`, icon: ShieldAlert, color: 'text-muted-foreground' },
    { label: 'Sanção Regul.', value: sancao, icon: ShieldAlert, color: 'text-destructive' },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.4 }}>
      <Card className="hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Meta Institucional</CardTitle>
            </div>
            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
              {meta.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Proficiência Atual</span>
              <span className="font-semibold">{meta.proficienciaAtual} / {meta.meta.toFixed(1)}</span>
            </div>
            <Progress value={meta.progresso} className="h-3" />
            <p className="text-xs text-muted-foreground text-right">{meta.progresso}% da meta</p>
          </div>

          {/* Sub-cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {subCards.map((sc) => (
              <div key={sc.label} className="flex items-center gap-3 rounded-lg border p-3">
                <sc.icon className={cn('h-4 w-4 shrink-0', sc.color)} />
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground">{sc.label}</p>
                  <p className="text-sm font-semibold">{sc.value}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
