// Helpers de autenticação para Edge Functions.
// Padrão: SEMPRE extrair user do JWT — nunca confiar em user_id do body.

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export interface AuthenticatedUser {
  id: string;
  email?: string;
  // Outros campos disponíveis em userData.user se necessário.
}

/**
 * Cria um cliente Supabase com service role (bypass RLS).
 * Use apenas quando estritamente necessário; prefira o cliente com JWT do usuário.
 */
export function createAdminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes');
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Cria um cliente Supabase com o JWT do usuário (RLS ativo).
 */
export function createUserClient(req: Request): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  return createClient(url, anon, {
    global: {
      headers: { Authorization: req.headers.get('Authorization') ?? '' },
    },
  });
}

/**
 * Extrai o JWT do header Authorization. Aceita opcionalmente um token
 * vindo do body (necessário para sendBeacon, que não permite headers).
 */
export function extractToken(req: Request, bodyToken?: string | null): string | null {
  const auth = req.headers.get('Authorization') ?? '';
  if (auth.startsWith('Bearer ')) {
    return auth.slice('Bearer '.length);
  }
  return bodyToken ?? null;
}

/**
 * Valida o JWT e retorna o usuário autenticado. Retorna null se inválido.
 */
export async function getAuthenticatedUser(
  client: SupabaseClient,
  token: string | null
): Promise<AuthenticatedUser | null> {
  if (!token) return null;
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  return { id: data.user.id, email: data.user.email ?? undefined };
}

/**
 * Mascara um email para uso seguro em logs (LGPD).
 * Ex: "foo.bar@sanar.com" -> "fo***@sanar.com"
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '<unknown>';
  const at = email.indexOf('@');
  if (at < 2) return '***' + email.slice(at);
  return email.slice(0, 2) + '***' + email.slice(at);
}
