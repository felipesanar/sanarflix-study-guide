import React, { useEffect, useState } from 'react';
import { Target } from 'lucide-react';
import { motion } from 'framer-motion';

import { KpiCardsGrid } from '@/components/analytics/v2/KpiCardsGrid';
import { FaixaDistribuicaoChart } from '@/components/analytics/v2/FaixaDistribuicaoChart';
import { MetaInstitucionalCard } from '@/components/analytics/v2/MetaInstitucionalCard';
import { EvolucaoChart } from '@/components/analytics/v2/EvolucaoChart';
import { DesempenhoV2Skeleton } from '@/components/analytics/v2/DesempenhoV2Skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

import {
  mockKpis,
  mockFaixas,
  mockMeta,
  mockEvolucao,
  mockDistanciaFaixa,
  mockAlunosAbaixo,
} from '@/mocks/desempenhoInstitucionalV2';

import type { DesempenhoV2Filters } from '@/types/desempenhoV2';

interface Props {
  filters: DesempenhoV2Filters;
}

export const VisaoInstitucionalModule: React.FC<Props> = ({ filters }) => {
  const [loading, setLoading] = useState(true);

  const distanciaFaixaParsed = mockDistanciaFaixa.map((item) => {
    const match = String(item.value).match(/\d+/);
    const count = match ? Number(match[0]) : 0;
    return { ...item, count };
  });
  const distanciaFaixaTotal = distanciaFaixaParsed.reduce((acc, item) => acc + item.count, 0);

  useEffect(() => {
    console.log('[DesempenhoV2:VisaoInstitucional]', 'Module mounted, filters:', filters);
    const timer = setTimeout(() => {
      setLoading(false);
      console.log('[DesempenhoV2:VisaoInstitucional]', 'Mock data loaded');
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  if (loading) return <DesempenhoV2Skeleton />;

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <KpiCardsGrid kpis={mockKpis} alunosAbaixo={mockAlunosAbaixo} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MetaInstitucionalCard meta={mockMeta} />
        <Card className="hover:shadow-md transition-shadow duration-200">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Distância para Próxima Faixa</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {distanciaFaixaParsed.map((item) => {
              const percent = distanciaFaixaTotal > 0 ? (item.count / distanciaFaixaTotal) * 100 : 0;
              return (
                <div key={item.label} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-semibold">{item.count} alunos</span>
                  </div>
                  <Progress value={percent} className="h-3" />
                  <p className="text-xs text-muted-foreground text-right">{Math.round(percent)}% do total</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FaixaDistribuicaoChart faixas={mockFaixas} />
        <EvolucaoChart evolucao={mockEvolucao} />
      </div>
    </motion.div>
  );
};
