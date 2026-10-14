import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/utils/logger';

export interface LiberacaoAgenda {
  id: string;
  aluno_email: string;
  mensagem: string;
  desde: string;
}

/**
 * Liberações de agenda ligadas do mentor logado. Leitura direta da tabela: a
 * policy "Mentor lê suas liberações" (RLS) já restringe ao próprio mentor.
 * A tabela ainda não está nos tipos gerados — mesmo cast dos services.
 */
export async function listarLiberacoesLigadas(): Promise<LiberacaoAgenda[]> {
  const { data, error } = await (supabase.from as CallableFunction)('mentoria_agenda_liberacoes')
    .select('id, aluno_email, mensagem, desde')
    .eq('ligado', true)
    .order('desde', { ascending: false });
  if (error) {
    Logger.error('[mentor/sessoes] listar liberações falhou:', error);
    throw new Error(error.message ?? 'Falha ao carregar as liberações.');
  }
  return (data ?? []) as LiberacaoAgenda[];
}
