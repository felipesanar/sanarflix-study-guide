import * as React from 'react';

export interface FiguraGraficoProps {
  /** Nome acessível do gráfico (`aria-label` do `role="img"`). */
  rotulo: string;
  children: React.ReactNode;
}

/**
 * Wrapper de todo gráfico do Engajamento (spec §10.6), exigido por
 * `__tests__/a11y.test.tsx`: `<figure>` com o desenho em `role="img"` e nome
 * acessível. Os valores aparecem escritos no próprio gráfico; não há mais a
 * alternativa "Ver dados em tabela" (removida a pedido do produto).
 */
export function FiguraGrafico({ rotulo, children }: FiguraGraficoProps) {
  return (
    <figure className="m-0">
      <div role="img" aria-label={rotulo}>
        {children}
      </div>
    </figure>
  );
}
