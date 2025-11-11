import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getBrazilDayOfWeek } from '@/utils/timezone';

export interface MeuDiaItem {
  id: string;
  type: 'guia' | 'intensivo' | 'simulado' | 'materia';
  title: string;
  subtitle?: string;
  path: string; // caminho principal (ex.: guia com matéria pré-selecionada)
  icon: string;
  color: string;
  // Link direto para aula sugerida (caso exista)
  lessonLink?: string;
}

export interface RankingData {
  simuladoRank?: number;
  simuladoTotal?: number;
  conteudoRank?: number;
  conteudoTotal?: number;
}

export interface SimuladoPerformance {
  nota: number;
  tempoGasto: string;
  ranking: number;
  totalAlunos: number;
  simuladoNome: string;
}

export interface TopAula {
  id: string;
  nome: string;
  materia: string;
  link: string;
}

export const useHomeData = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meuDiaItems, setMeuDiaItems] = useState<MeuDiaItem[]>([]);
  const [hasStudyGuide, setHasStudyGuide] = useState(false);
  const [hasCronograma, setHasCronograma] = useState(false);
  const [rankings, setRankings] = useState<RankingData>({});
  const [topAulas, setTopAulas] = useState<TopAula[]>([]);
  const [conteudosRelacionados, setConteudosRelacionados] = useState<any[]>([]);
  const [simuladoData, setSimuladoData] = useState<SimuladoPerformance | null>(null);
  
  // Cache leve em sessionStorage para evitar skeleton em revisitas rápidas
  const cacheKey = user ? `home_data_cache_${user.id}` : null;
  const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos

  useEffect(() => {
    if (user) {
      // Tenta restaurar dados do cache para evitar mostrar skeleton
      if (cacheKey) {
        try {
          const raw = sessionStorage.getItem(cacheKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.timestamp && (Date.now() - parsed.timestamp) < CACHE_TTL_MS) {
              setMeuDiaItems(parsed.meuDiaItems || []);
              setHasStudyGuide(!!parsed.hasStudyGuide);
              setHasCronograma(!!parsed.hasCronograma);
              setRankings(parsed.rankings || {});
              setTopAulas(parsed.topAulas || []);
              setConteudosRelacionados(parsed.conteudosRelacionados || []);
              setSimuladoData(parsed.simuladoData || null);
              // Evita skeleton imediato; atualiza silenciosamente em background
              setLoading(false);
              fetchAllData(true);
              return;
            }
          }
        } catch (e) {
          console.warn('Falha ao ler cache da Home:', e);
        }
      }

      // Sem cache válido: carrega normalmente
      fetchAllData();
    }
  }, [user]);

  const fetchAllData = async (silent: boolean = false) => {
    if (!silent) {
      setLoading(true);
    }
    
    try {
      setError(null);
      const [meuDiaRes, rankingsRes, topAulasRes, simuladoRes] = await Promise.all([
        fetchMeuDia(),
        fetchRankings(),
        fetchTopAulas(),
        fetchSimuladoData(),
      ]);
      setLoading(false);

      // Atualiza cache com dados atuais
      if (cacheKey) {
        try {
          const payload = {
            timestamp: Date.now(),
            meuDiaItems: meuDiaRes?.items ?? meuDiaItems,
            hasStudyGuide: meuDiaRes?.hasStudyGuide ?? hasStudyGuide,
            hasCronograma: meuDiaRes?.hasCronograma ?? hasCronograma,
            rankings: rankingsRes ?? rankings,
            topAulas: topAulasRes?.aulas ?? topAulas,
            conteudosRelacionados: topAulasRes?.relacionados ?? conteudosRelacionados,
            simuladoData: simuladoRes ?? simuladoData,
          };
          sessionStorage.setItem(cacheKey, JSON.stringify(payload));
        } catch (e) {
          console.warn('Falha ao salvar cache da Home:', e);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados da Home:', error);
      setError('Não foi possível carregar os dados. Tente novamente.');
      setLoading(false);
    }
  };

  const fetchMeuDia = async () => {
    if (!user?.id_ies || !user?.semestre) return;

    const items: MeuDiaItem[] = [];

    // 🚀 Paralelizar queries principais para melhor performance
    const [studyGuideRes, cronogramaRes, intensivoRes, simuladoRes] = await Promise.all([
      supabase
        .from('conteudos')
        .select('*')
        .eq('id_ies', user.id_ies)
        .eq('semestre', user.semestre.toString())
        .limit(1),
      supabase
        .from('calendar_subjects')
        .select('*')
        .eq('user_id', user.id)
        .limit(1),
      supabase
        .from('intensivouscs')
        .select('*')
        .limit(1),
      supabase
        .from('Simulados')
        .select('id, Simulado')
        .limit(1),
    ]);

    // Process study guide
    const studyGuideData = studyGuideRes.data;
    if (studyGuideData && studyGuideData.length > 0) {
      setHasStudyGuide(true);
    }

    // Process cronograma
    const cronogramaData = cronogramaRes.data;
    if (cronogramaData && cronogramaData.length > 0) {
      setHasCronograma(true);
    }

    // ⭐ Matérias do dia (do calendário) + sugestão de aula não concluída para cada uma
    try {
      // 🌍 Usar fuso de Brasília (GMT-3) para consistência com sistema de lembretes
      const today = getBrazilDayOfWeek(); // 0 (Dom) - 6 (Sáb)
      
      console.log('🔍 [Meu Dia] Dia da semana (GMT-3):', today);
      console.log('🔍 [Meu Dia] User ID:', user.id);
      
      // Buscar TODAS as matérias agendadas para hoje (remover limit)
      const { data: todaySubjects, error: subjectsError } = await supabase
        .from('calendar_subjects')
        .select('*')
        .eq('user_id', user.id)
        .eq('day_of_week', today)
        .order('start_time', { ascending: true });

      console.log('🔍 [Meu Dia] Calendar subjects encontrados:', todaySubjects?.length || 0, todaySubjects);
      if (subjectsError) console.error('❌ [Meu Dia] Erro ao buscar calendar_subjects:', subjectsError);

      let subjectsToProcess: string[] = [];

      /**
       * 📚 LÓGICA DE FALLBACK DO CALENDÁRIO:
       * 
       * 1. calendar_subjects: Tabela principal com matérias fixas do calendário
       *    - Criada quando usuário define horários de aula no calendário
       *    - Contém: nome da matéria, dia da semana, horário inicial/final, cor
       * 
       * 2. calendar_arrangements: Tabela de rearranjos personalizados (modo premium)
       *    - Permite mover/reordenar matérias temporariamente
       *    - Contém: item_key (nome da matéria), week, day, position
       *    - Usado quando usuário personaliza layout do calendário
       * 
       * Comportamento:
       * - Primeiro tenta calendar_subjects (fonte primária)
       * - Se vazio, tenta calendar_arrangements (fallback)
       * - Se ambos vazios, não mostra matérias do dia
       */
      if (todaySubjects && todaySubjects.length > 0) {
        subjectsToProcess = todaySubjects.map((s: any) => s.name);
        console.log('✅ [Meu Dia] Usando calendar_subjects:', subjectsToProcess);
      } else {
        // Fallback: usar calendar_arrangements
        const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        const todayName = dayNames[today];
        console.log('🔄 [Meu Dia] Tentando fallback para calendar_arrangements, dia:', todayName);
        
        const { data: arrangements, error: arrangementsError } = await supabase
          .from('calendar_arrangements')
          .select('*')
          .eq('user_id', user.id)
          .eq('day', todayName)
          .order('position', { ascending: true });
        
        console.log('🔍 [Meu Dia] Calendar arrangements encontrados:', arrangements?.length || 0, arrangements);
        if (arrangementsError) console.error('❌ [Meu Dia] Erro ao buscar calendar_arrangements:', arrangementsError);
        
        if (arrangements && arrangements.length > 0) {
          subjectsToProcess = arrangements.map((a: any) => a.item_key);
          console.log('✅ [Meu Dia] Usando calendar_arrangements:', subjectsToProcess);
        }
      }

      console.log('📋 [Meu Dia] Total de matérias a processar:', subjectsToProcess.length);

      // 🚀 Paralelizar queries para todas as matérias
      const subjectPromises = subjectsToProcess.map(async (subjectName) => {
        if (!subjectName) return null;

        try {
          // Buscar conteúdos e progresso em paralelo
          const [materiaConteudosRes, completedRes] = await Promise.all([
            supabase
              .from('conteudos')
              .select('id, aula, materia, link_aula')
              .eq('id_ies', user.id_ies)
              .eq('semestre', user.semestre.toString())
              .eq('materia', subjectName)
              .not('link_aula', 'is', null)
              .limit(20),
            supabase
              .from('study_progress')
              .select('content_id')
              .eq('user_id', user.id)
              .eq('materia_id', subjectName)
              .eq('semestre', user.semestre)
              .eq('ies_nome', user.ies_nome || '')
              .eq('content_type', 'aula')
              .eq('completed', true)
          ]);

          const materiaConteudos = materiaConteudosRes.data;
          const completed = completedRes.data;

          const completedSet = new Set((completed || []).map((c: any) => String(c.content_id)));
          const suggestion = (materiaConteudos || []).find((c: any) => !completedSet.has(String(c.id)));

          return {
            id: `materia-${subjectName}`,
            type: 'materia' as const,
            title: subjectName,
            subtitle: suggestion ? `Aula sugerida: ${suggestion.aula}` : 'Matéria agendada para hoje',
            path: `/guia-estudos?materia=${encodeURIComponent(subjectName)}`,
            icon: 'BookOpen',
            color: 'from-emerald-500 to-teal-500',
            lessonLink: suggestion?.link_aula || undefined,
          };
        } catch (error) {
          console.warn(`Erro ao processar matéria ${subjectName}:`, error);
          return null;
        }
      });

      // Aguardar todas as queries e filtrar nulos
      const subjectItems = (await Promise.all(subjectPromises)).filter((item) => item !== null) as MeuDiaItem[];
      console.log('✅ [Meu Dia] Matérias processadas com sucesso:', subjectItems.length);
      items.push(...subjectItems);
    } catch (e) {
      // Falha opcional ao sugerir aula - não bloquear Meu Dia
      console.error('❌ [Meu Dia] Erro ao montar matérias do dia:', e);
    }

    console.log('📊 [Meu Dia] Total de items antes de adicionar Intensivo/Simulado:', items.length);

    // Adicionar Intensivo e Simulado apenas se não houver matérias do dia
    // (para não poluir a lista quando já tem conteúdo programado)
    if (items.length === 0) {
      console.log('ℹ️ [Meu Dia] Nenhuma matéria encontrada, adicionando Intensivo e Simulado como fallback');
      
      // Process intensivo (já carregado em paralelo)
      const intensivoData = intensivoRes.data;
      if (intensivoData && intensivoData.length > 0) {
        console.log('✅ [Meu Dia] Adicionando Intensivo ENAMED');
        items.push({
          id: 'intensivo',
          type: 'intensivo',
          title: 'Intensivo ENAMED',
          subtitle: 'Conteúdo focado disponível',
          path: '/intensivao-enamed',
          icon: 'Zap',
          color: 'from-purple-500 to-pink-500',
        });
      }

      // Process simulado (já carregado em paralelo)
      const simuladoData = simuladoRes.data;
      if (simuladoData && simuladoData.length > 0) {
        console.log('✅ [Meu Dia] Adicionando Simulado Disponível');
        items.push({
          id: 'simulado',
          type: 'simulado',
          title: 'Simulado Disponível',
          subtitle: 'Teste seus conhecimentos',
          path: '/desempenho-simulado',
          icon: 'BarChart3',
          color: 'from-orange-500 to-red-500',
        });
      }
    } else {
      console.log('✅ [Meu Dia] Exibindo matérias do calendário (sem Intensivo/Simulado)');
    }

    console.log('📋 [Meu Dia] Items finais:', items);
    setMeuDiaItems(items);
    return {
      items,
      hasStudyGuide: !!(studyGuideData && studyGuideData.length > 0),
      hasCronograma: !!(cronogramaData && cronogramaData.length > 0)
    };
  };

  const fetchRankings = async () => {
    if (!user?.email) return;

    try {
      // Fetch real simulado ranking
      const { data: rankingData } = await supabase
        .rpc('get_user_rankings', { p_simulado_id: null });

      if (rankingData && typeof rankingData === 'object') {
        const ranking = rankingData as any;
        // Mock determinístico para ranking de conteúdo (baseado no user.id)
        const userIdHash = user.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const mockConteudoRank = (userIdHash % 50) + 1;
        
        const next: RankingData = {
          simuladoRank: ranking.rankingIES?.rank,
          simuladoTotal: ranking.rankingIES?.total,
          // Mock determinístico - sempre retorna o mesmo valor para o mesmo usuário
          conteudoRank: mockConteudoRank,
          conteudoTotal: 150,
        };
        setRankings(next);
        return next;
      }
    } catch (error) {
      console.error('Error fetching rankings:', error);
    }
  };

  const fetchTopAulas = async () => {
    if (!user?.id_ies || !user?.semestre) return;

    const { data } = await supabase
      .from('conteudos')
      .select('id, aula, materia, link_aula')
      .eq('id_ies', user.id_ies)
      .eq('semestre', user.semestre.toString())
      .not('link_aula', 'is', null)
      .limit(3);

    if (data) {
      const aulas = data.map((item) => ({
        id: item.id,
        nome: item.aula || 'Sem título',
        materia: item.materia || 'Matéria',
        link: item.link_aula || '#',
      }));
      setTopAulas(aulas);

      // Mock related content
      const relacionados = [
        { id: '1', titulo: 'Revisão de Cardiologia', tipo: 'PDF' },
        { id: '2', titulo: 'Quiz de Anatomia', tipo: 'Quiz' },
      ];
      setConteudosRelacionados(relacionados);
      return { aulas, relacionados };
    }
    return undefined;
  };

  const fetchSimuladoData = async () => {
    if (!user?.email) return;

    try {
      const { data: answerData } = await supabase
        .from('answer_progress_enamed')
        .select('simulado, correct, question_id')
        .eq('email', user.email)
        .order('simulado', { ascending: false });

      if (answerData && answerData.length > 0) {
        // Get latest simulado
        const latestSimulado = answerData[0].simulado;
        const simuladoAnswers = answerData.filter((a) => a.simulado === latestSimulado);
        const corrects = simuladoAnswers.filter((a) => a.correct).length;
        const total = simuladoAnswers.length;
        const nota = total > 0 ? Math.round((corrects / total) * 100) : 0;

        // Get simulado name
        const { data: simuladoInfo } = await supabase
          .from('Simulados')
          .select('Simulado')
          .eq('id', latestSimulado)
          .single();

        // Get ranking
        const { data: rankingData } = await supabase
          .rpc('get_user_rankings', { p_simulado_id: latestSimulado });

        let ranking = 0;
        let totalAlunos = 0;

        if (rankingData && typeof rankingData === 'object') {
          const rankingObj = rankingData as any;
          ranking = rankingObj.rankingIES?.rank || 0;
          totalAlunos = rankingObj.rankingIES?.total || 0;
        }

        const next: SimuladoPerformance = {
          nota,
          tempoGasto: '45min',
          ranking,
          totalAlunos,
          simuladoNome: simuladoInfo?.Simulado || 'Simulado',
        };
        setSimuladoData(next);
        return next;
      }
    } catch (error) {
      console.error('Error fetching simulado data:', error);
    }
    return null;
  };

  return {
    loading,
    error,
    meuDiaItems,
    hasStudyGuide,
    hasCronograma,
    rankings,
    topAulas,
    conteudosRelacionados,
    simuladoData,
    refetch: fetchAllData,
  };
};
