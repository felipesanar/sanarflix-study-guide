import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Logger from '@/utils/logger';
import type { Aviso, Envelope } from '@/features/gestor/api/types';

/**
 * queryKey canônica dos avisos do gestor — espelha EXATAMENTE a key real que
 * `useAvisos`/`useEnvelope` monta em `api/queries.ts`: namespace, id do
 * usuário logado (inserido logo depois do namespace, ver comentário de
 * `useEnvelope`) e só então o resto dos argumentos. Sem o id do usuário aqui
 * o `getQueryData`/`cancelQueries` abaixo nunca encontravam a query de
 * verdade em produção — o `if (anterior)` nunca executava porque a key nunca
 * batia com o cache real (achado 2 da revisão de 04/08).
 */
export const avisosQueryKey = (userId: string | undefined, iesId: string) =>
  ['gestor', userId, 'avisos', iesId] as const;

/**
 * Prefixo que casa com a query de avisos de QUALQUER IES deste usuário —
 * usado para propagar a marcação de lido entre IES (achado 14): a leitura em
 * `announcements_viewed` é por `(announcement_id, user_id)`, sem IES, então
 * um aviso "todas" marcado como lido numa IES tem que valer nas outras IES
 * cacheadas do mesmo gestor de grupo.
 */
const avisosSiblingPrefix = (userId: string | undefined) =>
  ['gestor', userId, 'avisos'] as const;

interface ContextoRollback {
  /** Estado de `lido` do aviso ANTES desta mutação — nunca a lista inteira
   *  (achado 12): outra mutação em voo pode ter alterado outro aviso da
   *  mesma lista entre o onMutate e o onError desta, e restaurar a lista
   *  inteira desfaria aquele sucesso concorrente. */
  lidoAnterior: boolean;
}

/** Aplica `lido` no aviso `avisoId` em toda query que casar com `prefix` —
 *  ignora silenciosamente queries sem esse aviso ou sem dado ainda. */
function marcarAvisoEmCache(
  queryClient: QueryClient,
  prefix: readonly unknown[],
  avisoId: string,
  lido: boolean,
) {
  for (const query of queryClient.getQueryCache().findAll({ queryKey: prefix })) {
    queryClient.setQueryData<Envelope<Aviso[]>>(query.queryKey, (atual) => {
      if (!atual?.data.some((aviso) => aviso.id === avisoId)) {
        return atual;
      }
      return {
        ...atual,
        data: atual.data.map((aviso) => (aviso.id === avisoId ? { ...aviso, lido } : aviso)),
      };
    });
  }
}

/**
 * Marca um aviso como lido. Escrita direta em `announcements_viewed`, mesmo
 * caminho já em produção no app do aluno (src/hooks/home/useAnnouncements.ts).
 *
 * Update otimista com rollback por ITEM (achado 12), propagado para todas as
 * IES cacheadas deste usuário (achado 14) e que evita cancelar um fetch que
 * ainda não trouxe nenhum dado (achado 2). Falha na escrita avisa por toast e
 * fica registrada no Logger (achado 13).
 */
export function useMarcarAvisoLido(iesId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  return useMutation<void, Error, string, ContextoRollback | undefined>({
    mutationFn: async (avisoId) => {
      if (!userId) {
        throw new Error('sem_sessao');
      }

      const { error } = await supabase
        .from('announcements_viewed')
        .insert({ announcement_id: avisoId, user_id: userId });

      if (error) {
        throw new Error(error.message);
      }
    },

    onMutate: async (avisoId) => {
      const key = avisosQueryKey(userId, iesId);
      const atual = queryClient.getQueryData<Envelope<Aviso[]>>(key);
      const avisoAtual = atual?.data.find((aviso) => aviso.id === avisoId);

      // Achado 2: sem dado ainda em cache para esta IES — típico logo após
      // trocar de instituição, com o fetch da IES nova ainda em voo e o
      // `placeholderData` do `useEnvelope` mostrando os avisos da IES
      // anterior nesse meio-tempo. `cancelQueries` aqui cancelaria esse
      // único fetch (com `revert: true` por padrão, devolvendo a query a
      // pending/idle/undefined) e, como o QueryClient global desliga todo
      // `refetchOnX` e este hook não invalida nada de propósito, NADA
      // reagendaria — a tela congelaria mostrando o placeholder da IES
      // anterior pra sempre. Sem dado, não há o que proteger nem o que
      // atualizar de forma otimista: deixa o fetch em paz.
      if (!atual || !avisoAtual) {
        return undefined;
      }

      await queryClient.cancelQueries({ queryKey: key });

      marcarAvisoEmCache(queryClient, avisosSiblingPrefix(userId), avisoId, true);

      return { lidoAnterior: avisoAtual.lido };
    },

    onError: (erro, avisoId, contexto) => {
      Logger.error('useMarcarAvisoLido: falha ao marcar aviso como lido', erro);
      toast.error('Não foi possível marcar o aviso como lido. Tente novamente.');

      if (!contexto) return;
      marcarAvisoEmCache(
        queryClient,
        avisosSiblingPrefix(userId),
        avisoId,
        contexto.lidoAnterior,
      );
    },

    // Sem invalidateQueries de propósito: o valor otimista é exatamente o
    // estado final no servidor, e invalidar geraria refetch a cada abertura.
  });
}
