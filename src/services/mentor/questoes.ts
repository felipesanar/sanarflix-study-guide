import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/utils/logger';

export interface AlunoQuestoes {
  email: string;
  tem_dado_questoes: boolean;
  ultima_resposta: string | null;
  por_semana: { semana: string; respondidas: number; acertos: number; erros: number }[];
  por_area: { area: string; respondidas: number; acertos: number; erros: number; pct_acerto: number | null }[];
}

export const chavesQuestoes = {
  aluno: (email: string) => ['mentor', 'aluno-questoes', email] as const,
};

export async function fetchAlunoQuestoes(email: string): Promise<AlunoQuestoes> {
  const { data, error } = await (supabase.rpc as CallableFunction)('mentor_aluno_questoes', { p_email: email });
  if (error) {
    Logger.error('[services/mentor/questoes] mentor_aluno_questoes falhou:', error);
    throw new Error(error.message ?? 'Falha ao executar mentor_aluno_questoes.');
  }
  return data as AlunoQuestoes;
}
