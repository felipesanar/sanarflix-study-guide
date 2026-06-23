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
  baseMode?: 'sixth-year' | 'general' | 'semestres';
}

export const VisaoInstitucionalModule: React.FC<Props> = ({ data, loading, error, onRetry, baseMode }) => {
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
    const isSemestresMode = baseMode === 'semestres';
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-14 text-center">
          <h3 className="text-base font-semibold mb-1">
            {isSemestresMode ? 'Selecione ao menos um semestre' : 'Selecione um simulado'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isSemestresMode
              ? 'Escolha um ou mais semestres no filtro acima para visualizar os dados desta base.'
              : 'Escolha um simulado nos filtros acima para começar.'}
          </p>
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

  const nAlunos = data.headerSummary.totalAlunos;
  const mode = data.headerSummary.conceitoMode;
  const fallback = !!data.headerSummary.sixthYearFallback;
  const semestresAtivos = data.headerSummary.semestresAtivos ?? [];

  let baseDescricao: string;
  if (mode === 'semestres' && semestresAtivos.length > 0) {
    baseDescricao = `Semestre(s): ${[...semestresAtivos].sort((a, b) => a - b).join(', ')}`;
  } else if (mode === 'general') {
    baseDescricao = 'Geral — todos os alunos que fizeram a prova';
  } else {
    baseDescricao = '6º ano (11º e 12º semestres)';
  }

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      {/* Recorte ativo — única indicação de base */}
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xs text-muted-foreground px-1">
        <span>
          Analisando <span className="font-semibold text-foreground">{nAlunos}</span>{' '}
          {nAlunos === 1 ? 'aluno' : 'alunos'}
          {' · '}
          Base: <span className="font-medium text-foreground">{baseDescricao}</span>
          {data.headerSummary.conceitoScoped && (
            <>
              {' · '}
              {(mode === 'general' || fallback) ? 'Conceito oficial:' : 'Conceito previsto:'}{' '}
              <span className="font-semibold text-foreground">{data.headerSummary.conceitoScoped}</span>
            </>
          )}
        </span>
        {fallback && (
          <span className="text-amber-600 dark:text-amber-400">
            · Sem alunos do 6º ano — exibindo base geral
          </span>
        )}
      </div>


      {/* KPIs */}
      <KpiCardsGrid
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
