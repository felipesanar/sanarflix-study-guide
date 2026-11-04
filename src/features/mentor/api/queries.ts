/**
 * Hooks de dados do Portal do Mentor. ESQUELETO DE CONTRATO: as assinaturas abaixo são estáveis
 * (telas e shell dependem delas); a frente de dados implementa os corpos e acrescenta os demais
 * hooks (alunos, mural, sessões, convites, canais, desempenho, kanban, rotina).
 * Ver docs/handoff/mentor/IMPLEMENTACAO.md § Fontes de dados.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { MeFlix } from './fonte';

export const chavesMentor = {
  me: ['mentor', 'me'] as const,
  contagensNav: ['mentor', 'contagens-nav'] as const,
};

/** Mentor logado, suas tribos/turmas e o toggle `portalMentor`. */
export function useMe(): UseQueryResult<MeFlix> {
  return useQuery({
    queryKey: chavesMentor.me,
    queryFn: async (): Promise<MeFlix> => {
      throw new Error('useMe: implementação pendente da frente de dados');
    },
  });
}

export interface ContagensNav {
  /** Cards em "A fazer" no kanban (badge de Intervenções). `null` = sem dado. */
  intervencoesAFazer: number | null;
  /** B2B: itens da rotina de hoje ainda não enviados (badge de Canais). `null` no B2C. */
  canaisPendentes: number | null;
}

/** Badges da navegação: só aparecem com pendência real (docs/01 § Shell). */
export function useContagensNav(): UseQueryResult<ContagensNav> {
  return useQuery({
    queryKey: chavesMentor.contagensNav,
    queryFn: async (): Promise<ContagensNav> => {
      throw new Error('useContagensNav: implementação pendente da frente de dados');
    },
  });
}
