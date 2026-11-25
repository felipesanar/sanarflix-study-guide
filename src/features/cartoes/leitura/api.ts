/** Acesso ao Supabase da Leitura de cartões (tabelas e bucket só de admin; ver a migration cartao_leituras). */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Leitura, PaginaLeitura, RevisaoPatch } from './types';

export const BUCKET = 'cartoes-leitura';
/** Limite do bucket (migration). O limite global do projeto pode ser menor. */
export const TAMANHO_MAXIMO = 200 * 1024 * 1024;

// as tabelas novas ainda não estão nos tipos gerados (src/integrations/supabase/types.ts)
const db = supabase as unknown as SupabaseClient;

function falha(error: { message?: string } | null, contexto: string): never {
  throw new Error(`${contexto}: ${error?.message ?? 'erro desconhecido'}`);
}

export interface SimuladoLeitura {
  id: string;
  nome: string;
  total_questoes: number;
}

export async function listarSimulados(): Promise<SimuladoLeitura[]> {
  const { data, error } = await supabase.from('simulados_admin').select('id, nome').order('created_at', { ascending: false });
  if (error) falha(error, 'simulados');
  const ids = (data ?? []).map((s) => s.id);
  const total: Record<string, number> = {};
  if (ids.length) {
    const { data: qs, error: e2 } = await supabase.rpc('get_simulados_questoes_count', { p_simulado_ids: ids });
    if (e2) falha(e2, 'contagem de questões');
    for (const r of (qs ?? []) as Array<{ simulado_id: string; total: number }>) total[String(r.simulado_id)] = Number(r.total) || 0;
  }
  return (data ?? []).map((s) => ({ id: s.id, nome: s.nome, total_questoes: total[String(s.id)] ?? 0 }));
}

export async function listarLeituras(limite = 30): Promise<Leitura[]> {
  const { data, error } = await db.from('cartao_leituras').select('*').order('created_at', { ascending: false }).limit(limite);
  if (error) falha(error, 'leituras');
  return (data ?? []) as Leitura[];
}

export async function obterLeitura(id: string): Promise<Leitura> {
  const { data, error } = await db.from('cartao_leituras').select('*').eq('id', id).single();
  if (error) falha(error, 'leitura');
  return data as Leitura;
}

/**
 * Sobe o PDF (`<id>/scan.pdf`) e cria a leitura em `enviado`. Quem chama dispara o worker com `iniciarLeitura`;
 * se o disparo falhar, a leitura fica criada e pode ser disparada de novo pela lista.
 */
export async function enviarLeitura(opts: { simuladoId: string; totalQuestoes: number; arquivo: File }): Promise<string> {
  const id = crypto.randomUUID();
  const caminho = `${id}/scan.pdf`;
  const { error: errUp } = await supabase.storage.from(BUCKET).upload(caminho, opts.arquivo, {
    contentType: 'application/pdf',
    upsert: false,
  });
  if (errUp) falha(errUp, 'upload do PDF');
  const { error } = await db.from('cartao_leituras').insert({
    id,
    simulado_id: opts.simuladoId,
    arquivo_path: caminho,
    arquivo_nome: opts.arquivo.name.slice(0, 200),
    arquivo_bytes: opts.arquivo.size,
    total_questoes: opts.totalQuestoes, // criado_por: default auth.uid() (a policy confere)
  });
  if (error) falha(error, 'registro da leitura');
  return id;
}

export async function iniciarLeitura(id: string): Promise<void> {
  const { error } = await supabase.functions.invoke('cartao-leitura-iniciar', { body: { leitura_id: id } });
  if (error) {
    let detalhe = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      const corpo = ctx && typeof ctx.json === 'function' ? await ctx.json() : null;
      if (corpo?.detail || corpo?.error) detalhe = corpo.detail ?? corpo.error;
    } catch {
      /* ignore */
    }
    throw new Error(`não consegui iniciar a leitura: ${detalhe}`);
  }
}

export async function listarPaginas(leituraId: string): Promise<PaginaLeitura[]> {
  const { data, error } = await db.from('cartao_leitura_paginas').select('*').eq('leitura_id', leituraId).order('pagina');
  if (error) falha(error, 'páginas');
  return (data ?? []) as PaginaLeitura[];
}

export async function revisarPagina(id: string, patch: RevisaoPatch): Promise<void> {
  const { data: sessao } = await supabase.auth.getUser();
  const { error } = await db
    .from('cartao_leitura_paginas')
    .update({ ...patch, revisado_por: sessao.user?.id ?? null, revisado_em: new Date().toISOString() })
    .eq('id', id);
  if (error) falha(error, 'revisão');
}

export async function marcarImportada(leituraId: string, batchId: string): Promise<void> {
  const { error } = await db
    .from('cartao_leituras')
    .update({ status: 'importado', import_batch_id: batchId, importado_em: new Date().toISOString() })
    .eq('id', leituraId);
  if (error) falha(error, 'marcar como importada');
}

/** URLs assinadas (10 min) para as imagens da revisão. */
export async function urlsAssinadas(caminhos: string[]): Promise<Record<string, string>> {
  const unicos = [...new Set(caminhos.filter(Boolean))];
  if (!unicos.length) return {};
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(unicos, 600);
  if (error) falha(error, 'imagens');
  const out: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}
