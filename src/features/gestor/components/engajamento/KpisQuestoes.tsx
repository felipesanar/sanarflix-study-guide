import * as React from 'react';
import { KpiCard, type EstadoKpi } from '@/features/gestor/components/KpiCard';
import { META_VAZIA_ENGAJAMENTO } from '@/features/gestor/components/engajamento/BlocoEngajamento';
import { formatNumero, formatPct } from '@/features/gestor/lib/formatters';
import type { Meta } from '@/features/gestor/api/types';
import type { QuestoesEngajamento } from '@/features/gestor/api/types-engajamento';

export interface KpisQuestoesProps {
  dados: QuestoesEngajamento | undefined;
  meta?: Meta;
  estado?: EstadoKpi;
  onTentarNovamente?: () => void;
}

/** Os 3 KPIs da aba Questões (spec §12.3): total, acerto e questões por aluno que resolveu. */
export function KpisQuestoes({ dados, meta, estado = 'ok', onTentarNovamente }: KpisQuestoesProps) {
  const k = dados?.kpis;
  const comum = { meta: meta ?? META_VAZIA_ENGAJAMENTO, estado, onTentarNovamente };

  return (
    <div data-testid="kpis-questoes" className="grid gap-3.5 sm:grid-cols-3">
      <KpiCard
        {...comum}
        testId="kpi-questoes-total"
        titulo="Questões resolvidas"
        valor={formatNumero(k?.questoes ?? null)}
        valorNumerico={k?.questoes ?? null}
        formatarValor={formatNumero}
        rodape={k ? `${formatNumero(k.alunos)} alunos resolveram` : undefined}
      />
      <KpiCard
        {...comum}
        testId="kpi-questoes-acerto"
        titulo="Acerto"
        valor={formatPct(k?.acertoPct ?? null)}
        rodape="corretas ÷ (corretas + erradas)"
      />
      <KpiCard
        {...comum}
        testId="kpi-questoes-por-aluno"
        titulo="Questões por aluno"
        valor={formatNumero(k?.porAluno ?? null)}
        valorNumerico={k?.porAluno ?? null}
        formatarValor={formatNumero}
        rodape={k ? `${formatNumero(k.questoes)} questões ÷ ${formatNumero(k.alunos)} alunos que resolveram` : undefined}
      />
    </div>
  );
}
