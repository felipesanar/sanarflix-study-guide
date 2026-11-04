import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/utils/logger';

/** Resumo do mentor logado — `get_mentor_contexto().mentor`. */
export interface MentorResumo {
  user_id: string;
  nome: string;
  email: string;
  tipo: 'b2c' | 'b2b';
  turma_nome: string;
  ies_id: string | null;
  ies_nome: string | null;
  ativo: boolean;
}

/** `mentor` null = o usuário tem o papel, mas o admin ainda não concluiu o cadastro. */
export interface MentorContexto {
  mentor: MentorResumo | null;
  alunos_ativos: number;
}

/**
 * Contexto do mentor logado. A RPC ainda não está nos tipos gerados — mesmo
 * cast documentado em `src/services/admin/contratoSimulados.ts`.
 */
export async function fetchMentorContexto(): Promise<MentorContexto> {
  const { data, error } = await (supabase.rpc as CallableFunction)('get_mentor_contexto', {});
  if (error) {
    Logger.error('[services/mentor/contexto] get_mentor_contexto falhou:', error);
    throw new Error(error.message ?? 'Falha ao carregar o contexto do mentor.');
  }
  return data as MentorContexto;
}
