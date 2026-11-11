import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders } from '../_shared/cors.ts';
import { criarProxy, ErroConfiguracaoProxy } from './nucleo.ts';

const admin = () => {
  const url = Deno.env.get('SUPABASE_URL');
  const chave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !chave) throw new ErroConfiguracaoProxy('Proxy nao configurado.');
  return createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });
};
// Uma instancia por isolate preserva o cache entre requisicoes.
const proxy = criarProxy({
  async usuarioDoJwt(jwt) {
    const { data, error } = await admin().auth.getUser(jwt);
    return error || !data.user ? null : { id: data.user.id, email: data.user.email ?? null };
  },
  async flixMentorId(userId) {
    const { data, error } = await admin().schema('public').from('mentores')
      .select('flix_mentor_id').eq('user_id', userId).eq('ativo', true).maybeSingle();
    return error || typeof data?.flix_mentor_id !== 'string' ? null : data.flix_mentor_id;
  },
  async buscar(url, init) {
    const resposta = await fetch(url, init);
    return { status: resposta.status, text: () => resposta.text(), cancelar: async () => { await resposta.body?.cancel(); } };
  },
  config: () => ({ flixUrl: Deno.env.get('FLIX_MENTORIA_URL') ?? null, flixToken: Deno.env.get('FLIX_MENTORIA_TOKEN') ?? null }),
  novoId: () => crypto.randomUUID(), agora: () => Date.now(),
  registrar: (evento) => console.error(JSON.stringify(evento)),
});

function idDoCorpo(corpo: unknown): string | null {
  const id = corpo && typeof corpo === 'object' ? (corpo as { requestId?: unknown }).requestId : null;
  return typeof id === 'string' ? id : null;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  const cors = buildCorsHeaders(origin);
  let corpo: unknown = null;
  if (req.method === 'POST') {
    try { corpo = await req.json(); } catch { /* O nucleo responde caminho_invalido. */ }
  }
  const saida = await proxy({
    metodoHttp: req.method, origin, corsPermitido: cors !== null,
    authorization: req.headers.get('Authorization'),
    // O cliente do Academy manda o ID no corpo (supabase.functions.invoke); o cabecalho vale para outros chamadores.
    requestId: req.headers.get('X-Request-Id') ?? idDoCorpo(corpo), corpo,
  });
  return new Response(saida.corpo, {
    status: saida.status,
    headers: {
      ...(cors ?? {}), ...saida.headers,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': [cors?.['Access-Control-Allow-Headers'], 'x-request-id'].filter(Boolean).join(', '),
      'Access-Control-Expose-Headers': [cors?.['Access-Control-Expose-Headers'], 'X-Request-Id'].filter(Boolean).join(', '),
    },
  });
});
