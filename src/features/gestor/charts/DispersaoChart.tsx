import * as React from 'react';
import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import { PROFICIENCIA_MINIMA } from '@/features/gestor/lib/regras';
import { formatNumero } from '@/features/gestor/lib/formatters';
import { SUPERFICIE_TOOLTIP } from '@/features/gestor/components/Dica';
import { MolduraVazia } from '@/features/gestor/charts/MolduraVazia';
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

/** Sem o valor da meta: a linha tracejada já ocupa essa faixa (handoff §7). */
const TICKS_Y = [0, 20, 40, 80, 100];
const TITULO = 'Dispersão de proficiência por semestre, um ponto por aluno';
/** docs/06-data-viz.md §3: "Ponto = aluno; opacidade 0.75". */
const OPACIDADE_PONTO = 0.75;

/**
 * Amplitude do jitter horizontal, em unidades de semestre (±0.3 = 60% da
 * meia-distância entre duas colunas). Larga o bastante para separar dezenas
 * de alunos, estreita o bastante para nunca deixar dúvida sobre a qual
 * semestre a nuvem pertence — as colunas ficam a 1.0 de distância e o domínio
 * do eixo tem 0.5 de folga em cada ponta.
 */
const JITTER = 0.3;

/** Quantas faixas o jitter usa antes de repetir. Ímpar, para haver coluna central. */
const FAIXAS_JITTER = 9;

/**
 * Converte os pontos brutos em coordenadas de plotagem.
 *
 * O jitter vale para TODO recorte, não só para o de um semestre. O eixo X é
 * discreto (semestre é 11º ou 12º, nunca 11,4º), então sem jitter cada
 * semestre vira uma única coluna de 1px com dezenas de alunos empilhados no
 * mesmo lugar — a nuvem lia como uma régua e a distribuição, que é a única
 * coisa que este gráfico tem para dizer, sumia. Isso já estava resolvido para
 * o caso de UM semestre (§4.5) e faltava justamente onde há mais alunos.
 *
 * A troca do eixo X por uma grandeza CONTÍNUA — que resolveria a sobreposição
 * pela raiz — é decisão de produto em aberto (reunião de 07/08); o jitter é o
 * que dá para fazer sem inventar eixo novo.
 *
 * Determinístico (por índice, não aleatório): o mesmo recorte sempre desenha
 * os mesmos pontos nos mesmos lugares, entre renders e entre sessões.
 */
export function prepararPontos(
  pontos: PontoDispersao[],
): { alunoId: string; x: number; y: number; semestre: number }[] {
  /** Índice do aluno DENTRO do seu semestre — senão as colunas herdariam o
   *  deslocamento uma da outra e ficariam com nuvens de formatos diferentes. */
  const porSemestre = new Map<number, number>();

  return pontos.map((ponto) => {
    const posicao = porSemestre.get(ponto.semestre) ?? 0;
    porSemestre.set(ponto.semestre, posicao + 1);
    const faixa = (posicao % FAIXAS_JITTER) - (FAIXAS_JITTER - 1) / 2;
    const deslocamento = (faixa / ((FAIXAS_JITTER - 1) / 2)) * JITTER;
    return {
      alunoId: ponto.alunoId,
      semestre: ponto.semestre,
      /* Arredondado: sem isso o próprio limite do jitter estoura por ruído de
         ponto flutuante (0.1*3 = 0.30000000000000004), e o `x` vira um número
         diferente a cada leitura do mesmo dado. */
      x: Math.round((ponto.semestre + deslocamento) * 1e4) / 1e4,
      y: ponto.nota,
    };
  });
}

/** Mediana das notas do recorte — só usada no modo "semestre único" (§4.5). */
export function medianaDeNotas(pontos: PontoDispersao[]): number | null {
  if (pontos.length === 0) return null;
  const notas = pontos.map((ponto) => ponto.nota).sort((a, b) => a - b);
  const meio = Math.floor(notas.length / 2);
  return notas.length % 2 === 1 ? notas[meio] : (notas[meio - 1] + notas[meio]) / 2;
}

/**
 * Ponto sob o cursor (docs/06 §3: "ponto sob hover ganha anel"). Sem uma forma
 * ativa declarada, o recharts nem sequer renderiza o ponto destacado — o
 * tooltip abria e a nuvem continuava idêntica, sem dizer QUAL ponto ele lê.
 * Nada aqui expõe o `alunoId`: o anel é geometria pura.
 */
export function AnelDeFoco(props: { cx?: number; cy?: number }) {
  const { cx, cy } = props;
  if (cx === undefined || cy === undefined) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={4} fill="var(--gp-brand)" />
      <circle
        cx={cx}
        cy={cy}
        r={8}
        fill="none"
        stroke="var(--gp-brand)"
        strokeWidth={2}
        strokeOpacity={0.55}
      />
    </g>
  );
}

