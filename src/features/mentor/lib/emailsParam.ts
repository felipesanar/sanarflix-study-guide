/** Formato simples de e-mail: o backend revalida (vínculo ativo) — aqui só descartamos lixo da URL. */
const EMAIL_RE = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;

/**
 * Lê e-mails de parâmetros de URL (não confiável): aceita valores com vários
 * e-mails separados por vírgula, aplica trim + minúsculas, remove duplicados e
 * ignora vazios e o que não tem cara de e-mail. Mantém a ordem da primeira ocorrência.
 */
export function parseEmailsParam(...valores: Array<string | null | undefined>): string[] {
  const vistos = new Set<string>();
  for (const valor of valores) {
    if (!valor) continue;
    for (const bruto of valor.split(',')) {
      const email = bruto.trim().toLowerCase();
      if (email && EMAIL_RE.test(email)) vistos.add(email);
    }
  }
  return [...vistos];
}
