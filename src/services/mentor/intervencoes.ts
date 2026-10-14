import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/utils/logger';

/**
 * Wrappers das RPCs de intervenções do mentor (Onda 2).
 * Mesmo cast de `src/services/admin/mentores.ts`.
 */

export type TipoIntervencao = 'reuniao_individual' | 'reuniao_coletiva' | 'mensagem_mural' | 'whatsapp' | 'outro';
export type StatusIntervencao = 'a_fazer' | 'em_andamento' | 'feito';
export type AlvoIntervencao = 'aluno' | 'grupo' | 'turma';

export interface ComentarioIntervencao {
  texto: string;
  criado_em: string;
}

export interface CardIntervencao {
  id: string;
  tipo: TipoIntervencao;
  titulo: string;
  nota: string | null;
  status: StatusIntervencao;
  alvo: AlvoIntervencao;
  origem: 'auto' | 'manual';
  origem_ref: { kind: string; id: string } | null;
  criado_em: string;
  alunos: string[];
  comentarios: ComentarioIntervencao[];
  peso: number;
}

export interface ListaIntervencoes {
  cards: CardIntervencao[];
  planejadas: number;
  realizadas: number;
}

export interface CriarIntervencaoInput {
  tipo: TipoIntervencao;
  titulo: string;
  nota?: string | null;
  alvo: AlvoIntervencao;
  alunos?: string[];
}

export interface AtualizarIntervencaoInput {
  id: string;
  titulo?: string | null;
  nota?: string | null;
  status?: StatusIntervencao | null;
}

async function callRpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase.rpc as CallableFunction)(fn, args);
  if (error) {
    Logger.error(`[services/mentor/intervencoes] ${fn} falhou:`, error);
    throw new Error(error.message ?? `Falha ao executar ${fn}.`);
  }
  return data as T;
}

export async function criarIntervencao(input: CriarIntervencaoInput): Promise<{ intervencao_id: string }> {
  return callRpc('mentor_intervencao_criar', {
    p_tipo: input.tipo,
    p_titulo: input.titulo,
    p_nota: input.nota ?? null,
    p_alvo: input.alvo,
    p_alunos: input.alunos ?? [],
  });
}

export async function atualizarIntervencao(
  input: AtualizarIntervencaoInput,
): Promise<{ intervencao_id: string; status: StatusIntervencao }> {
  return callRpc('mentor_intervencao_atualizar', {
    p_id: input.id,
    p_titulo: input.titulo ?? null,
    p_nota: input.nota ?? null,
    p_status: input.status ?? null,
  });
}

export async function comentarIntervencao(id: string, texto: string): Promise<{ comentario_id: string }> {
  return callRpc('mentor_intervencao_comentar', { p_id: id, p_texto: texto });
}

/** `de` e `ate` são datas YYYY-MM-DD (fuso America/Sao_Paulo); nulas deixam o período aberto. */
export async function listarIntervencoes(de: string | null, ate: string | null): Promise<ListaIntervencoes> {
  return callRpc<ListaIntervencoes>('mentor_intervencoes_listar', { p_de: de, p_ate: ate });
}
