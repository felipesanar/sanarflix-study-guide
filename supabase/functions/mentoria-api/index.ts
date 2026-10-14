import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolverRequisicao } from "./rotas.ts";

// API de Mentoria para o SanarFlix PRO ENAMED (Flix).
//
// Chamada só server-to-server, via Kong: o Kong injeta `x-mentoria-key`
// (segredo MENTORIA_API_KEY) e o Flix manda `x-aluno-email` (+ `x-sanarflix-user-id`,
// que só é registrado). Nunca vem do navegador, então não há CORS.
// Auth e roteamento vivem no módulo puro ./rotas.ts (testado no Vitest).
// A leitura passa por RPCs api_mentoria_* liberadas só para a service role.

const BUCKET_ANEXOS = "mural-anexos";
const VALIDADE_URL_ANEXO_S = 3600;

const json = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

const erroInterno = () =>
  json(500, { erro: "erro_interno", mensagem: "Não foi possível processar a requisição." });

serve(async (request: Request) => {
  const chave = Deno.env.get("MENTORIA_API_KEY") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  try {
    const url = new URL(request.url);
    const headers: Record<string, string> = {};
    request.headers.forEach((v, k) => { headers[k] = v; });
    const query: Record<string, string> = {};
    url.searchParams.forEach((v, k) => { query[k] = v; });

    const r = resolverRequisicao(
      { method: request.method, path: url.pathname, headers, query },
      chave,
    );
    if (!r.ok) return json(r.status, r.corpo);

    if (!supabaseUrl || !serviceKey) {
      console.error("mentoria-api: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes");
      return erroInterno();
    }
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const flixUserId = headers["x-sanarflix-user-id"];
    console.log(`mentoria-api ${r.rota} flix_user=${flixUserId ?? "-"}`);

    if (r.rota === "me") {
      const { data, error } = await supabase.rpc("api_mentoria_me", { p_email: r.email });
      if (error) throw error;
      return json(200, data);
    }

    if (r.rota === "sessoes") {
      const { data, error } = await supabase.rpc("api_mentoria_sessoes", {
        p_email: r.email,
        p_quando: r.params.quando,
      });
      if (error) throw error;
      return json(200, data);
    }

    // mural
    const { data, error } = await supabase.rpc("api_mentoria_mural", {
      p_email: r.email,
      p_aba: r.params.aba,
      p_cursor: r.params.cursor ?? null,
    });
    if (error) throw error;

    // deno-lint-ignore no-explicit-any
    const itens = await Promise.all(((data?.itens ?? []) as any[]).map(async (item) => {
      const { anexo_path, anexo_nome, ...resto } = item;
      if (!anexo_path) return { ...resto, anexo: null };
      const { data: assinada, error: errAssinar } = await supabase.storage
        .from(BUCKET_ANEXOS)
        .createSignedUrl(anexo_path, VALIDADE_URL_ANEXO_S);
      if (errAssinar || !assinada?.signedUrl) {
        console.error("mentoria-api: falha ao assinar anexo", errAssinar?.message);
        return { ...resto, anexo: null };
      }
      return { ...resto, anexo: { nome: anexo_nome ?? "Anexo", url: assinada.signedUrl } };
    }));

    return json(200, { ...data, itens });
  } catch (e) {
    console.error("mentoria-api: erro", e instanceof Error ? e.message : "desconhecido");
    return erroInterno();
  }
});
