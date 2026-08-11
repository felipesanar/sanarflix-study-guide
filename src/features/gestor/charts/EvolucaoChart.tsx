import * as React from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PROFICIENCIA_MINIMA } from '@/features/gestor/lib/regras';
import { formatData, formatNumero } from '@/features/gestor/lib/formatters';
import { SUPERFICIE_TOOLTIP } from '@/features/gestor/components/Dica';
import { MolduraVazia } from '@/features/gestor/charts/MolduraVazia';
import type { VisaoGeral } from '@/features/gestor/api/types';

/**
 * Modo "Geral" do gráfico protagonista (spec §4.8) — série da instituição ao
 * longo dos simulados, escala 0–100. Cada `ponto.valor` é `number | null`: um
 * `null` é um buraco na série (nunca vira zero, spec §4.10), então a linha usa
 * `connectNulls={false}` para não emendar um vale falso por cima do buraco.
 */
export interface EvolucaoChartProps {
  pontos: VisaoGeral['evolucao'];
  largura?: number;
  altura?: number;
  /**
   * Modo de loading PRÓPRIO do gráfico (spec de movimento §5, item 2: "nunca
   * um retângulo cinza"). Quando `true`, ignora `pontos` e desenha os MESMOS
   * eixos reais do modo carregado — grade, eixo Y de 0 a 100 e a linha de
   * meta, todos conhecidos independente do dado ainda não ter chegado — com
   * um traço em skeleton no lugar da série. Nunca um `GestorSkeleton`
   * genérico sem eixo.
   */
  carregando?: boolean;
}

/**
 * Escala completa: a linha tracejada de meta 60 saiu deste modo (a série mede
 * PERCENTUAL DE ALUNOS proficientes, não nota de aluno — 60 é corte de nota,
 * não meta de percentual de turma), então o tick de 60 volta ao eixo.
 */
const TICKS_Y = [0, 20, 40, 60, 80, 100];
const TITULO = 'Evolução do percentual de alunos proficientes por simulado';

/**
 * Dataset mudo, só para o `<XAxis dataKey="rotulo">` ter algo a iterar
 * durante o carregamento — nenhum rótulo é exibido (o nome do simulado ainda
 * não existe), mas o eixo, a grade e a linha de meta são os MESMOS
 * componentes Recharts do modo carregado, não uma imitação.
 */
const DADOS_ESQUELETO: { rotulo: string }[] = Array.from({ length: 5 }, () => ({ rotulo: '' }));

interface DadoEvolucao {
  rotulo: string;
  valor: number | null;
  participantes: number;
  data: string;
}

/**
 * Anatomia do ponto no handoff §7: o ponto CORRENTE é branco com anel da
 * marca e miolo sólido, sobre um halo largo de baixa opacidade; os anteriores
 * são círculos brancos de anel fino. O preenchimento sólido invertido (marca
 * dentro, branco fora) que existia aqui antes lia como "todos os pontos são o
 * atual".
 */
function PontoAtual(props: {
  cx?: number | null;
  cy?: number | null;
  index?: number;
  ultimoIndice: number;
}) {
  const { cx, cy, index, ultimoIndice } = props;
  /**
   * `== null` cobre `null` E `undefined`, e é o `null` que importa aqui.
   *
   * `Line.renderDots` do Recharts percorre TODOS os pontos, inclusive os de
   * valor nulo, e para esses passa `cy: null` (`y: isNil(value) ? null :
   * scale(value)`, cartesian/Line.js). Com o teste antigo (`=== undefined`)
   * o `null` passava batido, o `<circle>` saía sem atributo `cy`, e SVG
   * assume `cy=0` — um ponto solto colado no TOPO do gráfico, sem série
   * nenhuma por trás. Aparece sempre que a série tem buraco (§4.10: buraco
   * nunca vira zero), que é o caso comum do modo "Grande área".
   */
  if (cx == null || cy == null) return null;

  if (index !== ultimoIndice) {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={6}
        fill="var(--gp-surface-1)"
        stroke="var(--gp-brand)"
        strokeWidth={1.6}
      />
    );
  }

  return (
    <g>
      <circle cx={cx} cy={cy} r={13} fill="var(--gp-brand)" opacity={0.14} />
      <circle
        cx={cx}
        cy={cy}
        r={7.5}
        fill="var(--gp-surface-1)"
        stroke="var(--gp-brand)"
        strokeWidth={2.2}
      />
      <circle cx={cx} cy={cy} r={4} fill="var(--gp-brand)" />
    </g>
  );
}

