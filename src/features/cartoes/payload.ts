/**
 * Formato do QR do cartão (`SFA2`), espelho de `services/cartao-omr/cartao_omr/models.py`.
 *
 *   personalizado (sfa)  SFA2:S:<SIM8>:<UID32>   SIM8 = 8 primeiros hex do simulado_id; UID32 = user_id sem hífens
 *   UniAtenas            SFA2:A:<SIM8>
 *
 * Maiúsculas, para o QR usar o modo alfanumérico (mais compacto). Os vetores de teste vêm do Python.
 */
import type { CardSpec, QrData } from './types.ts';

export const QR_PREFIX = 'SFA2';

const UUID_RE = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
const QR_RE = /^SFA2:(?:S:([0-9A-F]{8}):([0-9A-F]{32})|A:([0-9A-F]{8}))$/;

export function isUuid(valor: string): boolean {
  return UUID_RE.test(valor.trim());
}

/** UUID em 32 hex minúsculos, sem hífens. */
function hex32(campo: string, valor: string): string {
  if (typeof valor !== 'string' || !isUuid(valor)) throw new Error(`${campo} precisa ser um UUID: ${JSON.stringify(valor)}`);
  return valor.trim().replace(/-/g, '').toLowerCase();
}

/** Referência curta do simulado, usada no QR e na checagem de `simulado_divergente`. */
export function sim8(simuladoId: string): string {
  return hex32('simulado_id', simuladoId).slice(0, 8).toUpperCase();
}

export function buildPayload(spec: Pick<CardSpec, 'model' | 'simuladoId' | 'userId'>): string {
  const ref = sim8(spec.simuladoId);
  if (spec.model === 'personalizado') {
    return `${QR_PREFIX}:S:${ref}:${hex32('user_id', spec.userId ?? '').toUpperCase()}`;
  }
  if (spec.model === 'uniatenas') return `${QR_PREFIX}:A:${ref}`;
  throw new Error(`modelo desconhecido: ${JSON.stringify(spec.model)}`);
}

/** Interpreta o texto de um QR. Devolve `null` se não for um cartão SFA2 válido. */
export function parseQr(texto: string): QrData | null {
  const m = QR_RE.exec(texto.trim());
  if (!m) return null;
  if (m[1] && m[2]) {
    const h = m[2].toLowerCase();
    const userId = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    return { kind: 'S', sim8: m[1], userId };
  }
  return { kind: 'A', sim8: m[3]!, userId: null };
}

/** Código legível sob o QR: 8 primeiros caracteres do user_id (personalizado) ou `UNIATENAS`. */
export function rotuloDoCartao(model: CardSpec['model'], userId?: string): string {
  if (model === 'uniatenas') return 'UNIATENAS';
  return hex32('user_id', userId ?? '').slice(0, 8).toUpperCase();
}
