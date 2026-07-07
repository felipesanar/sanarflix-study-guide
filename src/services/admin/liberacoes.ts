import { supabase } from '@/integrations/supabase/client';

/**
 * Wrapper da RPC `admin_liberar_tentativa` (contrato de implementação do Admin, §Backend·5).
 * SUBSTITUI o update direto em `simulados_finalizados` do tab antigo — a RPC é transacional
 * e grava a trilha de auditoria (`liberar_tentativa`) no mesmo commit.
 */
export interface LiberarTentativaResult {
  finalizacao_id: string;
  user_id: string;
  simulado_id: string;
  tentativa_numero: number;
}

/**
 * Libera uma nova tentativa para o aluno da finalização informada.
 *
 * `admin_liberar_tentativa` ainda não está nos tipos gerados do Supabase
 * (`src/integrations/supabase/types.ts`) — RPC pendente de regeneração de tipos após
 * aplicação via Lovable. Cast local e documentado, mesmo padrão de `logAction.ts`.
 */
export async function liberarTentativa(
  finalizacaoId: string,
  motivo?: string | null,
): Promise<LiberarTentativaResult> {
  const { data, error } = await (supabase.rpc as CallableFunction)('admin_liberar_tentativa', {
    p_finalizacao_id: finalizacaoId,
    p_motivo: motivo?.trim() ? motivo.trim() : null,
  });
  if (error) throw error instanceof Error ? error : new Error((error as { message?: string }).message ?? 'Falha ao liberar tentativa.');
  return data as LiberarTentativaResult;
}
