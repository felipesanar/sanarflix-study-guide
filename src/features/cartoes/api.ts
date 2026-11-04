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
  /** `users.email`: identifica o aluno no cartão quando não há matrícula utilizável (plano B). */
  email: string | null;
  /** `users.semestre`; `null` quando não está cadastrado (professores e gestores não têm semestre). */
  semestre: number | null;
  /** Papéis em `user_roles` (professor, gestor, admin...). Vazio = aluno; preenchido = equipe da IES. */
  papeis: string[];
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

/** `true` para quem tem algum papel em `user_roles` (professor, gestor, admin...): é equipe da IES, não aluno. */
export function ehEquipe(u: { papeis?: string[] }): boolean {
  return (u.papeis?.length ?? 0) > 0;
}

/**
 * **Todos** os usuários de uma IES, ordenados por nome. Quem tem papel (professor, gestor...) vem com `papeis`
 * preenchido para a tela marcá-lo como equipe e deixá-lo desmarcado por padrão; nada é escondido, então o total
 * da tela bate com o total de usuários da IES.
 */
export async function listarAlunosDaIes(client: Client, iesId: string): Promise<AlunoOpt[]> {
  const linhas = await paginar(async (de, ate) => {
    const { data, error } = await client
      .from('users')
      .select('id, nome, matricula_ra, email, semestre')
      .eq('id_ies', iesId)
      .order('nome')
      .order('id')
      .range(de, ate);
    if (error) throw error;
    return data ?? [];
  });

  const papeis = new Map<string, string[]>();
  for (let i = 0; i < linhas.length; i += LOTE_PAPEIS) {
    const lote = linhas.slice(i, i + LOTE_PAPEIS).map((u) => u.id);
    const { data, error } = await client.from('user_roles').select('user_id, role').in('user_id', lote);
    if (error) throw error;
    for (const r of data ?? []) papeis.set(r.user_id, [...(papeis.get(r.user_id) ?? []), String(r.role)]);
  }

  return linhas.map((u) => ({
    userId: u.id,
    nome: u.nome,
    matricula: u.matricula_ra?.trim() || null,
    email: u.email?.trim() || null,
    semestre: u.semestre ?? null,
    papeis: (papeis.get(u.id) ?? []).sort(),
  }));
}