/**
 * Gráfico de dispersão do modo "Aluno" do gráfico protagonista da Visão
 * Geral (spec §4.8) — cada ponto é um aluno, nunca identificado em tela.
 */
export function DispersaoChart({ pontos, tendencia, largura, altura = 300, onSelecionarAluno }: DispersaoChartProps) {
  if (pontos.length === 0) {
    return (
      <MolduraVazia
        testId="dispersao-vazio"
        altura={altura}
        comGradeVertical
        mensagem="Sem alunos com resultado neste recorte."
      />
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
      /* SEM `title` (tooltip nativo do navegador sobrepondo o tooltip de
         dado) — ver a explicação completa em `charts/EvolucaoChart.tsx`. */
      desc={`${pontos.length} alunos, proficiência de 0 a 100, semestres ${semestres.join(', ')}.`}
      margin={{ top: 8, right: 12, bottom: 8, left: 0 }}
    >
      {/*
       * Grade SÓLIDA de 1px em divisor sutil. A dispersão é o único gráfico do
       * portal que mantém grade VERTICAL (docs/06, princípio 1): sem ela, a
       * coluna de cada semestre some.
       */}
      <CartesianGrid stroke="var(--gp-border-subtle)" strokeWidth={1} />
      <XAxis
        type="number"
        dataKey="x"
        name="Semestre"
        domain={[semestres[0] - 0.5, semestres[semestres.length - 1] + 0.5]}
        ticks={semestres}
        tickFormatter={(valor: number) => `${Math.round(valor)}º`}
        tick={{ fontSize: 11, fill: 'var(--gp-axis)' }}
        axisLine={{ stroke: 'var(--gp-border-strong)' }}
        tickLine={false}
      />
      <YAxis
        type="number"
        dataKey="y"
        name="Proficiência"
        domain={[0, 100]}
        ticks={TICKS_Y}
        width={36}
        tick={{ fontSize: 11, fill: 'var(--gp-axis)' }}
        axisLine={false}
        tickLine={false}
      />
      {/*
        Cores TROCADAS entre meta e mediana (reunião de 07/08).
        "Do jeito que tá hoje induz o cara a olhar mais pra essa mediana, mas
        na verdade o que importa pra ele é a meta."

        A meta de proficiência é o corte de NEGÓCIO — a régua contra a qual a
        instituição é avaliada — e estava em cinza tracejado, o desenho de um
        detalhe de fundo. A mediana é descritiva: diz onde a turma está, não
        onde deveria estar. Agora a marca está na meta (linha sólida de 2px) e
        a mediana é o traço neutro.
      */}
      <ReferenceLine
        y={PROFICIENCIA_MINIMA}
        stroke="var(--gp-brand)"
        strokeWidth={2}
        label={{
          value: `meta de proficiência · ${PROFICIENCIA_MINIMA}`,
          position: 'insideTopRight',
          fontSize: 11,
          fill: 'var(--gp-brand-on-dark)',
        }}
      />
      {mediana !== null ? (
        <ReferenceLine
          y={mediana}
          stroke="var(--gp-border-input)"
          strokeWidth={1.5}
          strokeDasharray="6 5"
          label={{
            value: 'Mediana',
            position: 'insideBottomRight',
            fontSize: 11,
            fill: 'var(--gp-text-3)',
          }}
        />
      ) : null}
      <Tooltip
        // Só os dois eixos (Semestre, Proficiência) chegam ao formatter — o
        // ponto sempre traz `alunoId`, mas o Tooltip nunca lê essa chave.
        formatter={(valor: number, nome: string) => [nome === 'Semestre' ? `${Math.round(valor)}º` : formatNumero(valor), nome]}
        /* Mesma superfície escura dos outros dois modos do gráfico
           protagonista — ver `charts/EvolucaoChart.tsx`. */
        contentStyle={{
          ...SUPERFICIE_TOOLTIP,
          border: 'none',
          borderRadius: 'var(--gp-radius-md)',
          fontSize: '12px',
          padding: '10px 14px',
        }}
        labelStyle={{ color: 'var(--gp-tooltip-value)', fontWeight: 600 }}
        itemStyle={{ color: 'var(--gp-tooltip-label)', padding: 0 }}
      />
      <Scatter
        name="Alunos"
        data={preparados}
        /*
         * Cor NEUTRA, não a marca: a marca fica reservada para o que é
         * afirmação do gráfico (mediana e reta de tendência). Com a nuvem
         * inteira em vermelho, os três elementos liam como a mesma série.
         */
        fill="var(--gp-text-3)"
        fillOpacity={OPACIDADE_PONTO}
        activeShape={<AnelDeFoco />}
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
          line={{
            stroke: 'var(--gp-brand)',
            strokeWidth: 2.5,
            strokeDasharray: '5 4',
            strokeLinecap: 'round',
            strokeOpacity: 0.8,
          }}
          isAnimationActive={false}
          legendType="none"
        />
      ) : null}
    </ScatterChart>
  );

  return (
    <figure className="m-0">
      {/*
       * `TITULO` promovido a texto VISÍVEL (antes só existia dentro do
       * `aria-label`, invisível para quem usa visão normal). Foi reportado
       * que o modo "Aluno" não deixa clara sua utilidade/interpretação — o
       * único texto em tela era o título genérico "Alunos por semestre" de
       * `GraficoProtagonista`. O `aria-label` abaixo continua carregando o
       * mesmo texto: redundância entre um elemento visível e um `aria-label`
       * não é problema de acessibilidade, é reforço.
       */}
      <p data-testid="dispersao-subtitulo" className="mb-1 text-xs text-muted-foreground">
        {TITULO}
      </p>
      {/*
       * `role="img"` fica no contêiner do DESENHO, nunca no `<figure>`:
       * `role="img"` torna todo descendente "presentational" (ARIA 1.2,
       * Children Presentational: True), o que podaria a `<figcaption>` — que
       * carrega o corte, a mediana e a legenda — e a tabela colapsável, a
       * alternativa não-visual exigida pelo handoff §5, da árvore de
       * acessibilidade (achado 2, revisão de 05/08).
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
      <figcaption
        className="mt-3 flex flex-wrap items-center gap-4 pt-3.5 text-[11px]"
        style={{ borderTop: '1px solid var(--gp-border-subtle)', color: 'var(--gp-text-3)' }}
      >
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full"
            style={{ background: 'var(--gp-text-3)', opacity: OPACIDADE_PONTO }}
          />
          Cada ponto é um aluno do recorte
        </span>
        <span className="inline-flex items-center gap-1.5">
          {/*
           * Swatch SÓLIDO de marca — casa com a `ReferenceLine` real da meta
           * (`stroke="var(--gp-brand)"`, 2px, sem `strokeDasharray`, acima).
           * Antes deste ajuste a legenda trazia aqui o traço tracejado
           * neutro, e no swatch da mediana (abaixo) o sólido de marca — as
           * cores tinham sido trocadas entre as duas `ReferenceLine` na
           * reunião de 07/08 e a legenda não acompanhou a troca, então o
           * corte (o que importa de negócio) lia como o traço secundário.
           */}
          <span
            aria-hidden="true"
            className="h-0.5 w-4 rounded-full"
            style={{ background: 'var(--gp-brand)' }}
          />
          {`Corte de proficiência: ${PROFICIENCIA_MINIMA}`}
        </span>
        {mediana !== null ? (
          <span className="inline-flex items-center gap-1.5">
            {/* Swatch TRACEJADO neutro — casa com a `ReferenceLine` real da
                mediana (`stroke="var(--gp-border-input)"`, tracejada, acima). */}
            <span
              aria-hidden="true"
              className="w-4"
              style={{ borderTop: '1.5px dashed var(--gp-border-input)' }}
            />
            {`Mediana do semestre: ${formatNumero(mediana)}`}
          </span>
        ) : null}
        {retaTendencia ? (
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="w-4"
              style={{ borderTop: '1.5px dashed var(--gp-brand)' }}
            />
            Linha de tendência
          </span>
        ) : (
          /*
           * Sem reta de tendência, o aviso fala do CONTRATO, não do recorte: a
           * reta é calculada no servidor (§4.11) e nenhuma RPC do portal a
           * publica hoje. Dizer "indisponível para este recorte" empurrava para
           * o gestor a leitura de que outro filtro traria a reta — ele trocaria
           * de recorte atrás de um dado que não existe em nenhum.
           */
          <span>A reta de tendência ainda não é publicada pelo servidor.</span>
        )}
      </figcaption>
      {/*
       * Explica o jitter (achado do reporte: o modo "Aluno" "não deixa clara
       * a utilidade e a interpretação"). O deslocamento horizontal dentro de
       * cada coluna de semestre é artificial — só separa pontos que, no eixo
       * discreto real, cairiam todos empilhados na mesma coluna de 1px (ver
       * `prepararPontos` acima) — e isso nunca era dito em tela.
       */}
      <p className="mt-1.5 text-[11px]" style={{ color: 'var(--gp-text-3)' }}>
        A posição horizontal dentro de cada semestre é só para separar os pontos visualmente — não representa nenhum dado.
      </p>
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
