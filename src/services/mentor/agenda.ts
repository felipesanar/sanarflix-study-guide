import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/utils/logger';

/**
 * Leituras diretas (RLS) da agenda do mentor. As tabelas ainda não estão nos
 * tipos gerados — mesmo cast dos demais services do mentor.
 */

export interface LiberacaoAgenda {
  id: string;
  aluno_email: string;
  mensagem: string;
  desde: string;
}

/** Link do Google Agenda já cadastrado (policy "Mentor lê o próprio cadastro"). */
export async function fetchLinkAgendamento(mentorId: string): Promise<string | null> {
  const { data, error } = await (supabase.from as CallableFunction)('mentores')
    .select('link_agendamento')
    .eq('user_id', mentorId)
    .maybeSingle();
  if (error) {
    Logger.error('[services/mentor/agenda] ler link_agendamento falhou:', error);
    throw new Error(error.message ?? 'Falha ao carregar o link do Google Agenda.');
  }
  const link = (data as { link_agendamento: string | null } | null)?.link_agendamento ?? null;
  return link && link.trim() ? link.trim() : null;
}

/** Liberações de agenda ligadas do mentor, mais recentes primeiro. */
export async function listarLiberacoesLigadas(mentorId: string): Promise<LiberacaoAgenda[]> {
  const { data, error } = await (supabase.from as CallableFunction)('mentoria_agenda_liberacoes')
    .select('id, aluno_email, mensagem, desde')
    .eq('mentor_id', mentorId)
    .eq('ligado', true)
    .order('desde', { ascending: false });
  if (error) {
    Logger.error('[services/mentor/agenda] listar liberações falhou:', error);
    throw new Error(error.message ?? 'Falha ao carregar as liberações.');
  }
  return (data ?? []) as LiberacaoAgenda[];
}