/**
 * Tooltip rico do handoff (docs/06, princípio 3): nome do simulado, valor
 * formatado e o CONTEXTO — quantos alunos sustentam aquele número. O total de
 * participantes só existia na tabela colapsável; sem ele, uma queda medida em
 * 12 alunos parecia ter o mesmo peso que uma medida em 300.
 */
export function TooltipEvolucao(props: { active?: boolean; payload?: { payload: DadoEvolucao }[] }) {
  const { active, payload } = props;
  if (!active || !payload || payload.length === 0) return null;
  const ponto = payload[0].payload;

  return (
    <div
      data-testid="tooltip-evolucao"
      className="px-3.5 py-2.5 text-xs"
      style={{
        /* Superfície ESCURA nos dois temas, como todo tooltip do portal
           (referência LIGHT.html; os mesmos tokens de `TooltipRastreabilidade`
           e de `Dica`). O card branco de antes se confundia com o próprio
           fundo do gráfico e sumia por cima da linha. */
        ...SUPERFICIE_TOOLTIP,
        border: 'none',
        borderRadius: 'var(--gp-radius-md)',
      }}
    >
      <p className="flex items-center gap-1.5 font-semibold" style={{ color: 'var(--gp-tooltip-value)' }}>
        {/* Ponto da cor da série, como na referência: liga o balão à linha de
            onde ele saiu — necessário quando houver mais de uma série. */}
        <span
          aria-hidden="true"
          className="inline-block h-2 w-2 shrink-0 rounded-full"
          style={{ background: 'var(--gp-brand)' }}
        />
        {ponto.rotulo}
      </p>
      <p className="mt-0.5 tabular-nums" style={{ color: 'var(--gp-tooltip-label)' }}>
        {`${formatNumero(ponto.valor)}% de alunos proficientes · ${formatNumero(ponto.participantes)} alunos`}
      </p>
      <p style={{ color: 'var(--gp-tooltip-label)' }}>{formatData(ponto.data)}</p>
    </div>
  );
}

/** Rodapé de legenda do handoff (docs/06, princípio 2: legenda sempre). */
function LegendaEvolucao({ semTri }: { semTri: number }) {
  return (
    <figcaption
      className="mt-3 flex flex-wrap items-center gap-4 pt-3.5 text-[11px]"
      style={{ borderTop: '1px solid var(--gp-border-subtle)', color: 'var(--gp-text-3)' }}
    >
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="h-[3px] w-4 rounded-full"
          style={{ background: 'var(--gp-brand)' }}
        />
        Alunos proficientes (%)
      </span>
      {/*
       * A série só pode conter simulados cujo TRI já foi processado — sem
       * proficiência calculada não há ponto a desenhar, e emendar a linha por
       * cima deles inventaria evolução (§4.10). O aviso diz explicitamente
       * quantos simulados do recorte ficaram fora por esse motivo.
       */}
      <span data-testid="evolucao-aviso-tri" className="basis-full">
        Considera apenas simulados com TRI processado.
        {semTri > 0
          ? ` ${semTri} simulado${semTri > 1 ? 's' : ''} do recorte ainda sem TRI ${semTri > 1 ? 'ficaram' : 'ficou'} fora do gráfico.`
          : ''}
      </span>
    </figcaption>
  );
}

