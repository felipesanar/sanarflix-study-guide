/**
 * Formato do QR do cartão (`SFA2`), espelho de `services/cartao-omr/cartao_omr/models.py`.
 *
 *   personalizado (sfa)  SFA2:M:<SIM8>:<MATRICULA>   SIM8 = 8 primeiros hex do simulado_id
 *   UniAtenas            SFA2:A:<SIM8>
 *
 * Maiúsculas, para o QR usar o modo alfanumérico (mais compacto). O cartão não leva o `user_id`: a identidade
 * do aluno é a matrícula, a mesma que a importação do Academy aceita na 1ª coluna. Os vetores de teste vêm do Python.
 */
import type { CardSpec, QrData } from './types.ts';

export const QR_PREFIX = 'SFA2';

/** Matrícula impressa e no QR: só caracteres do modo alfanumérico do QR (sem espaço), de 1 a 24. */
export const MATRICULA_MAX = 24;
const MATRICULA_RE = /^[A-Z0-9./-]{1,24}$/;

const UUID_RE = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
const QR_RE = /^SFA2:(?:M:([0-9A-F]{8}):([A-Z0-9./-]{1,24})|A:([0-9A-F]{8}))$/;

export type ProblemaMatricula = 'sem_matricula' | 'formato_nao_suportado';

export function isUuid(valor: string): boolean {
  return UUID_RE.test(valor.trim());
}

/** `trim` + maiúsculas, a mesma comparação da importação (`lower(trim(matricula_ra))`). */
export function normalizarMatricula(valor: string | null | undefined): string {
  return (valor ?? '').trim().toUpperCase();
}

/** Motivo pelo qual a matrícula não pode ser impressa no cartão (`null` se estiver ok). */
export function problemaDaMatricula(valor: string | null | undefined): ProblemaMatricula | null {
  const m = normalizarMatricula(valor);
  if (!m) return 'sem_matricula';
  return MATRICULA_RE.test(m) ? null : 'formato_nao_suportado';
}

/** Referência curta do simulado, usada no QR e na checagem de `simulado_divergente`. */
export function sim8(simuladoId: string): string {
  if (typeof simuladoId !== 'string' || !isUuid(simuladoId)) {
    throw new Error(`simulado_id precisa ser um UUID: ${JSON.stringify(simuladoId)}`);
  }
  return simuladoId.trim().replace(/-/g, '').slice(0, 8).toUpperCase();
}

export function buildPayload(spec: Pick<CardSpec, 'model' | 'simuladoId' | 'matricula'>): string {
  const ref = sim8(spec.simuladoId);
  if (spec.model === 'personalizado') {
    const problema = problemaDaMatricula(spec.matricula);
    if (problema) {
      throw new Error(`matrícula não pode ser impressa (${problema}): ${JSON.stringify(spec.matricula ?? '')}`);
    }
    return `${QR_PREFIX}:M:${ref}:${normalizarMatricula(spec.matricula)}`;
  }
  if (spec.model === 'uniatenas') return `${QR_PREFIX}:A:${ref}`;
  throw new Error(`modelo desconhecido: ${JSON.stringify(spec.model)}`);
}

/** Interpreta o texto de um QR. Devolve `null` se não for um cartão SFA2 válido. */
export function parseQr(texto: string): QrData | null {
  const m = QR_RE.exec(texto.trim());
  if (!m) return null;
  if (m[1] && m[2]) return { kind: 'M', sim8: m[1], matricula: m[2] };
  return { kind: 'A', sim8: m[3]!, matricula: null };
}

/** Código legível sob o QR: a matrícula (personalizado) ou `UNIATENAS`. */
export function rotuloDoCartao(model: CardSpec['model'], matricula?: string): string {
  if (model === 'uniatenas') return 'UNIATENAS';
  const problema = problemaDaMatricula(matricula);
  if (problema) throw new Error(`matrícula não pode ser impressa (${problema})`);
  return normalizarMatricula(matricula);
}
