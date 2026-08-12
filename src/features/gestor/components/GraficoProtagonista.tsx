import * as React from 'react';
import { useRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { AreasChart } from '@/features/gestor/charts/AreasChart';
import { DispersaoChart } from '@/features/gestor/charts/DispersaoChart';
import { EvolucaoChart } from '@/features/gestor/charts/EvolucaoChart';
import type { ModoGrafico, VisaoGeral } from '@/features/gestor/api/types';

export interface GraficoProtagonistaProps {
  visao: VisaoGeral;
}

/**
 * Rótulos exatamente como a referência os escreve nos três estados do
 * segmented ("Geral", "Grande área", "Aluno"). O "Por " que existia antes
 * ("Por grande área") transformava o seletor de MODO DE LEITURA num filtro,
 * e alargava o segmento a ponto de empurrar o título do card na largura de
 * notebook.
 */
const MODOS: { valor: ModoGrafico; rotulo: string }[] = [
  { valor: 'geral', rotulo: 'Geral' },
  { valor: 'area', rotulo: 'Grande área' },
];

const TITULOS: Record<ModoGrafico, string> = {
  geral: 'Evolução institucional',
  area: 'Evolução por grande área',
};

/** Padding do trilho, em px (referência: `padding:3px`). O indicador vive dentro dele. */
const PADDING_TRILHO = 3;

/**
 * Raio do segmento, em px. Fora da escala geral do portal {8-9, 12, 16, 10em}
 * pelo mesmo motivo já registrado em `FiltroSemestre`: a referência crava
 * `border-radius:6px` no segmento, e 8px numa pastilha de ~28px de altura já
 * lê como pílula. Os dois segmentados do portal têm que ter o MESMO raio —
 * eles aparecem lado a lado no topo da Visão Geral.
 */
const RAIO_SEGMENTO = 6;

/**
 * Fade cruzado na troca de modo (item B2 do passe de conformidade;
 * `docs/06-data-viz.md:23`: "troca o conjunto de séries com fade cruzado").
 *
 * ATÉ 09/08 este componente levava `key={modo}` no componente PAI, o que
 * forçava React a desmontar e RECRIAR este `<div>` a cada troca — não só o
 * conteúdo interno, o próprio nó-wrapper. Isso violava a regra "eixos
 * permanecem" da spec de movimento (§10/§15): o wrapper que deveria
 * persistir como moldura estável desaparecia e reaparecia junto com o
 * gráfico. Achado do passe de conformidade de 09/08.
 *
 * Correção: o `key` sai do nível do wrapper — `modo` agora chega como PROP,
 * não como identidade do componente, e o fade é retriggado por um efeito
 * (dependente de `modo`), não por remontagem. O `<div data-testid=
 * "grafico-protagonista-conteudo">` abaixo é o MESMO nó do DOM antes e depois
 * da troca (prova em `GraficoProtagonista.test.tsx`).
 *
 * Ressalva registrada aqui, não escondida: Geral/Grande área/Aluno são três
 * visualizações Recharts genuinamente diferentes (`ComposedChart`/
 * `LineChart`/`ScatterChart`, domínios de eixo X diferentes — categórico por
 * simulado nos dois primeiros, numérico por semestre no terceiro) — os
 * `<XAxis>`/`<YAxis>` internos de cada `Chart` continuam sendo desmontados e
 * remontados pelo Recharts quando o COMPONENTE do gráfico troca (isso exigiria
 * unificar os três em um único gráfico para deixar de acontecer, fora do
 * escopo desta correção). O que esta correção resolve é o remount
 * REDUNDANTE do WRAPPER, que não precisava acontecer e é a causa raiz
 * apontada no achado: a moldura do CARD (título, toggle, borda — já fora
 * deste componente) nunca remontava; agora o wrapper de conteúdo também não.
 *
 * O truque do fade-in é: nascer em `opacity: 0` e, um quadro depois
 * (`requestAnimationFrame`, não um efeito síncrono — senão o navegador nunca
 * chega a pintar o quadro em opacity 0 para a transição CSS ter de onde
 * partir), subir para `opacity: 1` — a transição CSS entre os dois quadros É
 * o fade. Isso roda de novo a cada troca de `modo` (não só na montagem),
 * porque a dependência do efeito é `[modo]`.
 *
 * `--gp-motion-3` (200ms) e `--gp-ease` por `style`, nunca `duration-[...]`/
 * `ease-[...]`: guard de `tema.test.tsx` (classe arbitrária do Tailwind é
 * ambígua — já achado real num cartão do portal, ver comentário do guard).
 *
 * Só `opacity` — sem `transform`/translação/escala (decisão registrada no
 * brief do item B2: o fade é do CONTÊINER, as séries continuam com
 * `isAnimationActive={false}` cravado, decisão separada de 05/08 documentada
 * em `movimentoGraficos.test.tsx`).
 *
 * Sob `prefers-reduced-motion: reduce`, o bloco `@media` de
 * `gestor-theme.css:309-318` já zera `transition-duration` de todo
 * descendente de `.gestor-portal` com `!important` — esta transição comum
 * cai nesse guarda-chuva sem precisar de nenhum código extra aqui.
 */
function FadeConteudoGrafico({ modo, children }: { modo: ModoGrafico; children: React.ReactNode }) {
  const [visivel, setVisivel] = React.useState(false);

  React.useEffect(() => {
    setVisivel(false);
    const quadro = requestAnimationFrame(() => setVisivel(true));
    return () => cancelAnimationFrame(quadro);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- retrigger só quando o MODO muda, não a cada render.
  }, [modo]);

  return (
    <div
      data-testid="grafico-protagonista-conteudo"
      style={{
        opacity: visivel ? 1 : 0,
        transitionProperty: 'opacity',
        transitionDuration: 'var(--gp-motion-3)',
        transitionTimingFunction: 'var(--gp-ease)',
      }}
    >
      {children}
    </div>
  );
}

/**
 * Gráfico protagonista da Visão Geral (spec §4.8) — 3 modos que leem as três
 * séries já carregadas juntas por `useVisaoGeral` (`evolucao`,
 * `evolucaoPorArea`, `dispersao`). Trocar de modo é trocar de LEITURA do
 * mesmo payload em memória, nunca um novo hook de dado: nenhum refetch
 * (§8.2, caso crítico nº15) — provado no teste com `supabase.rpc` espionado
 * através de um harness com o hook real.
 *
 * O controle vive DENTRO do card (22/07: "o filtro tem que estar no
 * gráfico, não na página"), com roving tabIndex igual a `FiltroSemestre`
 * (Fase 2): só o segmento ativo é alcançável por Tab; as setas movem seleção
 * e foco juntos.
 */
export function GraficoProtagonista({ visao }: GraficoProtagonistaProps) {
  const [modo, setModo] = React.useState<ModoGrafico>('geral');
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const indiceAtivo = MODOS.findIndex((opcao) => opcao.valor === modo);

  const selecionar = (indice: number) => {
    setModo(MODOS[indice].valor);
  };

  const aoTeclar = (evento: React.KeyboardEvent<HTMLButtonElement>) => {
    const total = MODOS.length;
    let proximo: number | null = null;
    if (evento.key === 'ArrowRight' || evento.key === 'ArrowDown') {
      proximo = (indiceAtivo + 1) % total;
    } else if (evento.key === 'ArrowLeft' || evento.key === 'ArrowUp') {
      proximo = (indiceAtivo - 1 + total) % total;
    } else if (evento.key === 'Home') {
      proximo = 0;
    } else if (evento.key === 'End') {
      proximo = total - 1;
    }
    if (proximo === null) return;
    evento.preventDefault();
    selecionar(proximo);
    refs.current[proximo]?.focus();
  };

  return (
    <Card data-testid="grafico-protagonista">
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
        <h2 className="text-sm font-semibold">{TITULOS[modo]}</h2>
        {/*
         * Anatomia do segmented do handoff, a mesma de `FiltroSemestre`:
         * trilho tintado com 1px de borda e 3px de respiro, indicador ÚNICO
         * que desliza por `transform` (200ms) sob os rótulos, e o segmento
         * ativo em pílula escura com texto inverso. O estado ativo antes era
         * `bg-background … shadow-sm` no próprio botão — sombra em botão, que
         * a régua proíbe, e um retângulo que PISCAVA de um segmento para o
         * outro em vez de deslizar.
         *
         * As três colunas têm largura igual (`grid-cols-3`) de propósito: com
         * larguras variáveis, acompanhar o indicador exigiria animar `width`,
         * e §7 só permite animar `transform` e `opacity`.
         */}
        <div
          data-testid="grafico-modos"
          role="toolbar"
          aria-label="Modo do gráfico"
          aria-orientation="horizontal"
          className="relative grid w-fit grid-cols-3"
          style={{
            background: 'var(--gp-surface-3)',
            border: '1px solid var(--gp-border-strong)',
            borderRadius: 'var(--gp-radius-sm)',
            padding: PADDING_TRILHO,
          }}
        >
          {/* Pastilha PREENCHIDA de alto contraste, igual à de `FiltroSemestre`:
              quase-preto no claro, marca no escuro (onde --gp-text-1 é claro e
              uma pastilha branca viraria um clarão). */}
          <span
            aria-hidden="true"
            data-testid="grafico-modos-indicador"
            /*
             * `ease-out` (Tailwind, `cubic-bezier(0.4,0,0.2,1)`) saiu daqui —
             * era a curva de SAÍDA (spec §2.2: "algo sai ou desaparece"), e
             * este indicador nunca sai: ele desliza de um segmento para o
             * outro, uma troca de estado bidirecional, que é exatamente a
             * definição de `--gp-ease` (spec §2.2, achado do passe de
             * conformidade de 09/08). A curva vai por `style` (não
             * `ease-[...]`): guard de `tema.test.tsx` reprova classe
             * arbitrária de curva/duração do Tailwind.
             */
            className="pointer-events-none absolute z-0 bg-[var(--gp-text-1)] transition-transform duration-200 dark:bg-[var(--gp-brand)]"
            style={{
              top: PADDING_TRILHO,
              bottom: PADDING_TRILHO,
              left: PADDING_TRILHO,
              borderRadius: RAIO_SEGMENTO,
              width: `calc((100% - ${PADDING_TRILHO * 2}px) / ${MODOS.length})`,
              transform: `translateX(${indiceAtivo * 100}%)`,
              transitionTimingFunction: 'var(--gp-ease)',
            }}
          />
          {MODOS.map((opcao, indice) => {
            const ativo = indice === indiceAtivo;
            return (
              <button
                key={opcao.valor}
                ref={(elemento) => { refs.current[indice] = elemento; }}
                type="button"
                aria-pressed={ativo}
                tabIndex={ativo ? 0 : -1}
                onClick={() => selecionar(indice)}
                onKeyDown={aoTeclar}
                className={cn(
                  'relative z-10 whitespace-nowrap transition-colors duration-200',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  ativo
                    ? 'text-[color:var(--gp-text-inverse)]'
                    : 'text-[color:var(--gp-text-3)] hover:text-[color:var(--gp-text-2)]',
                )}
                style={{
                  padding: '6px 15px',
                  borderRadius: RAIO_SEGMENTO,
                  fontSize: 12,
                  fontWeight: ativo ? 600 : 500,
                }}
              >
                {opcao.rotulo}
              </button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent>
        <FadeConteudoGrafico modo={modo}>
          {modo === 'geral' ? <EvolucaoChart pontos={visao.evolucao} /> : null}
          {modo === 'area' ? <AreasChart areas={visao.evolucaoPorArea} /> : null}
          {modo === 'aluno' ? <DispersaoChart pontos={visao.dispersao} /> : null}
        </FadeConteudoGrafico>
      </CardContent>
    </Card>
  );
}
