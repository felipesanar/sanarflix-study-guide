import { useEffect } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/** Payload da RPC `get_effective_features` (fonte única de acesso por feature). */
export interface EffectiveFeaturesPayload {
  bypass: boolean;
  ies_id: string | null;
  features: Record<string, boolean>;
}

const EMPTY: EffectiveFeaturesPayload = { bypass: false, ies_id: null, features: {} };

/**
 * A RPC ainda não está nos tipos gerados do Supabase — cast local documentado
 * (mesmo padrão de `src/services/admin/iesFeatures.ts`).
 */
async function fetchEffectiveFeatures(): Promise<EffectiveFeaturesPayload> {
  const { data, error } = await (supabase.rpc as (
    fn: string,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>)(
    'get_effective_features',
  );
  if (error) throw new Error(`get_effective_features: ${error.message}`);
  return (data as EffectiveFeaturesPayload | null) ?? EMPTY;
}

/**
 * Subscription realtime ÚNICA por IES, com refcount fora do React.
 *
 * `supabase.channel(topic)` devolve a MESMA instância para um tópico já
 * existente — se cada consumidor do hook criasse "seu" canal, o segundo
 * mount chamaria `.on()` num canal já inscrito e o supabase-js lança
 * "cannot add postgres_changes callbacks after subscribe()". Vários
 * componentes montam este hook simultaneamente (rotas, sidebar, guards),
 * então a subscription vive aqui: o primeiro consumidor cria e inscreve,
 * os demais só incrementam; o último a desmontar remove o canal.
 */
const channelRegistry = new Map<string, { channel: RealtimeChannel; count: number }>();

function acquireIesFeaturesChannel(iesId: string, queryClient: QueryClient): () => void {
  let entry = channelRegistry.get(iesId);
  if (!entry) {
    const channel = supabase
      .channel(`ies-features-${iesId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ies_features', filter: `ies_id=eq.${iesId}` },
        () => queryClient.invalidateQueries({ queryKey: ['effective-features'] }),
      )
      .subscribe();
    entry = { channel, count: 0 };
    channelRegistry.set(iesId, entry);
  }
  entry.count += 1;

  return () => {
    const current = channelRegistry.get(iesId);
    if (!current) return;
    current.count -= 1;
    if (current.count <= 0) {
      channelRegistry.delete(iesId);
      supabase.removeChannel(current.channel);
    }
  };
}

/**
 * Fonte única de features efetivas do usuário. O servidor decide bypass
 * (admin/atendimento) e a semântica do master `gestao.enabled` — o front
 * nunca interpreta role para decidir feature. Realtime em `ies_features`
 * (recorte da IES do usuário) invalida o cache: toggle do admin reflete
 * na sessão aberta sem relogar.
 */
export const useEffectiveFeatures = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['effective-features', user?.id],
    queryFn: fetchEffectiveFeatures,
    enabled: !!user,
    staleTime: 60_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!user?.id_ies) return;
    return acquireIesFeaturesChannel(user.id_ies, queryClient);
  }, [user?.id_ies, queryClient]);

  const features = query.data?.features ?? {};

  return {
    features,
    bypass: query.data?.bypass ?? false,
    iesId: query.data?.ies_id ?? null,
    loading: !!user && query.isLoading,
    // Retry pós-erro (react-query v5): `isLoading` só cobre o fetch inicial —
    // um refetch() disparado da tela de erro fica com `isFetching` true e
    // `isLoading` false. Exposto para dar feedback visual no botão de retry.
    refetching: query.isFetching,
    error: query.isError ? 'Erro ao carregar permissões' : null,
    hasFeature: (key: string): boolean => features[key] ?? false,
    refetch: query.refetch,
  };
};
