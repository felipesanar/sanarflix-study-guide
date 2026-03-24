import React from 'react';
import { Target, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

import { KpiCardsGrid } from '@/components/analytics/v2/KpiCardsGrid';
import { FaixaDistribuicaoChart } from '@/components/analytics/v2/FaixaDistribuicaoChart';
import { MetaInstitucionalCard } from '@/components/analytics/v2/MetaInstitucionalCard';
import { EvolucaoChart } from '@/components/analytics/v2/EvolucaoChart';
import { DesempenhoV2Skeleton } from '@/components/analytics/v2/DesempenhoV2Skeleton';
import { ModuleEmptyState } from '@/components/analytics/v2/shell/ModuleEmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

import type { InstitutionalViewModel } from '@/types/desempenhoV2';

interface Props {
  data: InstitutionalViewModel | null;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
}

export const VisaoInstitucionalModule: React.FC<Props> = ({ data, loading, error, onRetry }) => {
  if (loading) return <DesempenhoV2Skeleton />;

  if (error && !data) {
    return (
      <Card className="border-dashed border-destructive/30">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-3 rounded-full bg-destructive/10 mb-4">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Erro ao carregar dados</h3>
          <p className="text-sm text-muted-foreground max-w-md mb-4">{error}</p>
          {onRetry && (
            <Button variant="outline" onClick={onRetry}>Tentar novamente</Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <h3 className="text-lg font-semibold mb-2">Selecione um simulado</h3>
          <p className="text-sm text-muted-foreground">Escolha um simulado nos filtros acima para visualizar os dados.</p>
        </CardContent>
      </Card>
    );
  }

  if (data.headerSummary.totalAlunos === 0) {
    return (
      <ModuleEmptyState
        title="Sem resultados para o recorte atual"
        description="Nenhum aluno foi encontrado com os filtros aplicados. Revise os filtros globais."
      />
    );
  }

  const distanciaFaixaParsed = data.distanciaFaixa.map((item) => {
    const match = String(item.value).match(/\d+/);
    const count = match ? Number(match[0]) : 0;
    return { ...item, count };
  });
  const distanciaFaixaTotal = distanciaFaixaParsed.reduce((acc, item) => acc + item.count, 0);

  console.log('[VisaoInstitucional]', 'Render do módulo', {
    totalAlunos: data.headerSummary.totalAlunos,
    percentProficientes: data.headerSummary.percentProficientes,
  });

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <KpiCardsGrid
        kpis={data.kpis}
        alunosAbaixo={data.alunosAbaixo.map((s) => ({
          nome: s.nome,
          proficienciaTri: s.percentual,
          percentualAcerto: s.percentual,
          distanciaAteProficiencia: Math.round(60 - s.percentual),
          turma: '',
          periodo: '',
          semestre: s.semestre,
        }))}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MetaInstitucionalCard meta={data.meta} />
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
        <FaixaDistribuicaoChart faixas={data.faixas} />
        <EvolucaoChart evolucao={data.evolucao} />
      </div>
    </motion.div>
  );
};
