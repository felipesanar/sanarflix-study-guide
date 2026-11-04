import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/utils/logger';

/**
 * Consumo de conteúdo de um aluno (drawer do mentor). Mesmo cast dos demais
 * serviços do mentor: a RPC ainda não está nos tipos gerados.
 */

export interface ConteudoSemana {
  /** Segunda-feira da semana, YYYY-MM-DD. */
  semana: string;
  videos: number;
  documentos: number;
}

export interface ConteudoRecente {
  quando: string;
  tipo: 'video' | 'document';
  conteudo: string;
  curso: string | null;
  modulo: string | null;
}

export interface CursoTop {
  curso: string;
  total: number;
}

export interface AlunoConteudos {
  email: string;
  /** Falso = não há fonte de dado para o aluno (B2C hoje): sem gráficos, sem zeros. */
  tem_dado_consumo: boolean;
  /** 8 semanas, da mais antiga para a mais recente; [] sem fonte. */
  por_semana: ConteudoSemana[];
  /** Até 20, do mais recente para o mais antigo. */
  recentes: ConteudoRecente[];
  /** Até 5 cursos, últimos 30 dias. */
  top_cursos: CursoTop[];
}

export const chavesConteudos = {
  aluno: (email: string) => ['mentor', 'aluno-conteudos', email] as const,
};

export async function fetchAlunoConteudos(email: string): Promise<AlunoConteudos> {
  const { data, error } = await (supabase.rpc as CallableFunction)('mentor_aluno_conteudos', { p_email: email });
  if (error) {
    Logger.error('[services/mentor/conteudos] mentor_aluno_conteudos falhou:', error);
    throw new Error(error.message ?? 'Falha ao executar mentor_aluno_conteudos.');
  }
  return data as AlunoConteudos;
}
