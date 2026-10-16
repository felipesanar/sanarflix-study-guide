/**
 * Consultas da tela de emissão de cartões. Só leitura, com a sessão do admin logado (RLS decide o que ele vê):
 * nada é gravado e nada sai do navegador.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

type Client = SupabaseClient<Database>;

export interface SimuladoCartao {
  id: string;
  nome: string;
  iesIds: string[];
  /** `aaaa-mm-dd`, sugerida para o cabeçalho do cartão. */
  data: string;
}

export interface IesOpt {
  id: string;
  nome: string;
}

export interface AlunoOpt {
  userId: string;
  nome: string;
  matricula: string | null;
}

/** O PostgREST devolve no máximo 1.000 linhas por pedido. */
export const TAMANHO_PAGINA = 1000;
const LOTE_PAPEIS = 150;

/** Busca página a página até vir uma página incompleta. */
export async function paginar<T>(
  buscar: (de: number, ate: number) => Promise<T[]>,
  tamanho = TAMANHO_PAGINA,
): Promise<T[]> {
  const tudo: T[] = [];
  for (let de = 0; ; de += tamanho) {
    const pagina = await buscar(de, de + tamanho - 1);
    tudo.push(...pagina);
    if (pagina.length < tamanho) return tudo;
  }
}

export async function listarSimulados(client: Client): Promise<SimuladoCartao[]> {
  const { data, error } = await client
    .from('simulados_admin')
    .select('id, nome, ies_ids, data_realizacao, data_liberacao')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((s) => ({
    id: s.id,
    nome: s.nome,
    iesIds: Array.isArray(s.ies_ids) ? (s.ies_ids as string[]) : [],
    data: (s.data_realizacao ?? s.data_liberacao ?? '').slice(0, 10),
  }));
}

export async function listarIes(client: Client, ids: string[]): Promise<IesOpt[]> {
  if (!ids.length) return [];
  const { data, error } = await client.from('ies').select('id, nome').in('id', ids).order('nome');
  if (error) throw error;
  return (data ?? []).map((i) => ({ id: i.id, nome: i.nome }));
}

/** Quem tem algum papel (admin, gestor, professor...) é equipe, não aluno. */
export function semEquipe<T extends { userId: string }>(alunos: T[], comPapel: Set<string>): T[] {
  return alunos.filter((a) => !comPapel.has(a.userId));
}

/** Alunos de uma IES (usuários sem papel de equipe), ordenados por nome. */
export async function listarAlunosDaIes(client: Client, iesId: string): Promise<AlunoOpt[]> {
  const linhas = await paginar(async (de, ate) => {
    const { data, error } = await client
      .from('users')
      .select('id, nome, matricula_ra')
      .eq('id_ies', iesId)
      .order('nome')
      .order('id')
      .range(de, ate);
    if (error) throw error;
    return data ?? [];
  });
  const alunos: AlunoOpt[] = linhas.map((u) => ({
    userId: u.id,
    nome: u.nome,
    matricula: u.matricula_ra?.trim() || null,
  }));

  const comPapel = new Set<string>();
  for (let i = 0; i < alunos.length; i += LOTE_PAPEIS) {
    const lote = alunos.slice(i, i + LOTE_PAPEIS).map((a) => a.userId);
    const { data, error } = await client.from('user_roles').select('user_id').in('user_id', lote);
    if (error) throw error;
    for (const r of data ?? []) comPapel.add(r.user_id);
  }
  return semEquipe(alunos, comPapel);
}
