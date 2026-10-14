import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/utils/logger';

/**
 * Wrappers das RPCs de leitura da turma (Onda 2). Mesmo cast de
 * `src/services/admin/mentores.ts`: as RPCs ainda não estão nos tipos gerados.
 */

export type Segmento = 'ativo' | 'esfriando' | 'sumido' | 'sem_dado';

/**
 * Contagem de conteúdos consumidos numa janela (vídeos + documentos).
 * Sem fonte de dado o backend devolve o objeto com campos nulos (`tem_dado_consumo` falso);
 * com fonte e sem consumo, 0/0/0.
 */
export interface ContagemConteudos {
  videos: number | null;
  documentos: number | null;
  total: number | null;
}

/** Um aluno da turma — item de `mentor_turma()`. */
export interface AlunoTurma {
  email: string;
  nome: string | null;
  telefone: string | null;
  semestre: number | null;
  acesso_ate: string | null;
  b2b: boolean;
  academy_user_id: string | null;
  sanarflix_user_id: string | null;
  ultima_atividade: string | null;
  dias_sem_atividade: number | null;
  segmento: Segmento;
  /**
   * Consumo de conteúdo. Opcionais: ficam ausentes até o backend ser aplicado.
   * `tem_dado_consumo` falso/ausente = SEM fonte de dado (mostrar "–", nunca 0), mesmo que o
   * objeto venha com campos nulos; verdadeiro com zeros = o aluno não consumiu nada.
   */
  conteudos_7d?: ContagemConteudos | null;
  conteudos_30d?: ContagemConteudos | null;
  tem_dado_consumo?: boolean;
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
