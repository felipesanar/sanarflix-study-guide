import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

/**
 * Decide se o usuário atual vê o portal novo (true) ou o console antigo
 * (false) -- ver get_gestor_portal_versao() e
 * docs/superpowers/specs/2026-08-11-rollout-faseado-portal-gestor-design.md.
 *
 * Fica em cache por 60s (mesmo staleTime de useEffectiveFeatures) -- não
 * precisa de realtime: a ativação de uma IES é um evento raro e manual,
 * relogar/navegar de novo já reflete.
 */
export function useGestorPortalVersao() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['gestor', 'portal-versao', user?.id],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc('get_gestor_portal_versao');
      if (error) throw new Error(`get_gestor_portal_versao: ${error.message}`);
      return Boolean(data);
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  return {
    portalNovo: query.data ?? false,
    loading: !!user && query.isLoading,
    error: query.isError ? 'Erro ao carregar versão do portal' : null,
  };
}
