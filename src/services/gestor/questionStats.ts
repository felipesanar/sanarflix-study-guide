import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { withRetry } from '@/utils/networkRetry';
import { Logger } from '@/utils/logger';

const RPC_TIMEOUT = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}: timeout após ${ms / 1000}s`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

/** Letra da alternativa (A a E). */
export type AlternativaLetra = 'A' | 'B' | 'C' | 'D' | 'E';

export interface QuestionStatAlternativa {
  letra: AlternativaLetra;
  texto: string;
  pct_escolha: number;
}

/** Estatística de uma questão do simulado — retorno de `get_institutional_question_stats`. */
export interface QuestionStat {
  question_id: string;
  numero_questao: number;
  enunciado: string;
  grande_area: string | null;
  especialidade: string | null;
  tema: string | null;
  correta: AlternativaLetra;
  comentario: string | null;
  total_respostas: number;
  pct_acerto: number;
  alternativas: QuestionStatAlternativa[];
}

/**
 * Busca as estatísticas de questões (acerto, alternativas, comentário) de um
 * simulado, ordenadas por `pct_acerto` ascendente (piores primeiro).
 * `p_ies_id` é opcional — quando omitido, o RPC usa o escopo padrão do usuário.
 */
export async function fetchInstitutionalQuestionStats(
  simuladoId: string,
  iesId?: string | null,
): Promise<QuestionStat[]> {
  return withRetry(async () => {
    const params: Record<string, unknown> = { p_simulado_id: simuladoId };
    if (iesId) params.p_ies_id = iesId;

    const rpcPromise = Promise.resolve(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.rpc as any)('get_institutional_question_stats', params),
    );
    const result = await withTimeout(
      rpcPromise,
      RPC_TIMEOUT,
      'get_institutional_question_stats',
    );
    if (result.error) {
      Logger.warn('[QuestionStats] get_institutional_question_stats failed:', result.error.message);
      throw new Error(`Estatísticas de questões: ${result.error.message}`);
    }
    return (result.data ?? []) as QuestionStat[];
  });
}

export const questionStatsQueryKey = (simuladoId?: string, iesId?: string | null) =>
  ['gestor', 'question-stats', simuladoId ?? null, iesId ?? null] as const;

/**
 * Hook React Query para as estatísticas de questões do simulado ativo.
 * Só habilitado quando `simuladoId` está definido — `iesId` é opcional
 * (escopo de grupo/IES única resolvido no backend quando omitido).
 */
export function useInstitutionalQuestionStats(simuladoId?: string, iesId?: string | null) {
  return useQuery({
    queryKey: questionStatsQueryKey(simuladoId, iesId),
    queryFn: () => fetchInstitutionalQuestionStats(simuladoId as string, iesId),
    enabled: Boolean(simuladoId),
    staleTime: 60_000,
  });
}
