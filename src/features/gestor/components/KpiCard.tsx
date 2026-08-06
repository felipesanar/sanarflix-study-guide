import * as React from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { TooltipRastreabilidade } from '@/features/gestor/components/TooltipRastreabilidade';
import { TRACO, formatDelta, formatNumero } from '@/features/gestor/lib/formatters';
import type { Meta, PontoSerie } from '@/features/gestor/api/types';

export type EstadoKpi = 'ok' | 'loading' | 'empty' | 'error';

export interface KpiCardProps {
  titulo: string;
  valor: string;
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
  rodape?: React.ReactNode;
  estado?: EstadoKpi;
  onTentarNovamente?: () => void;
}

/** Altura reservada pelo skeleton de carregamento, abaixo do título+tooltip. */
const ALTURA_SKELETON = 76;

function IconeDelta({ delta }: { delta: number }) {
  if (delta > 0) return <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />;
  if (delta < 0) return <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />;
  return <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />;
}

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
 */
export function KpiCard({
  titulo,
  valor,
  meta,
  criterio,
  badge,
  delta,
  serie,
  formatarPonto = formatNumero,
  trilha,
  rodape,
  estado = 'ok',
  onTentarNovamente,
}: KpiCardProps) {
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

  return (
    <Card data-testid="kpi-card" className="h-full">
      <CardContent className="flex h-full min-h-[148px] flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <span data-testid="kpi-titulo" className="text-xs font-medium leading-tight text-muted-foreground">
            {titulo}
          </span>
          <TooltipRastreabilidade meta={meta} criterio={criterio} />
        </div>

        {estado === 'loading' ? (
          <div data-testid="kpi-skeleton" className="flex-1">
            <GestorSkeleton altura={ALTURA_SKELETON} rotulo={`Carregando ${titulo}`} />
          </div>
        ) : estado === 'error' ? (
          <div className="flex-1">
            <EstadoErro
              titulo="Não foi possível carregar este indicador."
              onRetry={onTentarNovamente ?? (() => undefined)}
            />
          </div>
        ) : (
          <>
            <div className="flex items-end gap-2">
              <span data-testid="kpi-valor" className="text-3xl font-semibold leading-none tabular-nums">
                {estado === 'empty' ? TRACO : valor}
              </span>
              {badge ? (
                <Badge variant="secondary" className="mb-0.5 text-[10px] font-medium">
                  {badge}
                </Badge>
              ) : null}
              {estado === 'ok' && meta.lowSample ? (
                <Badge
                  data-testid="kpi-cobertura-parcial"
                  variant="outline"
                  className="mb-0.5 shrink-0 text-[10px] font-medium"
                >
                  cobertura parcial
                </Badge>
              ) : null}
              {estado === 'ok' && delta !== undefined && delta !== null ? (
                <span
                  data-testid="kpi-delta"
                  className={cn(
                    'mb-0.5 inline-flex items-center gap-0.5 text-xs font-medium tabular-nums',
                    delta > 0 && 'text-emerald-600 dark:text-emerald-400',
                    /* Task: contraste AA do delta negativo. `text-destructive` (var(--destructive)
                       de src/index.css) reprova AA nos dois temas — 3,78:1 no claro, 3,48:1 no
                       escuro — e ESCURECE no escuro (60%→50% de L) em vez de clarear, o oposto da
                       regra de tema escuro do portal. `gp-text-danger` (gestor-theme.css) resolve
                       para --gp-danger-on: 11,09:1 no claro e 7,15:1 no escuro contra o card,
                       clareando corretamente no escuro. Ver contrasteKpi.test.tsx. */
                    delta < 0 && 'gp-text-danger',
                    delta === 0 && 'text-muted-foreground',
                  )}
                >
                  <IconeDelta delta={delta} />
                  {formatDelta(delta)}
                  <span className="sr-only">em relação ao simulado anterior</span>
                </span>
              ) : null}
            </div>

            {mostrarRegua ? (
              <ol data-testid="kpi-regua" aria-label="Evolução do indicador" className="mt-auto flex items-end gap-4">
                {serie!.map((ponto, indice) => {
                  const corrente = indice === serie!.length - 1;
                  return (
                    <li key={`${ponto.rotulo}-${indice}`}>
                      <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                        {ponto.rotulo}
                      </span>
                      <span
                        className={cn(
                          'block text-sm tabular-nums',
                          corrente ? 'font-semibold' : 'text-muted-foreground',
                        )}
                      >
                        {formatarPonto(ponto.valor)}
                      </span>
                    </li>
                  );
                })}
              </ol>
            ) : null}

            {trilha ? (
              <div className="mt-auto">
                <div
                  data-testid="kpi-trilha"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percentualTrilha}
                  aria-label={`${trilha.feitos} de ${trilha.total} simulados realizados`}
                  className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                >
                  <div className="h-full rounded-full bg-primary" style={{ width: `${percentualTrilha}%` }} />
                </div>
              </div>
            ) : null}

            {rodape ? <div className="text-xs font-medium text-primary">{rodape}</div> : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
