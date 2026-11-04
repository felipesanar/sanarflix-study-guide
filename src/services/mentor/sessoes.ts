import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/utils/logger';

/**
 * Wrappers das RPCs de sessões e de liberação de agenda do mentor (Onda 2).
 * Mesmo cast de `src/services/admin/mentores.ts`.
 */

export type TipoSessao = 'coletiva' | 'individual';
export type StatusSessao = 'agendada' | 'realizada' | 'cancelada';
export type FiltroSessoes = 'proximas' | 'realizadas' | 'todas';

export interface Sessao {
  id: string;
  tipo: TipoSessao;
  titulo: string;
  tema: string | null;
  inicio: string;
  duracao_min: number;
  meet_link: string | null;
  gravacao_url: string | null;
  aluno_email: string | null;
  status: StatusSessao;
  realizada_em: string | null;
  origem: 'academy' | 'arquivo_2025';
}

export interface SalvarSessaoInput {
  /** Nulo cria uma sessão nova. */
  id?: string | null;
  tipo: TipoSessao;
  titulo: string;
  tema?: string | null;
  /** ISO 8601. */
  inicio: string;
  duracaoMin?: number | null;
  meetLink?: string | null;
  alunoEmail?: string | null;
}

export interface SalvarSessaoResultado {
  sessao_id: string;
  intervencao_id: string | null;
  post_id: string | null;
}

async function callRpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase.rpc as CallableFunction)(fn, args);
  if (error) {
    Logger.error(`[services/mentor/sessoes] ${fn} falhou:`, error);
    throw new Error(error.message ?? `Falha ao executar ${fn}.`);
  }
  return data as T;
}

export async function salvarSessao(input: SalvarSessaoInput): Promise<SalvarSessaoResultado> {
  return callRpc<SalvarSessaoResultado>('mentor_sessao_salvar', {
    p_id: input.id ?? null,
    p_tipo: input.tipo,
    p_titulo: input.titulo,
    p_tema: input.tema ?? null,
    p_inicio: input.inicio,
    p_duracao_min: input.duracaoMin ?? null,
    p_meet_link: input.meetLink ?? null,
    p_aluno_email: input.alunoEmail ?? null,
  });
}

export async function marcarSessaoFeita(id: string, gravacaoUrl?: string | null): Promise<{ sessao_id: string }> {
  return callRpc('mentor_sessao_marcar_feita', { p_id: id, p_gravacao_url: gravacaoUrl ?? null });
}

export async function listarSessoes(quando: FiltroSessoes): Promise<Sessao[]> {
  return callRpc<Sessao[]>('mentor_sessoes_listar', { p_quando: quando });
}

export async function definirLinkAgendamento(url: string): Promise<{ link_agendamento: string }> {
  return callRpc('mentor_definir_link_agendamento', { p_url: url });
}

export async function liberarAgenda(
  emails: string[],
  mensagem: string,
): Promise<{ liberados: number; intervencoes: number }> {
  return callRpc('mentor_agenda_liberar', { p_emails: emails, p_mensagem: mensagem });
}

/** `emails` nulo desliga a agenda de todos os alunos com agenda ligada. */
export async function desligarAgenda(emails: string[] | null): Promise<{ desligados: number }> {
  return callRpc('mentor_agenda_desligar', { p_emails: emails });
}
