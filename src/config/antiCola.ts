// Regra anti-cola por saída de página no modo prova, exclusiva para IES com
// regra estrita de permanência na tela. Fora da lista, comportamento do
// modo prova permanece 100% inalterado (só o alerta/pausa de tempo atuais).

/** Quantidade de saídas de aba toleradas antes do bloqueio. */
export const LIMITE_SAIDAS_DE_ABA = 1;

/**
 * IES com bloqueio automático do simulado a partir da 2ª saída de aba.
 * Id do Claretiano em prod (projeto Supabase gvqv) — regra pedida pela
 * coordenação do Claretiano em 21/08/2026.
 */
export const IES_COM_BLOQUEIO_POR_SAIDA: readonly string[] = [
  '6029b69d-a2ef-4de5-b907-91f88122bb4e',
];

export const iesTemBloqueioPorSaida = (idIes?: string | null): boolean => {
  if (!idIes) return false;
  return IES_COM_BLOQUEIO_POR_SAIDA.includes(idIes);
};

export const deveBloquearPorSaidas = (
  idIes: string | null | undefined,
  saidasDeAba: number
): boolean => iesTemBloqueioPorSaida(idIes) && saidasDeAba > LIMITE_SAIDAS_DE_ABA;
