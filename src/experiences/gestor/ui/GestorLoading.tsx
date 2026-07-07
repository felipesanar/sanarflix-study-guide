import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface GestorLoadingProps {
  /** Quantidade de cards de métrica no topo do esqueleto. @default 4 */
  metricCards?: number;
}

/**
 * Estado de carregamento padrão das telas do console de Gestão — skeletons
 * shimmer (mesmo padrão de `DesempenhoV2Skeleton`), genérico o bastante para
 * qualquer tela (KPIs + gráficos + tabela).
 */
export const GestorLoading: React.FC<GestorLoadingProps> = ({ metricCards = 4 }) => (
  <div className="space-y-4 animate-in fade-in duration-300" aria-busy="true" aria-live="polite">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {Array.from({ length: metricCards }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Skeleton className="h-72 rounded-xl" />
      <Skeleton className="h-72 rounded-xl" />
    </div>
    <Skeleton className="h-56 rounded-xl" />
  </div>
);
