/**
 * Instituições recentes do seletor da sidebar.
 *
 * Só faz sentido para quem troca de IES (admin, gestor_grupo). É preferência de
 * UI, não dado de negócio: mora no `localStorage`, chaveada por usuário (dois
 * logins no mesmo navegador não herdam a lista um do outro), e qualquer falha
 * — modo privado, cota, JSON corrompido — degrada para "sem recentes" em vez de
 * quebrar a sidebar.
 */

const LIMITE = 3;

const chave = (usuarioId: string) => `gp:ies-recentes:${usuarioId}`;

export const lerRecentes = (usuarioId: string): string[] => {
  try {
    const cru = window.localStorage.getItem(chave(usuarioId));
    if (!cru) return [];
    const dados: unknown = JSON.parse(cru);
    if (!Array.isArray(dados)) return [];
    return dados.filter((item): item is string => typeof item === 'string').slice(0, LIMITE);
  } catch {
    return [];
  }
};

export const registrarRecente = (usuarioId: string, iesId: string): string[] => {
  const proximas = [iesId, ...lerRecentes(usuarioId).filter((id) => id !== iesId)].slice(0, LIMITE);
  try {
    window.localStorage.setItem(chave(usuarioId), JSON.stringify(proximas));
  } catch {
    /* preferência de UI: sem persistência a lista simplesmente não sobrevive à sessão. */
  }
  return proximas;
};
