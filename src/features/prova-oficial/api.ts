import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { ProvaOficialAluno, ProvaOficialResumo } from './types';

// RPCs de get_aluno_provas_oficiais/get_aluno_prova_oficial (Task 1) ainda não
// estão nos types gerados do Supabase — cast local em vez de editar
// src/integrations/supabase/types.ts (fora do escopo deste agente).
const rpc = supabase.rpc as unknown as (
  fn: string,
  args?: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;

export function useProvasOficiaisAluno() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['prova-oficial', user?.id, 'lista'],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await rpc('get_aluno_provas_oficiais');
      if (error) throw new Error(`get_aluno_provas_oficiais: ${error.message}`);
      return (Array.isArray(data) ? data : []) as ProvaOficialResumo[];
    },
  });
}

export function useProvaOficialAluno(simuladoId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['prova-oficial', user?.id, 'detalhe', simuladoId],
    enabled: !!user?.id && !!simuladoId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await rpc('get_aluno_prova_oficial', { p_simulado_id: simuladoId });
      if (error) throw new Error(`get_aluno_prova_oficial: ${error.message}`);
      return (data ?? null) as ProvaOficialAluno | null;
    },
  });
}