export function EvolucaoChart({ pontos, largura, altura = 300, carregando = false }: EvolucaoChartProps) {
  if (carregando) {
    const graficoEsqueleto = (
      <ComposedChart
        data={DADOS_ESQUELETO}
        width={largura}
        height={largura ? altura : undefined}
        margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
      >
        <CartesianGrid stroke="var(--gp-border-subtle)" strokeWidth={1} vertical={false} />
        <XAxis
          dataKey="rotulo"
          tick={{ fontSize: 11, fill: 'var(--gp-axis)' }}
          axisLine={{ stroke: 'var(--gp-border-strong)' }}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          ticks={TICKS_Y}
          width={36}
          tick={{ fontSize: 11, fill: 'var(--gp-axis)' }}
          axisLine={false}
          tickLine={false}
        />
        {/* O traço da série ainda não existe: uma barra em skeleton no meio
            da faixa (spec §5, item 2), não um retângulo cinza cobrindo o
            plot inteiro — a moldura (eixos, grade, meta) já está de pé. */}
        <ReferenceLine
          y={50}
          stroke="var(--gp-skeleton)"
          strokeWidth={6}
          strokeLinecap="round"
          className="animate-pulse"
        />
      </ComposedChart>
    );

    return (
      <figure className="m-0">
        <div
          role="status"
          aria-busy="true"
          aria-label={`Carregando ${TITULO.toLowerCase()}`}
          data-testid="evolucao-carregando"
        >
          {largura ? (
            graficoEsqueleto
          ) : (
            <div style={{ height: altura }}>
              <ResponsiveContainer width="100%" height="100%">
                {graficoEsqueleto}
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </figure>
    );
  }

  /*
   * A série é o PERCENTUAL DE ALUNOS PROFICIENTES (nota >= 60) do simulado —
   * a mesma conta do KPI "Alunos proficientes", não mais a média da nota.
   * O critério de entrada no gráfico continua sendo TER TRI PROCESSADO
   * (`valor`, a média de proficiência, existir): sem TRI não há proficiência
   * nem contagem de proficientes, e emendar a linha por cima inventaria
   * evolução (§4.10).
   */
  const comTri = pontos
    .filter((ponto) => ponto.valor !== null && ponto.valor !== undefined)
    .map((ponto) => ({ ...ponto, valor: ponto.proficientesPct ?? null }));
  const semTri = pontos.length - comTri.length;

  const descricao = `Percentual de alunos proficientes (nota ${PROFICIENCIA_MINIMA} ou mais) por simulado, escala 0 a 100%, com ${comTri.length} simulado(s) com TRI processado.`;

  const tabela = (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs text-muted-foreground">Ver dados em tabela</summary>
      <table data-testid="evolucao-tabela" className="mt-2 w-full text-left text-xs">
        <caption className="sr-only">{TITULO}</caption>
        <thead>
          <tr className="text-muted-foreground">
            <th scope="col" className="py-1 pr-3 font-medium">Simulado</th>
            <th scope="col" className="py-1 pr-3 font-medium">Data</th>
            <th scope="col" className="py-1 pr-3 font-medium">Alunos proficientes</th>
            <th scope="col" className="py-1 font-medium">Participantes</th>
          </tr>
        </thead>
        <tbody>
          {comTri.map((ponto) => (
            <tr key={ponto.simuladoId} className="border-t border-border/60">
              <th scope="row" className="py-1 pr-3 font-normal">{ponto.nome}</th>
              <td className="py-1 pr-3 tabular-nums">{formatData(ponto.data)}</td>
              <td className="py-1 pr-3 tabular-nums">{`${formatNumero(ponto.valor)}%`}</td>
              <td className="py-1 tabular-nums">{formatNumero(ponto.participantes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );

  if (comTri.length === 0) {
    return (
      <MolduraVazia
        testId="evolucao-vazio"
        altura={altura}
        mensagem={
          pontos.length > 0
            ? 'Nenhum simulado deste recorte tem TRI processado.'
            : 'Nenhum simulado realizado neste recorte.'
        }
      />
    );
  }

  // Handoff de data viz: com 1 simulado não se desenha linha de um ponto.
  if (comTri.length === 1) {
    const unico = comTri[0];
    return (
      <figure className="m-0">
        {/*
         * `role="img"` fica no contêiner do DESENHO, nunca no `<figure>`:
         * `role="img"` torna todo descendente "presentational" (ARIA 1.2,
         * Children Presentational: True), o que podaria a `<figcaption>` e a
         * tabela colapsável — a alternativa não-visual do gráfico — da árvore
         * de acessibilidade (achado 2, revisão de 05/08).
         */}
        <div
          role="img"
          aria-label={`${TITULO}. ${descricao}`}
          data-testid="evolucao-ponto-unico"
          className="flex h-[300px] flex-col items-center justify-center gap-2"
        >
          {/* Mesmo halo + anel do ponto corrente da série completa. */}
          <span className="relative flex h-6 w-6 items-center justify-center">
            <span
              className="absolute h-6 w-6 rounded-full"
              style={{ background: 'var(--gp-brand)', opacity: 0.14 }}
            />
            <span
              className="flex h-[15px] w-[15px] items-center justify-center rounded-full"
              style={{ background: 'var(--gp-surface-1)', border: '2.2px solid var(--gp-brand)' }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: 'var(--gp-brand)' }} />
            </span>
          </span>
          <span className="text-3xl font-semibold tabular-nums">{`${formatNumero(unico.valor)}%`}</span>
          <span className="text-xs text-muted-foreground">
            {`${unico.nome} · ${formatData(unico.data)} · ${formatNumero(unico.participantes)} alunos`}
          </span>
        </div>
        <figcaption className="text-xs text-muted-foreground">
          Primeira medição com TRI processado; a evolução aparece a partir do segundo simulado com TRI.
        </figcaption>
        {tabela}
      </figure>
    );
  }

  const dados: DadoEvolucao[] = comTri.map((ponto) => ({
    rotulo: ponto.nome,
    valor: ponto.valor,
    participantes: ponto.participantes,
    data: ponto.data,
  }));
  const ultimoIndice = dados.length - 1;

  const grafico = (
    <ComposedChart
      data={dados}
      width={largura}
      height={largura ? altura : undefined}
      /*
       * SEM `title`, com `desc` — não é descuido.
       *
       * `title` vira um `<title>` como primeiro filho do `<svg>`, e todo
       * navegador transforma isso num TOOLTIP NATIVO ao passar o mouse: um
       * balão preto do sistema, com a frase inteira do título, pousando por
       * cima do nosso tooltip de dado justo quando o gestor foi ler o ponto.
       * Era ele que cobria o nome do simulado no balão.
       *
       * Não custa acessibilidade: o contêiner do desenho é
       * `role="img" aria-label={TITULO}` (abaixo), e `role="img"` torna todo
       * descendente presentational (ARIA 1.2) — o `<title>` já não
       * participava da árvore, só do hover. `desc` fica: não gera tooltip
       * nativo e mantém a descrição longa no SVG, como o checklist da §11
       * pede.
       */
      desc={descricao}
      margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
    >
      <defs>
        {/*
         * Três paradas, como o `vgFill` da referência: a área não é uma rampa
         * linear até zero — ela some rápido (58% do caminho já está em 0.06) e
         * deixa a linha, não o preenchimento, carregar a leitura.
         */}
        <linearGradient id="gradiente-evolucao-gestor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--gp-brand)" stopOpacity={0.22} />
          <stop offset="58%" stopColor="var(--gp-brand)" stopOpacity={0.06} />
          <stop offset="100%" stopColor="var(--gp-brand)" stopOpacity={0} />
        </linearGradient>
        {/* Traço em gradiente horizontal da marca (`vgLine` da referência). */}
        <linearGradient id="gradiente-linha-evolucao-gestor" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--gp-brand-strong)" />
          <stop offset="100%" stopColor="var(--gp-brand)" />
        </linearGradient>
      </defs>
      {/* Grade SÓLIDA, horizontal, 1px em divisor sutil (docs/06, princípio 1). */}
      <CartesianGrid stroke="var(--gp-border-subtle)" strokeWidth={1} vertical={false} />
      <XAxis
        dataKey="rotulo"
        tick={{ fontSize: 11, fill: 'var(--gp-axis)' }}
        /* A base do plot é a única linha de eixo desenhada, e mais densa que a grade. */
        axisLine={{ stroke: 'var(--gp-border-strong)' }}
        tickLine={false}
        /*
         * Sem `interval`, o Recharts usa o default `'preserveEnd'`: ele
         * percorre os ticks de trás para frente para garantir que o ÚLTIMO
         * sempre apareça, encolhendo o espaço disponível a cada iteração — o
         * PRIMEIRO ponto (primeiro simulado da série) é avaliado por último,
         * com o espaço mais apertado, e costuma perder o rótulo.
         * `'preserveStartEnd'` fixa o primeiro E o último tick, sacrificando
         * só os do meio se precisar.
         */
        interval="preserveStartEnd"
      />
      <YAxis
        domain={[0, 100]}
        ticks={TICKS_Y}
        width={36}
        tick={{ fontSize: 11, fill: 'var(--gp-axis)' }}
        axisLine={false}
        tickLine={false}
      />
      <Tooltip content={<TooltipEvolucao />} />
      <Area
        type="monotone"
        dataKey="valor"
        stroke="none"
        fill="url(#gradiente-evolucao-gestor)"
        isAnimationActive={false}
      />
      <Line
        type="monotone"
        dataKey="valor"
        stroke="url(#gradiente-linha-evolucao-gestor)"
        /*
         * 2.5px de docs/06-data-viz.md §1, não os 3.5px do SVG da referência:
         * o SVG é maquete em viewBox fixo de 960px, enquanto aqui a largura é
         * fluida — a espessura escrita na spec é a que atravessa breakpoints.
         * Decisão registrada aqui porque a divergência é deliberada.
         */
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        connectNulls={false}
        isAnimationActive={false}
        dot={<PontoAtual ultimoIndice={ultimoIndice} />}
        activeDot={{ r: 6 }}
      />
    </ComposedChart>
  );

  return (
    <figure className="m-0">
      {/* `role="img"` só no desenho — ver comentário no ramo de 1 simulado acima. */}
      {largura ? (
        <div role="img" aria-label={`${TITULO}. ${descricao}`}>
          {grafico}
        </div>
      ) : (
        <div role="img" aria-label={`${TITULO}. ${descricao}`} style={{ height: altura }}>
          <ResponsiveContainer width="100%" height="100%">
            {grafico}
          </ResponsiveContainer>
        </div>
      )}
      <LegendaEvolucao semTri={semTri} />
      {tabela}
    </figure>
  );
}
