// Função TEMPORÁRIA de suporte: devolve o payload do portal do gestor
// (visão geral + detalhamento) para um recorte, no contexto de um gestor real.
// Protegida por um segredo compartilhado no header. Remover após o uso.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-tmp-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  const esperado = Deno.env.get('TMP_RELATORIO_TOKEN');
  if (!esperado || req.headers.get('x-tmp-token') !== esperado) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const body = await req.json();
  const { uid, iesId, semestre, simulados } = body as {
    uid: string;
    iesId: string;
    semestre: string;
    simulados: string[];
  };

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const vg = await admin.rpc('tmp_rel_visao_geral', {
    p_uid: uid,
    p_ies_id: iesId,
    p_semestre: semestre,
  });
  const det = await admin.rpc('tmp_rel_detalhamento', {
    p_uid: uid,
    p_ies_id: iesId,
    p_semestre: semestre,
    p_simulados: simulados,
  });

  return new Response(
    JSON.stringify({
      visaoGeral: vg.data ?? null,
      erroVisaoGeral: vg.error?.message ?? null,
      detalhamento: det.data ?? null,
      erroDetalhamento: det.error?.message ?? null,
    }),
    { headers: { ...cors, 'Content-Type': 'application/json' } },
  );
});
