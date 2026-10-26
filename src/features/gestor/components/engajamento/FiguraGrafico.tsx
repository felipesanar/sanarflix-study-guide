import * as React from 'react';

export interface LinhaTabelaGrafico {
  rotulo: string;
  valor: string;
}

export interface FiguraGraficoProps {
  /** Nome acessível do gráfico (`aria-label` do `role="img"`). */
  rotulo: string;
  /** Uma linha por ponto do gráfico, na ordem em que aparece. */
  linhasTabela: LinhaTabelaGrafico[];
  /** Cabeçalho das duas colunas da tabela alternativa. */
  cabecalho?: [string, string];
  children: React.ReactNode;
}

/**
 * Wrapper obrigatório de todo gráfico do Engajamento (spec §10.6), exigido por
 * `__tests__/a11y.test.tsx`: `<figure>` com o desenho em `role="img"` (nome
 * acessível) e, logo abaixo, a alternativa tabular colapsável "Ver dados em
 * tabela". O desenho em si é decorativo para leitor de tela: quem quer os
 * números lê a tabela.
 */
export function FiguraGrafico({ rotulo, linhasTabela, cabecalho = ['Item', 'Valor'], children }: FiguraGraficoProps) {
  return (
    <figure className="m-0">
      <div role="img" aria-label={rotulo}>
        {children}
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-muted-foreground">Ver dados em tabela</summary>
        <table className="mt-2 w-full text-left text-xs">
          <caption className="sr-only">{rotulo}</caption>
          <thead>
            <tr className="text-muted-foreground">
              <th scope="col" className="py-1 pr-3 font-medium">{cabecalho[0]}</th>
              <th scope="col" className="py-1 font-medium">{cabecalho[1]}</th>
            </tr>
          </thead>
          <tbody>
            {linhasTabela.map((linha, i) => (
              <tr key={`${linha.rotulo}-${i}`} className="border-t border-border/60">
                <th scope="row" className="py-1 pr-3 font-normal">{linha.rotulo}</th>
                <td className="py-1 tabular-nums">{linha.valor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
