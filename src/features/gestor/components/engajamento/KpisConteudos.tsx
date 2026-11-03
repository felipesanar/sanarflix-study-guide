import * as React from 'react';
import { KpiCard, type EstadoKpi } from '@/features/gestor/components/KpiCard';
import { META_VAZIA_ENGAJAMENTO } from '@/features/gestor/components/engajamento/BlocoEngajamento';
import { formatNumero } from '@/features/gestor/lib/formatters';
import type { TipoConteudo } from '@/features/gestor/lib/engajamento';
import type { Meta } from '@/features/gestor/api/types';
import type { ConteudosEngajamento } from '@/features/gestor/api/types-engajamento';

export interface KpisConteudosProps {
  dados: ConteudosEngajamento | undefined;
  meta?: Meta;
  tipo: TipoConteudo;
  estado?: EstadoKpi;
  onTentarNovamente?: () => void;
}

function notaConsumidos(k: ConteudosEngajamento['kpis'], tipo: TipoConteudo): string {
  if (tipo === 'video') return 'vídeos abertos no período';
  if (tipo === 'document') return 'documentos abertos no período';
  return `${formatNumero(k.videos)} vídeos · ${formatNumero(k.documentos)} documentos`;
}

/** Os 2 KPIs da aba Conteúdos (spec §12.4): total consumido (por tipo) e conteúdos por aluno que consumiu. */
export function KpisConteudos({ dados, meta, tipo, estado = 'ok', onTentarNovamente }: KpisConteudosProps) {
  const k = dados?.kpis;
  const comum = { meta: meta ?? META_VAZIA_ENGAJAMENTO, estado, onTentarNovamente };

  return (
    <div data-testid="kpis-conteudos" className="grid gap-3.5 sm:grid-cols-2">
      <KpiCard
        {...comum}
        testId="kpi-conteudos-consumidos"
        titulo="Conteúdos consumidos"
        valor={formatNumero(k?.consumos ?? null)}
        valorNumerico={k?.consumos ?? null}
        formatarValor={formatNumero}
        rodape={k ? notaConsumidos(k, tipo) : undefined}
      />
      <KpiCard
        {...comum}
        testId="kpi-conteudos-por-aluno"
        titulo="Conteúdos por aluno"
        valor={formatNumero(k?.porAluno ?? null)}
        valorNumerico={k?.porAluno ?? null}
        formatarValor={formatNumero}
        rodape={k ? `${formatNumero(k.consumos)} conteúdos ÷ ${formatNumero(k.alunos)} alunos que consumiram` : undefined}
      />
    </div>
  );
}
