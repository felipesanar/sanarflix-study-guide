import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { GestorPanel, MetricValue, StatusBadge } from '@/experiences/gestor/ui';
import { cn } from '@/lib/utils';
import { StatusProgressBar } from './StatusProgressBar';
import type { DrillRowItem } from './types';

interface CurricularDrillListProps {
  /** Título do nível atual (ex.: "Grandes áreas", "Clínica Médica", "Cardiologia"). */
  title: string;
  /** "acerto médio · nº questões" do recorte atual (nível selecionado). */
  subtitle: string;
  rows: DrillRowItem[];
  onSelectRow: (row: DrillRowItem) => void;
}

const DrillRow: React.FC<{ row: DrillRowItem; onClick: () => void }> = ({ row, onClick }) => {
  const Tag = row.navigable ? 'button' : 'div';
  return (
    <Tag
      onClick={row.navigable ? onClick : undefined}
      className={cn(
        'w-full flex items-center gap-3 sm:gap-4 rounded-lg border border-border bg-card p-3 sm:p-4 text-left transition-colors',
        row.navigable
          ? 'cursor-pointer hover:bg-accent/40 hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          : 'cursor-default',
      )}
    >
      <div className="min-w-0 flex-1 space-y-2">
        <span className="block truncate text-sm font-medium text-foreground">{row.name}</span>
        <StatusProgressBar percent={row.percentual} />
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <MetricValue size="sm" className="w-11 text-right">
          {Math.round(row.percentual)}%
        </MetricValue>
        <span className="hidden text-xs text-muted-foreground sm:inline whitespace-nowrap">
          {row.total} questões
        </span>
        <StatusBadge percent={row.percentual} />
        {row.navigable ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        ) : (
          <span className="inline-block h-4 w-4" aria-hidden="true" />
        )}
      </div>
    </Tag>
  );
};

/**
 * Lista drill-down do diagnóstico curricular — usada para os 3 níveis
 * (grandes áreas, especialidades, temas). O nível folha (tema) renderiza
 * linhas não-navegáveis (sem chevron, cursor default).
 */
export const CurricularDrillList: React.FC<CurricularDrillListProps> = ({
  title,
  subtitle,
  rows,
  onSelectRow,
}) => (
  <GestorPanel title={title} subtitle={subtitle}>
    <div className="space-y-2">
      {rows.map((row) => (
        <DrillRow key={row.key} row={row} onClick={() => onSelectRow(row)} />
      ))}
    </div>
  </GestorPanel>
);
