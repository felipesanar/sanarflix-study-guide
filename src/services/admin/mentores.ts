import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/utils/logger';

/**
 * Wrappers das RPCs de admin da Página do Mentor (Onda 1). Mesmo cast de
 * `src/services/admin/contratoSimulados.ts`: as RPCs ainda não estão nos
 * tipos gerados.
 */

export type MentorTipo = 'b2c' | 'b2b';

export interface MentorAdmin {
  user_id: string;
  nome: string;
  email: string;
  tipo: MentorTipo;
  turma_nome: string;
  ies_id: string | null;
  ies_nome: string | null;
  ativo: boolean;
  alunos_ativos: number;
}

export interface UpsertMentorInput {
  userId: string;
  tipo: MentorTipo;
  turmaNome: string;
  iesId?: string | null;
  fotoUrl?: string | null;
  formacao?: string | null;
  linkAgendamento?: string | null;
  ativo?: boolean;
}

export interface LinhaVinculo {
  email: string;
  nome?: string;
}

export interface ImportacaoResultado {
  dry_run: boolean;
  total: number;
  novos: number;
  ja_com_este_mentor: number;
  com_outro_mentor: { email: string; mentor_atual_id: string; mentor_atual_nome: string | null }[];
  invalidos: { ordem: number; email: string; motivo: 'email_invalido' | 'duplicado_na_planilha' }[];
  inseridos: number;
  trocados: number;
}

async function callRpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase.rpc as CallableFunction)(fn, args);
  if (error) {
    Logger.error(`[services/admin/mentores] ${fn} falhou:`, error);
    throw new Error(error.message ?? `Falha ao executar ${fn}.`);
  }
  return data as T;
}

export async function listMentores(): Promise<MentorAdmin[]> {
  return callRpc<MentorAdmin[]>('admin_list_mentores', {});
}

export async function upsertMentor(input: UpsertMentorInput): Promise<{ user_id: string; criado: boolean }> {
  return callRpc('admin_upsert_mentor', {
    p_user_id: input.userId,
    p_tipo: input.tipo,
    p_turma_nome: input.turmaNome,
    p_ies_id: input.iesId ?? null,
    p_foto_url: input.fotoUrl ?? null,
    p_formacao: input.formacao ?? null,
    p_link_agendamento: input.linkAgendamento ?? null,
    p_ativo: input.ativo ?? true,
  });
}

export async function importarVinculos(input: {
  mentorId: string;
  linhas: LinhaVinculo[];
  trocar: boolean;
  dryRun: boolean;
}): Promise<ImportacaoResultado> {
  return callRpc<ImportacaoResultado>('admin_importar_vinculos', {
    p_mentor_id: input.mentorId,
    p_linhas: input.linhas,
    p_trocar: input.trocar,
    p_dry_run: input.dryRun,
  });
}

export async function encerrarVinculo(vinculoId: string): Promise<{ vinculo_id: string; fim: string }> {
  return callRpc('admin_encerrar_vinculo', { p_vinculo_id: vinculoId });
}
