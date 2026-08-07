import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/utils/logger';

/**
 * Payload da RPC `admin_anular_questao(p_questao_id uuid, p_motivo text default null)`
 * (contrato de implementação do Admin, §Backend·4). A RPC ainda NÃO está nos
 * tipos gerados do Supabase (`src/integrations/supabase/types.ts`) — cast
 * local e documentado, no mesmo padrão de `logAdminAction`
 * (`src/services/admin/logAction.ts`) e `fetchAdminCommandCenter`
 * (`src/services/admin/useAdminAttention.ts`). Quando `admin_anular_questao`
 * entrar em `types.ts`, trocar o cast pelo tipo gerado.
 */
export interface AnularQuestaoResult {
  questao_id: string;
  numero_questao: number | null;
  simulado_id: string;
  /** Quantas linhas de `answer_progress` foram marcadas como corretas pela RPC. */
  respostas_recontabilizadas: number;
}

/**
 * Anula uma questão de simulado via RPC transacional `admin_anular_questao`.
 * SUBSTITUI a lógica client-side antiga (update direto em `questoes_simulado`
 * + `answer_progress` em duas chamadas separadas) — a RPC faz as duas
 * mudanças em uma transação e grava a auditoria (`anular_questao`) no mesmo
 * commit. Lança em caso de erro (ex.: questão já anulada) — o chamador deve
 * tratar e mostrar o toast.
 */
export async function anularQuestao(questaoId: string, motivo?: string): Promise<AnularQuestaoResult> {
  const { data, error } = await (supabase.rpc as CallableFunction)('admin_anular_questao', {
    p_questao_id: questaoId,
    p_motivo: motivo ?? null,
  });
  if (error) {
    Logger.error('[services/admin/simulados] admin_anular_questao falhou:', error);
    throw new Error(error.message ?? 'Falha ao anular a questão.');
  }
  return data as unknown as AnularQuestaoResult;
}

/**
 * Conta quantas respostas (`answer_progress`) existem para uma questão — usado
 * para compor o resumo de impacto exibido na `DangerZone` antes de anular
 * ("até N respostas serão recontabilizadas"). É um TETO, não o número exato:
 * a RPC `admin_anular_questao` só recontabiliza respostas NÃO corretas (quem
 * já tinha acertado não muda), então o total aqui pode ser maior que o que
 * de fato será alterado.
 *
 * Retorna `null` em caso de erro de contagem — NUNCA 0, para o chamador não
 * confundir "não foi possível contar" com "não há respostas registradas"
 * (achado de auditoria P3).
 */
export async function countRespostasQuestao(questionId: string): Promise<number | null> {
  const { count, error } = await supabase
    .from('answer_progress')
    .select('answer_id', { count: 'exact', head: true })
    .eq('question_id', questionId);

  if (error) {
    Logger.error('[services/admin/simulados] contagem de respostas falhou:', error);
    return null;
  }
  return count ?? 0;
}

/** Campos do save de edição do simulado — os 9 que o dialog escreve. */
export interface UpdateSimuladoInput {
  simuladoId: string;
  nome: string;
  descricao: string | null;
  dataLiberacao: string | null;
  dataEncerramento: string | null;
  duracaoMinutos: number;
  status: 'aguardando' | 'ativo' | 'encerrado';
  iesIds: string[];
  liberacaoDesempenho: 'imediato' | 'agendado' | 'ao_encerrar';
  dataLiberacaoDesempenho: string | null;
  /**
   * `true` = o chamador está mexendo em modalidade/data_realizacao. Quando
   * omitido, a RPC PRESERVA os valores que já estão no banco — é isso que
   * permite o dialog de edição salvar sem apagar a agenda, já que ele não
   * conhece essas colunas. Não mexer aqui sem ler o §6.4.
   */
  atualizarAgenda?: boolean;
  modalidade?: 'online' | 'presencial' | null;
  dataRealizacao?: string | null;
  /** `true` = a data nova é definitiva → `data_agendada_original` sincroniza e a tag "Reagendado" some. */
  definitiva?: boolean;
}

export interface UpdateSimuladoResult {
  simulado_id: string;
  nome: string;
  status: string;
  modalidade: 'online' | 'presencial' | null;
  data_realizacao: string | null;
  data_liberacao: string | null;
  data_encerramento: string | null;
  data_agendada_original: string | null;
  reagendado: boolean;
}

/**
 * Salva a edição de um simulado via `admin_update_simulado`.
 *
 * SUBSTITUI o `.from('simulados_admin').update(...)` direto que vivia em
 * `SimuladoConfigDialog.handleSave` — decisão do Felipe em 28/07 (escopo extra
 * da Task 10 da Fase 0b): dois caminhos de escrita conviviam, um deles sem
 * auditoria e sem derivar `data_agendada_original`, o que fazia a tag
 * "Reagendado" aparecer ou não dependendo de qual tela o CX usou.
 *
 * A RPC audita como `editar_simulado` no mesmo commit, então o chamador NÃO
 * deve mais chamar `logAdminAction` — seriam duas linhas por save.
 */
export async function updateSimulado(input: UpdateSimuladoInput): Promise<UpdateSimuladoResult> {
  const { data, error } = await (supabase.rpc as CallableFunction)('admin_update_simulado', {
    p_simulado_id: input.simuladoId,
    p_nome: input.nome,
    p_descricao: input.descricao,
    p_data_liberacao: input.dataLiberacao,
    p_data_encerramento: input.dataEncerramento,
    p_duracao_minutos: input.duracaoMinutos,
    p_status: input.status,
    p_ies_ids: input.iesIds,
    p_liberacao_desempenho: input.liberacaoDesempenho,
    p_data_liberacao_desempenho: input.dataLiberacaoDesempenho,
    p_atualizar_agenda: input.atualizarAgenda ?? false,
    p_modalidade: input.modalidade ?? null,
    p_data_realizacao: input.dataRealizacao ?? null,
    p_definitiva: input.definitiva ?? false,
  });
  if (error) {
    Logger.error('[services/admin/simulados] admin_update_simulado falhou:', error);
    throw new Error(error.message ?? 'Falha ao salvar o simulado.');
  }
  return data as unknown as UpdateSimuladoResult;
}

export interface EncerrarSimuladoResult {
  simulado_id: string;
  nome: string;
  status_antes: string;
  status: string;
}

/**
 * Encerra um simulado via `admin_encerrar_simulado` — escreve só `status`.
 *
 * SUBSTITUI o `.update({ status: 'encerrado' })` direto de
 * `ProvasTab.handleConfirmEncerrar`. Este call site nunca pertenceu a uma RPC
 * de agenda: ela não recebia `status`, e roteá-lo por lá deixaria a prova
 * `ativo` no banco e zeraria modalidade + as 3 datas.
 *
 * A RPC audita como `encerrar_simulado`, então o chamador não deve mais chamar
 * `logAdminAction`. LANÇA em caso de erro — `ProvasTab` depende de o erro
 * propagar para o `DangerZone` continuar aberto para nova tentativa.
 */
export async function encerrarSimulado(simuladoId: string): Promise<EncerrarSimuladoResult> {
  const { data, error } = await (supabase.rpc as CallableFunction)('admin_encerrar_simulado', {
    p_simulado_id: simuladoId,
  });
  if (error) {
    Logger.error('[services/admin/simulados] admin_encerrar_simulado falhou:', error);
    throw new Error(error.message ?? 'Falha ao encerrar o simulado.');
  }
  return data as unknown as EncerrarSimuladoResult;
}
