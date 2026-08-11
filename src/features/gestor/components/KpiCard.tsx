import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { Tag, TagDelta } from '@/features/gestor/components/Tag';
import { TooltipRastreabilidade } from '@/features/gestor/components/TooltipRastreabilidade';
import { TRACO, formatNumero } from '@/features/gestor/lib/formatters';
import { useCountUp } from '@/features/gestor/hooks/useCountUp';
import { useDelayedLoading } from '@/features/gestor/hooks/useDelayedLoading';
import { FONTE_MONO } from '@/features/gestor/components/tabela/TabelaGestor';
import type { Meta, PontoSerie } from '@/features/gestor/api/types';

export type EstadoKpi = 'ok' | 'loading' | 'empty' | 'error';

export interface KpiCardProps {
  titulo: string;
  /**
   * Linha de critério VISÍVEL sob o título (handoff §4.2): "acima de 60 de
   * proficiência", "projeção institucional · escala 1 a 5". Sem ela o cartão
   * mostra um número sem dizer o que o número mede — o critério ficava só
   * dentro do tooltip, atrás de hover/foco.
   */
  hint?: string;
  valor: string;
  /**
   * Valor numérico bruto por trás de `valor`, para o count-up (handoff
   * `docs/07-motion.md`: 560ms, `--gp-motion-5`). **Opcional** — sem ele
   * (o caso de quem só tem a string pronta, como `SeletorSimulados`'s
   * comparativo por simulado) o cartão cai no comportamento de hoje:
   * imprime `valor` direto, sem animar. `null` é "sem número para animar"
   * (KPI vazio/sem dado), não dispara count-up.
   */
  valorNumerico?: number | null;
  /**
   * Formatador POR QUADRO da animação: recebe o número intermediário que
   * `useCountUp` produz a cada frame e devolve a string que aparece —
   * normalmente o mesmo formatador que produziu `valor` (ex.: `formatPct`).
   * O count-up só liga com os DOIS presentes (`valorNumerico` e
   * `formatarValor`); faltando um dos dois, o cartão imprime `valor` como
   * sempre fez.
   */
  formatarValor?: (valor: number) => string;
  /**
   * Escala subordinada ao número, em elemento PRÓPRIO: "/ 5", "/ 7", "/ 100".
   * Nunca concatenada dentro de `valor` — a referência dá ao sufixo corpo e
   * cor diferentes do número protagonista.
   */
  sufixo?: string;
  /**
   * `escala` (13px, o padrão) é o "/ 5" do conceito; `fracao` (20px/600) é o
   * denominador do contrato no cartão de simulados, que a referência desenha
   * com muito mais peso por ser metade da informação do KPI.
   */
  densidadeSufixo?: 'escala' | 'fracao';
  meta: Meta;
  /** Sobrescreve `meta.criterio` na rastreabilidade quando o critério é específico deste KPI. */
  criterio?: string;
  /** Ex.: "projetado" no Conceito ENAMED — o conceito é derivado, não medido diretamente. */
  badge?: string;
  delta?: number | null;
  /** Régua `1º simulado · anterior · atual` (spec §4.8). Ausente ou com 1 ponto → régua não aparece. */
  serie?: PontoSerie[];
  formatarPonto?: (valor: number | null) => string;
  trilha?: { feitos: number; total: number };
  /**
   * Substitui a linha do número quando o indicador NÃO tem um valor único:
   * o Conceito ENAMED com 2+ simulados é comparativo por simulado, nunca
   * média (§4.1) — e o cartão então não pode renderizar um `kpi-valor`.
   */
  corpo?: React.ReactNode;
  rodape?: React.ReactNode;
  estado?: EstadoKpi;
  onTentarNovamente?: () => void;
  /** O Detalhamento identifica cada cartão pelo indicador (`kpi-acerto-medio`, …). */
  testId?: string;
}

/**
 * Quantos pips o skeleton da trilha desenha quando o cartão real usa trilha
 * (em vez de régua) — não o `trilha.total` verdadeiro, que ainda não chegou.
 * Um número fixo, só para comunicar "isto vai ser uma trilha segmentada".
 */
const PIPS_SKELETON_TRILHA = 5;

