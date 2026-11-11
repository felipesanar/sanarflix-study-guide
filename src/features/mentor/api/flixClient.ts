/**
 * Cliente da API de Mentoria do Flix (docs/handoff/mentor/docs/07-integracao-flix.md; Notion "Contrato de
 * API · Academy × Flix", v2.1).
 *
 * O browser NUNCA vê o token de serviço: tudo passa pela Edge `flix-mentoria-proxy`
 * (`supabase.functions.invoke('flix-mentoria-proxy', { body: { metodo, caminho, corpo, idempotencyKey, requestId } })`), que injeta
 * `Authorization` e `X-Mentor-Id`. Erros `{ error: { code, message, field, requestId } }` viram `ErroFonte`.
 */
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/utils/logger';
import { ErroFonte } from './fonte';
import { criarRegistroDeIntencoes, type RegistroDeIntencoes } from './idempotencia';

export type Metodo = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/** Assinatura mínima de `supabase.functions.invoke` (injetável nos testes). */
export type InvocarProxy = (nome: string, opcoes: { body: unknown }) => Promise<{ data: unknown; error: unknown }>;

export const invocarSupabase: InvocarProxy = (nome, opcoes) =>
  supabase.functions.invoke(nome, { body: opcoes.body as Record<string, unknown> }) as Promise<{ data: unknown; error: unknown }>;

const PROXY = 'flix-mentoria-proxy';

interface CorpoErroFlix { error?: { code?: string; message?: string; field?: string; requestId?: string } }

async function lerCorpo(ctx: unknown): Promise<{ status: number | null; corpo: unknown }> {
  if (!ctx || typeof ctx !== 'object') return { status: null, corpo: null };
  const c = ctx as { status?: unknown; body?: unknown; json?: () => Promise<unknown>; clone?: () => { json: () => Promise<unknown> } };
  const status = typeof c.status === 'number' ? c.status : null;
  // FunctionsHttpError: `context` é o Response do proxy.
  if (typeof c.json === 'function') {
    try { return { status, corpo: await (c.clone ? c.clone().json() : c.json()) }; } catch { return { status, corpo: null }; }
  }
  return { status, corpo: c.body ?? null };
}

/** Erro do invoke → ErroFonte com o vocabulário do contrato. Sem Response = rede. */
export async function erroDoProxy(error: unknown, requestIdEnviado?: string): Promise<ErroFonte> {
  if (error instanceof ErroFonte) {
    error.requestId ??= requestIdEnviado;
    return error;
  }
  const { status, corpo } = await lerCorpo((error as { context?: unknown } | null)?.context);
  const e = (corpo && typeof corpo === 'object' ? (corpo as CorpoErroFlix).error : undefined) ?? undefined;
  const requestId = e?.requestId ?? requestIdEnviado;
  if (e?.code) return new ErroFonte(status ?? 500, e.code, e.message ?? '', e.field, requestId);
  return new ErroFonte(status ?? 0, 'rede', 'Não foi possível falar com o Flix.', undefined, requestId);
}

export interface ClienteFlix {
  chamar<T>(metodo: Metodo, caminho: string, corpo?: unknown): Promise<T>;
}

export function criarClienteFlix(
  invocar: InvocarProxy = invocarSupabase,
  opcoes: { intencoes?: RegistroDeIntencoes; novoRequestId?: () => string } = {},
): ClienteFlix {
  const intencoes = opcoes.intencoes ?? criarRegistroDeIntencoes();
  const novoRequestId = opcoes.novoRequestId ?? (() => crypto.randomUUID());
  return {
    async chamar<T>(metodo: Metodo, caminho: string, corpo?: unknown): Promise<T> {
      const requestId = novoRequestId();
      const escrita = metodo !== 'GET';
      const body = {
        metodo, caminho, ...(corpo === undefined ? {} : { corpo }), requestId,
        ...(escrita ? { idempotencyKey: intencoes.chavePara(metodo, caminho, corpo) } : {}),
      };
      try {
        const r = await invocar(PROXY, { body });
        if (r.error) throw r.error;
        if (escrita) intencoes.concluir(metodo, caminho, corpo);
        return r.data as T;
      } catch (e) {
        const erro = await erroDoProxy(e, requestId);
        if (escrita && erro.status >= 400 && erro.status < 500 && erro.status !== 408 && erro.status !== 429) {
          intencoes.concluir(metodo, caminho, corpo);
        }
        Logger.warn('[mentor/flixClient] chamada falhou', {
          requestId: erro.requestId, metodo, caminho: caminho.split('?')[0], status: erro.status, code: erro.code,
        });
        throw erro;
      }
    },
  };
}

/** Query string sem chaves vazias, na ordem dada. */
export function query(params: Record<string, string | number | null | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.append(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
}
