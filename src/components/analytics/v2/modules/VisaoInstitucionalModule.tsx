import React from 'react';
import { AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

import { KpiCardsGrid } from '@/components/analytics/v2/KpiCardsGrid';
import { FaixaDistribuicaoChart } from '@/components/analytics/v2/FaixaDistribuicaoChart';
import { MetaInstitucionalCard } from '@/components/analytics/v2/MetaInstitucionalCard';
import { EvolucaoChart } from '@/components/analytics/v2/EvolucaoChart';
import { DistanciaFaixaCards } from '@/components/analytics/v2/DistanciaFaixaCards';
import { DesempenhoV2Skeleton } from '@/components/analytics/v2/DesempenhoV2Skeleton';
import { ModuleEmptyState } from '@/components/analytics/v2/shell/ModuleEmptyState';
import { Card, CardContent } from '@/components/ui/card';
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
        <CardContent className="flex flex-col items-center justify-center py-14 text-center">
          <div className="p-3 rounded-full bg-destructive/10 mb-3">
            <AlertCircle className="h-5 w-5 text-destructive" />
          </div>
          <h3 className="text-base font-semibold mb-1">Erro ao carregar dados</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-4">{error}</p>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>Tentar novamente</Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-14 text-center">
          <h3 className="text-base font-semibold mb-1">Selecione um simulado</h3>
          <p className="text-sm text-muted-foreground">Escolha um simulado nos filtros acima para começar.</p>
        </CardContent>
      </Card>
    );
  }

  if (data.headerSummary.totalAlunos === 0) {
    return (
      <ModuleEmptyState
        title="Sem resultados"
        description="Nenhum aluno encontrado com os filtros aplicados. Ajuste os filtros para continuar."
      />
    );
  }

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      {/* KPIs */}
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

      {/* Distância para próxima faixa — clean cards */}
      <DistanciaFaixaCards items={data.distanciaFaixa} />

      {/* Meta + Evolução */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MetaInstitucionalCard meta={data.meta} />
        <EvolucaoChart evolucao={data.evolucao} />
      </div>

      {/* Distribuição por faixa full-width */}
      <FaixaDistribuicaoChart faixas={data.faixas} />
    </motion.div>
  );
};
