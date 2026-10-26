import * as React from 'react';

/** Atraso das buscas do Engajamento antes de virarem parâmetro de RPC (spec §10.4). */
export const ATRASO_BUSCA_MS = 300;

/**
 * Devolve `valor` só depois de ele ficar parado por `atraso` ms (debounce). Cada
 * mudança rearma o relógio; o valor inicial passa direto, sem esperar.
 */
export function useValorComAtraso<T>(valor: T, atraso: number = ATRASO_BUSCA_MS): T {
  const [atrasado, setAtrasado] = React.useState(valor);

  React.useEffect(() => {
    const id = setTimeout(() => setAtrasado(valor), atraso);
    return () => clearTimeout(id);
  }, [valor, atraso]);

  return atrasado;
}
