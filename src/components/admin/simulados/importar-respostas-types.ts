/**
 * Tipos e utilitários compartilhados pelo wizard de Importar respostas (fatia C2).
 * Lógica portada de `SimuladosImportRespostasTab.tsx` (mantida intacta) — apenas
 * reorganizada para os subcomponentes `Importar*` sobre os primitivos novos.
 */

export interface SimuladoOpt {
  id: string;
  nome: string;
  total_questoes: number;
  ies_count: number;
}

export interface ParsedRow {
  rowIndex: number;
  matricula_ra: string;
  answers: Record<string, string | null>;
}

export type PreviewStatus = 'preview_ok' | 'preview_warning' | 'preview_error' | 'imported' | 'replaced' | 'skipped' | 'failed';

export interface PreviewResult {
  matricula_ra: string;
  email?: string;
  nome?: string;
  status: PreviewStatus;
  reason?: string;
  details?: Record<string, unknown>;
}

export interface PreviewSummary {
  total: number;
  ok: number;
  warning: number;
  error: number;
  already_finalized: number;
  multi_marked_cells?: number;
  multi_marked_rows?: number;
  text_as_blank_cells?: number;
}

const RESPOSTA_VALIDA_REGEX = /^[A-Ea-e()/,;\s]+$/;

/** Célula conta como resposta só se tiver apenas letras A–E e separadores ( ) / , ; e espaço. */
export function isRespostaValida(raw: unknown): boolean {
  if (raw == null) return false;
  const s = String(raw).trim();
  return s !== '' && RESPOSTA_VALIDA_REGEX.test(s) && /[A-Ea-e]/.test(s);
}

export type ParseResult =
  | { ok: true; rows: ParsedRow[]; textAsBlank: number }
  | { ok: false; error: string };

/**
 * Lê a matriz da planilha por posição: coluna 0 = Matrícula/RA, colunas 1..N = questões 1..N.
 * Exige exatamente 1 + totalQuestoes colunas (ignorando colunas vazias à direita).
 */
export function parseMatrizRespostas(matrix: unknown[][], totalQuestoes: number): ParseResult {
  const isEmpty = (v: unknown) => v == null || String(v).trim() === '';
  const rowsRaw = matrix.filter((r) => Array.isArray(r) && r.some((v) => !isEmpty(v)));
  if (rowsRaw.length < 2) return { ok: false, error: 'A planilha não tem linhas de dados.' };
  let width = 0;
  for (const r of rowsRaw) {
    let w = r.length;
    while (w > 0 && isEmpty(r[w - 1])) w--;
    width = Math.max(width, w);
  }
  const esperado = 1 + totalQuestoes;
  if (width !== esperado) {
    return {
      ok: false,
      error: `A planilha tem ${width} colunas; este simulado exige ${esperado} (1 de Matrícula/RA + ${totalQuestoes} questões).`,
    };
  }
  let textAsBlank = 0;
  const rows: ParsedRow[] = rowsRaw.slice(1).map((r, idx) => {
    const answers: Record<string, string | null> = {};
    for (let q = 1; q <= totalQuestoes; q++) {
      const v = r[q];
      if (isEmpty(v)) answers[String(q)] = null;
      else if (isRespostaValida(v)) answers[String(q)] = String(v).trim();
      else {
        answers[String(q)] = null;
        textAsBlank++;
      }
    }
    return { rowIndex: idx + 2, matricula_ra: String(r[0] ?? '').trim(), answers };
  });
  return { ok: true, rows, textAsBlank };
}

export interface FinalReport {
  batch_id: string;
  summary: { total: number; imported: number; skipped: number; replaced: number; failed: number };
  results: PreviewResult[];
}

export const REASON_LABEL: Record<string, string> = {
  invalid_email: 'E-mail inválido',
  duplicate_email_in_file: 'E-mail duplicado na planilha',
  user_not_found: 'Usuário não cadastrado',
  user_not_in_ies: 'Usuário não pertence à IES do simulado',
  answers_missing: 'Sem respostas',
  no_answers: 'Nenhuma resposta preenchida',
  invalid_question_numbers: 'Colunas de questão inválidas',
  partial_answers: 'Respostas parciais (algumas em branco)',
  already_finalized: 'Aluno já finalizou esse simulado',
  validation_failed: 'Falhou na validação',
  already_processed: 'Já processado neste lote',
  ra_missing: 'Matrícula/RA em branco',
  duplicate_ra_in_file: 'Matrícula/RA duplicada na planilha',
  ra_not_found: 'Matrícula/RA não encontrada nas IES do simulado',
  ra_ambiguous: 'Matrícula/RA encontrada em mais de uma IES do simulado',
};

export const CHUNK_SIZE = 50;
/** Limite de linhas por chamada da edge `admin-import-simulado-responses` — vale
 * inclusive para o dry-run, então tanto o preview quanto o commit precisam chunkar. */
export const DRY_RUN_CHUNK_SIZE = 200;
const RA_HEADER_REGEX = /^(matr[ií]cula[\s_\-/]*(ra)?|ra|r\.a\.?|registro[\s_]+acad[eê]mico|matricula_ra)$/i;

/** Detecta a coluna de Matrícula/RA pelo cabeçalho. */
export function detectRaHeader(headers: string[]): string | null {
  return headers.find((h) => RA_HEADER_REGEX.test(h.trim())) ?? null;
}

/** Chave de comparação de RA: sem espaços nas pontas, case-insensitive (zeros à esquerda preservados). */
export function normRa(raw: unknown): string {
  return String(raw ?? '').trim().toLowerCase();
}

const EMAIL_HEADER_REGEX = /^(e[\s\-_.]?-?\s?mail|email|e-mail)$/i;

// dd/mm/yyyy, com "hh:mm" ou "hh:mm:ss" opcional, separado por espaço ou "T".
const PT_BR_DATE_REGEX = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

/**
 * Faz o parse de uma data de planilha no formato brasileiro dd/mm/yyyy[ hh:mm[:ss]].
 * `new Date(string)` interpreta "05/04" como mês/dia (formato US) — trocando dia e
 * mês silenciosamente — ou retorna "Invalid Date" sem avisar quando o formato não é
 * reconhecido. Quando a string bate com o padrão brasileiro, monta a data
 * explicitamente assumindo horário de Brasília (offset fixo -03:00, sem horário de
 * verão — mesmo racional de `src/utils/timezone.ts`). Fora desse padrão (ex.: já vem
 * em ISO), cai para `new Date(raw)` como fallback. Retorna `null` se nada for válido.
 */
export function parseDataPtBrOuIso(raw: string): Date | null {
  const trimmed = raw.trim();
  const match = trimmed.match(PT_BR_DATE_REGEX);
  if (match) {
    const [, dd, mm, yyyy, hh = '00', min = '00', ss = '00'] = match;
    const iso = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}T${hh.padStart(2, '0')}:${min.padStart(2, '0')}:${ss.padStart(2, '0')}-03:00`;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const fallback = new Date(trimmed);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * Detecta a coluna de e-mail de forma estrita (sem fallback silencioso).
 * Retorna a chave do header OU null caso nenhuma coluna pareça ser e-mail.
 */
export function detectEmailHeader(headers: string[], firstRow: Record<string, unknown> | undefined): string | null {
  const exact = headers.find((h) => EMAIL_HEADER_REGEX.test(h.trim()));
  if (exact) return exact;

  if (firstRow) {
    for (const h of headers) {
      const v = firstRow[h];
      if (typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) {
        return h;
      }
    }
  }
  return null;
}
