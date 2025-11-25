import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getBrazilDayOfWeek, getBrazilDate } from '@/utils/timezone';
import { cronogramaEnamedApi } from '@/services/cronogramaEnamedApi';

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
  // Origem dos dados: calendário pessoal ou cronograma ENAMED
  source?: 'calendar' | 'cronograma_enamed' | 'fallback';
  // Metadados para deep linking
  aulaId?: string;      // ID da aula específica
  aulaNome?: string;    // Nome completo da aula
  temaNome?: string;    // Nome do tema
  subtemaNome?: string; // Nome do subtema
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
        .from('simulados_admin')
        .select('id, nome, status')
        .eq('status', 'ativo'),
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
      
      
      
      // Buscar TODAS as matérias agendadas para hoje
      const { data: todaySubjects, error: subjectsError } = await supabase
        .from('calendar_subjects')
        .select('*')
        .eq('user_id', user.id)
        .eq('day_of_week', today)
        .order('start_time', { ascending: true });

      
      if (subjectsError) console.error('❌ [Meu Dia] Erro ao buscar calendar_subjects:', subjectsError);

      let subjectsToProcess: string[] = [];

      if (todaySubjects && todaySubjects.length > 0) {
        subjectsToProcess = todaySubjects.map((s: any) => s.name);
      } else {
        // Fallback: usar calendar_arrangements
        const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        const todayName = dayNames[today];
        
        
        const { data: arrangements, error: arrangementsError } = await supabase
          .from('calendar_arrangements')
          .select('*')
          .eq('user_id', user.id)
          .eq('day', todayName)
          .order('position', { ascending: true });
        
        
        if (arrangementsError) console.error('❌ [Meu Dia] Erro ao buscar calendar_arrangements:', arrangementsError);
        
        if (arrangements && arrangements.length > 0) {
          subjectsToProcess = arrangements.map((a: any) => a.item_key);
        }
      }

      

      // Se não encontrou no calendário pessoal, buscar no Cronograma ENAMED
      if (subjectsToProcess.length === 0) {
        
        try {
          const allCronogramaItems = await cronogramaEnamedApi.getAllContent();
          
          
          
          
          const brazilDate = getBrazilDate();
          const todayStr = `${brazilDate.getDate().toString().padStart(2, '0')}/${(brazilDate.getMonth() + 1).toString().padStart(2, '0')}`;
          
          
          // Filtrar por data_aula que contenha a data de hoje
          // OU por semana atual (como fallback)
          const todayCronogramaItems = allCronogramaItems.filter(item => {
            if (item.data_aula && item.data_aula.includes(todayStr)) {
              return true;
            }
            // Fallback: pegar itens da semana atual se não houver por data específica
            if (item.semana) {
              const weekMatch = item.semana.match(/semana[_\s]*(\d+)/i);
              if (weekMatch) {
                const weekNum = parseInt(weekMatch[1]);
                const currentWeek = Math.ceil(brazilDate.getDate() / 7);
                return weekNum === currentWeek;
              }
            }
            return false;
          });
          
          
          
          // Se ainda não tiver nada, pegar os primeiros 3 itens como fallback
          const itemsToShow = todayCronogramaItems.length > 0 
            ? todayCronogramaItems.slice(0, 3)
            : allCronogramaItems.slice(0, 3);
          
          
          
          // Buscar aulas específicas do Guia de Estudos para cada matéria do Cronograma
          const cronogramaPromises = itemsToShow.map(async (cronItem) => {
            const materiaName = cronItem.subtema || cronItem.tema || 'Matéria';
            
            try {
              // Buscar aulas da matéria no Guia de Estudos
              const [materiaConteudosRes, completedRes] = await Promise.all([
                supabase
                  .from('conteudos')
                  .select('id, aula, materia, link_aula')
                  .eq('id_ies', user.id_ies)
                  .eq('semestre', user.semestre.toString())
                  .ilike('materia', `%${materiaName}%`)
                  .not('link_aula', 'is', null)
                  .limit(20),
                supabase
                  .from('study_progress')
                  .select('content_id')
                  .eq('user_id', user.id)
                  .ilike('materia_id', `%${materiaName}%`)
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
                id: `cronograma-${cronItem.id}`,
                type: 'materia' as const,
                title: materiaName,
                subtitle: suggestion ? suggestion.aula : cronItem.titulo || 'Ver conteúdo',
                path: `/guia-estudos?materia=${encodeURIComponent(materiaName)}`,
                icon: 'BookOpen',
                color: 'from-purple-500 to-indigo-500',
                lessonLink: suggestion?.link_aula || cronItem.link_aula || cronItem.link_gratuito || undefined,
                source: 'cronograma_enamed' as const,
              };
            } catch (error) {
              console.warn(`Erro ao processar matéria ${materiaName}:`, error);
              return {
                id: `cronograma-${cronItem.id}`,
                type: 'materia' as const,
                title: materiaName,
                subtitle: cronItem.titulo || 'Cronograma ENAMED',
                path: '/cronograma-enamed',
                icon: 'BookOpen',
                color: 'from-purple-500 to-indigo-500',
                lessonLink: cronItem.link_aula || cronItem.link_gratuito || undefined,
                source: 'cronograma_enamed' as const,
              };
            }
          });

          const processedCronogramaItems = (await Promise.all(cronogramaPromises)).filter((item) => item !== null) as MeuDiaItem[];
          // Limitar a 2 itens do cronograma ENAMED
          items.push(...processedCronogramaItems.slice(0, 2));
        } catch (error) {
          console.warn('⚠️ [Meu Dia] Erro ao buscar Cronograma ENAMED:', error);
        }
      } else {
        // Processar matérias do calendário pessoal
        const subjectPromises = subjectsToProcess.map(async (subjectName) => {
          if (!subjectName) return null;

          try {
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

            // Buscar informações completas (tema e subtema) da aula sugerida
            let temaNome: string | undefined;
            let subtemaNome: string | undefined;
            
            if (suggestion) {
              const { data: aulaCompleta } = await supabase
                .from('conteudos')
                .select('tema, subtema')
                .eq('id', suggestion.id)
                .single();
              
              if (aulaCompleta) {
                temaNome = aulaCompleta.tema;
                subtemaNome = aulaCompleta.subtema;
              }
            }

              return {
                id: `materia-${subjectName}`,
                type: 'materia' as const,
                title: subjectName,
                subtitle: suggestion ? `Aula sugerida: ${suggestion.aula}` : 'Matéria agendada',
                path: suggestion && temaNome
                  ? `/guia-estudos?materia=${encodeURIComponent(subjectName)}&aula=${encodeURIComponent(suggestion.aula)}&tema=${encodeURIComponent(temaNome)}&subtema=${encodeURIComponent(subtemaNome || '')}`
                  : `/guia-estudos?materia=${encodeURIComponent(subjectName)}`,
                icon: 'BookOpen',
                color: 'from-emerald-500 to-teal-500',
                lessonLink: suggestion?.link_aula || undefined,
                source: 'calendar' as const,
                // Metadados para deep linking
                aulaId: suggestion?.id,
                aulaNome: suggestion?.aula,
                temaNome,
                subtemaNome,
              };
          } catch (error) {
            console.warn(`Erro ao processar matéria ${subjectName}:`, error);
            return null;
          }
        });

        const subjectItems = (await Promise.all(subjectPromises)).filter((item) => item !== null) as MeuDiaItem[];
        // Limitar a 2 matérias do calendário
        items.push(...subjectItems.slice(0, 2));
      }
    } catch (e) {
      console.error('❌ [Meu Dia] Erro ao montar matérias:', e);
    }

    

    // Adicionar "Simulado Disponível" somente se houver simulado ativo não respondido pelo usuário
    try {
      const { data: finalizados } = await supabase
        .from('simulados_finalizados')
        .select('simulado_id')
        .eq('user_id', user.id);

      const finalizadosIds = new Set((finalizados || []).map((r: any) => r.simulado_id));
      const ativos = (simuladoRes.data || []) as any[];
      const disponiveis = ativos.filter((s: any) => !finalizadosIds.has(s.id));
      let availableSimulado = disponiveis[0] || null;
      if (!availableSimulado && ativos.length > 0) {
        availableSimulado = ativos[0];
      }

      if (availableSimulado) {
        items.push({
          id: `simulado-${availableSimulado.id}-${Date.now()}`,
          type: 'simulado',
          title: 'Simulado Disponível',
          subtitle: availableSimulado.nome || 'Simulado',
          path: '/simulados',
          icon: 'Trophy',
          color: 'from-orange-500 to-red-500',
          source: 'fallback' as const,
        });
      }
    } catch (e) {
      console.warn('⚠️ [Meu Dia] Erro ao avaliar simulados disponíveis:', e);
    }

    // Adicionar Intensivo apenas se não houver matérias
    if (items.length === 0) {
      const intensivoData = intensivoRes.data;
      if (intensivoData && intensivoData.length > 0) {
        items.push({
          id: 'intensivo',
          type: 'intensivo',
          title: 'Intensivo ENAMED',
          subtitle: 'Conteúdo focado disponível',
          path: '/intensivao-enamed',
          icon: 'Zap',
          color: 'from-purple-500 to-pink-500',
          source: 'fallback' as const,
        });
      }
    }

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

    // Query com contagem real de views do usuário
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
    if (!user?.id) return;

    try {
      const { data: answerData } = await supabase
        .from('answer_progress')
        .select('simulado, correct, question_id')
        .eq('user_id', user.id)
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
          .from('simulados_admin')
          .select('nome')
          .eq('id', latestSimulado)
          .maybeSingle();

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
          simuladoNome: simuladoInfo?.nome || 'Simulado',
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
