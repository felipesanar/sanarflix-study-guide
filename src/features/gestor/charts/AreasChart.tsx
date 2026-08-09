// src/features/gestor/charts/AreasChart.tsx
import * as React from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';
import { formatPct } from '@/features/gestor/lib/formatters';
import { SUPERFICIE_TOOLTIP } from '@/features/gestor/components/Dica';
import { PROFICIENCIA_MINIMA } from '@/features/gestor/lib/regras';
import { MolduraVazia } from '@/features/gestor/charts/MolduraVazia';
import type { VisaoGeral } from '@/features/gestor/api/types';

export interface AreasChartProps {
  areas: VisaoGeral['evolucaoPorArea'];
  largura?: number;
  altura?: number;
}

/** Sem o valor da meta: a linha tracejada já ocupa essa faixa (handoff §7). */
const TICKS_Y = [0, 20, 40, 80, 100];

/**
 * Título/nome acessível do gráfico. Deliberadamente "desempenho", nunca
 * "proficiência" — na visão por grande área a métrica é % de acerto, e
 * "proficiência" só existe onde há TRI (aluno e simulado), spec §4.6.
 */
const TITULO = 'Desempenho por grande área, em percentual de acerto, por simulado';

/**
 * Paleta de séries do handoff (`tokens/tokens.light.css`, ordem fixa). Cada
 * grande área tem a MESMA cor em toda tela e em todo recorte: se a cor viesse
 * da posição no array, a Cirurgia mudaria de cor sempre que outra área
 * entrasse ou saísse do recorte, e a leitura de "aquela linha azul" morreria
 * entre dois filtros.
 *
 * O casamento é por expressão, não por igualdade de string, porque a RPC
 * devolve o nome da grande área como ele está cadastrado (com ou sem
 * abreviação: "Gineco. e Obstetrícia", "Ginecologia e Obstetrícia").
 */
const PALETA = [
  'var(--gp-serie-1)',
  'var(--gp-serie-2)',
  'var(--gp-serie-3)',
  'var(--gp-serie-4)',
  'var(--gp-serie-5)',
];

const SERIES_FIXAS: RegExp[] = [
  /cl[ií]nica/i,                              // serie-1
  /cirurgia/i,                                // serie-2
  /ginec|gineco|obstet/i,                     // serie-3
  /preventiva|coletiva|sa[uú]de p[uú]blica/i, // serie-4
  /pediatria/i,                               // serie-5
];

/**
 * Uma cor por área, estável entre recortes. Áreas conhecidas ficam com a cor
 * fixa da paleta; qualquer área fora da lista recebe a primeira cor ainda
 * livre — nunca uma cor já ocupada por outra série do mesmo gráfico.
 */
export function coresDasAreas(areas: VisaoGeral['evolucaoPorArea']): string[] {
  const ocupadas = new Set<number>();
  const fixadas = areas.map((area) => {
    const indice = SERIES_FIXAS.findIndex((expressao) => expressao.test(area.area));
    if (indice !== -1 && !ocupadas.has(indice)) {
      ocupadas.add(indice);
      return indice;
    }
    return null;
  });

  let livre = 0;
  return fixadas.map((indice, posicao) => {
    if (indice !== null) return PALETA[indice];
    while (livre < PALETA.length && ocupadas.has(livre)) livre += 1;
    if (livre < PALETA.length) {
      ocupadas.add(livre);
      return PALETA[livre];
    }
    // Mais áreas do que cores: repete a paleta em vez de deixar sem cor.
    return PALETA[posicao % PALETA.length];
  });
}

const CRITICA_STROKE_WIDTH = 3;
const DEMAIS_STROKE_WIDTH = 1.5;
const DEMAIS_STROKE_OPACITY = 0.7;
/**
 * Opacidade das séries que NÃO estão sob o cursor (docs/06, princípio 2.2).
 * Corrigido de 0.18 para 0.4 (spec de movimento §11, item 7 dos 22
 * comportamentos / item 3 dos 9 de dataviz): 0.18 esmaecia demais, a ponto de
 * a linha quase desaparecer — 40% ainda deixa a forma da série legível
 * enquanto isola visualmente a que está em foco.
 */
