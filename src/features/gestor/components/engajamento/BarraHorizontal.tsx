import * as React from 'react';

export interface BarraHorizontalProps {
  /** Largura do preenchimento, 0–100 (fora disso, é cortado). */
  pct: number;
  /** Cor do preenchimento; o padrão é a marca. Use token ou `color-mix` (§13). */
  cor?: string;
  /** Posição (0–100) do traço de referência, p.ex. a média da rede. */
  marcador?: number | null;
}

const limitar = (v: number) => Math.min(100, Math.max(0, Number.isFinite(v) ? v : 0));

/**
 * Barra de progresso fina (trilho + preenchimento + traço opcional de média).
 *
 * É só desenho, dentro de linhas de tabela e cartões que já escrevem o valor
 * em texto ao lado; por isso fica fora da árvore de acessibilidade em vez de
 * virar um `<figure>` por linha.
 */
export function BarraHorizontal({ pct, cor = 'var(--gp-brand)', marcador = null }: BarraHorizontalProps) {
  return (
    <span
      aria-hidden="true"
      className="relative block w-full"
      style={{ height: 8, borderRadius: 'var(--gp-radius-pill)', background: 'var(--gp-surface-3)' }}
    >
      <span
        className="absolute left-0 top-0 block h-full"
        style={{ width: `${limitar(pct)}%`, borderRadius: 'var(--gp-radius-pill)', background: cor }}
      />
      {marcador !== null && marcador !== undefined ? (
        <span
          data-testid="barra-marcador"
          className="absolute block"
          style={{
            left: `${limitar(marcador)}%`,
            top: -3,
            width: 2,
            height: 14,
            transform: 'translateX(-1px)',
            background: 'var(--gp-text-1)',
          }}
        />
      ) : null}
    </span>
  );
}
