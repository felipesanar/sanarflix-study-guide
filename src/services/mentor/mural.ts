import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/utils/logger';

/**
 * Wrappers das RPCs do mural do mentor (Onda 2). Mesmo cast de
 * `src/services/admin/mentores.ts`: as RPCs ainda não estão nos tipos gerados.
 */

export type PublicoMural = 'turma' | 'selecionados';
export type StatusPost = 'rascunho' | 'publicado';
export type OrigemPost = 'mentor' | 'sessao_coletiva' | 'liberacao_agenda';

export interface PostMural {
  id: string;
  tag: string;
  titulo: string;
  mensagem: string;
  link_titulo: string | null;
  link_url: string | null;
  anexo_nome: string | null;
  anexo_path: string | null;
  publico: PublicoMural;
  status: StatusPost;
  publicado_em: string | null;
  origem: OrigemPost;
  destinatarios: string[];
}

export interface SalvarPostInput {
  /** Nulo cria um post novo. */
  id?: string | null;
  tag: string;
  titulo: string;
  mensagem: string;
  linkTitulo?: string | null;
  linkUrl?: string | null;
  anexoPath?: string | null;
  anexoNome?: string | null;
  publico: PublicoMural;
  destinatarios?: string[];
  publicar: boolean;
  registrarIntervencao?: boolean;
}

export interface SalvarPostResultado {
  post_id: string;
  publicado: boolean;
  intervencao_id: string | null;
}

async function callRpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase.rpc as CallableFunction)(fn, args);
  if (error) {
    Logger.error(`[services/mentor/mural] ${fn} falhou:`, error);
    throw new Error(error.message ?? `Falha ao executar ${fn}.`);
  }
  return data as T;
}

export async function salvarPost(input: SalvarPostInput): Promise<SalvarPostResultado> {
  return callRpc<SalvarPostResultado>('mentor_mural_salvar', {
    p_id: input.id ?? null,
    p_tag: input.tag,
    p_titulo: input.titulo,
    p_mensagem: input.mensagem,
    p_link_titulo: input.linkTitulo ?? null,
    p_link_url: input.linkUrl ?? null,
    p_anexo_path: input.anexoPath ?? null,
    p_anexo_nome: input.anexoNome ?? null,
    p_publico: input.publico,
    p_destinatarios: input.destinatarios ?? [],
    p_publicar: input.publicar,
    p_registrar_intervencao: input.registrarIntervencao ?? false,
  });
}

export async function listarPosts(filtros: { alunoEmail?: string | null; tag?: string | null } = {}): Promise<PostMural[]> {
  return callRpc<PostMural[]>('mentor_mural_listar', {
    p_aluno_email: filtros.alunoEmail ?? null,
    p_tag: filtros.tag ?? null,
  });
}

export async function listarTags(): Promise<string[]> {
  return callRpc<string[]>('mentor_tags', {});
}
