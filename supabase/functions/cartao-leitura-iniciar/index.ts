// Edge function: dispara a leitura de um PDF de cartões-resposta (Admin → Simulados → Leitura de cartões).
//
// O front já criou a linha em `cartao_leituras` (status `enviado`) e subiu o PDF para
// `cartoes-leitura/<leitura>/scan.pdf`. Aqui: confere o admin (JWT + has_role), passa a leitura para
// `processando` (só a partir de `enviado` ou `falhou`, o que também serve para reprocessar) e dispara o workflow
// `cartao-leitura.yml` no GitHub Actions. Se o disparo falhar, a leitura volta para `falhou` com o motivo.
//
// Segredos: GITHUB_DISPATCH_TOKEN (fine-grained PAT só com actions:write no repositório).
// Opcionais: CARTAO_LEITURA_GITHUB_REPO (padrão felipesanar/sanarflix-study-guide),
//            CARTAO_LEITURA_GITHUB_REF (padrão main), CARTAO_LEITURA_WORKFLOW (padrão cartao-leitura.yml).

import { createAdminClient, extractToken, getAuthenticatedUser } from '../_shared/auth.ts';
import { isAllowedOrigin } from '../_shared/cors.ts';

const ehUuid = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (origin !== null && !isAllowedOrigin(origin)) return new Response('forbidden', { status: 403 });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const db = createAdminClient();
  const user = await getAuthenticatedUser(db, extractToken(req));
  if (!user) return json(401, { error: 'unauthorized' });
  const { data: ehAdmin, error: errRole } = await db.rpc('has_role', { _user_id: user.id, _role: 'admin' });
  if (errRole) return json(500, { error: 'role_check_failed' });
  if (ehAdmin !== true) return json(403, { error: 'forbidden' });

  let leituraId: unknown;
  try {
    leituraId = (await req.json())?.leitura_id;
  } catch {
    return json(400, { error: 'bad_request', detail: 'JSON inválido' });
  }
  if (!ehUuid(leituraId)) return json(400, { error: 'bad_request', detail: 'leitura_id inválido' });

  const token = Deno.env.get('GITHUB_DISPATCH_TOKEN');
  if (!token) return json(500, { error: 'not_configured', detail: 'GITHUB_DISPATCH_TOKEN ausente' });
  const repo = Deno.env.get('CARTAO_LEITURA_GITHUB_REPO') ?? 'felipesanar/sanarflix-study-guide';
  const ref = Deno.env.get('CARTAO_LEITURA_GITHUB_REF') ?? 'main';
  const workflow = Deno.env.get('CARTAO_LEITURA_WORKFLOW') ?? 'cartao-leitura.yml';

  // troca de status condicional: duas chamadas simultâneas não disparam dois workers
  const { data: tomada, error: errUpd } = await db
    .from('cartao_leituras')
    .update({ status: 'processando', disparado_em: new Date().toISOString(), iniciado_em: null, erro: null })
    .eq('id', leituraId)
    .in('status', ['enviado', 'falhou'])
    .select('id')
    .maybeSingle();
  if (errUpd) return json(500, { error: 'db_error', detail: errUpd.message });
  if (!tomada) return json(409, { error: 'conflict', detail: 'a leitura não existe ou já está em processamento/concluída' });

  const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'sanarflix-cartao-leitura',
    },
    body: JSON.stringify({ ref, inputs: { leitura_id: leituraId } }),
  });
  if (!res.ok) {
    const detalhe = (await res.text()).slice(0, 300);
    await db
      .from('cartao_leituras')
      .update({ status: 'falhou', erro: `não consegui disparar o worker (GitHub ${res.status}): ${detalhe}` })
      .eq('id', leituraId);
    return json(502, { error: 'dispatch_failed', detail: `GitHub ${res.status}` });
  }
  return json(200, { ok: true });
});
