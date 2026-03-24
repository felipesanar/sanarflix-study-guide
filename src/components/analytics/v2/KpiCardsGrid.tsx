import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Users, Target, School, BarChart3, TrendingUp, AlertTriangle, ArrowUpRight, CheckCircle, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import type { KpiData, StudentBelowExpected } from '@/mocks/desempenhoInstitucionalV2';

const iconMap: Record<string, React.ElementType> = {
  Users, Target, School, BarChart3, TrendingUp, AlertTriangle, ArrowUpRight, CheckCircle,
};

const statusColors: Record<string, string> = {
  good: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  critical: 'text-destructive',
  neutral: 'text-muted-foreground',
};

const statusBg: Record<string, string> = {
  good: 'bg-emerald-50 dark:bg-emerald-950/30',
  warning: 'bg-amber-50 dark:bg-amber-950/30',
  critical: 'bg-red-50 dark:bg-red-950/30',
  neutral: 'bg-muted/50',
};

interface Props {
  kpis: KpiData[];
  alunosAbaixo?: StudentBelowExpected[];
}

export const KpiCardsGrid: React.FC<Props> = ({ kpis, alunosAbaixo }) => {
  const [openModal, setOpenModal] = useState(false);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi, i) => {
        const Icon = iconMap[kpi.icon] || BarChart3;
        const isDetails = kpi.label === 'Alunos Abaixo do Esperado' && !!alunosAbaixo && alunosAbaixo.length > 0;
        return (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
          >
            <Card
              className={cn('transition-shadow duration-200 h-full', isDetails ? 'hover:shadow-md cursor-pointer' : 'hover:shadow-md')}
              onClick={isDetails ? () => setOpenModal(true) : undefined}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={cn('p-2 rounded-lg shrink-0', statusBg[kpi.status])}>
                    <Icon className={cn('h-5 w-5', statusColors[kpi.status])} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{kpi.label}</p>
                    <p className="text-xl font-bold mt-0.5 text-foreground">
                      {kpi.value}
                    </p>
                    {kpi.description && (
                      <p className="text-[10px] text-muted-foreground mt-1">{kpi.description}</p>
                    )}
                    {isDetails && (
                      <div className="mt-2 inline-flex items-center gap-1 text-xs text-primary">
                        <span>Ver detalhes</span>
                        <ChevronRight className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            {isDetails && (
              <Dialog open={openModal} onOpenChange={setOpenModal}>
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Alunos abaixo do esperado</DialogTitle>
                    <DialogDescription>
                      Visualize proficiência (TRI), percentual de acerto e distância até a proficiência.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-6 gap-2 text-[11px] text-muted-foreground">
                    <div>Aluno</div>
                    <div>Semestre</div>
                    <div>Proficiência (TRI)</div>
                    <div>% Acerto</div>
                    <div>Distância até 60</div>
                    <div>Status</div>
                  </div>
                  <div className="mt-2 space-y-2">
                    {alunosAbaixo!.map((aluno) => {
                      const status = aluno.proficienciaTri >= 500 ? 'Proficiente' : 'Não proficiente';
                      return (
                        <div key={aluno.nome} className="grid grid-cols-6 gap-2 text-sm">
                          <div className="truncate">{aluno.nome}</div>
                          <div>{aluno.semestre}º</div>
                          <div>{aluno.proficienciaTri}</div>
                          <div>{aluno.percentualAcerto}%</div>
                          <div>{aluno.distanciaAteProficiencia} pts</div>
                          <div className={cn('truncate', aluno.proficienciaTri >= 500 ? 'text-emerald-600' : 'text-destructive')}>
                            {status}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </motion.div>
        );
      })}
    </div>
  );
};
