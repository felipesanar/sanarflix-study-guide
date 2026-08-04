import type { QueryClient } from '@tanstack/react-query';
import { chamarRpcGestor, GESTOR_STALE_TIME } from '@/features/gestor/api/queries';
import type { FiltroSemestre, VisaoGeral } from '@/features/gestor/api/types';

/**
 * Recurso canônico da Visão Geral na queryKey do portal: 'visao-geral'.
 * Bate com a tupla inline que `useVisaoGeral` usa em `api/queries.ts`
 * (`['gestor', 'visao-geral', filtros.iesId, filtros.semestre]`) — se
 * divergir, o prefetch aquece um cache que a tela nunca lê.
 */
export const visaoGeralQueryKey = (iesId: string, semestre: FiltroSemestre) =>
  ['gestor', 'visao-geral', iesId, semestre] as const;

/**
 * Aquece a Visão Geral antes do clique (handoff docs/08 §Prefetch), reusando
 * `chamarRpcGestor` — a mesma função que `useVisaoGeral` chama por dentro —
 * em vez de duplicar a chamada de RPC e o cast do envelope.
 */
export function prefetchVisaoGeral(
  queryClient: QueryClient,
  iesId: string,
  semestre: FiltroSemestre,
): Promise<void> {
  return queryClient.prefetchQuery({
    queryKey: visaoGeralQueryKey(iesId, semestre),
    queryFn: () =>
      chamarRpcGestor<VisaoGeral>('get_gestor_visao_geral', {
        p_ies_id: iesId,
        p_semestre: semestre,
      }),
    staleTime: GESTOR_STALE_TIME,
  });
}
