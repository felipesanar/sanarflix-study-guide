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

const TICKS_Y = [0, 20, 40, 60, 80, 100];
const TITULO = 'Evolução da proficiência institucional por simulado';

function PontoAtual(props: { cx?: number; cy?: number; index?: number; ultimoIndice: number }) {
  const { cx, cy, index, ultimoIndice } = props;
  if (cx === undefined || cy === undefined) return null;
  const corrente = index === ultimoIndice;
  return (
    <g>
      {corrente ? <circle cx={cx} cy={cy} r={9} fill="hsl(var(--primary))" fillOpacity={0.18} /> : null}
      <circle
        cx={cx}
        cy={cy}
        r={corrente ? 5 : 3.5}
        fill="hsl(var(--primary))"
        stroke="hsl(var(--card))"
        strokeWidth={2}
      />
    </g>
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
      <div data-testid="evolucao-vazio" className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        Nenhum simulado realizado neste recorte.
      </div>
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
          <span className="relative flex h-4 w-4 items-center justify-center">
            <span className="absolute h-4 w-4 rounded-full bg-primary/20" />
            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
          <span className="text-3xl font-semibold tabular-nums">{formatNumero(unico.valor)}</span>
          <span className="text-xs text-muted-foreground">{unico.nome} · {formatData(unico.data)}</span>
        </div>
        <figcaption className="text-xs text-muted-foreground">
          Primeira medição; a evolução aparece a partir do segundo simulado.
        </figcaption>
        {tabela}
      </figure>
    );
  }

  const dados = pontos.map((ponto) => ({ rotulo: ponto.nome, valor: ponto.valor }));
  const ultimoIndice = dados.length - 1;

  const grafico = (
    <ComposedChart
      data={dados}
      width={largura}
      height={largura ? altura : undefined}
      title={TITULO}
      desc={descricao}
      margin={{ top: 8, right: 56, bottom: 0, left: 0 }}
    >
      <defs>
        <linearGradient id="gradiente-evolucao-gestor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" vertical={false} />
      <XAxis dataKey="rotulo" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
      <YAxis
        domain={[0, 100]}
        ticks={TICKS_Y}
        width={36}
        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
        axisLine={false}
        tickLine={false}
      />
      <ReferenceLine
        y={PROFICIENCIA_MINIMA}
        stroke="hsl(var(--muted-foreground))"
        strokeDasharray="6 4"
        label={{ value: `Meta ${PROFICIENCIA_MINIMA}`, position: 'right', fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
      />
      <Tooltip
        formatter={(valor: number) => [formatNumero(valor), 'Proficiência']}
        contentStyle={{
          backgroundColor: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          borderRadius: '8px',
          fontSize: '12px',
        }}
      />
      <Area type="monotone" dataKey="valor" stroke="none" fill="url(#gradiente-evolucao-gestor)" isAnimationActive={false} />
      <Line
        type="monotone"
        dataKey="valor"
        stroke="hsl(var(--primary))"
        strokeWidth={2.5}
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
      <figcaption className="text-xs text-muted-foreground">
        Meta institucional de proficiência: {PROFICIENCIA_MINIMA}.
      </figcaption>
      {tabela}
    </figure>
  );
}
