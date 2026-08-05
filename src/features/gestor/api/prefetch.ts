import type { QueryClient } from '@tanstack/react-query';
import { chamarRpcGestor, GESTOR_STALE_TIME } from '@/features/gestor/api/queries';
import type { FiltroSemestre, VisaoGeral } from '@/features/gestor/api/types';

/**
 * Recurso canônico da Visão Geral na queryKey do portal: 'visao-geral'.
 * Bate com a tupla que `useVisaoGeral` observa via `useEnvelope` em
 * `api/queries.ts` — que insere o `user.id` logo após o namespace `'gestor'`
 * (card 107 da revisão de 03/08: `[namespace, user?.id, ...resto]`). Por
 * isso `userId` é o PRIMEIRO parâmetro aqui, não um acréscimo no final — se
 * a posição divergir, o prefetch aquece um cache que a tela nunca lê (achado
 * 1 da revisão de 03/08).
 */
export const visaoGeralQueryKey = (
  userId: string | undefined,
  iesId: string,
  semestre: FiltroSemestre,
) => ['gestor', userId, 'visao-geral', iesId, semestre] as const;

/**
 * Aquece a Visão Geral antes do clique (handoff docs/08 §Prefetch), reusando
 * `chamarRpcGestor` — a mesma função que `useVisaoGeral` chama por dentro —
 * em vez de duplicar a chamada de RPC e o cast do envelope.
 *
 * `userId` deve ser o `user?.id` do `useAuth()` de quem chama (o mesmo valor
 * que `useEnvelope` lê internamente), para a chave aquecida aqui bater com a
 * que `useVisaoGeral` vai observar na tela seguinte.
 */
export function prefetchVisaoGeral(
  queryClient: QueryClient,
  userId: string | undefined,
  iesId: string,
  semestre: FiltroSemestre,
): Promise<void> {
  return queryClient.prefetchQuery({
    queryKey: visaoGeralQueryKey(userId, iesId, semestre),
    queryFn: () =>
      chamarRpcGestor<VisaoGeral>('get_gestor_visao_geral', {
        p_ies_id: iesId,
        p_semestre: semestre,
      }),
    staleTime: GESTOR_STALE_TIME,
  });
}
