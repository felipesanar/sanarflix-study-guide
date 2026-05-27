// Rate limiting cross-instance via tabela `public.kv_store` no Postgres.
// Substitui o uso de Deno.openKv() (não habilitado no projeto hospedado) e o
// fallback em memória (que vazava entre instâncias do edge runtime).
//
// Uso típico:
//   const rl = await checkRateLimit(req, { key: 'b2b-create-user', limitPerMin: 5 });
//   if (!rl.allowed) return tooManyRequests();
//
// Fail-open: se a chamada ao DB falhar, permitimos o request (e logamos).
// Rate limit não deve derrubar o happy path; segurança real vem de JWT + Zod + RLS.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface RateLimitOptions {
  /** Identificador da rota/operação (ex: 'b2b-create-user'). */
  key: string;
  /** Limite por minuto por IP (default: 10). */
  limitPerMin?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number; // segundos até reset
}

let adminClient: SupabaseClient | null = null;
function getAdmin(): SupabaseClient | null {
  if (adminClient) return adminClient;
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return null;
  adminClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}

function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

export async function checkRateLimit(
  req: Request,
  opts: RateLimitOptions
): Promise<RateLimitResult> {
  const limit = opts.limitPerMin ?? 10;
  const ip = getClientIp(req);
  const fullKey = `rl:${opts.key}:${ip}`;

  const admin = getAdmin();
  if (!admin) {
    console.warn('[rateLimit] missing SUPABASE_URL/SERVICE_ROLE_KEY → fail-open');
    return { allowed: true, remaining: limit, resetIn: 60 };
  }

  try {
    const { data, error } = await admin.rpc('kv_incr', {
      p_key: fullKey,
      p_ttl_seconds: 60,
      p_limit: limit,
    });
    if (error || !data) {
      console.warn('[rateLimit] kv_incr error → fail-open:', error?.message);
      return { allowed: true, remaining: limit, resetIn: 60 };
    }
    const row = data as { allowed: boolean; remaining: number; reset_in: number };
    return {
      allowed: row.allowed,
      remaining: row.remaining,
      resetIn: row.reset_in,
    };
  } catch (err) {
    console.warn('[rateLimit] unexpected error → fail-open:', err);
    return { allowed: true, remaining: limit, resetIn: 60 };
  }
}
