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

  const isScoped = !!data.headerSummary.isSemestreScoped;
  const semestresAtivos = data.headerSummary.semestresAtivos ?? [];
  const nAlunos = data.headerSummary.totalAlunos;
  const scopeLabel = !isScoped
    ? 'da IES'
    : semestresAtivos.length === 1
      ? `do ${semestresAtivos[0]}º semestre`
      : `dos semestres ${semestresAtivos.join(', ')}`;

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      {/* Recorte ativo */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>
          Analisando <span className="font-semibold text-foreground">{nAlunos}</span>{' '}
          {nAlunos === 1 ? 'aluno' : 'alunos'} <span>{scopeLabel}</span>
          {data.headerSummary.conceitoScoped && (
            <>
              {' · '}
              Conceito previsto:{' '}
              <span className="font-semibold text-foreground">{data.headerSummary.conceitoScoped}</span>
              {data.headerSummary.conceitoMode === 'sixth-year' && !data.headerSummary.sixthYearFallback && (
                <span className="text-muted-foreground/80"> (base 6º ano)</span>
              )}
              {data.headerSummary.conceitoMode === 'general' && (
                <span className="text-muted-foreground/80"> (base geral)</span>
              )}
            </>
          )}
        </span>
        {isScoped && (
          <span className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground">
            Recorte por semestre ativo
          </span>
        )}
      </div>


      {/* KPIs */}
      <KpiCardsGrid
        showInstitutionalBadge={isScoped}
        kpis={data.kpis}
        alunosAbaixo={data.alunosAbaixo.map((s) => {
          const hasTri = s.triScore !== null && s.triScore !== undefined;
          const triRef = hasTri ? (s.triScore as number) : s.percentual;
          return {
            nome: s.nome,
            proficienciaTri: hasTri ? Math.round(triRef) : Math.round(s.percentual),
            percentualAcerto: Math.round(s.percentual),
            distanciaAteProficiencia: Math.max(0, Math.round(60 - triRef)),
            turma: '',
            periodo: '',
            semestre: s.semestre,
          };
        })}
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
