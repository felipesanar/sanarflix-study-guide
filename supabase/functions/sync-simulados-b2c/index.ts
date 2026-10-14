import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  lotes,
  mapearPacote,
  sanitizarErro,
  separarPorEspelho,
  type Pacote,
} from "./upsert.ts";

// Sincronização diária dos simulados B2C (Onda 3 da Página do Mentor).
//
// Chamada pelo pg_cron com `Authorization: Bearer <service role>`. Lê os
// e-mails dos mentorados ativos, pede ao mentoria-export (projeto de simulados)
// os dados deles em lotes e faz upsert nas tabelas b2c_* (espelho). Cada
// execução fica registrada em b2c_sync_execucoes (só contagens ou mensagem de
// erro — nunca segredos).

// 100 e-mails por chamada: lotes grandes sem `desde` arriscam estourar a memória da export.
const LOTE_EXPORTACAO = 100;
const TAMANHO_LOTE_UPSERT = 1000;
const FOLGA_DIAS = 2;

const JSON_HEADERS = { "Content-Type": "application/json" };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

// Comparação em tempo constante (não vaza o ponto da primeira diferença).
function compararSegredo(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ba = enc.encode(a);
  const bb = enc.encode(b);
  const tamanho = Math.max(ba.length, bb.length);
  let diff = ba.length ^ bb.length;
  for (let i = 0; i < tamanho; i++) {
    diff |= (ba[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

// O env SUPABASE_SERVICE_ROLE_KEY pode vir no formato novo (sb_secret_…) enquanto o
// cron manda a service_role legada (JWT) guardada no Vault: as duas são válidas, mas
// não são iguais. Fora a igualdade exata, aceita quem prova acesso de serviço lendo
// b2c_sync_execucoes — anon e authenticated não têm grant nessa tabela.
async function temAcessoDeServico(supabaseUrl: string, token: string): Promise<boolean> {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/b2c_sync_execucoes?select=id&limit=1`, {
      headers: { apikey: token, Authorization: `Bearer ${token}` },
    });
    await res.body?.cancel();
    return res.ok;
  } catch {
    return false;
  }
}

serve(async (req: Request) => {
  if (req.method !== "POST") return json(405, { ok: false, erro: "metodo_nao_permitido" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const exportUrl = Deno.env.get("SIMULADOS_EXPORT_URL") ?? "";
  const exportSecret = Deno.env.get("MENTORIA_EXPORT_SECRET") ?? "";

  if (!supabaseUrl || !serviceKey) {
    console.error("sync-simulados-b2c: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes");
    return json(500, { ok: false, erro: "config_ausente" });
  }

  const auth = req.headers.get("Authorization") ?? "";
  const recebido = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!recebido || !(compararSegredo(recebido, serviceKey) || await temAcessoDeServico(supabaseUrl, recebido))) {
    return json(401, { ok: false, erro: "nao_autorizado" });
  }

  if (!exportUrl || !exportSecret) {
    console.error("sync-simulados-b2c: SIMULADOS_EXPORT_URL/MENTORIA_EXPORT_SECRET ausentes");
    return json(500, { ok: false, erro: "config_ausente" });
  }

  const db = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Execução anterior (lida ANTES de registrar a atual): se terminou com erro
  // ou nem terminou (queda/timeout), esta rodada reenvia tudo sem `desde`.
  const { data: anterior, error: antErr } = await db
    .from("b2c_sync_execucoes")
    .select("terminado_em, erro")
    .order("id", { ascending: false })
    .limit(1);
  if (antErr) {
    console.error("sync-simulados-b2c: falha ao ler execução anterior", sanitizarErro(antErr.message));
    return json(500, { ok: false, erro: "execucao_anterior_ilegivel" });
  }
  const anteriorFalhou = !!anterior && anterior.length > 0 &&
    (anterior[0].erro !== null || anterior[0].terminado_em === null);

  const { data: exec, error: execErr } = await db
    .from("b2c_sync_execucoes")
    .insert({})
    .select("id")
    .single();
  if (execErr || !exec) {
    console.error("sync-simulados-b2c: falha ao registrar execução", sanitizarErro(execErr?.message ?? ""));
    return json(500, { ok: false, erro: "execucao_nao_registrada" });
  }
  const execId = exec.id as number;

  const totais = { alunos: 0, tentativas: 0, respostas: 0 };

  async function upsert(tabela: string, linhas: unknown[], onConflict: string) {
    for (const lote of lotes(linhas, TAMANHO_LOTE_UPSERT)) {
      const { error } = await db.from(tabela).upsert(lote, { onConflict });
      if (error) throw new Error(`upsert ${tabela}: ${error.message}`);
    }
  }

  try {
    // 1. E-mails dos mentorados ativos (vínculo sem fim), distintos.
    const emails = new Set<string>();
    for (let de = 0; ; de += 1000) {
      const { data, error } = await db
        .from("mentoria_vinculos")
        .select("email_normalizado")
        .is("fim", null)
        .order("email_normalizado")
        .range(de, de + 999);
      if (error) throw new Error(`ler vinculos: ${error.message}`);
      for (const r of data ?? []) {
        const e = String(r.email_normalizado ?? "").trim().toLowerCase();
        if (e) emails.add(e);
      }
      if (!data || data.length < 1000) break;
    }

    if (emails.size === 0) {
      await db
        .from("b2c_sync_execucoes")
        .update({ terminado_em: new Date().toISOString(), alunos: 0, tentativas: 0, respostas: 0 })
        .eq("id", execId);
      return json(200, { ok: true, ...totais });
    }

    // 2. Quem já está no espelho (paginado).
    const noEspelho = new Set<string>();
    for (let de = 0; ; de += 1000) {
      const { data, error } = await db
        .from("b2c_alunos")
        .select("email")
        .order("email")
        .range(de, de + 999);
      if (error) throw new Error(`ler espelho: ${error.message}`);
      for (const r of data ?? []) noEspelho.add(String(r.email));
      if (!data || data.length < 1000) break;
    }

    // 3. Janela incremental (só para quem já está no espelho): max(finalizada_em) menos a folga.
    const { data: ult, error: ultErr } = await db
      .from("b2c_tentativas")
      .select("finalizada_em")
      .order("finalizada_em", { ascending: false })
      .limit(1);
    if (ultErr) throw new Error(`ler ultima tentativa: ${ultErr.message}`);
    let desdeExistentes: string | null = null;
    if (ult && ult.length > 0 && ult[0].finalizada_em && Number.isFinite(Date.parse(ult[0].finalizada_em as string))) {
      const ms = Date.parse(ult[0].finalizada_em as string) - FOLGA_DIAS * 24 * 60 * 60 * 1000;
      desdeExistentes = new Date(ms).toISOString();
    }

    // Novos (ou rodada anterior falhou): histórico completo, desde = null.
    const { novos, existentes } = anteriorFalhou
      ? { novos: [...emails], existentes: [] as string[] }
      : separarPorEspelho([...emails], noEspelho);
    const grupos = [
      ...lotes(novos, LOTE_EXPORTACAO).map((l) => ({ emails: l, desde: null as string | null })),
      ...lotes(existentes, LOTE_EXPORTACAO).map((l) => ({ emails: l, desde: desdeExistentes })),
    ];

    // 4. Exporta por lote e grava na ordem das FKs.
    const simuladosVistos = new Set<string>();
    const questoesVistas = new Set<string>();

    for (const grupo of grupos) {
      const resp = await fetch(exportUrl, {
        method: "POST",
        headers: { ...JSON_HEADERS, "x-mentoria-export-secret": exportSecret },
        body: JSON.stringify({ emails: grupo.emails, desde: grupo.desde }),
      });
      if (!resp.ok) throw new Error(`mentoria-export respondeu ${resp.status}`);
      const pacote = (await resp.json()) as Pacote;
      const m = mapearPacote(pacote);

      const simulados = m.simulados.filter((s) => !simuladosVistos.has(s.id));
      simulados.forEach((s) => simuladosVistos.add(s.id));
      const questoes = m.questoes.filter((q) => !questoesVistas.has(q.id));
      questoes.forEach((q) => questoesVistas.add(q.id));

      await upsert("b2c_simulados", simulados, "id");
      await upsert("b2c_questoes", questoes, "id");
      await upsert("b2c_alunos", m.alunos, "email");
      await upsert("b2c_tentativas", m.tentativas, "id");
      await upsert("b2c_respostas", m.respostas, "tentativa_id,questao_id");

      totais.alunos += m.alunos.length;
      totais.tentativas += m.tentativas.length;
      totais.respostas += m.respostas.length;
    }

    // 5. Fecha a execução.
    await db
      .from("b2c_sync_execucoes")
      .update({ terminado_em: new Date().toISOString(), ...totais })
      .eq("id", execId);

    return json(200, { ok: true, ...totais });
  } catch (e) {
    const mensagem = sanitizarErro(e instanceof Error ? e.message : "erro_desconhecido");
    console.error("sync-simulados-b2c:", mensagem);
    await db
      .from("b2c_sync_execucoes")
      .update({ terminado_em: new Date().toISOString(), ...totais, erro: mensagem })
      .eq("id", execId);
    return json(500, { ok: false, erro: mensagem });
  }
});
