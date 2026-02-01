import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getBrazilDayOfWeek, getBrazilDate } from '@/utils/timezone';
import { MeuDiaItem } from '@/hooks/useHomeData';

interface User {
  id: string;
  id_ies?: string;
  semestre?: number;
  ies_nome?: string;
}

/**
 * Hook extraído de useHomeData para buscar itens do "Meu Dia"
 * Responsável por: calendário pessoal, simulados disponíveis
 */
export const useMeuDia = () => {
  const [items, setItems] = useState<MeuDiaItem[]>([]);
  const [hasStudyGuide, setHasStudyGuide] = useState(false);
  const [hasCronograma, setHasCronograma] = useState(false);

  const fetchMeuDia = async (user: User) => {
    if (!user?.id_ies || !user?.semestre) return { items: [], hasStudyGuide: false, hasCronograma: false };

    const meuDiaItems: MeuDiaItem[] = [];

    // Paralelizar queries principais
    const [studyGuideRes, simuladoRes] = await Promise.all([
      supabase
        .from('conteudos')
        .select('*')
        .eq('id_ies', user.id_ies)
        .eq('semestre', user.semestre.toString())
        .limit(1),
      supabase
        .from('simulados_admin')
        .select('id, nome, status')
        .eq('status', 'ativo'),
    ]);

    const studyGuideData = studyGuideRes.data;
    const hasGuide = !!(studyGuideData && studyGuideData.length > 0);
    setHasStudyGuide(hasGuide);
    setHasCronograma(false);

    // Matérias do dia
    try {
      const today = getBrazilDayOfWeek();
      const { data: todaySubjects } = await supabase
        .from('calendar_subjects')
        .select('*')
        .eq('user_id', user.id)
        .eq('day_of_week', today)
        .order('start_time', { ascending: true });

      let subjectsToProcess: string[] = [];

      if (todaySubjects && todaySubjects.length > 0) {
        subjectsToProcess = todaySubjects.map((s) => s.name);
      } else {
        const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        const { data: arrangements } = await supabase
          .from('calendar_arrangements')
          .select('*')
          .eq('user_id', user.id)
          .eq('day', dayNames[today])
          .order('position', { ascending: true });

        if (arrangements && arrangements.length > 0) {
          subjectsToProcess = arrangements.map((a) => a.item_key);
        }
      }

      if (subjectsToProcess.length > 0) {
        // Processar calendário pessoal
        await processCalendarSubjects(user, subjectsToProcess, meuDiaItems);
      }
    } catch (e) {
      console.error('[Meu Dia] Erro ao montar matérias:', e);
    }

    // Simulado disponível
    await addAvailableSimulado(user, simuladoRes.data || [], meuDiaItems);

    setItems(meuDiaItems);
    return { items: meuDiaItems, hasStudyGuide: hasGuide, hasCronograma: false };
  };

  const processCalendarSubjects = async (user: User, subjects: string[], items: MeuDiaItem[]) => {
    const subjectItems = await Promise.all(
      subjects.map(async (subjectName) => {
        if (!subjectName) return null;

        try {
          const [materiaConteudosRes, completedRes] = await Promise.all([
            supabase
              .from('conteudos')
              .select('id, aula, materia, link_aula, tema, subtema')
              .eq('id_ies', user.id_ies!)
              .eq('semestre', user.semestre!.toString())
              .eq('materia', subjectName)
              .not('link_aula', 'is', null)
              .limit(20),
            supabase
              .from('study_progress')
              .select('content_id')
              .eq('user_id', user.id)
              .eq('materia_id', subjectName)
              .eq('content_type', 'aula')
              .eq('completed', true)
          ]);

          const materiaConteudos = materiaConteudosRes.data || [];
          const completed = completedRes.data || [];
          const completedSet = new Set(completed.map((c) => String(c.content_id)));
          const suggestion = materiaConteudos.find((c) => !completedSet.has(String(c.id)));

          return {
            id: `materia-${subjectName}`,
            type: 'materia' as const,
            title: subjectName,
            subtitle: suggestion ? `Aula sugerida: ${suggestion.aula}` : 'Matéria agendada',
            path: suggestion?.tema
              ? `/guia-estudos?materia=${encodeURIComponent(subjectName)}&aula=${encodeURIComponent(suggestion.aula || '')}&tema=${encodeURIComponent(suggestion.tema)}&subtema=${encodeURIComponent(suggestion.subtema || '')}`
              : `/guia-estudos?materia=${encodeURIComponent(subjectName)}`,
            icon: 'BookOpen',
            color: 'from-emerald-500 to-teal-500',
            lessonLink: suggestion?.link_aula,
            source: 'calendar' as const,
            aulaId: suggestion?.id,
            aulaNome: suggestion?.aula,
            temaNome: suggestion?.tema,
            subtemaNome: suggestion?.subtema,
          };
        } catch {
          return null;
        }
      })
    );

    items.push(...(subjectItems.filter(Boolean) as MeuDiaItem[]).slice(0, 2));
  };

  const addAvailableSimulado = async (user: User, ativos: { id: string; nome: string }[], items: MeuDiaItem[]) => {
    try {
      const { data: finalizados } = await supabase
        .from('simulados_finalizados')
        .select('simulado_id')
        .eq('user_id', user.id);

      const finalizadosIds = new Set((finalizados || []).map((r) => r.simulado_id));
      const disponiveis = ativos.filter((s) => !finalizadosIds.has(s.id));
      const availableSimulado = disponiveis[0] || ativos[0];

      if (availableSimulado) {
        items.push({
          id: `simulado-${availableSimulado.id}-${Date.now()}`,
          type: 'simulado',
          title: 'Simulado Disponível',
          subtitle: availableSimulado.nome || 'Simulado',
          path: '/simulados',
          icon: 'Trophy',
          color: 'from-orange-500 to-red-500',
          source: 'fallback',
        });
      }
    } catch (e) {
      console.warn('[Meu Dia] Erro ao avaliar simulados:', e);
    }
  };

  return {
    items,
    hasStudyGuide,
    hasCronograma,
    fetchMeuDia,
  };
};
