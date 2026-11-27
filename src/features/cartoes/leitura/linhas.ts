/**
 * Da leitura revisada às linhas da importação (`admin-import-simulado-responses`), sem rede.
 *
 * Regras:
 * - página `ignorada` (em branco, ilegível, de outro simulado, repetida) nunca entra;
 * - página descartada na revisão nunca entra;
 * - página `nao_identificados` só entra depois que alguém confirma a identificação (`identificacao_manual`),
 *   inclusive no `aluno_duplicado`, em que a lida vem preenchida mas um humano precisa escolher;
 * - em `respostas`, a identificação manual (se houver) vale mais que a lida;
 * - resposta decidida na revisão (`respostas_manual`, `null` = em branco) vale mais que a lida;
 * - duas páginas com a mesma identificação bloqueiam a importação até uma ser descartada.
 */
import type { PaginaLeitura } from './types';

export type Situacao = 'pronta' | 'com_duvida' | 'nao_identificada' | 'duplicada' | 'ignorada' | 'descartada';

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  pronta: 'Pronta',
  com_duvida: 'Com dúvida',
  nao_identificada: 'Não identificada',
  duplicada: 'Aluno repetido',
  ignorada: 'Ignorada',
  descartada: 'Descartada',
};

export const ROTULO_MOTIVO: Record<string, string> = {
  cartao_generico: 'Cartão genérico: digite a matrícula escrita pelo aluno',
  qr_ilegivel: 'QR não foi lido',
  matricula_invalida: 'Matrícula em bolhas em branco ou com duas marcas',
  aluno_duplicado: 'A mesma matrícula aparece em outra página com respostas diferentes',
  pagina_em_branco: 'Página em branco',
  pagina_ilegivel: 'Página ilegível',
  simulado_divergente: 'Cartão de outro simulado',
  pagina_repetida: 'Mesma folha escaneada duas vezes',
};

const norm = (v: string | null | undefined) => (v ?? '').trim();
/** Chave de comparação, igual à da importação (`normRa`): sem espaços nas pontas e sem caixa. */
const chave = (v: string) => v.trim().toLowerCase();

export function identificacaoEfetiva(pg: PaginaLeitura): string {
  return norm(pg.identificacao_manual) || (pg.destino === 'respostas' ? norm(pg.identificacao) : '');
}

export function respostasEfetivas(pg: PaginaLeitura, totalQuestoes: number): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (let q = 1; q <= totalQuestoes; q++) {
    const k = String(q);
    out[k] = k in (pg.respostas_manual ?? {}) ? pg.respostas_manual[k] : (pg.respostas[k] ?? null);
  }
  return out;
}

/** Questões com dúvida (múltipla/ambígua) ainda não decididas na revisão. */
export function duvidasAbertas(pg: PaginaLeitura): string[] {
  return Object.keys(pg.duvidas ?? {})
    .filter((q) => !(q in (pg.respostas_manual ?? {})))
    .sort((a, b) => Number(a) - Number(b));
}

function situacaoBase(pg: PaginaLeitura): Situacao {
  if (pg.descartada) return 'descartada';
  if (pg.destino === 'ignorada') return 'ignorada';
  if (!identificacaoEfetiva(pg)) return 'nao_identificada';
  return duvidasAbertas(pg).length ? 'com_duvida' : 'pronta';
}

/** Situação de cada página (por id), já considerando identificações repetidas entre páginas. */
export function situacoes(paginas: PaginaLeitura[]): Map<string, Situacao> {
  const out = new Map<string, Situacao>();
  const porChave = new Map<string, string[]>();
  for (const pg of paginas) {
    const s = situacaoBase(pg);
    out.set(pg.id, s);
    if (s === 'pronta' || s === 'com_duvida') {
      const k = chave(identificacaoEfetiva(pg));
      porChave.set(k, [...(porChave.get(k) ?? []), pg.id]);
    }
  }
  for (const ids of porChave.values()) {
    if (ids.length > 1) for (const id of ids) out.set(id, 'duplicada');
  }
  return out;
}

export interface LinhaLeitura {
  pagina: number;
  matricula_ra: string;
  answers: Record<string, string | null>;
}

export interface Montagem {
  linhas: LinhaLeitura[];
  contagem: Record<Situacao, number>;
  /** Há página não identificada ou aluno repetido: a importação fica bloqueada. */
  bloqueada: boolean;
}

export function montarLinhas(paginas: PaginaLeitura[], totalQuestoes: number): Montagem {
  const sit = situacoes(paginas);
  const contagem: Record<Situacao, number> = {
    pronta: 0, com_duvida: 0, nao_identificada: 0, duplicada: 0, ignorada: 0, descartada: 0,
  };
  const linhas: LinhaLeitura[] = [];
  for (const pg of [...paginas].sort((a, b) => a.pagina - b.pagina)) {
    const s = sit.get(pg.id)!;
    contagem[s]++;
    if (s === 'pronta' || s === 'com_duvida') {
      linhas.push({ pagina: pg.pagina, matricula_ra: identificacaoEfetiva(pg), answers: respostasEfetivas(pg, totalQuestoes) });
    }
  }
  return { linhas, contagem, bloqueada: contagem.nao_identificada + contagem.duplicada > 0 };
}
