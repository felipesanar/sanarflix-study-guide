import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/utils/logger';

/**
 * Wrappers das 4 RPCs da superfície de admin do cronograma (spec §6.3):
 * `admin_get_ies_contratos`, `admin_upsert_ies_contrato`,
 * `admin_delete_ies_contrato` e `admin_set_ies_simulados_previstos`.
 *
 * A escrita de modalidade e datas do simulado (agenda) NÃO vive aqui: é
 * `admin_update_simulado` (ver `src/services/admin/simulados.ts`) — a
 * `admin_set_simulado_agenda` foi dropada em
 * `20260726123000_admin_update_simulado.sql` para não manter dois caminhos
 * de escrita.
 *
 * Assim como `src/services/admin/simulados.ts`, estas RPCs podem ainda não
 * estar nos tipos gerados (`src/integrations/supabase/types.ts`) — daí o cast
 * `(supabase.rpc as CallableFunction)`, documentado e idêntico ao padrão já
 * usado em `logAction.ts` / `useAdminAttention.ts`. Quando os tipos forem
 * regenerados contra o projeto gvqv, trocar o cast pelo tipo gerado.
 */

export type Modalidade = 'online' | 'presencial';

/** Agenda de um simulado (§6.4): online usa data_liberacao; presencial, data_realizacao. */
export interface SimuladoAgenda {
  id: string;
  nome: string;
  status?: string;
  modalidade: Modalidade | null;
  data_realizacao: string | null;
  data_liberacao: string | null;
  data_encerramento: string | null;
  /** 1ª data marcada — é o que permite derivar "reagendado" (§6.4). */
  data_agendada_original: string | null;
}

/** Slot do contrato. `simulado_id` nulo = "A definir" (§6.2). */
export interface SlotPrevisto {
  id: string;
  ordem: number;
  nome_previsto: string | null;
  simulado_id: string | null;
  simulado: SimuladoAgenda | null;
}

export interface IesContrato {
  id: string;
  nome_contrato: string;
  simulados_contratados: number;
  vigencia_inicio: string;
  vigencia_fim: string;
  created_at: string;
  slots: SlotPrevisto[];
}

export interface IesContratosPayload {
  ies: { id: string; nome: string };
  contratos: IesContrato[];
  /** Simulados cuja `ies_ids` contém a IES — popula o select de vínculo de slot. */
  simulados_disponiveis: SimuladoAgenda[];
}

export interface UpsertIesContratoInput {
  iesId: string;
  nome: string;
  simuladosContratados: number;
  /** `yyyy-MM-dd` (tipo `date` no banco). */
  vigenciaInicio: string;
  /** `yyyy-MM-dd` (tipo `date` no banco). */
  vigenciaFim: string;
}

export interface UpsertIesContratoResult {
  contrato_id: string;
  criado: boolean;
}

export interface DeleteIesContratoResult {
  contrato_id: string;
  slots_removidos: number;
}

export interface SlotPrevistoInput {
  ordem: number;
  nome_previsto: string | null;
  simulado_id: string | null;
}

export interface SetSlotsResult {
  contrato_id: string;
  slots: number;
  criados: number;
  atualizados: number;
  removidos: number;
}

async function callRpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase.rpc as CallableFunction)(fn, args);
  if (error) {
    Logger.error(`[services/admin/contratoSimulados] ${fn} falhou:`, error);
    throw new Error(error.message ?? `Falha ao executar ${fn}.`);
  }
  return data as T;
}

/** Contrato(s), slots e simulados de uma IES — via `admin_get_ies_contratos`. */
export async function fetchIesContratos(iesId: string): Promise<IesContratosPayload> {
  return callRpc<IesContratosPayload>('admin_get_ies_contratos', { p_ies_id: iesId });
}

/** Cria ou atualiza o contrato (idempotente por `ies_id` + nome) — `admin_upsert_ies_contrato`. */
export async function upsertIesContrato(input: UpsertIesContratoInput): Promise<UpsertIesContratoResult> {
  return callRpc<UpsertIesContratoResult>('admin_upsert_ies_contrato', {
    p_ies_id: input.iesId,
    p_nome: input.nome,
    p_simulados_contratados: input.simuladosContratados,
    p_vigencia_inicio: input.vigenciaInicio,
    p_vigencia_fim: input.vigenciaFim,
  });
}

/** Apaga o contrato (a RPC recusa se algum slot está vinculado) — `admin_delete_ies_contrato`. */
export async function deleteIesContrato(contratoId: string): Promise<DeleteIesContratoResult> {
  return callRpc<DeleteIesContratoResult>('admin_delete_ies_contrato', { p_contrato_id: contratoId });
}

/**
 * Sincroniza a lista COMPLETA de slots do contrato — `admin_set_ies_simulados_previstos`.
 * É sync, não append: slot cuja `ordem` não está no array é removido no banco.
 */
export async function setIesSimuladosPrevistos(
  contratoId: string,
  slots: SlotPrevistoInput[],
): Promise<SetSlotsResult> {
  return callRpc<SetSlotsResult>('admin_set_ies_simulados_previstos', {
    p_contrato_id: contratoId,
    p_slots: slots,
  });
}
