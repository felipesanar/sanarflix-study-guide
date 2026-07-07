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
const EMAIL_HEADER_REGEX = /^(e[\s\-_.]?-?\s?mail|email|e-mail)$/i;

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
