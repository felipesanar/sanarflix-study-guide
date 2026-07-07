import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, FileQuestion, ListTree } from 'lucide-react';
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

const DrillRow: React.FC<{ row: DrillRowItem; onClick: () => void; onVerQuestoes: () => void }> = ({
  row,
  onClick,
  onVerQuestoes,
}) => {
  const Tag = row.navigable ? 'button' : 'div';
  return (
    <Tag
      onClick={row.navigable ? onClick : undefined}
      className={cn(
        'group w-full flex items-center gap-3 sm:gap-4 rounded-lg border border-border bg-card p-3 sm:p-4 text-left transition-all duration-200',
        row.navigable
          ? 'cursor-pointer hover:bg-accent hover:translate-x-1 hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
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
        {row.isLeaf && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onVerQuestoes();
            }}
            className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground opacity-100 transition-opacity hover:text-primary sm:opacity-0 sm:group-hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Ver questões do tema ${row.name}`}
          >
            <FileQuestion className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline whitespace-nowrap">Ver questões</span>
          </button>
        )}
        {row.navigable ? (
          <ChevronRight
            className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
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
}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleVerQuestoes = (temaNome: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tema', temaNome);
    navigate(`/gestor/simulados-questoes?${next.toString()}`);
  };

  return (
    <GestorPanel title={title} subtitle={subtitle} icon={ListTree}>
      <div className="space-y-2">
        {rows.map((row) => (
          <DrillRow
            key={row.key}
            row={row}
            onClick={() => onSelectRow(row)}
            onVerQuestoes={() => handleVerQuestoes(row.name)}
          />
        ))}
      </div>
    </GestorPanel>
  );
};