const ESMAECIDA_STROKE_OPACITY = 0.4;

/**
 * Marcador por simulado. A série crítica ganha ponto maior e, no ÚLTIMO ponto
 * com valor, o mesmo halo + anel do ponto corrente da evolução institucional —
 * é ali que o gestor precisa parar de ler a linha e começar a agir.
 */
function PontoArea(props: {
  cx?: number | null;
  cy?: number | null;
  index?: number;
  cor: string;
  critica: boolean;
  ultimoIndice: number;
}) {
  const { cx, cy, index, cor, critica, ultimoIndice } = props;
  /**
   * `== null`, não `=== undefined` — ver a explicação completa em
   * `PontoAtual` (`charts/EvolucaoChart.tsx`). Era aqui que o sintoma
   * aparecia: neste gráfico o buraco é a regra, não a exceção (cada área tem
   * seu próprio conjunto de simulados), e cada ponto nulo virava um círculo
   * colado no topo do plot, sem representar área nenhuma.
   */
  if (cx == null || cy == null) return null;

  if (critica && index === ultimoIndice) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={12} fill={cor} opacity={0.16} />
        <circle cx={cx} cy={cy} r={5.5} fill="var(--gp-surface-1)" stroke={cor} strokeWidth={2} />
        <circle cx={cx} cy={cy} r={3.2} fill={cor} />
      </g>
    );
  }

  return <circle cx={cx} cy={cy} r={critica ? 4 : 3.5} fill={cor} />;
}

/**
 * Achados 1 e 3 (revisão de 05/08): a RPC monta `evolucaoPorArea[].pontos`
 * numa subquery correlacionada e independente por `grande_area` — áreas
 * diferentes podem ter quantidades e conjuntos de simulados diferentes
 * (questões anuladas num simulado, `grande_area` não classificada etc.).
 * `areas[0].pontos` NÃO é uma régua confiável para as demais áreas.
 *
 * Um `flatMap` + dedupe ingênuo (preservando só a ordem de primeira
 * aparição) também falha: se a área alfabeticamente primeira (`ORDER BY
 * t.area`) só tiver o 3º ponto, ele apareceria antes dos pontos 1 e 2 de
 * outra área. Em vez disso, cada par consecutivo `(pontos[i], pontos[i+1])`
 * DENTRO de uma área — que a RPC já entrega em `ORDER BY m.ord`, ou seja,
 * ordem cronológica real — se torna uma aresta "vem antes de"; a união de
 * todas essas arestas, de todas as áreas, é ordenada topologicamente
 * (Kahn). Isso reconstrói a ordem cronológica correta mesmo quando ela só
 * é observável a partir de uma área mais completa que a primeira do array.
 */
function unirRotulosNaOrdemCorreta(areas: VisaoGeral['evolucaoPorArea']): string[] {
  const primeiraAparicao: string[] = [];
  const sucessores = new Map<string, string[]>();
  const grauEntrada = new Map<string, number>();

  const registrarNo = (rotulo: string) => {
    if (!grauEntrada.has(rotulo)) {
      grauEntrada.set(rotulo, 0);
      sucessores.set(rotulo, []);
      primeiraAparicao.push(rotulo);
    }
  };

  areas.forEach((area) => {
    area.pontos.forEach((ponto, indice) => {
      registrarNo(ponto.rotulo);
      if (indice === 0) return;
      const anterior = area.pontos[indice - 1].rotulo;
      if (anterior === ponto.rotulo) return;
      const listaSucessores = sucessores.get(anterior);
      if (listaSucessores && !listaSucessores.includes(ponto.rotulo)) {
        listaSucessores.push(ponto.rotulo);
        grauEntrada.set(ponto.rotulo, (grauEntrada.get(ponto.rotulo) ?? 0) + 1);
      }
    });
  });

  const restante = new Map(grauEntrada);
  const resultado: string[] = [];
  const pendentes = primeiraAparicao.filter((rotulo) => restante.get(rotulo) === 0);

  while (pendentes.length > 0) {
    const atual = pendentes.shift();
    if (atual === undefined) break;
    resultado.push(atual);
    sucessores.get(atual)?.forEach((proximo) => {
      const grau = (restante.get(proximo) ?? 0) - 1;
      restante.set(proximo, grau);
      if (grau === 0) pendentes.push(proximo);
    });
  }

  // Segurança: se algo sobrar (ciclo — não deveria ocorrer com dados reais,
  // já que todas as áreas são subsequências de uma mesma ordem cronológica),
  // anexa no fim na ordem de primeira aparição, para nunca perder um rótulo.
  primeiraAparicao.forEach((rotulo) => {
    if (!resultado.includes(rotulo)) resultado.push(rotulo);
  });

  return resultado;
}

