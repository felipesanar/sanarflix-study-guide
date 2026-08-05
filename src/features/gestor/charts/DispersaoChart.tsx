import * as React from 'react';
import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import { PROFICIENCIA_MINIMA } from '@/features/gestor/lib/regras';
import { formatNumero } from '@/features/gestor/lib/formatters';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import type { VisaoGeral } from '@/features/gestor/api/types';

type PontoDispersao = VisaoGeral['dispersao'][number];

export interface DispersaoChartProps {
  pontos: PontoDispersao[];
  /**
   * §4.11: a reta de tendência é calculada e armazenada no backend — nunca
   * regressão no cliente. Ausente/`null` = não desenhar (pendência nº4, a
   * tela não depende dela para funcionar).
   */
  tendencia?: { semestre: number; nota: number }[] | null;
  largura?: number;
  altura?: number;
  /**
   * Chamado com o `alunoId` do ponto clicado, se o consumidor quiser abrir o
   * drawer do aluno. O componente nunca renderiza esse id em tela — nem em
   * tooltip, label ou atributo do DOM (dispersão é vista agregada; a
   * coordenadora projeta esta tela em reunião de colegiado).
   */
  onSelecionarAluno?: (alunoId: string) => void;
}

const TICKS_Y = [0, 20, 40, 60, 80, 100];
const TITULO = 'Dispersão de proficiência por semestre, um ponto por aluno';

/**
 * Converte os pontos brutos em coordenadas de plotagem.
 *
 * §4.5: com um único semestre no recorte, não há eixo X para dispersar — o
 * gráfico vira "distribuição interna" daquele semestre. Sem jitter, todo
 * aluno cairia na mesma coluna vertical e os pontos se sobreporiam
 * inteiramente. O jitter é determinístico (por índice, não aleatório) para o
 * mesmo recorte sempre desenhar os mesmos pontos nos mesmos lugares.
 */
export function prepararPontos(
  pontos: PontoDispersao[],
): { alunoId: string; x: number; y: number; semestre: number }[] {
  const semestres = Array.from(new Set(pontos.map((ponto) => ponto.semestre)));
  const semestreUnico = semestres.length === 1;
  return pontos.map((ponto, indice) => ({
    alunoId: ponto.alunoId,
    semestre: ponto.semestre,
    x: semestreUnico ? ponto.semestre + ((indice % 7) - 3) * 0.06 : ponto.semestre,
    y: ponto.nota,
  }));
}

/** Mediana das notas do recorte — só usada no modo "semestre único" (§4.5). */
export function medianaDeNotas(pontos: PontoDispersao[]): number | null {
  if (pontos.length === 0) return null;
  const notas = pontos.map((ponto) => ponto.nota).sort((a, b) => a - b);
  const meio = Math.floor(notas.length / 2);
  return notas.length % 2 === 1 ? notas[meio] : (notas[meio - 1] + notas[meio]) / 2;
}

/**
 * Gráfico de dispersão do modo "Por aluno" do gráfico protagonista da Visão
 * Geral (spec §4.8) — cada ponto é um aluno, nunca identificado em tela.
 */
