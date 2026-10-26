import * as React from 'react';
import { FiguraGrafico } from '@/features/gestor/components/engajamento/FiguraGrafico';
import { eixoPct } from '@/features/gestor/components/engajamento/LinhaMensal';
import { formatPct, TRACO } from '@/features/gestor/lib/formatters';
import type { AdminEngajamento } from '@/features/gestor/api/types-engajamento';

export interface DispersaoEngajamentoAcertoProps {
  ranking: AdminEngajamento['ranking'];
  rede: Pick<AdminEngajamento['rede'], 'engajadosPct' | 'acertoPct'>;
}

const ALTURA = 280;

/** Rótulos abreviados (§10.6): "Faculdade " → "Fac. ", "Centro Univ. " → "CU ". */
export function abreviarIes(nome: string): string {
  return nome.replace(/^Faculdade /, 'Fac. ').replace(/^Centro Univ\. /, 'CU ');
}

/**
 * "Engajamento × acerto" (spec §10.6, §12.5): uma bolha por IES, x = % engajados, y = %
 * de acerto, raio `8 + 22 × base ÷ maiorBase` px, linhas tracejadas nas médias da rede.
 * Eixos dinâmicos (`floor(min − 5)` a `ceil(max + 5)`, múltiplos de 5). IES sem acerto
 * (sem questões) fica fora do desenho e aparece na tabela alternativa com "—".
 */
export function DispersaoEngajamentoAcerto({ ranking, rede }: DispersaoEngajamentoAcertoProps) {
  const desenhaveis = ranking.filter((l) => l.engajadosPct !== null && l.acertoPct !== null);
  const eixoX = eixoPct([...desenhaveis.map((l) => l.engajadosPct), rede.engajadosPct]);
  const eixoY = eixoPct([...desenhaveis.map((l) => l.acertoPct), rede.acertoPct]);
  const maiorBase = desenhaveis.reduce((m, l) => Math.max(m, l.base), 0);

  const px = (v: number) => ((v - eixoX.min) / (eixoX.max - eixoX.min)) * 100;
  const py = (v: number) => (1 - (v - eixoY.min) / (eixoY.max - eixoY.min)) * 100;

  return (
    <section aria-labelledby="titulo-dispersao" className="min-w-0 max-w-full rounded-xl border bg-card p-4" data-testid="dispersao">
      <h2 id="titulo-dispersao" className="text-base font-semibold">
        Engajamento × acerto
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">Tamanho do ponto = base ativa. Linhas tracejadas = médias da rede.</p>

      <FiguraGrafico
        rotulo="Engajamento × acerto por instituição"
        cabecalho={['Instituição', 'Engajados · acerto']}
        linhasTabela={ranking.map((l) => ({
          rotulo: l.nome,
          valor: `${formatPct(l.engajadosPct)} engajados · acerto ${l.acertoPct === null ? TRACO : formatPct(l.acertoPct)}`,
        }))}
      >
        <div className="grid gap-x-2" style={{ gridTemplateColumns: '28px 1fr' }}>
          <div className="relative" style={{ height: ALTURA }}>
            <span className="absolute left-0 top-0 text-[10px] tabular-nums text-muted-foreground">{eixoY.max}%</span>
            <span className="absolute left-0 top-1/2 -translate-y-1/2 -rotate-90 whitespace-nowrap text-[11px] text-muted-foreground" style={{ transformOrigin: 'left center', left: 8 }}>
              % de acerto
            </span>
            <span className="absolute bottom-0 left-0 text-[10px] tabular-nums text-muted-foreground">{eixoY.min}%</span>
          </div>
          <div className="relative overflow-hidden rounded-md border border-border bg-muted/20" style={{ height: ALTURA }}>
            {rede.engajadosPct !== null ? (
              <span
                data-testid="media-x"
                aria-hidden="true"
                className="absolute top-0 h-full border-l border-dashed border-foreground/60"
                style={{ left: `${px(rede.engajadosPct)}%` }}
              />
            ) : null}
            {rede.acertoPct !== null ? (
              <span
                data-testid="media-y"
                aria-hidden="true"
                className="absolute left-0 w-full border-t border-dashed border-foreground/60"
                style={{ top: `${py(rede.acertoPct)}%` }}
              />
            ) : null}
            {desenhaveis.map((l) => {
              const raio = 8 + (maiorBase > 0 ? (22 * l.base) / maiorBase : 0);
              return (
                <span
                  key={l.iesId}
                  data-testid="bolha-ies"
                  className="absolute"
                  style={{ left: `${px(l.engajadosPct as number)}%`, top: `${py(l.acertoPct as number)}%`, transform: 'translate(-50%, -50%)' }}
                >
                  <span
                    data-testid="bolha-circulo"
                    className="block rounded-full border border-primary bg-primary/60"
                    style={{ width: raio * 2, height: raio * 2 }}
                  />
                  <span className="absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap text-[10px] text-foreground">{abreviarIes(l.nome)}</span>
                </span>
              );
            })}
          </div>
          <span />
          <div className="mt-1 flex items-center justify-between text-[10px] tabular-nums text-muted-foreground">
            <span>{eixoX.min}%</span>
            <span className="text-[11px]">% engajados →</span>
            <span>{eixoX.max}%</span>
          </div>
        </div>
      </FiguraGrafico>
    </section>
  );
}