/**
 * Modo "Grande área" do gráfico protagonista (spec §4.8, Task 39).
 *
 * Compara as grandes áreas entre si em % de acerto — nunca proficiência,
 * que só existe onde há TRI (aluno e simulado). A área crítica vem do
 * servidor via `critica` e ganha peso visual (3px vs 1.5px a 70% de
 * opacidade nas demais); nenhum corte de nota é decidido aqui.
 *
 * Hover em uma série a isola visualmente (as outras esmaecem) e a legenda
 * clicável isola uma área por vez (clicar de novo reativa todas); uma tabela
 * colapsável oferece a mesma série em texto, para quem não lê o gráfico
 * visualmente.
 */
export function AreasChart({ areas, largura, altura = 300 }: AreasChartProps) {
  const [isolada, setIsolada] = React.useState<string | null>(null);
  const [emFoco, setEmFoco] = React.useState<string | null>(null);

  if (areas.length === 0) {
    return (
      <MolduraVazia
        testId="areas-vazio"
        altura={altura}
        rotuloMeta={`meta de acerto · ${PROFICIENCIA_MINIMA}`}
        mensagem="Sem dados por grande área neste recorte."
      />
    );
  }

  const cores = coresDasAreas(areas);

  // Eixo X = união ordenada dos rótulos de todas as áreas (nunca só
  // `areas[0]`); cada ponto casa pelo `rotulo`, nunca pelo índice — ver
  // `unirRotulosNaOrdemCorreta` acima (achados 1 e 3).
  const rotulos = unirRotulosNaOrdemCorreta(areas);
  const mapasPorArea = areas.map((area) => new Map(area.pontos.map((ponto) => [ponto.rotulo, ponto.valor])));
  const dados = rotulos.map((rotulo) => {
    const linha: Record<string, string | number | null> = { rotulo };
    areas.forEach((area, indice) => {
      linha[area.area] = mapasPorArea[indice].get(rotulo) ?? null;
    });
    return linha;
  });

  /**
   * Último rótulo COM valor de cada área — não `rotulos.length - 1`: uma área
   * pode terminar antes das outras (simulado sem questão daquela área), e o
   * marcador de destaque tem que pousar no último ponto real dela.
   */
  const ultimoIndicePorArea = areas.map((_, indice) => {
    for (let posicao = rotulos.length - 1; posicao !== -1; posicao -= 1) {
      if ((mapasPorArea[indice].get(rotulos[posicao]) ?? null) !== null) return posicao;
    }
    return -1;
  });

  /**
   * `<title>`/`<desc>` do SVG, exigidos pelo checklist de acessibilidade da
   * fase nos três modos do gráfico protagonista (mesmo padrão de
   * `EvolucaoChart`/`DispersaoChart`). "Percentual de acerto", nunca
   * "proficiência": nesta visão a métrica não é TRI (spec §4.6).
   */
  const descricao = `${areas.length} grande(s) área(s), percentual de acerto de 0 a 100 por simulado.`;

  const opacidadeDaSerie = (area: VisaoGeral['evolucaoPorArea'][number]) => {
    if (emFoco !== null && emFoco !== area.area) return ESMAECIDA_STROKE_OPACITY;
    return area.critica ? 1 : DEMAIS_STROKE_OPACITY;
  };

  const grafico = (
    <LineChart
      data={dados}
      width={largura}
      height={largura ? altura : undefined}
      /* SEM `title` (tooltip nativo do navegador sobrepondo o tooltip de
         dado) — ver a explicação completa em `charts/EvolucaoChart.tsx`. */
      desc={descricao}
      margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
    >
      {/* Grade SÓLIDA, horizontal, 1px em divisor sutil (docs/06, princípio 1). */}
      <CartesianGrid stroke="var(--gp-border-subtle)" strokeWidth={1} vertical={false} />
      <XAxis
        dataKey="rotulo"
        tick={{ fontSize: 11, fill: 'var(--gp-axis)' }}
        axisLine={{ stroke: 'var(--gp-border-strong)' }}
        tickLine={false}
        /*
         * Mesmo bug/correção de `EvolucaoChart.tsx`: sem `interval`, o
         * Recharts usa o default `'preserveEnd'` e avalia o PRIMEIRO rótulo
         * por último, com o espaço mais apertado — é o primeiro simulado que
         * costuma perder o tick. `'preserveStartEnd'` fixa o primeiro E o
         * último, sacrificando só os do meio se precisar.
         */
        interval="preserveStartEnd"
      />
      <YAxis
        domain={[0, 100]}
        ticks={TICKS_Y}
        width={40}
        tickFormatter={(valor: number) => `${valor}%`}
        tick={{ fontSize: 11, fill: 'var(--gp-axis)' }}
        axisLine={false}
        tickLine={false}
      />
      {/*
       * Sem esta linha, o modo "Grande área" era o único do portal em que o
       * gestor não conseguia ver, de relance, quais áreas estão abaixo da
       * meta — tinha que ler o eixo Y de cada linha.
       */}
      <ReferenceLine
        y={PROFICIENCIA_MINIMA}
        stroke="var(--gp-border-input)"
        strokeWidth={1.5}
        strokeDasharray="6 5"
        label={{
          value: `meta de acerto · ${PROFICIENCIA_MINIMA}`,
          position: 'insideTopRight',
          fontSize: 11,
          fill: 'var(--gp-text-3)',
        }}
      />
      <Tooltip
        formatter={(valor: number, nome: string) => [formatPct(valor), nome]}
        /* Mesma superfície escura do tooltip de `EvolucaoChart` e de todo
           tooltip do portal. `itemStyle`/`labelStyle` são obrigatórios: o
           tooltip padrão do Recharts pinta o rótulo e os itens com cor
           própria, que ficaria escura sobre fundo escuro. */
        contentStyle={{
          ...SUPERFICIE_TOOLTIP,
          border: 'none',
          borderRadius: 'var(--gp-radius-md)',
          fontSize: '12px',
          padding: '10px 14px',
        }}
        labelStyle={{ color: 'var(--gp-tooltip-value)', fontWeight: 600, marginBottom: 4 }}
        itemStyle={{ color: 'var(--gp-tooltip-label)', padding: 0 }}
      />
      {areas.map((area, indice) => (
        <Line
          key={area.area}
          type="monotone"
          dataKey={area.area}
          stroke={cores[indice]}
          strokeWidth={area.critica ? CRITICA_STROKE_WIDTH : DEMAIS_STROKE_WIDTH}
          strokeOpacity={opacidadeDaSerie(area)}
          strokeLinecap="round"
          strokeLinejoin="round"
          dot={
            <PontoArea
              cor={cores[indice]}
              critica={area.critica}
              ultimoIndice={ultimoIndicePorArea[indice]}
            />
          }
          connectNulls={false}
          isAnimationActive={false}
          hide={isolada !== null && isolada !== area.area}
          onMouseEnter={() => setEmFoco(area.area)}
          onMouseLeave={() => setEmFoco(null)}
        />
      ))}
    </LineChart>
  );

  return (
    <figure className="m-0">
      <p data-testid="areas-rotulo-metrica" className="mb-1 text-xs text-muted-foreground">
        Desempenho por grande área (% de acerto)
      </p>
      {/*
       * Achado 2 (revisão de 05/08): `role="img"` torna todo descendente
       * "presentational" (ARIA 1.2, Children Presentational: True), podando
       * a legenda clicável e a tabela colapsável — a alternativa não-visual
       * — da árvore de acessibilidade. Por isso o role fica restrito ao
       * contêiner do desenho, nunca no `<figure>` que também envolve a
       * legenda e a `<details>`.
       */}
      {largura ? (
        <div role="img" aria-label={TITULO}>
          {grafico}
        </div>
      ) : (
        <div role="img" aria-label={TITULO} style={{ height: altura }}>
          <ResponsiveContainer width="100%" height="100%">
            {grafico}
          </ResponsiveContainer>
        </div>
      )}
      <ul
        data-testid="areas-legenda"
        className="mt-3 flex flex-wrap gap-2 pt-3.5"
        style={{ borderTop: '1px solid var(--gp-border-subtle)' }}
      >
        {areas.map((area, indice) => (
          <li key={area.area}>
            <button
              type="button"
              aria-pressed={isolada === area.area}
              onClick={() => setIsolada((atual) => (atual === area.area ? null : area.area))}
              /* O mesmo destaque do hover no gráfico, também por teclado. */
              onMouseEnter={() => setEmFoco(area.area)}
              onMouseLeave={() => setEmFoco(null)}
              onFocus={() => setEmFoco(area.area)}
              onBlur={() => setEmFoco(null)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors duration-200',
                isolada === area.area
                  ? 'border-foreground/40 bg-muted font-medium'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              <span
                aria-hidden="true"
                className="h-[3px] w-4 rounded-full"
                style={{ background: cores[indice] }}
              />
              {area.area}
              {/* Task: contraste AA do rótulo "área crítica" (texto, 10px/medium — não é "bold"
                  para fins de WCAG, então o mínimo é 4,5:1, não 3:1). `text-destructive`
                  (var(--destructive) de src/index.css) reprovava AA contra os dois fundos em que
                  este <span> realmente aparece — card (padrão) e muted (botão isolado): 3,78:1/3,44:1
                  no claro, 3,48:1/3,30:1 no escuro. `gp-text-danger` (gestor-theme.css) resolve para
                  --gp-danger-on: 11,09:1/10,08:1 no claro e 7,15:1/6,78:1 no escuro — os quatro acima
                  do mínimo. NÃO mexe na cor da SÉRIE (paleta --gp-serie-*): aquela cor é a identidade
                  da grande área, não o sinal de "crítica" (que vem de espessura/opacidade), então
                  trocar o texto do badge não muda a leitura do gráfico. Ver
                  contrasteDestructive.test.tsx. */}
              {area.critica ? <span className="text-[10px] font-medium gp-text-danger">área crítica</span> : null}
            </button>
          </li>
        ))}
      </ul>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-muted-foreground">Ver dados em tabela</summary>
        <table data-testid="areas-tabela" className="mt-2 w-full text-left text-xs">
          <caption className="sr-only">{TITULO}</caption>
          <thead>
            <tr className="text-muted-foreground">
              <th scope="col" className="py-1 pr-3 font-medium">
                Grande área
              </th>
              {rotulos.map((rotulo) => (
                <th key={rotulo} scope="col" className="py-1 pr-3 font-medium">
                  {rotulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {areas.map((area, indice) => (
              <tr key={area.area} className="border-t border-border/60">
                <th scope="row" className="py-1 pr-3 font-normal">
                  {area.area}
                </th>
                {rotulos.map((rotulo) => (
                  <td key={`${area.area}-${rotulo}`} className="py-1 pr-3 tabular-nums">
                    {formatPct(mapasPorArea[indice].get(rotulo) ?? null)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
