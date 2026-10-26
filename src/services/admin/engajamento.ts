import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AdminEngajamento } from '@/features/gestor/api/types-engajamento';

/** Mesma tolerância das demais RPCs do console: o ranking lê a rede inteira. */
const STALE_TIME = 5 * 60 * 1000;

/**
 * Engajamento SanarFlix da rede (`get_admin_engajamento`, spec 2026-10-22-engajamento §8.10).
 * Só agregados por IES, mês e semestre: nenhum dado individual de aluno. A RPC exige
 * `has_role(admin)`; sem ele devolve `admin role required`.
 *
 * `semestre` nulo = todos os semestres (a RPC trata o parâmetro ausente como `NULL`).
 */
export function useAdminEngajamento(inicio: string, fim: string, semestre: number | null) {
  return useQuery({
    queryKey: ['admin', 'engajamento', inicio, fim, semestre],
    staleTime: STALE_TIME,
    queryFn: async (): Promise<AdminEngajamento> => {
      const { data, error } = await supabase.rpc('get_admin_engajamento', {
        p_inicio: inicio,
        p_fim: fim,
        ...(semestre !== null ? { p_semestre: semestre } : {}),
      });
      if (error) throw new Error(error.message);
      // A RPC devolve `{ data, meta }`; o console só usa `data`.
      return (data as unknown as { data: AdminEngajamento }).data;
    },
  });
}
