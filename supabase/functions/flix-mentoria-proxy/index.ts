import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders } from '../_shared/cors.ts';
import { montarHeaders, validarRota } from './rotas.ts';

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  const cors = buildCorsHeaders(origin);
  const headers = {
    ...(cors ?? {}),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
  const erro = (status: number, code: string, message: string) =>
    new Response(JSON.stringify({ error: { code, message } }), { status, headers });

  if (origin !== null && !cors) return erro(403, 'origem_nao_permitida', 'Origem nao permitida.');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return erro(405, 'metodo_nao_permitido', 'Use POST para chamar o proxy.');

  const jwt = /^Bearer\s+(\S+)$/i.exec(req.headers.get('Authorization') ?? '')?.[1];
  if (!jwt) return erro(401, 'token_invalido', 'Sessao expirada.');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRole) return erro(500, 'configuracao', 'Proxy nao configurado.');
  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let userId: string;
  try {
    const { data, error } = await admin.auth.getUser(jwt);
    if (error || !data.user) return erro(401, 'token_invalido', 'Sessao expirada.');
    userId = data.user.id;
  } catch {
    return erro(401, 'token_invalido', 'Sessao expirada.');
  }

  const flixUrl = Deno.env.get('FLIX_MENTORIA_URL');
  const flixToken = Deno.env.get('FLIX_MENTORIA_TOKEN');
  if (!flixUrl || !flixToken) {
    return erro(503, 'flix_indisponivel', 'Integra\u00e7\u00e3o com o Flix ainda n\u00e3o configurada.');
  }

  let payload: { metodo?: unknown; caminho?: unknown; corpo?: unknown };
  try {
    payload = await req.json();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error();
  } catch {
    return erro(400, 'caminho_invalido', 'Informe um objeto JSON valido.');
  }
  const rota = validarRota(payload.metodo, payload.caminho);
  if (rota.ok === false) return new Response(JSON.stringify(rota.corpo), { status: rota.status, headers });

  let mentorId: string;
  try {
    // Service role sem Authorization do cliente: o vinculo nao depende de RLS ou metadata.
    const { data, error } = await admin.schema('public').from('mentores')
      .select('flix_mentor_id').eq('user_id', userId).eq('ativo', true).maybeSingle();
    if (error || typeof data?.flix_mentor_id !== 'string' || !data.flix_mentor_id.trim()) {
      return erro(403, 'mentor_sem_vinculo_flix', 'Mentor sem vinculo com o Flix.');
    }
    mentorId = data.flix_mentor_id;
  } catch {
    return erro(403, 'mentor_sem_vinculo_flix', 'Mentor sem vinculo com o Flix.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const resposta = await fetch(`${flixUrl.replace(/\/+$/, '')}/mentoria/v1${rota.caminho}`, {
      method: rota.metodo,
      headers: montarHeaders(flixToken, mentorId),
      body: rota.metodo !== 'GET' && payload.corpo !== undefined ? JSON.stringify(payload.corpo) : undefined,
      signal: controller.signal,
      // Nunca encaminhe o token de servico para um destino de redirect.
      redirect: 'manual',
    });
    if (resposta.status >= 500 || (resposta.status >= 300 && resposta.status < 400)) {
      await resposta.body?.cancel();
      return erro(502, 'rede', 'Nao foi possivel acessar o Flix.');
    }
    const corpo = resposta.status === 204 || resposta.status === 205 ? null : await resposta.text();
    return new Response(corpo, { status: resposta.status, headers });
  } catch {
    return erro(502, 'rede', 'Nao foi possivel acessar o Flix.');
  } finally {
    clearTimeout(timeout);
  }
});
