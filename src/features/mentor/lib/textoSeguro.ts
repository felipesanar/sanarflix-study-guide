/**
 * Conteúdo vindo do banco (enunciado, alternativas, explicação) é renderizado SEMPRE como
 * texto pelo React; nunca como HTML. Esta função só tira marcação para o professor não ler
 * `<p>`/`<br>` soltos: quebras viram `\n`, `<script>`/`<style>` somem com o conteúdo, as
 * demais tags somem e as entidades mais comuns voltam a ser caracteres. Roda depois de
 * remover as tags, então `&lt;b&gt;` aparece como o texto "<b>" (inofensivo: é texto).
 */
const ENTIDADES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
};

export function textoSeguro(bruto: string | null | undefined): string {
  if (typeof bruto !== 'string' || bruto.length === 0) return '';
  let t = bruto.replace(/\r\n?/g, '\n');
  // Conteúdo de <script>/<style> não é texto de leitura: sai junto com a tag.
  t = t.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  t = t.replace(/<br\s*\/?>/gi, '\n').replace(/<\/?(p|div|li|h[1-6]|tr)\b[^>]*>/gi, '\n');
  // Repete até estabilizar: "<<b>script>" não pode reconstruir uma tag depois da limpeza.
  let anterior: string;
  do {
    anterior = t;
    t = t.replace(/<\/?[a-z!][^>]*>/gi, '');
  } while (t !== anterior);
  t = t.replace(/&(nbsp|amp|lt|gt|quot|apos|#39);/gi, (m) => ENTIDADES[m.toLowerCase()] ?? m);
  return t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Uma linha só (prévia na lista): tira marcação, junta quebras e corta em `max` caracteres. */
export function previaEmUmaLinha(bruto: string | null | undefined, max = 140): string {
  const t = textoSeguro(bruto).replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** Título vindo da URL (`?titulo=`): texto simples, sem marcação nem controle, no máximo 120 caracteres. */
export const TITULO_MAX = 120;
export function tituloDeParam(bruto: string | null | undefined): string | null {
  if (typeof bruto !== 'string') return null;
  const t = bruto
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/<\/?[a-z!][^>]*>/gi, '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, TITULO_MAX)
    .trim();
  return t.length > 0 ? t : null;
}
