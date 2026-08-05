import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { KpiCard, type EstadoKpi } from '@/features/gestor/components/KpiCard';
import { formatConceito, formatNumero, formatPct } from '@/features/gestor/lib/formatters';
import type { Meta, VisaoGeral } from '@/features/gestor/api/types';

export interface KpisVisaoGeralProps {
  kpis: VisaoGeral['kpis'];
  meta: Meta;
  estado?: EstadoKpi;
  onTentarNovamente?: () => void;
}

/**
 * Os 4 KPIs no topo da Visão Geral, na ordem canônica fixa (spec §4.8):
 * Conceito ENAMED projetado · Alunos proficientes · Percentual de acerto ·
 * Simulados realizados. Os três primeiros lideram pela evolução (régua
 * `1º simulado · anterior · atual`, cf. `KpiCard`); o quarto não tem régua
 * nem delta — é progresso de contrato, não uma métrica que evolui.
 *
 * Nenhum corte de nota vive aqui: os valores já vêm computados do servidor
 * (`Kpi.valor`/`Kpi.delta`/`Kpi.serie`), este componente só formata e ordena.
 */
export function KpisVisaoGeral({ kpis, meta, estado = 'ok', onTentarNovamente }: KpisVisaoGeralProps) {
  const { simulados } = kpis;
  const { search } = useLocation();
  /**
   * `contratados` é `null` quando a IES não tem linha de contrato — nunca
   * `0` (spec §4.10). `formatNumero` já devolve TRACO para `null`, então o
   * texto do valor ("3 de —") sai correto sem nenhum corte aqui. A trilha,
   * porém, exige `{ feitos: number; total: number }`: sem total conhecido não
   * há progresso para desenhar, então ela simplesmente não aparece — em vez
   * de inventar uma barra em 0%, que afirmaria "a IES contratou zero".
   */
  const trilha = simulados.contratados !== null
    ? { feitos: simulados.realizados, total: simulados.contratados }
    : undefined;

  return (
    <div data-testid="kpis-visao-geral" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        titulo="Conceito ENAMED projetado"
        valor={formatConceito(kpis.enamedProjetado.valor)}
        badge="projetado"
        meta={meta}
        criterio={kpis.enamedProjetado.criterio}
        delta={kpis.enamedProjetado.delta}
        serie={kpis.enamedProjetado.serie}
        formatarPonto={formatConceito}
        estado={estado}
        onTentarNovamente={onTentarNovamente}
      />
      <KpiCard
        titulo="Alunos proficientes"
        valor={formatPct(kpis.proficientesPct.valor)}
        meta={meta}
        criterio={kpis.proficientesPct.criterio}
        delta={kpis.proficientesPct.delta}
        serie={kpis.proficientesPct.serie}
        formatarPonto={(valor) => formatPct(valor)}
        estado={estado}
        onTentarNovamente={onTentarNovamente}
      />
      <KpiCard
        titulo="Percentual de acerto"
        valor={formatPct(kpis.acertoPct.valor)}
        meta={meta}
        criterio={kpis.acertoPct.criterio}
        delta={kpis.acertoPct.delta}
        serie={kpis.acertoPct.serie}
        formatarPonto={(valor) => formatPct(valor)}
        estado={estado}
        onTentarNovamente={onTentarNovamente}
      />
      <KpiCard
        titulo="Simulados realizados"
        valor={`${formatNumero(simulados.realizados)} de ${formatNumero(simulados.contratados)}`}
        meta={meta}
        criterio="Slots do contrato com simulado já realizado"
        trilha={trilha}
        rodape={<Link to={{ pathname: '/gestor', search }}>Ver cronograma</Link>}
        estado={estado}
        onTentarNovamente={onTentarNovamente}
      />
    </div>
  );
}
