import * as React from 'react';
import { mesCurto } from '@/features/gestor/lib/engajamento';
import { FiguraGrafico } from './FiguraGrafico';

export interface PontoLinhaMensal {
  /** 'AAAA-MM'. */
  mes: string;
  parcial: boolean;
  /** `null` = mês sem dado (a linha quebra ali). */
  valor: number | null;
}

export interface LinhaMensalProps {
  /** Nome acessível da figura. */
  rotulo: string;
  pontos: PontoLinhaMensal[];
  modo: 'quantidade' | 'pct';
  /** Formata um valor do eixo / do ponto ("145.873", "66%"). */
  formatar: (v: number) => string;
  /** Múltiplo do teto do eixo de quantidade: 1.000 para questões, 500 para conteúdos. */
  passoQuantidade?: 500 | 1000;
}

export interface Eixo {
  min: number;
  max: number;
}

/** Eixo de quantidade (§10.6): 0 a `ceil(max × 1,15)`, arredondado para cima ao múltiplo de `passo`. */
export function eixoQuantidade(valores: Array<number | null>, passo: 500 | 1000 = 1000): Eixo {
  const maximo = valores.reduce<number>((m, v) => Math.max(m, v ?? 0), 0);
  const teto = Math.ceil(maximo * 1.15);
  return { min: 0, max: Math.max(passo, Math.ceil(teto / passo) * passo) };
}

/** Eixo de % de acerto (§10.6): `floor(min − 5)` a `ceil(max + 5)`, em múltiplos de 5, dentro de [0, 100]. */
export function eixoPct(valores: Array<number | null>): Eixo {
  const v = valores.filter((x): x is number => x !== null && Number.isFinite(x));
  if (v.length === 0) return { min: 0, max: 100 };
  const min = Math.max(0, Math.floor((Math.min(...v) - 5) / 5) * 5);
  const max = Math.min(100, Math.ceil((Math.max(...v) + 5) / 5) * 5);
  return max > min ? { min, max } : { min: 0, max: 100 };
}

const LARGURA = 1000;
const ALTURA = 220;
/** Até aqui cada ponto leva o valor escrito em cima; acima disso só a tabela alternativa. */
const MAX_PONTOS_COM_VALOR = 12;

/**
 * Linha mensal com área (spec §10.6): SVG `0 0 1000 220` com
 * `preserveAspectRatio="none"` (polyline + polygon de área a 8%) e os pontos em
 * `div` absolutos, para não esticarem com o SVG. Ponto de mês parcial tem miolo
 * da cor do fundo.
 */
export function LinhaMensal({ rotulo, pontos, modo, formatar, passoQuantidade = 1000 }: LinhaMensalProps) {
  const valores = pontos.map((p) => p.valor);
  const eixo = modo === 'pct' ? eixoPct(valores) : eixoQuantidade(valores, passoQuantidade);
  const n = pontos.length;

  const xFrac = (i: number) => (i + 0.5) / n;
  const yFrac = (v: number) => 1 - (v - eixo.min) / (eixo.max - eixo.min);

  // Trechos contínuos de pontos com valor: a linha não atravessa mês sem dado.
  const trechos: Array<Array<{ i: number; v: number }>> = [];
  pontos.forEach((p, i) => {
    if (p.valor === null) {
      trechos.push([]);
      return;
    }
    if (trechos.length === 0) trechos.push([]);
    trechos[trechos.length - 1].push({ i, v: p.valor });
  });
  const trechosValidos = trechos.filter((t) => t.length > 0);

  const sx = (i: number) => (xFrac(i) * LARGURA).toFixed(1);
  const sy = (v: number) => (yFrac(v) * ALTURA).toFixed(1);

  const ticks = [eixo.max, (eixo.min + eixo.max) / 2, eixo.min];
  const comValor = n <= MAX_PONTOS_COM_VALOR;

  return (
    <FiguraGrafico
      rotulo={rotulo}
    >
      <div className="overflow-x-auto">
        <div style={{ minWidth: Math.max(n * 36, 280) + 48 }}>
          <div className="grid" style={{ gridTemplateColumns: '44px 1fr', columnGap: 4 }}>
            <div className="relative" style={{ height: ALTURA }}>
              {ticks.map((t, i) => (
                <span
                  key={i}
                  className="tabular-nums absolute right-0"
                  style={{
                    top: `${yFrac(t) * 100}%`,
                    transform: 'translateY(-50%)',
                    fontSize: 'var(--gp-font-size-micro)',
                    color: 'var(--gp-text-3)',
                  }}
                >
                  {formatar(Math.round(t))}
                </span>
              ))}
            </div>
            <div className="relative" style={{ height: ALTURA }}>
              <svg
                viewBox={`0 0 ${LARGURA} ${ALTURA}`}
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full"
                focusable="false"
                aria-hidden="true"
              >
                {ticks.map((t, i) => (
                  <line
                    key={i}
                    x1={0}
                    x2={LARGURA}
                    y1={sy(t)}
                    y2={sy(t)}
                    stroke="var(--gp-border-subtle)"
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {trechosValidos.map((t, k) => (
                  <React.Fragment key={k}>
                    {t.length > 1 ? (
                      <polygon
                        data-testid="linha-area"
                        points={`${sx(t[0].i)},${ALTURA} ${t.map((p) => `${sx(p.i)},${sy(p.v)}`).join(' ')} ${sx(t[t.length - 1].i)},${ALTURA}`}
                        fill="var(--gp-brand)"
                        fillOpacity={0.08}
                      />
                    ) : null}
                    {t.length > 1 ? (
                      <polyline
                        data-testid="linha-serie"
                        points={t.map((p) => `${sx(p.i)},${sy(p.v)}`).join(' ')}
                        fill="none"
                        stroke="var(--gp-brand)"
                        strokeWidth={2}
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    ) : null}
                  </React.Fragment>
                ))}
              </svg>
              {pontos.map((p, i) =>
                p.valor === null ? null : (
                  <React.Fragment key={p.mes}>
                    <span
                      data-testid="linha-ponto"
                      data-parcial={p.parcial ? 'true' : 'false'}
                      className="absolute block"
                      style={{
                        left: `${xFrac(i) * 100}%`,
                        top: `${yFrac(p.valor) * 100}%`,
                        width: 10,
                        height: 10,
                        transform: 'translate(-50%, -50%)',
                        borderRadius: 'var(--gp-radius-pill)',
                        background: p.parcial ? 'var(--gp-surface-1)' : 'var(--gp-brand)',
                        border: '2px solid var(--gp-brand)',
                      }}
                    />
                    {comValor ? (
                      <span
                        className="tabular-nums absolute"
                        style={{
                          left: `${xFrac(i) * 100}%`,
                          top: `${yFrac(p.valor) * 100}%`,
                          transform: 'translate(-50%, -150%)',
                          fontSize: 'var(--gp-font-size-micro)',
                          fontWeight: 'var(--gp-font-weight-medio)',
                          color: 'var(--gp-text-1)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatar(p.valor)}
                      </span>
                    ) : null}
                  </React.Fragment>
                ),
              )}
            </div>
            <span />
            <div className="flex">
              {pontos.map((p) => (
                <span
                  key={p.mes}
                  className="flex-1 text-center"
                  style={{
                    marginTop: 4,
                    fontSize: 'var(--gp-font-size-label)',
                    fontWeight: 'var(--gp-font-weight-medio)',
                    color: 'var(--gp-text-2)',
                  }}
                >
                  {mesCurto(p.mes, p.parcial)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </FiguraGrafico>
  );
}
