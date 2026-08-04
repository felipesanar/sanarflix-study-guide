import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Aviso, Envelope } from '@/features/gestor/api/types';

/**
 * queryKey canônica dos avisos do gestor. `useAvisos` em api/queries.ts usa
 * exatamente esta tupla — o update otimista abaixo depende disso.
 */
export const avisosQueryKey = (iesId: string) => ['gestor', 'avisos', iesId] as const;

interface ContextoRollback {
  anterior: Envelope<Aviso[]> | undefined;
}

/**
 * Marca um aviso como lido. Escrita direta em `announcements_viewed`, mesmo
 * caminho já em produção no app do aluno (src/hooks/home/useAnnouncements.ts).
 * Update otimista com rollback: o gestor vê o ponto sumir na hora.
 */
export function useMarcarAvisoLido(iesId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<void, Error, string, ContextoRollback>({
    mutationFn: async (avisoId) => {
      if (!user?.id) {
        throw new Error('sem_sessao');
      }

      const { error } = await supabase
        .from('announcements_viewed')
        .insert({ announcement_id: avisoId, user_id: user.id });

      if (error) {
        throw new Error(error.message);
      }
    },

    onMutate: async (avisoId) => {
      await queryClient.cancelQueries({ queryKey: avisosQueryKey(iesId) });
      const anterior = queryClient.getQueryData<Envelope<Aviso[]>>(avisosQueryKey(iesId));

      if (anterior) {
        queryClient.setQueryData<Envelope<Aviso[]>>(avisosQueryKey(iesId), {
          ...anterior,
          data: anterior.data.map((aviso) =>
            aviso.id === avisoId ? { ...aviso, lido: true } : aviso,
          ),
        });
      }

      return { anterior };
    },

    onError: (_erro, _avisoId, contexto) => {
      if (contexto?.anterior) {
        queryClient.setQueryData(avisosQueryKey(iesId), contexto.anterior);
      }
    },

    // Sem invalidateQueries de propósito: o valor otimista é exatamente o
    // estado final no servidor, e invalidar geraria refetch a cada abertura.
  });
}
