import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/utils/logger';

/**
 * Wrappers das RPCs de leitura da turma (Onda 2). Mesmo cast de
 * `src/services/admin/mentores.ts`: as RPCs ainda não estão nos tipos gerados.
 */

export type Segmento = 'ativo' | 'esfriando' | 'sumido' | 'sem_dado';

/** Um aluno da turma — item de `mentor_turma()`. */
export interface AlunoTurma {
  email: string;
  nome: string | null;
  telefone: string | null;
  semestre: string | null;
  acesso_ate: string | null;
  b2b: boolean;
  academy_user_id: string | null;
  sanarflix_user_id: string | null;
  ultima_atividade: string | null;
  dias_sem_atividade: number | null;
  segmento: Segmento;
}

export interface AlunoDetalhe {
  aluno: AlunoTurma | null;
  liberacao: { ligado: boolean; desde: string; mensagem: string } | null;
  intervencoes: { id: string; tipo: string; titulo: string; status: string; criado_em: string }[];
  log: { tipo: string; criado_em: string; payload: Record<string, unknown> }[];
}

async function callRpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase.rpc as CallableFunction)(fn, args);
  if (error) {
    Logger.error(`[services/mentor/turma] ${fn} falhou:`, error);
    throw new Error(error.message ?? `Falha ao executar ${fn}.`);
  }
  return data as T;
}

export async function fetchTurma(): Promise<AlunoTurma[]> {
  return callRpc<AlunoTurma[]>('mentor_turma', {});
}

export async function fetchAluno(email: string): Promise<AlunoDetalhe> {
  return callRpc<AlunoDetalhe>('mentor_aluno', { p_email: email });
}
