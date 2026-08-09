/**
 * Instituições recentes do seletor da sidebar.
 *
 * Só faz sentido para quem troca de IES (admin, gestor_grupo). É preferência de
 * UI de vida curta: mora em MEMÓRIA, não em `localStorage`/`sessionStorage` —
 * §7.7 proíbe qualquer persistência no navegador dentro do portal do gestor
 * (travado em `__tests__/seguranca-lgpd.test.tsx`). Some ao recarregar a página,
 * e é exatamente esse o contrato.
 */

const LIMITE = 3;

/** Chaveado por usuário: dois logins na mesma aba não herdam a lista um do outro. */
const memoria = new Map<string, string[]>();

export const lerRecentes = (usuarioId: string): string[] => memoria.get(usuarioId) ?? [];

export const registrarRecente = (usuarioId: string, iesId: string): string[] => {
  const proximas = [iesId, ...lerRecentes(usuarioId).filter((id) => id !== iesId)].slice(0, LIMITE);
  memoria.set(usuarioId, proximas);
  return proximas;
};

/** Só para testes: zera a memória entre casos. */
export const limparRecentes = (): void => memoria.clear();
