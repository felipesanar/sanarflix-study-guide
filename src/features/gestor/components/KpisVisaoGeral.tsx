import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icon } from '@/features/gestor/components/Icon';
import { KpiCard, type EstadoKpi } from '@/features/gestor/components/KpiCard';
import { formatConceito, formatNumero, formatPct } from '@/features/gestor/lib/formatters';
import { PROFICIENCIA_MINIMA } from '@/features/gestor/lib/regras';
import type { Meta, VisaoGeral } from '@/features/gestor/api/types';

export interface KpisVisaoGeralProps {
  kpis: VisaoGeral['kpis'];
  meta: Meta;
  estado?: EstadoKpi;
  onTentarNovamente?: () => void;
}

/**
 * Conceito ENAMED chega como `N/5` de `formatConceito`. A referência quebra o
 * número e a escala em dois elementos (44px vs 13px), então o cartão precisa
 * das duas metades separadas — sem reimplementar o arredondamento, que é
 * regra de produto e mora no formatador.
 */
function conceitoSemEscala(valor: number | null): string {
  return formatConceito(valor).split('/')[0];
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
 * ÚNICA exceção: `simulados.realizados` chega já RECALCULADO no cliente por
 * `useVisaoGeral` (`api/queries.ts`, `contarSimuladosComNotaReal`) a partir
 * de `evolucao` — nunca o valor cru que a RPC devolve nesse campo (slots do
 * contrato vigente). Decisão de Felipe em 05/08 (achado FAI: KPI "0 de —" ao
 * lado de 3 simulados com nota real no gráfico "Evolução institucional", na
 * mesma tela): o numerador passa a contar simulados com nota, não slots de
 * contrato — `contratados` (o denominador) continua vindo do servidor tal
 * qual, `null` sem contrato.
 */
export function KpisVisaoGeral({ kpis, meta, estado = 'ok', onTentarNovamente }: KpisVisaoGeralProps) {
  const { simulados } = kpis;
  const { search } = useLocation();
  /**
   * `contratados` é `null` quando a IES não tem linha de contrato — nunca
   * `0` (spec §4.10). `formatNumero` já devolve TRACO para `null`, então o
   * denominador sai como "/ —" sem nenhum corte aqui. A trilha, porém, exige
   * `{ feitos: number; total: number }`: sem total conhecido não há progresso
   * para desenhar, então ela simplesmente não aparece — em vez de inventar
   * uma barra em 0%, que afirmaria "a IES contratou zero".
   *
   * `simulados.realizados` (o numerador, `feitos` aqui) já chega recalculado
   * por `useVisaoGeral` a partir de `evolucao` — ver o comentário no topo
   * deste arquivo e `contarSimuladosComNotaReal` em `api/queries.ts`.
   */
  const trilha = simulados.contratados !== null
    ? { feitos: simulados.realizados, total: simulados.contratados }
    : undefined;

  return (
    <div data-testid="kpis-visao-geral" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        titulo="Conceito ENAMED"
        hint="projeção institucional · escala 1 a 5"
        valor={conceitoSemEscala(kpis.enamedProjetado.valor)}
        sufixo="/ 5"
        badge="projetado"
        meta={meta}
        criterio={kpis.enamedProjetado.criterio}
        delta={kpis.enamedProjetado.delta}
        serie={kpis.enamedProjetado.serie}
        formatarPonto={formatConceito}
        rodape="projetado no último simulado · não é o conceito oficial do MEC"
        estado={estado}
        onTentarNovamente={onTentarNovamente}
      />
      <KpiCard
        titulo="Alunos proficientes"
        /* O corte é o da régua única (`lib/regras.ts`), nunca um 60 datilografado
           na copy: se a régua mudar, o hint muda junto. */
        hint={`acima de ${PROFICIENCIA_MINIMA} de proficiência`}
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
        hint="questões certas no período"
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
        hint="do contrato vigente da IES"
        valor={formatNumero(simulados.realizados)}
        sufixo={`/ ${formatNumero(simulados.contratados)}`}
        densidadeSufixo="fracao"
        meta={meta}
        /* Sem a sigla TRI: invariante 2 do handoff — TRI só existe por aluno,
           no Detalhamento. O critério vazava a sigla no tooltip e no `sr-only`
           de rastreabilidade, ou seja, dentro da Visão Geral. O conceito que a
           gestora precisa aqui é "nota de proficiência", que é como o resto da
           tela chama a mesma medida. */
        criterio="Simulados com nota de proficiência calculada no recorte atual — mesma base do gráfico de evolução. Contratados vêm do contrato vigente da IES."
        trilha={trilha}
        rodape={
          <Link
            to={{ pathname: '/gestor', search }}
            className="inline-flex items-center gap-1"
            style={{ fontSize: 12, fontWeight: 600, color: 'var(--gp-brand-on-dark)' }}
          >
            Ver cronograma
            <Icon name="chevron_right" variant="outlined" size={14} />
          </Link>
        }
        estado={estado}
        onTentarNovamente={onTentarNovamente}
      />
    </div>
  );
}
