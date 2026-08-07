import * as React from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
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
 * Recorte de UM semestre específico. É o MESMO regex que
 * `get_gestor_visao_geral` usa para decidir o recorte (`v_sems :=
 * ARRAY[p_semestre::int]`, migration
 * `20260804130000_get_gestor_visao_geral_guard_kpi_lowsample.sql`); `6ano` e
 * `geral` deixam `v_sems` NULL, ou seja, cobrem a IES inteira — `6ano` só põe
 * 11º/12º em evidência, não filtra. Valor ausente ou inválido degrada para o
 * padrão `6ano` em `useFiltrosGestor`, que também é a IES inteira, então o
 * "não casou" desta expressão coincide com o comportamento real do servidor.
 *
 * Não importamos as constantes de `useFiltrosGestor` de propósito: aquele
 * módulo é substituído por `vi.mock` em suítes que montam a rota inteira, e um
 * import de constante viria `undefined` lá dentro.
 */
const SEMESTRE_UNICO = /^(1[0-2]|[1-9])$/;

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
 *
 * Consequência disso: as duas pontas dessa fração têm recortes diferentes, e o
 * denominador só é exibido quando os dois coincidem. Ver `recorteEhIesInteira`
 * no corpo do componente.
 */
export function KpisVisaoGeral({ kpis, meta, estado = 'ok', onTentarNovamente }: KpisVisaoGeralProps) {
  const { simulados } = kpis;
  const { search } = useLocation();
  const [searchParams] = useSearchParams();
  /**
   * As duas pontas da fração precisam falar do MESMO universo. O numerador
   * (`realizados`) é recortado por semestre — `contarSimuladosComNotaReal` lê
   * `evolucao`, que a RPC monta só sobre os alunos de `v_sems`. O denominador
   * (`contratados`) é a soma dos contratos vigentes da IES INTEIRA, sem
   * recorte nenhum. Com `?semestre=5` numa IES que aplicou 4 simulados o
   * cartão dizia "1 de 7": uma fração cujas pontas contam coisas diferentes.
   *
   * Enquanto a RPC não devolver contratados por recorte, a saída honesta é
   * mostrar só o numerador quando o recorte não é a IES inteira — afirmar um
   * total que não corresponde é pior do que não afirmar total nenhum.
   */
  const recorteEhIesInteira = !SEMESTRE_UNICO.test(searchParams.get('semestre') ?? '');
  /**
   * `contratados` é `null` quando a IES não tem linha de contrato — nunca
   * `0` (spec §4.10). `formatNumero` já devolve TRACO para `null`, então o
   * denominador sai como "/ —" sem nenhum corte aqui. A trilha, porém, exige
   * `{ feitos: number; total: number }`: sem total conhecido não há progresso
   * para desenhar, então ela simplesmente não aparece — em vez de inventar
   * uma barra em 0%, que afirmaria "a IES contratou zero". Pelo mesmo motivo
   * ela some fora do recorte da IES inteira: a barra é a razão entre as duas
   * pontas, e a razão é justamente o que deixa de fazer sentido ali.
   *
   * `simulados.realizados` (o numerador, `feitos` aqui) já chega recalculado
   * por `useVisaoGeral` a partir de `evolucao` — ver o comentário no topo
   * deste arquivo e `contarSimuladosComNotaReal` em `api/queries.ts`.
   */
  const trilha = recorteEhIesInteira && simulados.contratados !== null
    ? { feitos: simulados.realizados, total: simulados.contratados }
    : undefined;

  return (
    <div data-testid="kpis-visao-geral" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        titulo="Conceito ENAMED"
        hint="projeção institucional · escala 1 a 5"
        valor={conceitoSemEscala(kpis.enamedProjetado.valor)}
        valorNumerico={kpis.enamedProjetado.valor}
        formatarValor={conceitoSemEscala}
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
        valorNumerico={kpis.proficientesPct.valor}
        formatarValor={formatPct}
        meta={meta}
        criterio={kpis.proficientesPct.criterio}
        delta={kpis.proficientesPct.delta}
        serie={kpis.proficientesPct.serie}
        formatarPonto={(valor) => formatPct(valor)}
        /**
         * Rodapé de BASE, como o do Conceito ENAMED ao lado: diz sobre quem o
         * percentual foi calculado. Não é detalhe de rodapé — é a diferença
         * entre "54% da minha turma está proficiente" e "54% de quem fez o
         * último simulado está proficiente", e só a segunda é verdade
         * (`prof_pct = n_prof / n_tri` do simulado `atual`, ver o `criterio`
         * que a própria RPC devolve).
         *
         * A referência escreve aqui a contagem absoluta ("56 de 104 alunos do
         * 6º período"). O payload de `get_gestor_visao_geral` não carrega
         * `n_prof`/`n_tri` — só o percentual já arredondado — e derivar a
         * contagem de volta a partir de `%` × `participantes` erraria por um
         * aluno para cima ou para baixo, além de misturar denominadores
         * (`participantes` é `GREATEST(n_tri, n_resp)`, não `n_tri`).
         * Afirmar "56 de 104" sem ter 56 nem 104 é exatamente o que a §4.10
         * proíbe. Fica a base; a contagem entra quando a RPC devolver os dois
         * números.
         */
        rodape="sobre os alunos com resultado no simulado mais recente"
        estado={estado}
        onTentarNovamente={onTentarNovamente}
      />
      <KpiCard
        titulo="Percentual de acerto"
        /**
         * "no simulado mais recente", não "no período": o valor é
         * `acerto_pct` do ponto `atual` da régua (acertos ÷ respostas válidas
         * daquele simulado), nunca um acumulado do período nem uma média
         * entre simulados. O hint anterior descrevia um cálculo que a RPC não
         * faz — e ficava impossível de sustentar ao lado do rodapé novo.
         */
        hint="questões certas no simulado mais recente"
        valor={formatPct(kpis.acertoPct.valor)}
        valorNumerico={kpis.acertoPct.valor}
        formatarValor={formatPct}
        meta={meta}
        criterio={kpis.acertoPct.criterio}
        delta={kpis.acertoPct.delta}
        serie={kpis.acertoPct.serie}
        formatarPonto={(valor) => formatPct(valor)}
        /** Mesma função do rodapé ao lado: a base do cálculo, em uma linha. */
        rodape="respostas válidas, na última tentativa de cada aluno · questão anulada fora"
        estado={estado}
        onTentarNovamente={onTentarNovamente}
      />
      <KpiCard
        titulo="Simulados realizados"
        hint={recorteEhIesInteira ? 'do contrato vigente da IES' : 'com nota neste recorte de semestre'}
        valor={formatNumero(simulados.realizados)}
        valorNumerico={simulados.realizados}
        formatarValor={formatNumero}
        sufixo={recorteEhIesInteira ? `/ ${formatNumero(simulados.contratados)}` : undefined}
        densidadeSufixo="fracao"
        meta={meta}
        /* Sem a sigla TRI: invariante 2 do handoff — TRI só existe por aluno,
           no Detalhamento. O critério vazava a sigla no tooltip e no `sr-only`
           de rastreabilidade, ou seja, dentro da Visão Geral. O conceito que a
           gestora precisa aqui é "nota de proficiência", que é como o resto da
           tela chama a mesma medida. */
        criterio={
          recorteEhIesInteira
            ? 'Simulados com nota de proficiência calculada no recorte atual — mesma base do gráfico de evolução. Contratados vêm do contrato vigente da IES.'
            : 'Simulados com nota de proficiência calculada neste recorte de semestre — mesma base do gráfico de evolução. O total contratado não aparece aqui porque vale para a IES inteira, não para um semestre: dividir um pelo outro compararia universos diferentes.'
        }
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
