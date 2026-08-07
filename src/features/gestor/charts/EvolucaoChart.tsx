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
}

/**
 * Sem o valor da meta: a linha tracejada de meta já ocupa essa altura e traz o
 * próprio rótulo. Mantê-lo aqui desenhava duas linhas e dois rótulos na mesma
 * faixa (handoff §7 / LIGHT.html, cujos rótulos de Y saltam de 40 para 80).
 */
const TICKS_Y = [0, 20, 40, 80, 100];
const TITULO = 'Evolução da proficiência institucional por simulado';

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
function PontoAtual(props: { cx?: number; cy?: number; index?: number; ultimoIndice: number }) {
  const { cx, cy, index, ultimoIndice } = props;
  if (cx === undefined || cy === undefined) return null;

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
      className="rounded-xl px-3 py-2 text-xs"
      style={{
        background: 'var(--gp-surface-1)',
        border: '1px solid var(--gp-border-strong)',
        boxShadow: 'var(--gp-shadow-card)',
      }}
    >
      <p className="font-semibold" style={{ color: 'var(--gp-text-1)' }}>
        {ponto.rotulo}
      </p>
      <p className="tabular-nums" style={{ color: 'var(--gp-text-3)' }}>
        {`${formatNumero(ponto.valor)} de proficiência · ${formatNumero(ponto.participantes)} alunos`}
      </p>
      <p style={{ color: 'var(--gp-text-3)' }}>{formatData(ponto.data)}</p>
    </div>
  );
}

/** Rodapé de legenda do handoff (docs/06, princípio 2: legenda sempre). */
function LegendaEvolucao() {
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
        Proficiência institucional
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="w-4"
          style={{ borderTop: '1.5px dashed var(--gp-border-input)' }}
        />
        {`Meta ${PROFICIENCIA_MINIMA}`}
      </span>
    </figcaption>
  );
}

export function EvolucaoChart({ pontos, largura, altura = 300 }: EvolucaoChartProps) {
  const descricao = `Proficiência institucional por simulado, escala 0 a 100, com ${pontos.length} simulado(s) realizado(s). Meta institucional de ${PROFICIENCIA_MINIMA}.`;

  const tabela = (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs text-muted-foreground">Ver dados em tabela</summary>
      <table data-testid="evolucao-tabela" className="mt-2 w-full text-left text-xs">
        <caption className="sr-only">{TITULO}</caption>
        <thead>
          <tr className="text-muted-foreground">
            <th scope="col" className="py-1 pr-3 font-medium">Simulado</th>
            <th scope="col" className="py-1 pr-3 font-medium">Data</th>
            <th scope="col" className="py-1 pr-3 font-medium">Proficiência</th>
            <th scope="col" className="py-1 font-medium">Participantes</th>
          </tr>
        </thead>
        <tbody>
          {pontos.map((ponto) => (
            <tr key={ponto.simuladoId} className="border-t border-border/60">
              <th scope="row" className="py-1 pr-3 font-normal">{ponto.nome}</th>
              <td className="py-1 pr-3 tabular-nums">{formatData(ponto.data)}</td>
              <td className="py-1 pr-3 tabular-nums">{formatNumero(ponto.valor)}</td>
              <td className="py-1 tabular-nums">{formatNumero(ponto.participantes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );

  if (pontos.length === 0) {
    return (
      <MolduraVazia
        testId="evolucao-vazio"
        altura={altura}
        mensagem="Nenhum simulado realizado neste recorte."
      />
    );
  }

  // Handoff de data viz: com 1 simulado não se desenha linha de um ponto.
  if (pontos.length === 1) {
    const unico = pontos[0];
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
          <span className="text-3xl font-semibold tabular-nums">{formatNumero(unico.valor)}</span>
          <span className="text-xs text-muted-foreground">
            {`${unico.nome} · ${formatData(unico.data)} · ${formatNumero(unico.participantes)} alunos`}
          </span>
        </div>
        <figcaption className="text-xs text-muted-foreground">
          Primeira medição; a evolução aparece a partir do segundo simulado.
        </figcaption>
        {tabela}
      </figure>
    );
  }

  const dados: DadoEvolucao[] = pontos.map((ponto) => ({
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
      title={TITULO}
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
      />
      <YAxis
        domain={[0, 100]}
        ticks={TICKS_Y}
        width={36}
        tick={{ fontSize: 11, fill: 'var(--gp-axis)' }}
        axisLine={false}
        tickLine={false}
      />
      <ReferenceLine
        y={PROFICIENCIA_MINIMA}
        stroke="var(--gp-border-input)"
        strokeWidth={1.5}
        strokeDasharray="6 5"
        /*
         * `insideTopRight`: o rótulo mora DENTRO do plot, ancorado à direita e
         * acima da linha. Fora dele (o antigo `position: 'right'`) obrigava a
         * reservar 56px de margem morta à direita só para caber o texto.
         */
        label={{
          value: `meta de proficiência · ${PROFICIENCIA_MINIMA}`,
          position: 'insideTopRight',
          fontSize: 11,
          fill: 'var(--gp-text-3)',
        }}
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
      <LegendaEvolucao />
      {tabela}
    </figure>
  );
}
