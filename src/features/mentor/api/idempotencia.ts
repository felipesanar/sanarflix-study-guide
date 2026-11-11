const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';

export function novaChave(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => ALFABETO[byte & 63]).join('');
}

export interface RegistroDeIntencoes {
  /** Mesma intencao devolve a mesma chave enquanto estiver pendente e valida. */
  chavePara(metodo: string, caminho: string, corpo: unknown): string;
  /** Sucesso ou erro definitivo encerra a intencao. */
  concluir(metodo: string, caminho: string, corpo: unknown): void;
}

export function criarRegistroDeIntencoes(opcoes: { agora?: () => number; validadeMs?: number } = {}): RegistroDeIntencoes {
  const agora = opcoes.agora ?? Date.now;
  const validadeMs = opcoes.validadeMs ?? 600_000;
  const entradas = new Map<string, { chave: string; expiraEm: number }>();

  function identidade(metodo: string, caminho: string, corpo: unknown): string {
    const instante = agora();
    for (const [id, entrada] of entradas) if (entrada.expiraEm <= instante) entradas.delete(id);
    const json = JSON.stringify(corpo, (_chave, valor) =>
      valor !== null && typeof valor === 'object' && !Array.isArray(valor)
        ? Object.fromEntries(Object.keys(valor).sort().map((chave) => [chave, valor[chave]]))
        : valor);
    return `${metodo} ${caminho} ${json}`;
  }

  return {
    chavePara(metodo, caminho, corpo) {
      const id = identidade(metodo, caminho, corpo);
      let entrada = entradas.get(id);
      if (!entrada) {
        entrada = { chave: novaChave(), expiraEm: agora() + validadeMs };
        entradas.set(id, entrada);
      }
      return entrada.chave;
    },
    concluir(metodo, caminho, corpo) {
      entradas.delete(identidade(metodo, caminho, corpo));
    },
  };
}
