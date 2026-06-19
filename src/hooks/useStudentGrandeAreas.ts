import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Logger } from '@/utils/logger';
import { normalizeGrandeArea } from '@/utils/grandeArea';

/**
 * Grandes áreas disponíveis para o aluno = as grandes áreas das questões dos
 * simulados que ele já fez (respondeu). Usado no "Adicionar erro manual" para
 * oferecer um dropdown fechado de áreas reais (corrige SAN-2986: antes listava
 * só as áreas já erradas; não dá pra digitar do nada).
 */
export function useStudentGrandeAreas() {
  const { user } = useAuth();
  const [areas, setAreas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        // simulados em que o aluno respondeu algo
        const { data: aps, error: apErr } = await supabase
          .from('answer_progress')
          .select('simulado')
          .eq('user_id', user.id);
        if (apErr) throw apErr;

        const simIds = [...new Set((aps ?? []).map((a) => a.simulado).filter(Boolean) as string[])];
        if (simIds.length === 0) {
          if (!cancelled) setAreas([]);
          return;
        }

        // grandes áreas das questões desses simulados
        const { data: qs, error: qErr } = await supabase
          .from('questoes_simulado')
          .select('grande_area')
          .in('simulado_id', simIds);
        if (qErr) throw qErr;

        const normalized = (qs ?? [])
          .map((q) => q.grande_area)
          .filter(Boolean)
          .map((a) => normalizeGrandeArea(a as string));
        const unique = [...new Set(normalized)].sort((a, b) => a.localeCompare(b, 'pt-BR'));

        if (!cancelled) setAreas(unique);
      } catch (err) {
        Logger.error('[Caderno] student grande areas error:', err);
        if (!cancelled) setAreas([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  return { areas, loading };
}
