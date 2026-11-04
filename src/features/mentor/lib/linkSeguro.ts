/**
 * Única regra de link renderizado/salvo no módulo Mentor: https com host.
 * Bloqueia `http:`, `javascript:`, `data:`, texto solto, espaços internos e valores que não são string.
 */
export function ehLinkHttps(valor: unknown): boolean {
  if (typeof valor !== 'string') return false;
  const v = valor.trim();
  if (!v || /\s/.test(v)) return false;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && u.hostname.length > 0;
  } catch {
    return false;
  }
}

/** @deprecated Use `ehLinkHttps`: links são https apenas. */
export const ehLinkHttp = ehLinkHttps;
