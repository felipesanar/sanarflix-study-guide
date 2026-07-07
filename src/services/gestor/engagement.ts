import { supabase } from '@/integrations/supabase/client';
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

/** Uma linha de engajamento por aluno, retornada por `get_institutional_student_engagement`. */
export interface StudentEngagementEntry {
  user_id: string;
  nome: string;
  semestre: number | null;
  horas_periodo: number;
  last_activity_at: string | null;
  sessions_count: number;
}

/**
 * Engajamento (consumo de horas/sessões) dos alunos da IES num período — usa
 * `get_institutional_student_engagement` (baseada em `user_sessions`).
 * Wrapper segue o padrão de timeout + retry de `src/services/institutional.ts`.
 * Em caso de falha, resolve para array vazio (tela degrada para estado vazio,
 * nunca inventa dado).
 */
export async function fetchStudentEngagement(
  iesId: string | undefined,
  days = 90,
): Promise<StudentEngagementEntry[]> {
  try {
    return await withRetry(async () => {
      const params: Record<string, unknown> = {
        p_ies_id: iesId ?? null,
        p_days: days,
      };
      const rpcPromise = Promise.resolve(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.rpc as any)('get_institutional_student_engagement', params),
      );
      const result = await withTimeout(
        rpcPromise,
        RPC_TIMEOUT,
        'get_institutional_student_engagement',
      );
      if (result.error) throw new Error(`Engajamento: ${result.error.message}`);
      return (result.data ?? []) as StudentEngagementEntry[];
    });
  } catch (err) {
    Logger.warn('[Engagement] get_institutional_student_engagement error:', err);
    return [];
  }
}
