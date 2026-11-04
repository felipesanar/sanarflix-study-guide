/**
 * Cliente da API de Mentoria do Flix (docs/handoff/mentor/docs/07-integracao-flix.md; Notion "Contrato de
 * API · Academy × Flix", v2.1).
 *
 * O browser NUNCA vê o token de serviço: tudo passa pela Edge `flix-mentoria-proxy`
 * (`supabase.functions.invoke('flix-mentoria-proxy', { body: { metodo, caminho, corpo } })`), que injeta
 * `Authorization` e `X-Mentor-Id`. Erros `{ error: { code, message, field } }` viram `ErroFonte`.
 */
import { supabase } from '@/integrations/supabase/client';
import { ErroFonte } from './fonte';

export type Metodo = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/** Assinatura mínima de `supabase.functions.invoke` (injetável nos testes). */
export type InvocarProxy = (nome: string, opcoes: { body: unknown }) => Promise<{ data: unknown; error: unknown }>;

export const invocarSupabase: InvocarProxy = (nome, opcoes) =>
  supabase.functions.invoke(nome, { body: opcoes.body as Record<string, unknown> }) as Promise<{ data: unknown; error: unknown }>;

const PROXY = 'flix-mentoria-proxy';

interface CorpoErroFlix { error?: { code?: string; message?: string; field?: string } }

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
export async function erroDoProxy(error: unknown): Promise<ErroFonte> {
  if (error instanceof ErroFonte) return error;
  const { status, corpo } = await lerCorpo((error as { context?: unknown } | null)?.context);
  const e = (corpo && typeof corpo === 'object' ? (corpo as CorpoErroFlix).error : undefined) ?? undefined;
  if (e?.code) return new ErroFonte(status ?? 500, e.code, e.message ?? '', e.field);
  return new ErroFonte(status ?? 0, 'rede', 'Não foi possível falar com o Flix.');
}

export interface ClienteFlix {
  chamar<T>(metodo: Metodo, caminho: string, corpo?: unknown): Promise<T>;
}

export function criarClienteFlix(invocar: InvocarProxy = invocarSupabase): ClienteFlix {
  return {
    async chamar<T>(metodo: Metodo, caminho: string, corpo?: unknown): Promise<T> {
      let r: { data: unknown; error: unknown };
      try {
        r = await invocar(PROXY, { body: corpo === undefined ? { metodo, caminho } : { metodo, caminho, corpo } });
      } catch (e) {
        throw await erroDoProxy(e);
      }
      if (r.error) throw await erroDoProxy(r.error);
      return r.data as T;
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