/**
 * Cartão de KPI, reusado 4x na Visão Geral e 3x no Detalhamento.
 *
 * O protagonista é a EVOLUÇÃO, não o valor absoluto isolado — decisão da
 * reunião de 22/07 (spec §4.8): a IES contrata uma linha do tempo; a pergunta
 * dela é "estamos melhorando?", não "quanto é". Por isso o cartão sempre
 * expõe o delta contra o simulado anterior e a régua `1º · anterior · atual`
 * contra o primeiro, quando a série sustenta os dois pontos.
 *
 * A régua **não** aparece com 1 simulado realizado: evolução pressupõe
 * comparação, e mostrar régua com uma única medição sugeriria uma tendência
 * que o dado não tem.
 *
 * Toda a caixa (padding 18, gap 14, raio --gp-radius-lg, sombra
 * --gp-shadow-card) vem por `style` em vez de utilitário Tailwind: o `Card`
 * compartilhado é de aluno/admin também, e vestir o cartão do gestor por
 * classe exigiria mexer no primitivo.
 */
export function KpiCard({
  titulo,
  hint,
  valor,
  valorNumerico,
  formatarValor,
  sufixo,
  densidadeSufixo = 'escala',
  meta,
  criterio,
  badge,
  delta,
  serie,
  formatarPonto = formatNumero,
  trilha,
  corpo,
  rodape,
  estado = 'ok',
  onTentarNovamente,
  testId = 'kpi-card',
}: KpiCardProps) {
  // Hook incondicional (regra do React): o `null` abaixo é "sem número para
  // animar", e é a própria `useCountUp` que decide não agendar frame nenhum
  // nesse caso — ver seu cabeçalho.
  const valorAnimado = useCountUp(typeof valorNumerico === 'number' ? valorNumerico : null);
  /**
   * Regra dos 400ms (spec de motion §7, Onda 1): o skeleton só aparece se o
   * carregamento persistir por mais de 400ms — abaixo disso, mostrá-lo a
   * cada troca de recorte seria o "flash" que a regra existe para eliminar.
   * Enquanto o atraso não vence, o corpo do cartão fica em branco (a moldura
   * — título e hint, já reais e imediatos, ver abaixo — não pisca).
   */
  const mostrarSkeleton = useDelayedLoading(estado === 'loading');
  /**
   * Count-up só liga com os DOIS ingredientes presentes — o número bruto E o
   * formatador de quadro. Um sem o outro cai no `valor` já formatado de
   * sempre (item B1 do passe de conformidade: props novas são opcionais,
   * consumidores que só têm a string pronta — ex.: o comparativo por
   * simulado do Detalhamento quando `corpo` substitui a linha do número —
   * continuam funcionando sem mudar nada).
   */
  const usaContagem = estado === 'ok' && typeof valorNumerico === 'number' && formatarValor !== undefined;
  const textoValor = estado === 'empty' ? TRACO : usaContagem ? formatarValor!(valorAnimado) : valor;

  const mostrarRegua = estado === 'ok' && Array.isArray(serie) && serie.length >= 2;
  /**
   * Limitado a 100 desde 05/08, quando o numerador de "Simulados realizados"
   * deixou de vir dos slots do contrato e passou a contar simulados com nota
   * (ver `contarSimuladosComNotaReal` em `api/queries.ts`). Antes disso
   * `feitos` nunca podia exceder `total` por construção; agora uma IES que
   * aplicou mais simulados do que contratou faria `aria-valuenow` passar de
   * `aria-valuemax`, e a barra vazaria do trilho. O número em texto continua
   * mostrando a razão real — quem é limitado aqui é só a representação.
   */
  const percentualTrilha =
    trilha && trilha.total > 0 ? Math.min(100, Math.round((trilha.feitos / trilha.total) * 100)) : 0;
  /** Mesmo motivo do clamp acima: mais simulados que o contrato não vira resto negativo. */
  const restantesTrilha = trilha ? Math.max(0, trilha.total - trilha.feitos) : 0;

  return (
    <Card
      data-testid={testId}
      className="h-full"
      style={{ borderRadius: 'var(--gp-radius-lg)', boxShadow: 'var(--gp-shadow-card)' }}
    >
      <CardContent className="flex h-full min-h-[148px] flex-col" style={{ padding: 18, gap: 14 }}>
        <div className="flex flex-col" style={{ gap: 3 }}>
          <div className="flex items-center" style={{ gap: 6 }}>
            <span
              data-testid="kpi-titulo"
              className="leading-tight"
              style={{ fontSize: 14, fontWeight: 700, color: 'var(--gp-text-1)' }}
            >
              {titulo}
            </span>
            {badge ? <Tag variant="qualificador">{badge}</Tag> : null}
            <TooltipRastreabilidade meta={meta} criterio={criterio} titulo={titulo} className="ml-auto" />
          </div>
          {hint ? (
            <span data-testid="kpi-hint" style={{ fontSize: 11, color: 'var(--gp-text-3)' }}>
              {hint}
            </span>
          ) : null}
        </div>

        {estado === 'loading' ? (
          mostrarSkeleton ? (
            /*
             * Composição que reproduz a ANATOMIA real do cartão (spec §5,
             * item 1) — não mais um bloco só. Título e hint FICAM DE FORA
             * desta composição: são props estáticas (a string já chega no
             * primeiro render, nunca é buscada), então já aparecem reais e
             * imediatos no bloco acima, como manda a decisão #2 da Onda 1
             * ("a moldura estática entra com o reveal, independente do
             * delay do skeleton"). Só o número e a régua/trilha dependem do
             * dado que ainda não chegou — são eles que ficam em skeleton.
             */
            <div data-testid="kpi-skeleton" className="flex flex-1 flex-col" style={{ gap: 14 }}>
              {/* Bloco do número: mesma altura (44px) que `kpi-valor` ocupa. */}
              <GestorSkeleton altura={44} rotulo={`Carregando ${titulo}`} className="w-24" />

              {serie !== undefined ? (
                /* Faixa da régua com 3 colunas — a mesma moldura emoldurada
                   (borda + raio 9) de `kpi-regua`, com rótulo+valor de cada
                   célula em skeleton no lugar do texto. */
                <div
                  data-testid="kpi-regua-skeleton"
                  className="mt-auto flex overflow-hidden"
                  style={{ border: '1px solid var(--gp-border-subtle)', borderRadius: 9 }}
                >
                  {[0, 1, 2].map((indice) => (
                    <div
                      key={indice}
                      className="flex flex-1 flex-col items-center"
                      style={{
                        padding: '7px 6px',
                        gap: 4,
                        borderLeft: indice === 0 ? undefined : '1px solid var(--gp-border-subtle)',
                      }}
                    >
                      <GestorSkeleton altura={8} rotulo={`Carregando ${titulo}`} className="w-8" />
                      <GestorSkeleton altura={14} rotulo={`Carregando ${titulo}`} className="w-10" />
                    </div>
                  ))}
                </div>
              ) : trilha !== undefined ? (
                /* Cartões sem régua (ex.: "Simulados realizados") fecham no
                   rodapé com trilha — os mesmos pips segmentados do
                   progressbar real, em skeleton. */
                <div data-testid="kpi-trilha-skeleton" className="mt-auto flex" style={{ gap: 5 }}>
                  {Array.from({ length: PIPS_SKELETON_TRILHA }, (_, indice) => (
                    <GestorSkeleton
                      key={indice}
                      altura={8}
                      rotulo={`Carregando ${titulo}`}
                      className="flex-1 !rounded-full"
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex-1" aria-hidden="true" />
          )
        ) : estado === 'error' ? (
          <div className="flex-1">
            <EstadoErro
              titulo="Não foi possível carregar este indicador."
              onRetry={onTentarNovamente ?? (() => undefined)}
            />
          </div>
        ) : (
          <>
            {corpo ?? (
              <div className="flex flex-wrap items-baseline min-w-0" style={{ gap: 9, rowGap: 6 }}>
                <span
                  data-testid="kpi-valor"
                  className="tabular-nums"
                  style={{
                    fontSize: 44,
                    fontWeight: 800,
                    letterSpacing: '-0.035em',
                    lineHeight: '36px',
                    color: 'var(--gp-text-1)',
                  }}
                >
                  {textoValor}
                </span>
                {estado === 'ok' && sufixo ? (
                  <span
                    data-testid="kpi-sufixo"
                    className="tabular-nums"
                    style={{
                      fontSize: densidadeSufixo === 'fracao' ? 20 : 13,
                      fontWeight: densidadeSufixo === 'fracao' ? 600 : undefined,
                      color: 'var(--gp-text-3)',
                    }}
                  >
                    {sufixo}
                  </span>
                ) : null}
                {estado === 'ok' && meta.lowSample ? (
                  /* Sem o `n` da amostra: `Meta` (api/types.ts) não carrega tamanho de
                     amostra, e `TagCoberturaParcial` exige o número. Inventar um seria
                     pior que omitir — pendência de contrato, registrada no retorno. */
                  <Tag variant="ausencia" data-testid="kpi-cobertura-parcial" className="shrink-0">
                    cobertura parcial
                  </Tag>
                ) : null}
                {estado === 'ok' && delta !== undefined && delta !== null ? (
                  /* O `span` externo existe só para carregar o `data-testid` e o
                     `ml-auto`: `TagDelta` é anatomia fechada (§5) e não recebe
                     atributos arbitrários. */
                  <span data-testid="kpi-delta" className="ml-auto inline-flex min-w-0 max-w-full">
                    <TagDelta valor={delta} sufixo=" vs anterior" densidade="kpi" className="max-w-full overflow-hidden text-ellipsis" />
                  </span>

                ) : null}
              </div>
            )}

            {mostrarRegua ? (
              <ol
                data-testid="kpi-regua"
                aria-label="Evolução do indicador"
                className="mt-auto flex overflow-hidden"
                style={{ border: '1px solid var(--gp-border-subtle)', borderRadius: 9 }}
              >
                {serie!.map((ponto, indice) => {
                  const corrente = indice === serie!.length - 1;
                  const primeiro = indice === 0;
                  return (
                    <li
                      key={`${ponto.rotulo}-${indice}`}
                      className="flex flex-col items-center"
                      style={{
                        flex: 1,
                        padding: '7px 6px',
                        gap: 2,
                        /* Divisor de 1px entre células: borda do próprio item, e não um
                           nó separado — `<ol>` só admite `<li>` como filho. */
                        borderLeft: primeiro ? undefined : '1px solid var(--gp-border-subtle)',
                        background: corrente ? 'var(--gp-brand-surface)' : undefined,
                      }}
                    >
                      <span
                        className="uppercase"
                        style={{
                          fontSize: 9,
                          fontWeight: corrente ? 700 : 600,
                          letterSpacing: '0.04em',
                          color: corrente ? 'var(--gp-brand-on-dark)' : 'var(--gp-text-3)',
                        }}
                      >
                        {ponto.rotulo}
                      </span>
                      <span
                        className="tabular-nums"
                        style={{
                          fontFamily: FONTE_MONO,
                          fontSize: 14,
                          fontWeight: corrente ? 700 : 600,
                          color: corrente
                            ? 'var(--gp-text-1)'
                            : primeiro
                              ? 'var(--gp-text-3)'
                              : 'var(--gp-text-2)',
                        }}
                      >
                        {formatarPonto(ponto.valor)}
                      </span>
                    </li>
                  );
                })}
              </ol>
            ) : null}

            {trilha && trilha.total > 0 ? (
              <div className="mt-auto flex flex-col" style={{ gap: 8 }}>
                {/* Medidor DISCRETO: um segmento por simulado contratado. A barra
                    contínua anterior lia "43% de progresso"; o gestor conta eventos
                    ("3 de 7 aplicados"), não percentual de conclusão. */}
                <div
                  data-testid="kpi-trilha"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percentualTrilha}
                  aria-label={`${trilha.feitos} de ${trilha.total} simulados realizados`}
                  className="flex w-full"
                  style={{ gap: 5 }}
                >
                  {Array.from({ length: trilha.total }, (_, indice) => (
                    <span
                      key={indice}
                      style={{
                        flex: 1,
                        height: 8,
                        borderRadius: 'var(--gp-radius-pill)',
                        background:
                          indice < trilha.feitos ? 'var(--gp-success)' : 'var(--gp-surface-3)',
                      }}
                    />
                  ))}
                </div>
                {restantesTrilha > 0 ? (
                  <span data-testid="kpi-trilha-restantes" style={{ fontSize: 11, color: 'var(--gp-text-3)' }}>
                    {restantesTrilha} {restantesTrilha === 1 ? 'contratado ainda a realizar' : 'contratados ainda a realizar'}
                  </span>
                ) : null}
              </div>
            ) : null}

            {rodape ? (
              <div
                data-testid="kpi-rodape"
                className={cn(!mostrarRegua && !trilha && 'mt-auto')}
                style={{
                  fontSize: 11,
                  lineHeight: '15px',
                  color: 'var(--gp-text-3)',
                  borderTop: '1px solid var(--gp-border-subtle)',
                  paddingTop: 10,
                }}
              >
                {rodape}
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
