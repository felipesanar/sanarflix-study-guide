// Supabase Edge Function: flix-mentoria-proxy
// Repassa chamadas do Academy para a API de Mentoria do Flix sem expor o token.
// Secrets: FLIX_MENTORIA_URL (proxy do Cloud), FLIX_MENTORIA_TOKEN.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const METODOS = new Set(['GET', 'POST', 'PATCH', 'PUT', 'DELETE']);
// Só caminhos do contrato (docs/07). Rotas de cadastro (SGI) ficam de fora.
const PERMITIDOS = [/^\/me$/, /^\/tribos\/[\w-]+\/(alunos|canais|publicacoes|sessoes|convites)(\/.*)?(\?.*)?$/, /^\/(publicacoes|sessoes|convites)\/[\w-]+(\/gravacao)?$/, /^\/uploads$/];

Deno.serve(async (req) => {
  const auth = req.headers.get('Authorization') ?? '';
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: { code: 'token_invalido', message: 'Sessão expirada.' } }), { status: 401 });

  const { metodo, caminho, corpo } = await req.json();
  if (!METODOS.has(metodo) || !PERMITIDOS.some((r) => r.test(caminho))) {
    return new Response(JSON.stringify({ error: { code: 'nao_encontrado', message: 'Rota não permitida.' } }), { status: 404 });
  }

  // O Flix identifica o mentor pelo userId da conta Sanar.
  // TODO: confirmar se o user.id do Academy é o mesmo userId do Flix ou se precisa de mapeamento.
  const r = await fetch(`${Deno.env.get('FLIX_MENTORIA_URL')}/mentoria/v1${caminho}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${Deno.env.get('FLIX_MENTORIA_TOKEN')}`,
      'X-Mentor-Id': user.user_metadata?.flix_user_id ?? user.id,
      'Content-Type': 'application/json',
    },
    body: corpo !== undefined && metodo !== 'GET' ? JSON.stringify(corpo) : undefined,
  });
  return new Response(r.status === 204 ? null : await r.text(), { status: r.status, headers: { 'Content-Type': 'application/json' } });
});
