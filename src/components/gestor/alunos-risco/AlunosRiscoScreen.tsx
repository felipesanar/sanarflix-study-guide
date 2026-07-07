import * as React from 'react';
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  SectionHeader, GestorLoading, GestorError, GestorEmpty, GestorDemoBadge, GestorTriPending, MetricValue,
} from '@/experiences/gestor/ui';
import { GestorPanel } from '@/experiences/gestor/ui';
import { useGestorFilters } from '@/experiences/gestor/GestorFiltersProvider';
import { SegmentCards } from './SegmentCards';
import { EngagementScatterCard } from './EngagementScatterCard';
import { AlunosRiscoTable } from './AlunosRiscoTable';
import { useAlunosRisco, type SegmentoAluno } from './useAlunosRisco';

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

/**
 * Tela Alunos & Risco (`/gestor/alunos-risco`). Orquestra
 * loading → error → empty → dados sobre `useGestorFilters()` (allStudents +
 * TRI) e junta engajamento/crescimento via `useAlunosRisco`.
 */
export const AlunosRiscoScreen: React.FC = () => {
  const { filteredData, loading, error, usingMock, refetch, filters } = useGestorFilters();
  const [activeSegment, setActiveSegment] = useState<SegmentoAluno | null>(null);

  const allStudents = filteredData?.allStudents ?? [];
  const triPending = filteredData?.headerSummary.triPending ?? false;

  const {
    rows,
    segmentCounts,
    scatterData,
    engagementLoading,
    hasEngagementData,
    casoDeVirada,
    growthByStudentId,
  } = useAlunosRisco({ allStudents, iesId: filters.iesId || undefined });

  const visibleRows = useMemo(
    () => (activeSegment ? rows.filter((r) => r.segmento === activeSegment) : rows),
    [rows, activeSegment],
  );

  const corner = usingMock ? (
    <GestorDemoBadge />
  ) : (
    <div className="text-right">
      <MetricValue size="lg">{allStudents.length}</MetricValue>
      <p className="text-xs text-muted-foreground">alunos no recorte</p>
    </div>
  );

  let body: React.ReactNode;
  if (loading) {
    body = <GestorLoading metricCards={4} />;
  } else if (error) {
    body = <GestorError message={error} onRetry={refetch} />;
  } else if (!filteredData || allStudents.length === 0) {
    body = (
      <GestorEmpty
        title="Sem alunos no recorte atual"
        description="Ajuste os filtros (simulado, IES ou base ativa) para visualizar a segmentação de risco."
      />
    );
  } else if (triPending) {
    body = <GestorTriPending />;
  } else {
    body = (
      <motion.div
        className="space-y-6"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={itemVariants}>
          <SegmentCards counts={segmentCounts} active={activeSegment} onSelect={setActiveSegment} />
        </motion.div>

        <motion.div variants={itemVariants}>
          <EngagementScatterCard
            data={scatterData}
            loading={engagementLoading}
            hasEngagementSource={hasEngagementData}
            casoDeVirada={casoDeVirada}
          />
        </motion.div>

        <motion.div variants={itemVariants}>
          <GestorPanel
            title="Alunos"
            subtitle={activeSegment ? 'Filtrado pelo segmento selecionado — clique novamente no card para limpar.' : 'Todos os alunos do recorte ativo'}
          >
            <AlunosRiscoTable rows={visibleRows} growthByStudentId={growthByStudentId} />
          </GestorPanel>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Alunos & risco"
        title="Quem está em risco e quem salvar primeiro"
        corner={corner}
      />
      {body}
    </div>
  );
};
