import * as React from 'react';
import { motion } from 'framer-motion';
import {
  GestorLoading,
  GestorError,
  GestorEmpty,
  GestorDemoBadge,
  GestorTriPending,
} from '@/experiences/gestor/ui';
import type { InstitutionalViewModel } from '@/types/desempenhoV2';
import { MatrizPrioridadeCurricular } from './MatrizPrioridadeCurricular';
import { FilaIntervencoes } from './FilaIntervencoes';
import { SimuladorImpacto } from './SimuladorImpacto';
import { buildTemasPrioridade, sortByImpacto } from './priorizacao';

interface IntervencaoImpactoContentProps {
  data: InstitutionalViewModel | null;
  loading: boolean;
  error: string | null;
  usingMock: boolean;
  onRetry?: () => void;
}

/**
 * Orquestra loading → error → empty → dados para a tela de Intervenção &
 * Impacto. Toda a lógica de priorização (matriz + fila + simulador) deriva
 * da mesma lista de temas (`buildTemasPrioridade`) para garantir consistência
 * entre os três blocos.
 */
export const IntervencaoImpactoContent: React.FC<IntervencaoImpactoContentProps> = ({
  data,
  loading,
  error,
  usingMock,
  onRetry,
}) => {
  const temas = React.useMemo(() => {
    if (!data) return [];
    return sortByImpacto(buildTemasPrioridade(data));
  }, [data]);

  if (loading) return <GestorLoading />;

  if (error && !data) {
    return <GestorError message={error} onRetry={onRetry} />;
  }

  if (!data) {
    return (
      <GestorEmpty
        title="Sem simulado selecionado"
        description="Escolha um simulado no recorte acima para calcular a matriz de prioridade e o simulador de impacto."
      />
    );
  }

  if (data.headerSummary.triPending) {
    return <GestorTriPending />;
  }

  if (temas.length === 0) {
    return (
      <GestorEmpty
        title="Sem dados curriculares"
        description="Nenhum tema encontrado para o recorte atual. Amplie os filtros para ver a matriz de prioridade."
      />
    );
  }

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {usingMock && (
        <div className="flex justify-end">
          <GestorDemoBadge />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        <MatrizPrioridadeCurricular temas={temas} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FilaIntervencoes temas={temas} />
        <SimuladorImpacto temas={temas} headerSummary={data.headerSummary} />
      </div>
    </motion.div>
  );
};
