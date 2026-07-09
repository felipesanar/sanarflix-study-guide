import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
    const channel = supabase
      .channel(`ies-features-${user.id_ies}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ies_features', filter: `ies_id=eq.${user.id_ies}` },
        () => queryClient.invalidateQueries({ queryKey: ['effective-features'] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id_ies, queryClient]);

  const features = query.data?.features ?? {};

  return {
    features,
    bypass: query.data?.bypass ?? false,
    iesId: query.data?.ies_id ?? null,
    loading: !!user && query.isLoading,
    error: query.isError ? 'Erro ao carregar permissões' : null,
    hasFeature: (key: string): boolean => features[key] ?? false,
  };
};
