import * as React from 'react';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Meta } from '@/features/gestor/api/types';

const formatarData = (iso: string): string => {
  const data = new Date(iso);
  return Number.isNaN(data.getTime())
    ? '—'
    : data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/**
 * Rastreabilidade de um indicador: Período · Fonte · Atualizado em · Critério
 * (spec §4.1). O texto do critério vem do servidor (`meta.criterio`) para não
 * divergir entre telas.
 */
export const TooltipRastreabilidade: React.FC<{
  meta: Meta;
  children?: React.ReactNode;
}> = ({ meta, children }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      {children ?? (
        <button
          type="button"
          aria-label="Rastreabilidade do indicador"
          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </TooltipTrigger>
    <TooltipContent className="max-w-xs">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
        <dt className="font-medium text-muted-foreground">Período</dt>
        <dd>{meta.periodo}</dd>
        <dt className="font-medium text-muted-foreground">Fonte</dt>
        <dd>{meta.fonte}</dd>
        <dt className="font-medium text-muted-foreground">Atualizado em</dt>
        <dd>{formatarData(meta.atualizadoEm)}</dd>
        <dt className="font-medium text-muted-foreground">Critério</dt>
        <dd>{meta.criterio}</dd>
      </dl>
    </TooltipContent>
  </Tooltip>
);
