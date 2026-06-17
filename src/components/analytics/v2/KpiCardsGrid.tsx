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

const statusAccent: Record<string, string> = {
  good: 'border-l-emerald-500',
  warning: 'border-l-amber-500',
  critical: 'border-l-red-500',
  neutral: 'border-l-border',
};

const statusIconColor: Record<string, string> = {
  good: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  critical: 'text-destructive',
  neutral: 'text-muted-foreground',
};

interface Props {
  kpis: KpiData[];
  alunosAbaixo?: StudentBelowExpected[];
  /** Mostra selo "Base: ..." nos cards quando `kpi.baseLabel` está presente */
  showBaseBadge?: boolean;
}

export const KpiCardsGrid: React.FC<Props> = ({ kpis, alunosAbaixo, showBaseBadge = true }) => {
  const [openModal, setOpenModal] = useState(false);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {kpis.map((kpi, i) => {
        const Icon = iconMap[kpi.icon] || BarChart3;
        const isDetails = kpi.label === 'Alunos Abaixo do Esperado' && !!alunosAbaixo && alunosAbaixo.length > 0;
        const showBadge = showBaseBadge && !!kpi.baseLabel;
        return (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.25 }}
          >
            <Card
              className={cn(
                'border-l-[3px] transition-all duration-200 h-full',
                statusAccent[kpi.status],
                isDetails && 'hover:shadow-md cursor-pointer group'
              )}
              onClick={isDetails ? () => setOpenModal(true) : undefined}
            >
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={cn('h-4 w-4', statusIconColor[kpi.status])} />
                  <p className="text-[11px] text-muted-foreground truncate">{kpi.label}</p>
                  {showBadge && (
                    <span className="ml-auto shrink-0 text-[9px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border" title={`Base ativa: ${kpi.baseLabel}`}>
                      {kpi.baseLabel}
                    </span>
                  )}
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight leading-none">
                  {kpi.value}
                </p>
                {kpi.description && (
                  <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-1">{kpi.description}</p>
                )}
                {isDetails && (
                  <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-primary font-medium group-hover:gap-1.5 transition-all">
                    <span>Ver alunos</span>
                    <ChevronRight className="h-3 w-3" />
                  </div>
                )}
              </CardContent>
            </Card>
            {isDetails && (
              <Dialog open={openModal} onOpenChange={setOpenModal}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-base">Alunos abaixo do esperado</DialogTitle>
                    <DialogDescription className="text-xs">
                      Percentual de acerto e distância até a proficiência.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-xs text-muted-foreground">
                          <th className="text-left py-2 pr-4 font-medium">Aluno</th>
                          <th className="text-center py-2 px-2 font-medium">Proficiência (TRI)</th>
                          <th className="text-center py-2 px-2 font-medium">Acerto</th>
                          <th className="text-center py-2 px-2 font-medium">Distância</th>
                          <th className="text-center py-2 pl-2 font-medium">Sem.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {alunosAbaixo!.map((aluno) => (
                          <tr key={aluno.nome} className="border-b border-border/40 last:border-0">
                            <td className="py-2 pr-4 truncate max-w-[180px]">{aluno.nome}</td>
                            <td className="py-2 px-2 text-center font-medium">{aluno.proficienciaTri}</td>
                            <td className="py-2 px-2 text-center font-medium">{aluno.percentualAcerto}%</td>
                            <td className="py-2 px-2 text-center font-medium">{aluno.distanciaAteProficiencia} pts</td>
                            <td className="py-2 pl-2 text-center font-medium">{aluno.semestre}º</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
