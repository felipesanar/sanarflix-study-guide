import * as React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReportCoverPreviewProps {
  iesNome: string;
  simuladoNome?: string;
  baseLabel?: string;
  conceito: number | null;
  percentProficientes: number | null;
  triMedio: number | null;
}

/** Cor do conceito na capa — sempre em tom escuro (a capa é fixamente clara). */
const CONCEPT_COVER_COLOR: Record<number, string> = {
  1: 'text-red-600',
  2: 'text-red-600',
  3: 'text-amber-600',
  4: 'text-blue-600',
  5: 'text-emerald-600',
};

const fmtPct = (v: number | null): string => (v == null ? '—' : `${Math.round(v)}%`);
const fmtScore = (v: number | null): string => (v == null ? '—' : Math.round(v).toString());

/**
 * Prévia da capa do relatório institucional — card `aspect-[3/4]` SEMPRE
 * claro (`bg-white text-neutral-900` fixos, mesmo em dark), pois representa
 * um documento impresso. Única exceção documentada à regra "só tokens".
 */
export const ReportCoverPreview: React.FC<ReportCoverPreviewProps> = ({
  iesNome,
  simuladoNome,
  baseLabel,
  conceito,
  percentProficientes,
  triMedio,
}) => {
  const hoje = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
  const conceitoColor = conceito != null ? (CONCEPT_COVER_COLOR[conceito] ?? 'text-neutral-900') : 'text-neutral-400';

  return (
    <div
      className={cn(
        'flex aspect-[3/4] w-full flex-col justify-between rounded-lg border border-neutral-200 bg-white p-6 text-neutral-900 shadow-sm',
      )}
    >
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-neutral-900 text-white text-xs font-bold">
              S
            </div>
            <span className="text-sm font-bold tracking-tight text-neutral-900">SanarFlix Academy</span>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-neutral-300 text-neutral-400">
            <GraduationCap className="h-4 w-4" aria-hidden="true" />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-neutral-500">
            Relatório de desempenho institucional
          </p>
          <h2 className="text-2xl font-bold leading-tight text-neutral-900">{iesNome}</h2>
          <p className="text-xs text-neutral-500">
            {simuladoNome ?? 'Simulado selecionado'} · {baseLabel ?? 'IES inteira'}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-3 border-t border-neutral-200 pt-4">
          <div>
            <p className={cn('font-mono text-2xl font-bold leading-none tabular-nums', conceitoColor)}>
              {conceito ?? '—'}
            </p>
            <p className="mt-1 text-[10px] text-neutral-500">Conceito MEC</p>
          </div>
          <div>
            <p className="font-mono text-2xl font-bold leading-none tabular-nums text-neutral-900">
              {fmtPct(percentProficientes)}
            </p>
            <p className="mt-1 text-[10px] text-neutral-500">Proficientes</p>
          </div>
          <div>
            <p className="font-mono text-2xl font-bold leading-none tabular-nums text-neutral-900">
              {fmtScore(triMedio)}
            </p>
            <p className="mt-1 text-[10px] text-neutral-500">TRI médio</p>
          </div>
        </div>

        <p className="text-[10px] text-neutral-400">Gerado em {hoje} · confidencial</p>
      </div>
    </div>
  );
};
