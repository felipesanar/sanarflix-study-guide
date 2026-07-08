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
  email: string;
  answers: Record<string, string | null>;
  tempo_segundos?: number;
  saidas_aba?: number;
  finalizado_em?: string;
}

export type PreviewStatus = 'preview_ok' | 'preview_warning' | 'preview_error' | 'imported' | 'replaced' | 'skipped' | 'failed';

export interface PreviewResult {
  email: string;
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
};

export const CHUNK_SIZE = 50;
/** Limite de linhas por chamada da edge `admin-import-simulado-responses` — vale
 * inclusive para o dry-run, então tanto o preview quanto o commit precisam chunkar. */
export const DRY_RUN_CHUNK_SIZE = 200;
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
