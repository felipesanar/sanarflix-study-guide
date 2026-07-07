import * as React from 'react';
import { motion } from 'framer-motion';
import { Users2 } from 'lucide-react';
import {
  SectionHeader,
  GestorLoading,
  GestorError,
  GestorEmpty,
  GestorDemoBadge,
} from '@/experiences/gestor/ui';
import { useGestorFilters } from '@/experiences/gestor/GestorFiltersProvider';
import { useGroupIesComparison } from '@/services/gestor/iesComparison';
import { useAuth } from '@/contexts/AuthContext';
import { IesCompareCard } from './IesCompareCard';
import { IesComparisonBarChart } from './IesComparisonBarChart';

const iesInitials = (nome: string): string =>
  nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
};

/**
 * Módulo "Comparar IES" (`/gestor/comparar-ies`) — só faz sentido para
 * gestores de grupo (mais de 1 IES acessível). Orquestra
 * `loading → error → empty → dados` sobre `get_group_ies_comparison`.
 */
export const CompararIesModule: React.FC = () => {
  const { filters, updateFilter, usingMock } = useGestorFilters();
  const { user } = useAuth();
  const {
    data: entries,
    isLoading,
    isError,
    refetch,
  } = useGroupIesComparison(filters.simuladoId || null);

  const activeIesId = filters.iesId || user?.id_ies;

  const corner = usingMock ? (
    <GestorDemoBadge />
  ) : entries && entries.length > 0 ? (
    <span className="text-xs text-muted-foreground">
      <span className="font-mono tabular-nums">{entries.length}</span> instituições no grupo
    </span>
  ) : undefined;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={`Grupo · ${entries?.length ?? 0} instituições`}
        title="Comparar minhas IES"
        corner={corner}
      />

      {isLoading ? (
        <GestorLoading metricCards={4} />
      ) : isError ? (
        <GestorError
          message="Não foi possível carregar o comparativo entre as IES do grupo."
          onRetry={() => refetch()}
        />
      ) : !entries || entries.length <= 1 ? (
        <GestorEmpty
          icon={Users2}
          title="Comparação disponível para gestores de grupo"
          description="Esta tela compara o desempenho entre as IES acessíveis por você. Como sua conta tem acesso a apenas uma instituição, não há o que comparar aqui."
        />
      ) : (
        <motion.div className="space-y-6" variants={containerVariants} initial="hidden" animate="show">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {entries.map((entry, i) => (
              <IesCompareCard
                key={entry.ies_id}
                entry={entry}
                initials={iesInitials(entry.ies_nome)}
                active={entry.ies_id === activeIesId}
                delayIndex={i}
                onClick={() => updateFilter('iesId', entry.ies_id)}
              />
            ))}
          </div>

          <IesComparisonBarChart entries={entries} />
        </motion.div>
      )}
    </div>
  );
};
