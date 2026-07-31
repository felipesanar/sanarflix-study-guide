import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ContextoGestor, Envelope, Meta } from '@/features/gestor/api/types';

/** Dado do gestor é fresco por 5 minutos (spec §8.2). */
export const GESTOR_STALE_TIME = 5 * 60 * 1000;

type ArgsRpc = Record<string, unknown>;

/**
 * Chama uma RPC `get_gestor_*` e devolve o envelope `{ data, meta }`.
 *
 * As RPCs novas ainda não estão nos tipos gerados do Supabase — cast local
 * documentado, mesmo padrão de `src/hooks/useEffectiveFeatures.ts`.
 */
export async function chamarRpcGestor<T>(fn: string, args?: ArgsRpc): Promise<Envelope<T>> {
  const { data, error } = await (supabase.rpc as (
    fn: string,
    args?: ArgsRpc,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>)(fn, args);

  if (error) throw new Error(`${fn}: ${error.message}`);
  if (data == null) throw new Error(`${fn}: resposta vazia`);
  return data as Envelope<T>;
}

/** Resultado padrão de todo hook do portal: envelope desembrulhado. */
export interface ResultadoGestor<T> {
  data: T | undefined;
  meta: Meta | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

/** Contexto do shell: usuário, papel, IES acessíveis, contrato e permissões (spec §5.2). */
export function useGestorContexto(): ResultadoGestor<ContextoGestor> {
  const query = useQuery({
    queryKey: ['gestor', 'contexto'],
    queryFn: () => chamarRpcGestor<ContextoGestor>('get_gestor_contexto'),
    staleTime: GESTOR_STALE_TIME,
    placeholderData: (anterior) => anterior,
  });

  return {
    data: query.data?.data,
    meta: query.data?.meta,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => void query.refetch(),
  };
}
