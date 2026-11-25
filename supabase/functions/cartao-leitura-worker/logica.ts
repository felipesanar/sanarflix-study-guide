// Lógica pura da edge function `cartao-leitura-worker` (sem Deno nem Supabase), testada pelo vitest
// em src/test/unit/cartaoLeituraWorker.test.ts. O formato vem de services/cartao-omr/cartao_omr/serializar.py.

export const ACOES = ['obter', 'urls_recortes', 'concluir', 'falhar'] as const;
export type Acao = (typeof ACOES)[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RECORTE_RE = /^recortes\/[A-Za-z0-9_.-]{1,120}\.png$/;
const DESTINOS = new Set(['respostas', 'nao_identificados', 'ignorada']);
const LETRAS = new Set(['A', 'B', 'C', 'D', 'E']);
const MAX_PAGINAS = 5000;
const MAX_RECORTES = 10000;

/** Comparação em tempo constante (não vaza o ponto da primeira diferença). */
export function compararSegredo(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ba = enc.encode(a);
  const bb = enc.encode(b);
  const tamanho = Math.max(ba.length, bb.length);
  let diff = ba.length ^ bb.length;
  for (let i = 0; i < tamanho; i++) diff |= (ba[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

/** `Authorization: Bearer <token>` confere com o segredo configurado? Segredo vazio nega sempre. */
export function autorizado(header: string | null, segredo: string | undefined): boolean {
  if (!segredo || segredo.length < 16) return false;
  if (!header?.startsWith('Bearer ')) return false;
  return compararSegredo(header.slice('Bearer '.length), segredo);
}

export function ehUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

export function ehAcao(v: unknown): v is Acao {
  return typeof v === 'string' && (ACOES as readonly string[]).includes(v);
}

export function caminhoDoScan(leituraId: string): string {
  return `${leituraId}/scan.pdf`;
}

/** Caminhos de recorte pedidos pelo worker → caminhos no bucket (só dentro de `<leitura>/recortes/`). */
export function caminhosDeRecorte(leituraId: string, caminhos: unknown): string[] | { erro: string } {
  if (!Array.isArray(caminhos) || caminhos.length === 0) return { erro: 'caminhos deve ser uma lista não vazia' };
  if (caminhos.length > MAX_RECORTES) return { erro: `no máximo ${MAX_RECORTES} recortes` };
  const fora = caminhos.find((c) => typeof c !== 'string' || !RECORTE_RE.test(c));
  if (fora !== undefined) return { erro: `caminho de recorte inválido: ${String(fora).slice(0, 80)}` };
  return [...new Set(caminhos as string[])].map((c) => `${leituraId}/${c}`);
}

export interface LinhaPagina {
  leitura_id: string;
  pagina: number;
  destino: string;
  status: string;
  layout: string | null;
  identificacao: string | null;
  via: string | null;
  motivo: string;
  respostas: Record<string, string | null>;
  duvidas: Record<string, string>;
  pendencias: Array<{ tipo: string; detalhe: string; questao: number | null; recorte: string | null }>;
  imagem: string | null;
}

const texto = (v: unknown, max = 500): string | null =>
  v == null || v === '' ? null : String(v).slice(0, max);

function recorteOuNulo(leituraId: string, v: unknown): string | null {
  return typeof v === 'string' && RECORTE_RE.test(v) ? `${leituraId}/${v}` : null;
}

/**
 * Valida o `resultado` do worker e devolve as linhas de `cartao_leitura_paginas` e o resumo.
 * Os caminhos de imagem viram caminhos do bucket (`<leitura>/recortes/...`).
 */
export function linhasDoResultado(
  leituraId: string,
  totalQuestoes: number,
  resultado: unknown,
): { linhas: LinhaPagina[]; resumo: Record<string, unknown> } | { erro: string } {
  if (!resultado || typeof resultado !== 'object') return { erro: 'resultado ausente' };
  const r = resultado as { versao?: unknown; resumo?: unknown; paginas?: unknown };
  if (r.versao !== 1) return { erro: `versão do resultado não suportada: ${String(r.versao)}` };
  if (!Array.isArray(r.paginas)) return { erro: 'resultado.paginas deve ser uma lista' };
  if (r.paginas.length > MAX_PAGINAS) return { erro: `no máximo ${MAX_PAGINAS} páginas` };
  if (!r.resumo || typeof r.resumo !== 'object') return { erro: 'resultado.resumo ausente' };

  const linhas: LinhaPagina[] = [];
  const vistas = new Set<number>();
  for (const bruto of r.paginas) {
    const pg = bruto as Record<string, unknown>;
    const pagina = Number(pg.pagina);
    if (!Number.isInteger(pagina) || pagina < 1) return { erro: `página inválida: ${String(pg.pagina)}` };
    if (vistas.has(pagina)) return { erro: `página repetida no resultado: ${pagina}` };
    vistas.add(pagina);
    if (typeof pg.destino !== 'string' || !DESTINOS.has(pg.destino)) return { erro: `destino inválido na página ${pagina}` };

    const respostas: Record<string, string | null> = {};
    const brutas = (pg.respostas ?? {}) as Record<string, unknown>;
    if (typeof brutas !== 'object') return { erro: `respostas inválidas na página ${pagina}` };
    for (const [q, v] of Object.entries(brutas)) {
      const n = Number(q);
      if (!Number.isInteger(n) || n < 1 || n > totalQuestoes) return { erro: `questão ${q} fora do simulado na página ${pagina}` };
      if (v !== null && !(typeof v === 'string' && LETRAS.has(v))) return { erro: `resposta inválida na página ${pagina}, questão ${q}` };
      respostas[String(n)] = v as string | null;
    }
    const duvidas: Record<string, string> = {};
    for (const [q, v] of Object.entries((pg.duvidas ?? {}) as Record<string, unknown>)) {
      if (v === 'multipla' || v === 'ambigua') duvidas[String(Number(q))] = v;
    }
    const pendencias = (Array.isArray(pg.pendencias) ? pg.pendencias : []).map((p) => {
      const x = p as Record<string, unknown>;
      return {
        tipo: String(x.tipo ?? '').slice(0, 60),
        detalhe: String(x.detalhe ?? '').slice(0, 500),
        questao: Number.isInteger(x.questao) ? (x.questao as number) : null,
        recorte: recorteOuNulo(leituraId, x.recorte),
      };
    });
    linhas.push({
      leitura_id: leituraId,
      pagina,
      destino: pg.destino,
      status: String(pg.status ?? '').slice(0, 60),
      layout: texto(pg.layout, 30),
      identificacao: texto(pg.identificacao, 320),
      via: texto(pg.via, 20),
      motivo: String(pg.motivo ?? '').slice(0, 500),
      respostas,
      duvidas,
      pendencias,
      imagem: recorteOuNulo(leituraId, pg.imagem),
    });
  }
  return { linhas, resumo: r.resumo as Record<string, unknown> };
}

/** Link do run do GitHub Actions: só aceita https://github.com/... */
export function runUrlValida(v: unknown): string | null {
  return typeof v === 'string' && /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/actions\/runs\/\d+/.test(v) ? v.slice(0, 300) : null;
}
