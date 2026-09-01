/**
 * Exportação de recorte em CSV — a peça que fechava o ciclo operacional do
 * portal (auditoria de 09/08, B4: "um portal de gestão sem export sai como
 * imaturo em avaliação enterprise"; até aqui `onExportar` era um no-op com
 * toast de "ainda não disponível").
 *
 * CSV, e não XLSX, de propósito: é o formato que abre no Excel, no Sheets e no
 * Numbers sem plugin, sem dependência nova no bundle e sem servidor. A geração
 * é 100% no cliente a partir do dado JÁ na tela — nenhuma consulta nova, nada
 * que amplie o que aquele papel já podia ver.
 *
 * Privacidade (handoff §7.7): este módulo é genérico e não sabe o que exporta.
 * A barreira continua sendo quem CHAMA — cada drawer monta as linhas do seu
 * próprio recorte, e o gate de `podeExportar` (resolvido no servidor, via
 * `useGestorContexto`) vive em `AcoesRecorte`, que é o único dono do botão.
 */

/** Uma coluna do arquivo: rótulo do cabeçalho + como extrair o valor da linha. */
export interface ColunaCsv<T> {
  cabecalho: string;
  valor: (linha: T) => string | number | null | undefined;
}

/** Separador `;` — é o que o Excel em locale pt-BR espera; com `,` ele joga tudo numa coluna. */
const SEPARADOR = ';';

/**
 * BOM de UTF-8. Sem ele o Excel no Windows lê o arquivo como Latin-1 e
 * "Clínica Médica" chega como "ClÃ­nica MÃ©dica".
 */
const BOM = '\uFEFF';

/**
 * Neutraliza injeção de fórmula (CSV/Excel injection): uma célula que começa
 * com `=`, `+`, `-`, `@`, TAB ou CR é executada como fórmula ao abrir o
 * arquivo. Prefixar com apóstrofo mantém o texto legível e inerte.
 */
function neutralizarFormula(texto: string): string {
  return /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
}

/** Escapa uma célula: aspas duplicadas e envelope quando há separador, aspas ou quebra. */
function celula(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return '';
  const texto = neutralizarFormula(String(valor));
  return /["\n\r;]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/**
 * Monta o conteúdo do arquivo. Exportado separado do download para poder ser
 * testado sem `URL.createObjectURL`/DOM.
 *
 * `\r\n` como fim de linha: é o que a RFC 4180 pede e o que o Excel mais
 * antigo ainda exige para não colar todas as linhas numa só.
 */
export function montarCsv<T>(colunas: ReadonlyArray<ColunaCsv<T>>, linhas: ReadonlyArray<T>): string {
  const cabecalho = colunas.map((coluna) => celula(coluna.cabecalho)).join(SEPARADOR);
  const corpo = linhas.map((linha) => colunas.map((coluna) => celula(coluna.valor(linha))).join(SEPARADOR));
  return BOM + [cabecalho, ...corpo].join('\r\n');
}

/**
 * Nome de arquivo estável e legível: `gestor-<partes>-<AAAA-MM-DD>.csv`.
 * Acento é removido e o resto vira `kebab-case` — nome de arquivo com acento
 * ou barra quebra em sistemas de arquivos e em anexo de e-mail.
 */
export function nomeArquivoCsv(partes: ReadonlyArray<string>, agora: Date = new Date()): string {
  const data = [
    agora.getFullYear(),
    String(agora.getMonth() + 1).padStart(2, '0'),
    String(agora.getDate()).padStart(2, '0'),
  ].join('-');

  const miolo = partes
    .filter(Boolean)
    .join('-')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  return `gestor-${miolo || 'recorte'}-${data}.csv`;
}

/**
 * Uma seção do arquivo: um título de bloco, seu próprio cabeçalho e suas
 * linhas. Existe porque o recorte do aluno passou a ter DUAS granularidades no
 * mesmo arquivo (resumo por simulado + detalhamento por área/especialidade/tema)
 * — e um CSV com colunas diferentes por bloco só se lê se cada bloco se
 * apresentar.
 */
export interface SecaoCsv<T> {
  titulo: string;
  colunas: ReadonlyArray<ColunaCsv<T>>;
  linhas: ReadonlyArray<T>;
}

/** Apaga a tipagem de uma seção para poder guardar seções heterogêneas numa lista. */
export function secaoCsv<T>(secao: SecaoCsv<T>): SecaoCsv<unknown> {
  return secao as unknown as SecaoCsv<unknown>;
}

/**
 * Concatena seções num único CSV: título, cabeçalho, linhas, linha em branco.
 * Só o primeiro bloco leva o BOM (montado uma vez, no começo do arquivo).
 */
export function montarCsvSecoes(secoes: ReadonlyArray<SecaoCsv<unknown>>): string {
  const blocos = secoes
    .filter((secao) => secao.colunas.length > 0)
    .map((secao) => [celula(secao.titulo), montarCsv(secao.colunas, secao.linhas).slice(BOM.length)].join('\r\n'));
  return BOM + blocos.join('\r\n\r\n');
}

/** Dispara o download de um conteúdo já montado. Ver `baixarCsv` para o retorno. */
function baixarConteudo(nomeArquivo: string, conteudo: string): boolean {
  if (typeof document === 'undefined' || typeof URL?.createObjectURL !== 'function') return false;

  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const ancora = document.createElement('a');
  ancora.href = url;
  ancora.download = nomeArquivo;
  // Fora do fluxo visual: o elemento existe por um tick só para o clique valer.
  ancora.style.display = 'none';
  document.body.appendChild(ancora);
  ancora.click();
  ancora.remove();
  // Revogar no próximo tick — no Safari revogar em seguida cancela o download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return true;
}

/**
 * Dispara o download. Retorna `false` quando o ambiente não tem as APIs de
 * Blob/URL (jsdom sem polyfill, navegador antigo) — assim quem chama pode
 * avisar em vez de deixar o clique morrer em silêncio, que é exatamente o
 * problema que este módulo existe para resolver.
 */
export function baixarCsv<T>(
  nomeArquivo: string,
  colunas: ReadonlyArray<ColunaCsv<T>>,
  linhas: ReadonlyArray<T>,
): boolean {
  return baixarConteudo(nomeArquivo, montarCsv(colunas, linhas));
}

/** Mesma coisa de `baixarCsv`, para um arquivo com múltiplas seções. */
export function baixarCsvSecoes(nomeArquivo: string, secoes: ReadonlyArray<SecaoCsv<unknown>>): boolean {
  return baixarConteudo(nomeArquivo, montarCsvSecoes(secoes));
}
