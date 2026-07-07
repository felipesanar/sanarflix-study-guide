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
 * Conta quantas respostas (`answer_progress`) existem para uma questão —
 * usado para compor o resumo de impacto real exibido na `DangerZone` antes
 * de anular ("N respostas serão recontabilizadas"). Retorna 0 em caso de
 * erro (nunca bloqueia a abertura do diálogo por uma falha de contagem).
 */
export async function countRespostasQuestao(questionId: string): Promise<number> {
  const { count, error } = await supabase
    .from('answer_progress')
    .select('answer_id', { count: 'exact', head: true })
    .eq('question_id', questionId);

  if (error) {
    Logger.error('[services/admin/simulados] contagem de respostas falhou:', error);
    return 0;
  }
  return count ?? 0;
}
