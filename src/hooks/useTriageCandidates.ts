import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Logger } from '@/utils/logger';

export interface SimuladoOption {
  id: string;
  nome: string;
}

export interface TriageCandidate {
  questionId: string;
  enunciado: string;
  optionLabels: string[];
  selectedLabel: string | null;
  correctLabel: string;
  wasCorrect: boolean;
  grandeArea: string | null;
  especialidade: string | null;
  tema: string | null;
}

const ALL_LABELS: Record<string, string> = {
  alternativa_a: 'A',
  alternativa_b: 'B',
  alternativa_c: 'C',
  alternativa_d: 'D',
  alternativa_e: 'E',
};

/** Lista de simulados do usuário (para o seletor de triagem). */
export function useTriageSimulados() {
  const [simulados, setSimulados] = useState<SimuladoOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc('get_user_simulados');
        if (error) throw error;
        if (!cancelled) setSimulados(((data ?? []) as SimuladoOption[]));
      } catch (err) {
        Logger.error('[Triage] simulados load error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { simulados, loading };
}

/**
 * Candidatos de triagem de um simulado: questões erradas ou em branco (exclui
 * anuladas). Corretas não entram — sem captura de confiança na prova, não há
 * sinal de "baixa confiança" no dado; o aluno define a confiança na triagem.
 */
export function useTriageCandidates(simuladoId: string | null) {
  const { user } = useAuth();
  const [candidates, setCandidates] = useState<TriageCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id || !simuladoId) {
      setCandidates([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [questoesRes, respostasRes] = await Promise.all([
        supabase
          .from('questoes_simulado')
          .select('id, ordem, enunciado, alternativa_a, alternativa_b, alternativa_c, alternativa_d, alternativa_e, correta, grande_area, especialidade, tema, anulada')
          .eq('simulado_id', simuladoId)
          .order('ordem', { ascending: true }),
        supabase
          .from('answer_progress')
          .select('question_id, resposta_usuario, correct')
          .eq('simulado', simuladoId)
          .eq('user_id', user.id),
      ]);
      if (questoesRes.error) throw questoesRes.error;
      if (respostasRes.error) throw respostasRes.error;

      const answers = new Map(
        (respostasRes.data ?? []).map((r) => [r.question_id, r as { resposta_usuario: string | null; correct: boolean | null }]),
      );

      const out: TriageCandidate[] = [];
      for (const row of questoesRes.data ?? []) {
        if (row.anulada) continue;

        const correctLabel = (row.correta ?? '').toUpperCase();
        const ans = answers.get(row.id);
        const selectedLabel = ans?.resposta_usuario ? ans.resposta_usuario.toUpperCase() : null;
        const wasCorrect = !!selectedLabel && selectedLabel === correctLabel;
        if (wasCorrect) continue; // só erros/branco entram na triagem

        const r = row as unknown as Record<string, string | null>;
        const optionLabels = Object.entries(ALL_LABELS)
          .filter(([col]) => r[col] != null && r[col] !== '')
          .map(([, label]) => label);

        out.push({
          questionId: row.id,
          enunciado: row.enunciado,
          optionLabels,
          selectedLabel,
          correctLabel,
          wasCorrect,
          grandeArea: row.grande_area,
          especialidade: row.especialidade,
          tema: row.tema,
        });
      }
      setCandidates(out);
    } catch (err) {
      Logger.error('[Triage] candidates load error:', err);
      setError('Erro ao carregar a triagem do simulado');
    } finally {
      setLoading(false);
    }
  }, [user?.id, simuladoId]);

  useEffect(() => { load(); }, [load]);

  return { candidates, loading, error, reload: load };
}
