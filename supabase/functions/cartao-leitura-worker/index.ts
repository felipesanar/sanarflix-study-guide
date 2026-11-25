// Edge function chamada pelo worker da leitura de cartões (GitHub Actions, services/cartao-omr/cartao_omr/worker.py).
//
// Auth própria: `Authorization: Bearer <CARTAO_WORKER_TOKEN>`, comparado em tempo constante (verify_jwt = false
// em config.toml). O worker nunca recebe a service role: quem grava no banco e assina URLs do Storage é esta função.
//
// Ações (POST JSON `{ acao, leitura_id, ... }`), todas só para leitura em `processando`:
//   obter          → dados da leitura + URL assinada (1 h) do PDF; grava início e link do run
//   urls_recortes  → URLs assinadas de upload para `<leitura>/recortes/*.png`
//   concluir       → grava as páginas (substitui as anteriores da leitura) e muda para `concluido`
//   falhar         → grava o erro e muda para `falhou`

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createAdminClient } from '../_shared/auth.ts';
import {
  autorizado,
  caminhoDoScan,
  caminhosDeRecorte,
  ehAcao,
  ehUuid,
  linhasDoResultado,
  runUrlValida,
} from './logica.ts';

const BUCKET = 'cartoes-leitura';
const LOTE_INSERT = 500;
const LOTE_URLS = 20;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  if (!autorizado(req.headers.get('Authorization'), Deno.env.get('CARTAO_WORKER_TOKEN'))) {
    return json(401, { error: 'unauthorized' });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'bad_request', detail: 'JSON inválido' });
  }
  const { acao, leitura_id: leituraId } = body;
  if (!ehAcao(acao)) return json(400, { error: 'bad_request', detail: 'acao inválida' });
  if (!ehUuid(leituraId)) return json(400, { error: 'bad_request', detail: 'leitura_id inválido' });

  const db = createAdminClient();
  const { data: leitura, error: errLeitura } = await db
    .from('cartao_leituras')
    .select('id, simulado_id, total_questoes, status, arquivo_path')
    .eq('id', leituraId)
    .maybeSingle();
  if (errLeitura) return json(500, { error: 'db_error', detail: errLeitura.message });
  if (!leitura) return json(404, { error: 'not_found' });

  if (acao === 'falhar') {
    // depois de concluída, uma falha tardia (ex.: passo de limpeza do runner) não desfaz o resultado
    if (leitura.status !== 'processando') return json(200, { ok: true, ignorado: true });
    const erro = String(body.erro ?? 'falha sem mensagem').slice(0, 1000);
    const { error } = await db.from('cartao_leituras').update({ status: 'falhou', erro }).eq('id', leituraId);
    return error ? json(500, { error: 'db_error', detail: error.message }) : json(200, { ok: true });
  }

  if (leitura.status !== 'processando') {
    return json(409, { error: 'conflict', detail: `leitura em ${leitura.status}, esperado processando` });
  }

  if (acao === 'obter') {
    const { data: assinada, error } = await db.storage.from(BUCKET).createSignedUrl(caminhoDoScan(leituraId), 3600);
    if (error || !assinada) return json(500, { error: 'storage_error', detail: error?.message });
    await db
      .from('cartao_leituras')
      .update({ iniciado_em: new Date().toISOString(), github_run_url: runUrlValida(body.run_url), erro: null })
      .eq('id', leituraId);
    return json(200, {
      leitura: { id: leitura.id, simulado_id: leitura.simulado_id, total_questoes: leitura.total_questoes },
      download_url: assinada.signedUrl,
    });
  }

  if (acao === 'urls_recortes') {
    const caminhos = caminhosDeRecorte(leituraId, body.caminhos);
    if (!Array.isArray(caminhos)) return json(400, { error: 'bad_request', detail: caminhos.erro });
    const urls: Record<string, string> = {};
    for (let i = 0; i < caminhos.length; i += LOTE_URLS) {
      const lote = caminhos.slice(i, i + LOTE_URLS);
      const assinadas = await Promise.all(
        lote.map((c) => db.storage.from(BUCKET).createSignedUploadUrl(c, { upsert: true })),
      );
      for (let j = 0; j < lote.length; j++) {
        const { data, error } = assinadas[j];
        if (error || !data) return json(500, { error: 'storage_error', detail: error?.message });
        urls[lote[j].slice(leituraId.length + 1)] = data.signedUrl;
      }
    }
    return json(200, { urls });
  }

  // concluir
  const r = linhasDoResultado(leituraId, leitura.total_questoes, body.resultado);
  if ('erro' in r) return json(400, { error: 'bad_request', detail: r.erro });

  const { error: errDel } = await db.from('cartao_leitura_paginas').delete().eq('leitura_id', leituraId);
  if (errDel) return json(500, { error: 'db_error', detail: errDel.message });
  for (let i = 0; i < r.linhas.length; i += LOTE_INSERT) {
    const { error } = await db.from('cartao_leitura_paginas').insert(r.linhas.slice(i, i + LOTE_INSERT));
    if (error) return json(500, { error: 'db_error', detail: error.message });
  }
  const { error: errUpd } = await db
    .from('cartao_leituras')
    .update({ status: 'concluido', resumo: r.resumo, concluido_em: new Date().toISOString(), erro: null })
    .eq('id', leituraId);
  if (errUpd) return json(500, { error: 'db_error', detail: errUpd.message });
  return json(200, { ok: true, paginas: r.linhas.length });
});
