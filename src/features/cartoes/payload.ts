/**
 * Formato do QR do cartão (`SFA2`), espelho de `services/cartao-omr/cartao_omr/models.py`.
 *
 *   personalizado, com matrícula  SFA2:M:<SIM8>:<MATRICULA>   maiúsculas, modo alfanumérico (compacto)
 *   personalizado, plano B        SFA2:E:<SIM8>:<EMAIL>       minúsculas, modo byte (maior)
 *   UniAtenas                     SFA2:A:<SIM8>
 *
 * SIM8 = 8 primeiros hex do simulado_id. O cartão não leva o `user_id`: o aluno é identificado pela matrícula
 * (a mesma que a importação do Academy aceita na 1ª coluna) ou, quando o cadastro não tem matrícula utilizável,
 * pelo e-mail (plano B). Os vetores de teste vêm do Python.
 */
import type { CardSpec, QrData } from './types.ts';

export const QR_PREFIX = 'SFA2';

/** Matrícula impressa e no QR: só caracteres do modo alfanumérico do QR (sem espaço), de 1 a 24. */
export const MATRICULA_MAX = 24;
const MATRICULA_RE = /^[A-Z0-9./-]{1,24}$/;

/** E-mail no QR: minúsculas, sem espaço, até 58 caracteres (QR de versão 6, módulo >= 0,73 mm na caixa de 36 mm). */
export const EMAIL_MAX = 58;
const EMAIL_PARTES = '[a-z0-9._%+-]+@[a-z0-9-]+(?:\\.[a-z0-9-]+)+';
const EMAIL_RE = new RegExp(`^${EMAIL_PARTES}$`);

const UUID_RE = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
const QR_RE = new RegExp(
  `^SFA2:(?:M:([0-9A-F]{8}):([A-Z0-9./-]{1,24})|E:([0-9A-F]{8}):(${EMAIL_PARTES})|A:([0-9A-F]{8}))$`,
);

export type ProblemaMatricula = 'sem_matricula' | 'formato_nao_suportado';
export type ProblemaEmail = 'sem_email' | 'email_invalido' | 'email_longo_demais';

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

/** `trim` + minúsculas: a chave de comparação do e-mail. */
export function normalizarEmail(valor: string | null | undefined): string {
  return (valor ?? '').trim().toLowerCase();
}

/** Motivo pelo qual o e-mail não pode ir no QR (`null` se estiver ok). */
export function problemaDoEmail(valor: string | null | undefined): ProblemaEmail | null {
  const e = normalizarEmail(valor);
  if (!e) return 'sem_email';
  if (e.length > EMAIL_MAX) return 'email_longo_demais';
  return EMAIL_RE.test(e) ? null : 'email_invalido';
}

/** Chave do aluno na planilha: e-mail em minúsculas ou matrícula em maiúsculas (e-mail tem `@`, matrícula não). */
export function normalizarIdentificacao(valor: string | null | undefined): string {
  const v = (valor ?? '').trim();
  return v.includes('@') ? normalizarEmail(v) : normalizarMatricula(v);
}

/** Referência curta do simulado, usada no QR e na checagem de `simulado_divergente`. */
export function sim8(simuladoId: string): string {
  if (typeof simuladoId !== 'string' || !isUuid(simuladoId)) {
    throw new Error(`simulado_id precisa ser um UUID: ${JSON.stringify(simuladoId)}`);
  }
  return simuladoId.trim().replace(/-/g, '').slice(0, 8).toUpperCase();
}

/** O cartão é identificado pelo e-mail (plano B) quando só ele foi informado. */
export function cartaoPorEmail(spec: Pick<CardSpec, 'model' | 'matricula' | 'email'>): boolean {
  return spec.model === 'personalizado' && !!(spec.email ?? '').trim() && !(spec.matricula ?? '').trim();
}

export function buildPayload(spec: Pick<CardSpec, 'model' | 'simuladoId' | 'matricula' | 'email'>): string {
  const ref = sim8(spec.simuladoId);
  if (spec.model === 'personalizado') {
    if ((spec.matricula ?? '').trim() && (spec.email ?? '').trim()) {
      throw new Error('o cartão é identificado ou pela matrícula ou pelo e-mail, não pelos dois');
    }
    if (cartaoPorEmail(spec)) {
      const problema = problemaDoEmail(spec.email);
      if (problema) throw new Error(`e-mail não pode ir no QR (${problema}): ${JSON.stringify(spec.email ?? '')}`);
      return `${QR_PREFIX}:E:${ref}:${normalizarEmail(spec.email)}`;
    }
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
  if (m[1] && m[2]) return { kind: 'M', sim8: m[1], matricula: m[2], email: null };
  if (m[3] && m[4]) {
    if (m[4].length > EMAIL_MAX) return null;
    return { kind: 'E', sim8: m[3], matricula: null, email: m[4] };
  }
  return { kind: 'A', sim8: m[5]!, matricula: null, email: null };
}

/** Código legível sob o QR: a matrícula ou o e-mail (personalizado) ou `UNIATENAS`. */
export function rotuloDoCartao(model: CardSpec['model'], matricula?: string, email?: string): string {
  if (model === 'uniatenas') return 'UNIATENAS';
  if (cartaoPorEmail({ model, matricula, email })) {
    const problema = problemaDoEmail(email);
    if (problema) throw new Error(`e-mail não pode ir no QR (${problema})`);
    return normalizarEmail(email);
  }
  const problema = problemaDaMatricula(matricula);
  if (problema) throw new Error(`matrícula não pode ser impressa (${problema})`);
  return normalizarMatricula(matricula);
}
