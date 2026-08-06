// src/features/gestor/charts/AreasChart.tsx
import * as React from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cn } from '@/lib/utils';
import { formatPct } from '@/features/gestor/lib/formatters';
import type { VisaoGeral } from '@/features/gestor/api/types';

export interface AreasChartProps {
  areas: VisaoGeral['evolucaoPorArea'];
  largura?: number;
  altura?: number;
}

const TICKS_Y = [0, 20, 40, 60, 80, 100];

/**
 * Título/nome acessível do gráfico. Deliberadamente "desempenho", nunca
 * "proficiência" — na visão por grande área a métrica é % de acerto, e
 * "proficiência" só existe onde há TRI (aluno e simulado), spec §4.6.
 */
const TITULO = 'Desempenho por grande área, em percentual de acerto, por simulado';

/**
 * Paleta por posição no array. A área crítica não ganha cor própria — ela se
 * destaca por espessura e opacidade (ver `CRITICA_*` abaixo), nunca por cor,
 * porque a marcação de "crítica" é dado do servidor (`evolucaoPorArea[].critica`,
 * spec §4.4/§4.10), não algo que este componente decida.
 */
const CORES = [
  'hsl(var(--destructive))',
  'hsl(var(--primary))',
  'hsl(var(--chart-3, var(--primary)))',
  'hsl(var(--chart-4, var(--muted-foreground)))',
  'hsl(var(--chart-5, var(--foreground)))',
];

const CRITICA_STROKE_WIDTH = 3;
const DEMAIS_STROKE_WIDTH = 1.5;
const DEMAIS_STROKE_OPACITY = 0.7;

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
 * Modo "Por grande área" do gráfico protagonista (spec §4.8, Task 39).
 *
 * Compara as grandes áreas entre si em % de acerto — nunca proficiência,
 * que só existe onde há TRI (aluno e simulado). A área crítica vem do
 * servidor via `critica` e ganha peso visual (3px vs 1.5px a 70% de
 * opacidade nas demais); nenhum corte de nota é decidido aqui.
 *
 * Legenda clicável isola uma área por vez (clicar de novo reativa todas) e
 * uma tabela colapsável oferece a mesma série em texto, para quem não lê o
 * gráfico visualmente.
 */
export function AreasChart({ areas, largura, altura = 300 }: AreasChartProps) {
  const [isolada, setIsolada] = React.useState<string | null>(null);

  if (areas.length === 0) {
    return (
      <div
        data-testid="areas-vazio"
        className="flex h-[300px] items-center justify-center text-sm text-muted-foreground"
      >
        Sem dados por grande área neste recorte.
      </div>
    );
  }

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
   * `<title>`/`<desc>` do SVG, exigidos pelo checklist de acessibilidade da
   * fase nos três modos do gráfico protagonista (mesmo padrão de
   * `EvolucaoChart`/`DispersaoChart`). "Percentual de acerto", nunca
   * "proficiência": nesta visão a métrica não é TRI (spec §4.6).
   */
  const descricao = `${areas.length} grande(s) área(s), percentual de acerto de 0 a 100 por simulado.`;

  const grafico = (
    <LineChart
      data={dados}
      width={largura}
      height={largura ? altura : undefined}
      title={TITULO}
      desc={descricao}
      margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
    >
      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" vertical={false} />
      <XAxis
        dataKey="rotulo"
        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
        axisLine={false}
        tickLine={false}
      />
      <YAxis
        domain={[0, 100]}
        ticks={TICKS_Y}
        width={40}
        tickFormatter={(valor: number) => `${valor}%`}
        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
        axisLine={false}
        tickLine={false}
      />
      <Tooltip
        formatter={(valor: number, nome: string) => [formatPct(valor), nome]}
        contentStyle={{
          backgroundColor: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          borderRadius: '8px',
          fontSize: '12px',
        }}
      />
      {areas.map((area, indice) => (
        <Line
          key={area.area}
          type="monotone"
          dataKey={area.area}
          stroke={CORES[indice % CORES.length]}
          strokeWidth={area.critica ? CRITICA_STROKE_WIDTH : DEMAIS_STROKE_WIDTH}
          strokeOpacity={area.critica ? 1 : DEMAIS_STROKE_OPACITY}
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
          hide={isolada !== null && isolada !== area.area}
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
      <ul data-testid="areas-legenda" className="mt-2 flex flex-wrap gap-2">
        {areas.map((area, indice) => (
          <li key={area.area}>
            <button
              type="button"
              aria-pressed={isolada === area.area}
              onClick={() => setIsolada((atual) => (atual === area.area ? null : area.area))}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
                isolada === area.area
                  ? 'border-foreground/40 bg-muted font-medium'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: CORES[indice % CORES.length] }}
              />
              {area.area}
              {/* Task: contraste AA do rótulo "área crítica" (texto, 10px/medium — não é "bold"
                  para fins de WCAG, então o mínimo é 4,5:1, não 3:1). `text-destructive`
                  (var(--destructive) de src/index.css) reprovava AA contra os dois fundos em que
                  este <span> realmente aparece — card (padrão) e muted (botão isolado): 3,78:1/3,44:1
                  no claro, 3,48:1/3,30:1 no escuro. `gp-text-danger` (gestor-theme.css) resolve para
                  --gp-danger-on: 11,09:1/10,08:1 no claro e 7,15:1/6,78:1 no escuro — os quatro acima
                  do mínimo. NÃO mexe em CORES[0] (var(--destructive) como cor de série, linhas 29-35):
                  aquela cor é só a posição 0 da paleta, não o sinal de "crítica" (que vem de espessura/
                  opacidade), então trocar o texto do badge não muda a leitura do gráfico. Ver
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