export function DispersaoChart({ pontos, tendencia, largura, altura = 300, onSelecionarAluno }: DispersaoChartProps) {
  if (pontos.length === 0) {
    return (
      <div data-testid="dispersao-vazio">
        <EstadoVazio titulo="Sem alunos com resultado neste recorte." altura={altura} />
      </div>
    );
  }

  const preparados = prepararPontos(pontos);
  const semestres = Array.from(new Set(pontos.map((ponto) => ponto.semestre))).sort((a, b) => a - b);
  const semestreUnico = semestres.length === 1;
  const mediana = semestreUnico ? medianaDeNotas(pontos) : null;
  const retaTendencia = tendencia?.map((ponto) => ({ x: ponto.semestre, y: ponto.nota })) ?? null;

  const grafico = (
    <ScatterChart
      width={largura}
      height={largura ? altura : undefined}
      title={TITULO}
      desc={`${pontos.length} alunos, proficiência de 0 a 100, semestres ${semestres.join(', ')}.`}
      margin={{ top: 8, right: 56, bottom: 8, left: 0 }}
    >
      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
      <XAxis
        type="number"
        dataKey="x"
        name="Semestre"
        domain={[semestres[0] - 0.5, semestres[semestres.length - 1] + 0.5]}
        ticks={semestres}
        tickFormatter={(valor: number) => `${Math.round(valor)}º`}
        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
        axisLine={false}
        tickLine={false}
      />
      <YAxis
        type="number"
        dataKey="y"
        name="Proficiência"
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
        label={{ value: `Corte ${PROFICIENCIA_MINIMA}`, position: 'right', fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
      />
      {mediana !== null ? (
        <ReferenceLine
          y={mediana}
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          label={{ value: 'Mediana', position: 'right', fontSize: 11, fill: 'hsl(var(--primary))' }}
        />
      ) : null}
      <Tooltip
        // Só os dois eixos (Semestre, Proficiência) chegam ao formatter — o
        // ponto sempre traz `alunoId`, mas o Tooltip nunca lê essa chave.
        formatter={(valor: number, nome: string) => [nome === 'Semestre' ? `${Math.round(valor)}º` : formatNumero(valor), nome]}
        contentStyle={{
          backgroundColor: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          borderRadius: '8px',
          fontSize: '12px',
        }}
      />
      <Scatter
        name="Alunos"
        data={preparados}
        fill="hsl(var(--primary))"
        fillOpacity={0.55}
        isAnimationActive={false}
        cursor={onSelecionarAluno ? 'pointer' : undefined}
        onClick={
          onSelecionarAluno
            ? (dado: { alunoId?: string }) => {
                if (dado?.alunoId) onSelecionarAluno(dado.alunoId);
              }
            : undefined
        }
      />
      {retaTendencia ? (
        <Scatter
          name="Tendência"
          data={retaTendencia}
          fill="transparent"
          line={{ stroke: 'hsl(var(--primary))', strokeWidth: 2, strokeDasharray: '6 4' }}
          isAnimationActive={false}
          legendType="none"
        />
      ) : null}
    </ScatterChart>
  );

  return (
    <figure className="m-0">
      {/*
       * `role="img"` fica no contêiner do DESENHO, nunca no `<figure>`:
       * `role="img"` torna todo descendente "presentational" (ARIA 1.2,
       * Children Presentational: True), o que podaria a `<figcaption>` — que
       * carrega o corte, a mediana e o aviso de tendência indisponível — e a
       * tabela colapsável, a alternativa não-visual exigida pelo handoff §5, da
       * árvore de acessibilidade (achado 2, revisão de 05/08).
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
      <figcaption className="text-xs text-muted-foreground">
        Corte de proficiência: {PROFICIENCIA_MINIMA}.
        {mediana !== null ? ` Mediana do semestre: ${formatNumero(mediana)}.` : ''}
        {retaTendencia ? '' : ' Linha de tendência indisponível para este recorte.'}
      </figcaption>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-muted-foreground">Ver dados em tabela</summary>
        {/*
          Alternativa textual/tabular exigida para acessibilidade (contrato do
          handoff, §5). Deliberadamente sem coluna de aluno: a tabela é o
          mesmo gráfico em outra forma, não uma lista de alunos identificados.
        */}
        <table data-testid="dispersao-tabela" className="mt-2 w-full text-left text-xs">
          <caption className="sr-only">{TITULO}</caption>
          <thead>
            <tr className="text-muted-foreground">
              <th scope="col" className="py-1 pr-3 font-medium">Semestre</th>
              <th scope="col" className="py-1 font-medium">Proficiência</th>
            </tr>
          </thead>
          <tbody>
            {pontos.map((ponto) => (
              // `key` não é serializado no DOM (não é atributo, é interno ao
              // reconciliador do React) — usar `alunoId` aqui não viola a
              // regra de nunca expor o id em tela.
              <tr key={ponto.alunoId} className="border-t border-border/60">
                <th scope="row" className="py-1 pr-3 font-normal">{ponto.semestre}º</th>
                <td className="py-1 tabular-nums">{formatNumero(ponto.nota)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
