import * as React from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useGestorFilters } from '@/experiences/gestor/GestorFiltersProvider';
import {
  SectionHeader,
  GestorLoading,
  GestorError,
  GestorEmpty,
  GestorDemoBadge,
  GestorTriPending,
} from '@/experiences/gestor/ui';
import { EvolucaoChart } from '@/components/analytics/v2/EvolucaoChart';
import { FaixaDistribuicaoChart } from '@/components/analytics/v2/FaixaDistribuicaoChart';
import {
  ConceitoMecCard,
  WhatChangedCard,
  OndeIntervirCard,
  AdesaoCorner,
  getPiorTema,
} from '@/components/gestor/panorama';

/** Panorama executivo do gestor (`/gestor/panorama`). */
const PanoramaPage: React.FC = () => {
  const { user } = useAuth();
  const { filteredData: data, loading, error, usingMock, refetch, filters } = useGestorFilters();

  const accessibleIes = user?.accessible_ies ?? [];
  const isMultiIes = accessibleIes.length > 1;
  const activeIesNome = isMultiIes
    ? (accessibleIes.find((ies) => ies.id === filters.iesId)?.nome ?? accessibleIes[0]?.nome ?? user?.ies_nome)
    : user?.ies_nome;
  const iesLabel = activeIesNome ?? 'a IES';

  if (loading) {
    return (
      <div className="space-y-6">
        <SectionHeader eyebrow="Panorama executivo" title={`Como está ${iesLabel} agora`} />
        <GestorLoading metricCards={3} />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-6">
        <SectionHeader eyebrow="Panorama executivo" title={`Como está ${iesLabel} agora`} />
        <GestorError message={error} onRetry={refetch} />
      </div>
    );
  }

  if (!data) {
    const isSemestresMode = filters.baseMode === 'semestres';
    return (
      <div className="space-y-6">
        <SectionHeader eyebrow="Panorama executivo" title={`Como está ${iesLabel} agora`} />
        <GestorEmpty
          title={isSemestresMode ? 'Selecione ao menos um semestre' : 'Selecione um simulado'}
          description={
            isSemestresMode
              ? 'Escolha um ou mais semestres no filtro acima para visualizar o panorama desta base.'
              : 'Escolha um simulado nos filtros acima para começar.'
          }
        />
      </div>
    );
  }

  if (data.headerSummary.totalAlunos === 0) {
    return (
      <div className="space-y-6">
        <SectionHeader eyebrow="Panorama executivo" title={`Como está ${iesLabel} agora`} />
        <GestorEmpty title="Sem resultados" description="Nenhum aluno encontrado com os filtros aplicados. Ajuste os filtros para continuar." />
      </div>
    );
  }

  const { headerSummary, meta, evolucao, faixas, curricular } = data;

  const respondentes = meta.totalStudentsSimulado ?? headerSummary.totalAlunos;
  // totalIesUsers só é confiável quando > 0 (RPC real); no mock ou quando
  // ausente, usamos a taxa de adesão já calculada em `meta.taxaAdesao`.
  const hasRealAdesaoBase = !!meta.totalIesUsers && meta.totalIesUsers > 0;
  const baseAdesao = hasRealAdesaoBase ? (meta.totalIesUsers as number) : respondentes;
  const adesaoPercent = hasRealAdesaoBase
    ? Math.round((respondentes / baseAdesao) * 100)
    : Math.round(meta.taxaAdesao);

  const footerKpis = [
    { label: 'Proficientes', value: headerSummary.percentProficientes !== null ? `${headerSummary.percentProficientes}%` : '—' },
    { label: 'TRI médio', value: meta.proficienciaAtual ? Math.round(meta.proficienciaAtual) : '—' },
    { label: 'Total de alunos', value: headerSummary.totalAlunos },
  ];

  const piorTema = getPiorTema(curricular);

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <SectionHeader
        eyebrow="Panorama executivo"
        title={`Como está ${iesLabel} agora`}
        corner={<AdesaoCorner percent={adesaoPercent} respondentes={respondentes} base={baseAdesao} />}
      />

      {usingMock && <GestorDemoBadge />}

      {headerSummary.triPending ? (
        <GestorTriPending />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ConceitoMecCard headerSummary={headerSummary} footerKpis={footerKpis} />
            <WhatChangedCard evolucao={evolucao} piorTema={piorTema ? { nome: piorTema.name, percentual: piorTema.percentual } : null} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <EvolucaoChart evolucao={evolucao} />
            <FaixaDistribuicaoChart faixas={faixas} />
          </div>

          <OndeIntervirCard curricular={curricular} />
        </>
      )}
    </motion.div>
  );
};

export default PanoramaPage;
