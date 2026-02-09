import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, subDays, differenceInDays, format, startOfWeek } from 'date-fns';
import type {
  JourneyFilters,
  ExecutiveMetrics,
  JourneyFunnelData,
  FunnelStage,
  BehavioralSegmentsData,
  RetentionCohortData,
  StudyVsPerformanceData,
  EngagementDepthData,
  SmartInsight,
  RiskAlert,
} from '../types';
import {
  mapMateriaToArea,
  calculatePearsonCorrelation,
  determineGapType,
  generateCorrelationInsights,
} from '../utils/areaMapping';

interface UseJourneyAnalyticsReturn {
  executive: ExecutiveMetrics | null;
  funnel: JourneyFunnelData | null;
  segments: BehavioralSegmentsData | null;
  retention: RetentionCohortData | null;
  studyCorrelation: StudyVsPerformanceData | null;
  engagement: EngagementDepthData | null;
  insights: SmartInsight[];
  alerts: RiskAlert[];
  isLoading: boolean;
  error: Error | null;
}

export function useJourneyAnalytics(filters: JourneyFilters): UseJourneyAnalyticsReturn {
  const { dateRange, iesId, excludedIES } = filters;
  const startDate = startOfDay(dateRange.start);
  const endDate = endOfDay(dateRange.end);

  // Query 0: Get admin user IDs to exclude from all metrics
  const adminIdsQuery = useQuery({
    queryKey: ['journey-admin-ids'],
    queryFn: async (): Promise<Set<string>> => {
      const { data } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');
      
      return new Set((data || []).map(r => r.user_id));
    },
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });

  const adminIds = adminIdsQuery.data || new Set<string>();

  // Query 1: Executive Metrics (sessions, DAU/WAU/MAU, etc.)
  const executiveQuery = useQuery({
    queryKey: ['journey-executive', iesId, excludedIES, startDate.toISOString(), endDate.toISOString(), Array.from(adminIds)],
    queryFn: async (): Promise<ExecutiveMetrics> => {
      const now = new Date();
      const thirtyDaysAgo = subDays(now, 30);
      const sevenDaysAgo = subDays(now, 7);
      
      // Get sessions for the period
      let sessionsQuery = supabase
        .from('user_sessions')
        .select('user_id, started_at, duration_seconds, pages_visited, ies_id')
        .gte('started_at', thirtyDaysAgo.toISOString())
        .lte('started_at', now.toISOString());
      
      if (iesId) sessionsQuery = sessionsQuery.eq('ies_id', iesId);
      
      const { data: sessions } = await sessionsQuery;
      let filteredSessions = sessions || [];
      
      // Exclude admin users
      filteredSessions = filteredSessions.filter(s => !adminIds.has(s.user_id));
      
      if (excludedIES?.length) {
        filteredSessions = filteredSessions.filter(s => !excludedIES.includes(s.ies_id || ''));
      }

      // Calculate DAU (average daily active users)
      const dailyUsers = new Map<string, Set<string>>();
      filteredSessions.forEach(s => {
        const day = format(new Date(s.started_at), 'yyyy-MM-dd');
        if (!dailyUsers.has(day)) dailyUsers.set(day, new Set());
        dailyUsers.get(day)!.add(s.user_id);
      });
      
      const dauValues = Array.from(dailyUsers.values()).map(set => set.size);
      const dau = dauValues.length > 0 ? Math.round(dauValues.reduce((a, b) => a + b, 0) / dauValues.length) : 0;

      // WAU (last 7 days unique users)
      const wauUsers = new Set(
        filteredSessions
          .filter(s => new Date(s.started_at) >= sevenDaysAgo)
          .map(s => s.user_id)
      );
      const wau = wauUsers.size;

      // MAU (last 30 days unique users)
      const mauUsers = new Set(filteredSessions.map(s => s.user_id));
      const mau = mauUsers.size;

      // Stickiness (DAU/MAU)
      const stickiness = mau > 0 ? Math.round((dau / mau) * 100) : 0;

      // Average session depth and duration
      const avgSessionDepth = filteredSessions.length > 0
        ? Math.round(filteredSessions.reduce((sum, s) => sum + (s.pages_visited || 0), 0) / filteredSessions.length * 10) / 10
        : 0;
      
      const avgSessionDuration = filteredSessions.length > 0
        ? Math.round(filteredSessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / filteredSessions.length / 60 * 10) / 10
        : 0;

      // Calendar adoption
      const { count: calendarUsers } = await supabase
        .from('calendar_subjects')
        .select('user_id', { count: 'exact', head: true });
      
      const calendarAdoption = mau > 0 ? Math.round(((calendarUsers || 0) / mau) * 100) : 0;

      // Time to first simulado (get first session and first completed simulado per user)
      const { data: firstSimulados } = await supabase
        .from('simulados_finalizados')
        .select('user_id, finalizado_em')
        .order('finalizado_em', { ascending: true });

      const userFirstSimulado = new Map<string, Date>();
      (firstSimulados || []).forEach(s => {
        if (!userFirstSimulado.has(s.user_id)) {
          userFirstSimulado.set(s.user_id, new Date(s.finalizado_em));
        }
      });

      // Get first session per user
      const userFirstSession = new Map<string, Date>();
      filteredSessions.forEach(s => {
        const sessionDate = new Date(s.started_at);
        if (!userFirstSession.has(s.user_id) || sessionDate < userFirstSession.get(s.user_id)!) {
          userFirstSession.set(s.user_id, sessionDate);
        }
      });

      // Calculate average time to first simulado
      const timesToSimulado: number[] = [];
      userFirstSimulado.forEach((simuladoDate, userId) => {
        const firstSession = userFirstSession.get(userId);
        if (firstSession && simuladoDate >= firstSession) {
          const days = differenceInDays(simuladoDate, firstSession);
          if (days >= 0) timesToSimulado.push(days);
        }
      });
      
      const timeToFirstSimulado = timesToSimulado.length > 0
        ? Math.round(timesToSimulado.reduce((a, b) => a + b, 0) / timesToSimulado.length * 10) / 10
        : null;

      // Baixo engajamento (B2B: users com apenas 1 sessao em 14 dias)
      const fourteenDaysAgo = subDays(now, 14);
      const recentSessions = filteredSessions.filter(s => new Date(s.started_at) >= fourteenDaysAgo);
      const userSessionCounts = new Map<string, number>();
      recentSessions.forEach(s => {
        userSessionCounts.set(s.user_id, (userSessionCounts.get(s.user_id) || 0) + 1);
      });
      
      const lowEngagementCount = Array.from(userSessionCounts.entries())
        .filter(([_, count]) => count === 1).length;

      // Total users matriculados (excluindo admins)
      let usersQuery = supabase
        .from('users')
        .select('id');
      
      if (iesId) usersQuery = usersQuery.eq('id_ies', iesId);
      
      const { data: allUsers } = await usersQuery;
      // Exclude admin users from total count
      const nonAdminUsers = (allUsers || []).filter(u => !adminIds.has(u.id));
      const totalUsersCount = nonAdminUsers.length;

      // Usuarios que nunca acessaram (cadastrados mas sem sessao)
      const usersWithSessions = new Set(filteredSessions.map(s => s.user_id));
      const neverActiveCount = Math.max(0, totalUsersCount - usersWithSessions.size);
      
      // Taxa de ativacao (% de matriculados que ja acessaram)
      const activationRate = totalUsersCount > 0 
        ? Math.round((usersWithSessions.size / totalUsersCount) * 100) 
        : 0;

      return {
        dau,
        wau,
        mau,
        stickiness,
        avgSessionDepth,
        avgSessionDuration,
        timeToFirstSimulado,
        calendarAdoption,
        lowEngagementCount,
        neverActiveCount,
        activationRate,
        totalUsers: totalUsersCount,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  // Query 2: Journey Funnel (6 stages)
  const funnelQuery = useQuery({
    queryKey: ['journey-funnel', iesId, excludedIES, startDate.toISOString(), endDate.toISOString(), Array.from(adminIds)],
    queryFn: async (): Promise<JourneyFunnelData> => {
      // Stage 1: First Access (unique users with sessions)
      let sessionsQuery = supabase
        .from('user_sessions')
        .select('user_id, started_at, pages_visited, ies_id')
        .gte('started_at', startDate.toISOString())
        .lte('started_at', endDate.toISOString());
      
      if (iesId) sessionsQuery = sessionsQuery.eq('ies_id', iesId);
      
      const { data: sessions } = await sessionsQuery;
      let filteredSessions = sessions || [];
      
      // Exclude admin users
      filteredSessions = filteredSessions.filter(s => !adminIds.has(s.user_id));
      
      if (excludedIES?.length) {
        filteredSessions = filteredSessions.filter(s => !excludedIES.includes(s.ies_id || ''));
      }

      const allUsers = new Set(filteredSessions.map(s => s.user_id));
      const firstAccessCount = allUsers.size;

      // Stage 2: Exploration (2+ pages in any session)
      const userMaxPages = new Map<string, number>();
      filteredSessions.forEach(s => {
        const current = userMaxPages.get(s.user_id) || 0;
        userMaxPages.set(s.user_id, Math.max(current, s.pages_visited || 0));
      });
      const explorationCount = Array.from(userMaxPages.entries())
        .filter(([_, pages]) => pages >= 2).length;

      // Stage 3: Engagement (returned on different day)
      const userDays = new Map<string, Set<string>>();
      filteredSessions.forEach(s => {
        const day = format(new Date(s.started_at), 'yyyy-MM-dd');
        if (!userDays.has(s.user_id)) userDays.set(s.user_id, new Set());
        userDays.get(s.user_id)!.add(day);
      });
      const engagementCount = Array.from(userDays.entries())
        .filter(([_, days]) => days.size >= 2).length;

      // Stage 4: Consumption (accessed study guide or sanarclass)
      const { data: pageViews } = await supabase
        .from('page_views')
        .select('user_id, page_path')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .or('page_path.ilike.%guia%,page_path.ilike.%sanarclass%,page_path.ilike.%study%');
      
      // Exclude admin users from consumption count
      const consumptionUsers = new Set((pageViews || []).map(p => p.user_id).filter(id => id && !adminIds.has(id)));
      const consumptionCount = consumptionUsers.size;

      // Stage 5: Retenção (retornou mais de uma semana depois)
      // Users who have sessions in different weeks
      const userWeeks = new Map<string, Set<string>>();
      filteredSessions.forEach(s => {
        const week = format(startOfWeek(new Date(s.started_at), { weekStartsOn: 1 }), 'yyyy-ww');
        if (!userWeeks.has(s.user_id)) userWeeks.set(s.user_id, new Set());
        userWeeks.get(s.user_id)!.add(week);
      });
      const retentionCount = Array.from(userWeeks.entries())
        .filter(([_, weeks]) => weeks.size >= 2).length;

      const stages: FunnelStage[] = [
        { id: 'first_access', name: 'Primeiro Acesso', shortName: 'Acesso', count: firstAccessCount, percentage: 100, dropoff: 0, description: 'Alunos que acessaram a plataforma' },
        { id: 'exploration', name: 'Exploração', shortName: 'Explorar', count: explorationCount, percentage: 0, dropoff: 0, description: 'Visitaram 2+ páginas na sessão' },
        { id: 'engagement', name: 'Engajamento', shortName: 'Engajar', count: engagementCount, percentage: 0, dropoff: 0, description: 'Retornaram em outro dia' },
        { id: 'consumption', name: 'Consumo', shortName: 'Consumir', count: consumptionCount, percentage: 0, dropoff: 0, description: 'Acessaram Guia ou SanarClass' },
        { id: 'retention', name: 'Retenção', shortName: 'Reter', count: retentionCount, percentage: 0, dropoff: 0, description: 'Ativos em múltiplas semanas' },
      ];

      // Calculate percentages and dropoffs
      stages.forEach((stage, i) => {
        stage.percentage = firstAccessCount > 0 ? Math.round((stage.count / firstAccessCount) * 100) : 0;
        if (i > 0) {
          const prevCount = stages[i - 1].count;
          stage.dropoff = prevCount > 0 ? Math.round(((prevCount - stage.count) / prevCount) * 100) : 0;
        }
      });

      // Taxa de engajamento profundo (chegou até consumo)
      const deepEngagementRate = firstAccessCount > 0 ? Math.round((consumptionCount / firstAccessCount) * 100) : 0;

      return {
        stages,
        totalUsers: firstAccessCount,
        conversionRate: deepEngagementRate,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  // Query 3: Behavioral Segments
  const segmentsQuery = useQuery({
    queryKey: ['journey-segments', iesId, excludedIES, startDate.toISOString(), endDate.toISOString(), Array.from(adminIds)],
    queryFn: async (): Promise<BehavioralSegmentsData> => {
      let sessionsQuery = supabase
        .from('user_sessions')
        .select('user_id, started_at, ies_id')
        .gte('started_at', startDate.toISOString())
        .lte('started_at', endDate.toISOString());
      
      if (iesId) sessionsQuery = sessionsQuery.eq('ies_id', iesId);
      
      const { data: sessions } = await sessionsQuery;
      let filteredSessions = sessions || [];
      
      // Exclude admin users
      filteredSessions = filteredSessions.filter(s => !adminIds.has(s.user_id));
      
      if (excludedIES?.length) {
        filteredSessions = filteredSessions.filter(s => !excludedIES.includes(s.ies_id || ''));
      }

      // Count unique days per user
      const userDays = new Map<string, Set<string>>();
      filteredSessions.forEach(s => {
        const day = format(new Date(s.started_at), 'yyyy-MM-dd');
        if (!userDays.has(s.user_id)) userDays.set(s.user_id, new Set());
        userDays.get(s.user_id)!.add(day);
      });

      // Segment by day count (B2B: foco em frequencia, nao risco de cancelamento)
      let powerUsers = 0, regulars = 0, ocasionais = 0, baixaFrequencia = 0;
      userDays.forEach((days) => {
        const count = days.size;
        if (count >= 7) powerUsers++;
        else if (count >= 4) regulars++;
        else if (count >= 2) ocasionais++;
        else baixaFrequencia++;
      });

      const totalUsers = userDays.size;

      return {
        segments: [
          { id: 'power', name: 'Power Users', description: '7+ dias de acesso', count: powerUsers, percentage: totalUsers > 0 ? Math.round((powerUsers / totalUsers) * 100) : 0, trend: 'stable', color: 'hsl(var(--chart-1))' },
          { id: 'regular', name: 'Regulares', description: '4-6 dias', count: regulars, percentage: totalUsers > 0 ? Math.round((regulars / totalUsers) * 100) : 0, trend: 'stable', color: 'hsl(var(--chart-2))' },
          { id: 'occasional', name: 'Ocasionais', description: '2-3 dias', count: ocasionais, percentage: totalUsers > 0 ? Math.round((ocasionais / totalUsers) * 100) : 0, trend: 'stable', color: 'hsl(var(--chart-3))' },
          { id: 'low_frequency', name: 'Baixa Frequência', description: '1 dia apenas', count: baixaFrequencia, percentage: totalUsers > 0 ? Math.round((baixaFrequencia / totalUsers) * 100) : 0, trend: 'stable', color: 'hsl(var(--muted-foreground))' },
        ],
        totalUsers,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  // Query 4: Retention Cohort
  const retentionQuery = useQuery({
    queryKey: ['journey-retention', iesId, excludedIES, Array.from(adminIds)],
    queryFn: async (): Promise<RetentionCohortData> => {
      const now = new Date();
      const fiveWeeksAgo = subDays(now, 35);

      let sessionsQuery = supabase
        .from('user_sessions')
        .select('user_id, started_at, ies_id')
        .gte('started_at', fiveWeeksAgo.toISOString());
      
      if (iesId) sessionsQuery = sessionsQuery.eq('ies_id', iesId);
      
      const { data: sessions } = await sessionsQuery;
      let filteredSessions = sessions || [];
      
      // Exclude admin users
      filteredSessions = filteredSessions.filter(s => !adminIds.has(s.user_id));
      
      if (excludedIES?.length) {
        filteredSessions = filteredSessions.filter(s => !excludedIES.includes(s.ies_id || ''));
      }

      // Group by user's first session week
      const userFirstWeek = new Map<string, Date>();
      const userActivityDates = new Map<string, Set<string>>();
      
      filteredSessions.forEach(s => {
        const sessionDate = new Date(s.started_at);
        const weekStart = startOfWeek(sessionDate, { weekStartsOn: 1 });
        
        if (!userFirstWeek.has(s.user_id) || weekStart < userFirstWeek.get(s.user_id)!) {
          userFirstWeek.set(s.user_id, weekStart);
        }
        
        if (!userActivityDates.has(s.user_id)) userActivityDates.set(s.user_id, new Set());
        userActivityDates.get(s.user_id)!.add(format(sessionDate, 'yyyy-MM-dd'));
      });

      // Build cohort data for last 4 weeks
      const cohorts: RetentionCohortData['cohorts'] = [];
      
      for (let i = 4; i >= 0; i--) {
        const cohortStart = startOfWeek(subDays(now, i * 7), { weekStartsOn: 1 });
        const cohortEnd = subDays(startOfWeek(subDays(now, (i - 1) * 7), { weekStartsOn: 1 }), 1);
        
        // Find users whose first session was in this week
        const cohortUsers: string[] = [];
        userFirstWeek.forEach((firstWeek, userId) => {
          if (format(firstWeek, 'yyyy-MM-dd') === format(cohortStart, 'yyyy-MM-dd')) {
            cohortUsers.push(userId);
          }
        });

        if (cohortUsers.length === 0) continue;

        const weeks: RetentionCohortData['cohorts'][0]['weeks'] = [];
        
        for (let w = 0; w <= Math.min(4 - i, 4); w++) {
          const weekStart = subDays(cohortStart, -w * 7);
          const weekEnd = subDays(weekStart, -6);
          
          let retained = 0;
          cohortUsers.forEach(userId => {
            const activityDates = userActivityDates.get(userId);
            if (activityDates) {
              const hasActivityInWeek = Array.from(activityDates).some(dateStr => {
                const date = new Date(dateStr);
                return date >= weekStart && date <= weekEnd;
              });
              if (hasActivityInWeek) retained++;
            }
          });

          weeks.push({
            week: w,
            retained,
            percentage: Math.round((retained / cohortUsers.length) * 100),
          });
        }

        cohorts.push({
          cohortDate: format(cohortStart, 'yyyy-MM-dd'),
          cohortLabel: format(cohortStart, 'dd/MM'),
          initialUsers: cohortUsers.length,
          weeks,
        });
      }

      // Calculate average retention
      const week1Retentions = cohorts
        .filter(c => c.weeks.length > 1)
        .map(c => c.weeks[1]?.percentage || 0);
      const week4Retentions = cohorts
        .filter(c => c.weeks.length > 4)
        .map(c => c.weeks[4]?.percentage || 0);

      return {
        cohorts,
        avgRetentionWeek1: week1Retentions.length > 0 
          ? Math.round(week1Retentions.reduce((a, b) => a + b, 0) / week1Retentions.length)
          : 0,
        avgRetentionWeek4: week4Retentions.length > 0
          ? Math.round(week4Retentions.reduce((a, b) => a + b, 0) / week4Retentions.length)
          : 0,
      };
    },
    staleTime: 10 * 60 * 1000,
  });

  // Query 5: Study vs Performance Correlation
  const studyCorrelationQuery = useQuery({
    queryKey: ['journey-study-correlation', iesId, excludedIES, startDate.toISOString(), endDate.toISOString(), Array.from(adminIds)],
    queryFn: async (): Promise<StudyVsPerformanceData> => {
      // Get study progress (lessons completed)
      const { data: studyProgress } = await supabase
        .from('study_progress')
        .select('user_id, materia_id, completed')
        .eq('completed', true);

      // Get answers with questions to get grande_area
      const { data: answers } = await supabase
        .from('answer_progress')
        .select(`
          user_id,
          correct,
          question_id,
          questoes_simulado!inner(grande_area)
        `)
        .order('answer_id');

      // Filter out admin users
      const filteredStudy = (studyProgress || []).filter(s => s.user_id && !adminIds.has(s.user_id));
      const filteredAnswers = (answers || []).filter((a: any) => a.user_id && !adminIds.has(a.user_id));

      // Check if we have enough data
      if (filteredStudy.length < 10 || filteredAnswers.length < 10) {
        return {
          studyBands: [],
          areaCorrelation: [],
          correlationCoefficient: 0,
          topInsights: [],
          totalLessonsCompleted: filteredStudy.length,
          totalAnswers: filteredAnswers.length,
          hasEnoughData: false,
        };
      }

      // Map study progress to areas
      const userAreaStudy = new Map<string, Map<string, number>>();
      filteredStudy.forEach(s => {
        const area = mapMateriaToArea(s.materia_id);
        if (!area) return;
        
        if (!userAreaStudy.has(s.user_id)) {
          userAreaStudy.set(s.user_id, new Map());
        }
        const userMap = userAreaStudy.get(s.user_id)!;
        userMap.set(area, (userMap.get(area) || 0) + 1);
      });

      // Aggregate answers by user and area
      const userAreaAnswers = new Map<string, Map<string, { correct: number; total: number }>>();
      filteredAnswers.forEach((a: any) => {
        const area = a.questoes_simulado?.grande_area;
        if (!area || !a.user_id) return;
        
        if (!userAreaAnswers.has(a.user_id)) {
          userAreaAnswers.set(a.user_id, new Map());
        }
        const userMap = userAreaAnswers.get(a.user_id)!;
        if (!userMap.has(area)) {
          userMap.set(area, { correct: 0, total: 0 });
        }
        const stats = userMap.get(area)!;
        stats.total++;
        if (a.correct) stats.correct++;
      });

      // Calculate user-level metrics for study bands
      const userMetrics: { lessonsCompleted: number; accuracy: number }[] = [];
      const allUserIds = new Set([...userAreaStudy.keys(), ...userAreaAnswers.keys()]);
      
      allUserIds.forEach(userId => {
        const studyMap = userAreaStudy.get(userId);
        const answerMap = userAreaAnswers.get(userId);
        
        const lessonsCompleted = studyMap 
          ? Array.from(studyMap.values()).reduce((sum, v) => sum + v, 0) 
          : 0;
        
        let totalCorrect = 0;
        let totalAnswers = 0;
        if (answerMap) {
          answerMap.forEach(stats => {
            totalCorrect += stats.correct;
            totalAnswers += stats.total;
          });
        }
        
        if (totalAnswers > 0) {
          const accuracy = Math.round((totalCorrect / totalAnswers) * 100);
          userMetrics.push({ lessonsCompleted, accuracy });
        }
      });

      // Create study bands
      const bands = [
        { band: '0', min: 0, max: 0 },
        { band: '1-5', min: 1, max: 5 },
        { band: '6-15', min: 6, max: 15 },
        { band: '16-30', min: 16, max: 30 },
        { band: '31+', min: 31, max: Infinity },
      ];

      const studyBands = bands.map(({ band, min, max }) => {
        const usersInBand = userMetrics.filter(u => u.lessonsCompleted >= min && u.lessonsCompleted <= max);
        const avgAccuracy = usersInBand.length > 0
          ? Math.round(usersInBand.reduce((sum, u) => sum + u.accuracy, 0) / usersInBand.length)
          : 0;
        
        return {
          band,
          avgAccuracy,
          userCount: usersInBand.length,
          lessonsCompleted: usersInBand.reduce((sum, u) => sum + u.lessonsCompleted, 0),
        };
      }).filter(b => b.userCount > 0);

      // Calculate area correlation
      const allAreas = new Set<string>();
      userAreaStudy.forEach(map => map.forEach((_, area) => allAreas.add(area)));
      userAreaAnswers.forEach(map => map.forEach((_, area) => allAreas.add(area)));

      // Get total lessons per area for percentage calculation
      const areaLessonTotals = new Map<string, number>();
      filteredStudy.forEach(s => {
        const area = mapMateriaToArea(s.materia_id);
        if (area) {
          areaLessonTotals.set(area, (areaLessonTotals.get(area) || 0) + 1);
        }
      });
      const maxLessons = Math.max(...Array.from(areaLessonTotals.values()), 1);

      const areaCorrelation = Array.from(allAreas).map(area => {
        let totalStudy = 0;
        let totalCorrect = 0;
        let totalAnswersInArea = 0;
        
        userAreaStudy.forEach(map => {
          totalStudy += map.get(area) || 0;
        });
        
        userAreaAnswers.forEach(map => {
          const stats = map.get(area);
          if (stats) {
            totalCorrect += stats.correct;
            totalAnswersInArea += stats.total;
          }
        });

        const studyPercentage = Math.round((totalStudy / maxLessons) * 100);
        const accuracy = totalAnswersInArea > 0 
          ? Math.round((totalCorrect / totalAnswersInArea) * 100) 
          : 0;
        
        const gap = determineGapType(studyPercentage, accuracy);

        return {
          area,
          studyPercentage,
          accuracy,
          gap,
          lessonsCompleted: totalStudy,
          totalLessons: areaLessonTotals.get(area) || 0,
          answersCorrect: totalCorrect,
          totalAnswers: totalAnswersInArea,
        };
      })
      .filter(a => a.totalAnswers >= 5) // Need at least 5 answers for meaningful data
      .sort((a, b) => b.totalAnswers - a.totalAnswers);

      // Calculate Pearson correlation
      const correlationData = userMetrics
        .filter(u => u.lessonsCompleted > 0)
        .map(u => ({ study: u.lessonsCompleted, accuracy: u.accuracy }));
      
      const correlationCoefficient = calculatePearsonCorrelation(correlationData);

      // Generate insights
      const topInsights = generateCorrelationInsights(studyBands, areaCorrelation, correlationCoefficient);

      return {
        studyBands,
        areaCorrelation,
        correlationCoefficient,
        topInsights,
        totalLessonsCompleted: filteredStudy.length,
        totalAnswers: filteredAnswers.length,
        hasEnoughData: true,
      };
    },
    staleTime: 10 * 60 * 1000,
  });

  // Query 6: Engagement Depth
  const engagementQuery = useQuery({
    queryKey: ['journey-engagement', iesId, excludedIES, startDate.toISOString(), endDate.toISOString(), Array.from(adminIds)],
    queryFn: async (): Promise<EngagementDepthData> => {
      let sessionsQuery = supabase
        .from('user_sessions')
        .select('user_id, pages_visited, duration_seconds, started_at, ies_id')
        .gte('started_at', startDate.toISOString())
        .lte('started_at', endDate.toISOString());
      
      if (iesId) sessionsQuery = sessionsQuery.eq('ies_id', iesId);
      
      const { data: sessions } = await sessionsQuery;
      let filteredSessions = sessions || [];
      
      // Exclude admin users
      filteredSessions = filteredSessions.filter(s => !adminIds.has(s.user_id));
      
      if (excludedIES?.length) {
        filteredSessions = filteredSessions.filter(s => !excludedIES.includes(s.ies_id || ''));
      }

      // Session depth buckets
      const depthBuckets = { '1 página': 0, '2-3 páginas': 0, '4-6 páginas': 0, '7+ páginas': 0 };
      filteredSessions.forEach(s => {
        const pages = s.pages_visited || 0;
        if (pages <= 1) depthBuckets['1 página']++;
        else if (pages <= 3) depthBuckets['2-3 páginas']++;
        else if (pages <= 6) depthBuckets['4-6 páginas']++;
        else depthBuckets['7+ páginas']++;
      });

      const totalSessions = filteredSessions.length;
      const sessionDepth = Object.entries(depthBuckets).map(([bucket, count]) => ({
        bucket,
        count,
        percentage: totalSessions > 0 ? Math.round((count / totalSessions) * 100) : 0,
      }));

      // Average pages per session
      const avgPagesPerSession = totalSessions > 0
        ? Math.round(filteredSessions.reduce((sum, s) => sum + (s.pages_visited || 0), 0) / totalSessions * 10) / 10
        : 0;

      // Average time on platform (minutes)
      const avgTimeOnPlatform = totalSessions > 0
        ? Math.round(filteredSessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / totalSessions / 60 * 10) / 10
        : 0;

      // Heatmap data (day of week x hour)
      const heatmap: EngagementDepthData['heatmap'] = [];
      const heatmapCounts = new Map<string, number>();
      
      filteredSessions.forEach(s => {
        const date = new Date(s.started_at);
        const dayOfWeek = date.getDay();
        const hour = date.getHours();
        const key = `${dayOfWeek}-${hour}`;
        heatmapCounts.set(key, (heatmapCounts.get(key) || 0) + 1);
      });

      for (let d = 0; d < 7; d++) {
        for (let h = 0; h < 24; h++) {
          const key = `${d}-${h}`;
          heatmap.push({
            dayOfWeek: d,
            hour: h,
            value: heatmapCounts.get(key) || 0,
          });
        }
      }

      // Find peak
      let peakDay = 'Segunda';
      let peakHour = 0;
      let maxValue = 0;
      heatmap.forEach(cell => {
        if (cell.value > maxValue) {
          maxValue = cell.value;
          peakDay = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][cell.dayOfWeek];
          peakHour = cell.hour;
        }
      });

      return {
        sessionDepth,
        avgPagesPerSession,
        avgTimeOnPlatform,
        heatmap,
        peakDay,
        peakHour,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  // Generate Smart Insights
  const insights: SmartInsight[] = [];
  
  if (executiveQuery.data) {
    const exec = executiveQuery.data;
    
    if (exec.stickiness < 20) {
      insights.push({
        id: 'low-stickiness',
        type: 'risk',
        severity: 'warning',
        title: 'Stickiness baixo',
        description: `Apenas ${exec.stickiness}% dos usuários mensais retornam diariamente. Considere implementar notificações push ou gamificação.`,
        metric: 'Stickiness',
        value: exec.stickiness,
        action: 'Implementar lembretes diários',
        dataSource: 'user_sessions',
      });
    }
    
    if (exec.calendarAdoption < 20) {
      insights.push({
        id: 'low-calendar',
        type: 'opportunity',
        severity: 'info',
        title: 'Calendário subutilizado',
        description: `Apenas ${exec.calendarAdoption}% dos usuários ativos usam o calendário. Esta feature pode aumentar engajamento.`,
        metric: 'Adoção do Calendário',
        value: exec.calendarAdoption,
        action: 'Promover feature na onboarding',
        dataSource: 'calendar_subjects',
      });
    }

    if (exec.lowEngagementCount > 0) {
      insights.push({
        id: 'low-engagement',
        type: 'opportunity',
        severity: exec.lowEngagementCount > 20 ? 'warning' : 'info',
        title: `${exec.lowEngagementCount} alunos com baixa atividade`,
        description: 'Estes alunos acessaram apenas 1 vez nas últimas 2 semanas. Considere ações de ativação como lembretes ou comunicação via coordenação.',
        metric: 'Baixa Atividade',
        value: exec.lowEngagementCount,
        action: 'Notificar coordenação',
        dataSource: 'user_sessions',
      });
    }

    if (exec.neverActiveCount > 0 && exec.activationRate < 80) {
      insights.push({
        id: 'never-active',
        type: 'opportunity',
        severity: exec.activationRate < 50 ? 'warning' : 'info',
        title: `${exec.neverActiveCount} alunos nunca acessaram`,
        description: `Taxa de ativação de ${exec.activationRate}%. Alguns alunos matriculados ainda não conhecem a plataforma.`,
        metric: 'Taxa de Ativação',
        value: exec.activationRate,
        action: 'Campanha de onboarding',
        dataSource: 'users + user_sessions',
      });
    }

    if (exec.activationRate >= 80) {
      insights.push({
        id: 'good-activation',
        type: 'positive',
        severity: 'success',
        title: `Taxa de ativação de ${exec.activationRate}%`,
        description: 'A maioria dos alunos matriculados já acessou a plataforma pelo menos uma vez.',
        metric: 'Ativação',
        value: exec.activationRate,
        dataSource: 'users + user_sessions',
      });
    }
  }

  if (studyCorrelationQuery.data?.hasEnoughData) {
    const correlation = studyCorrelationQuery.data;
    
    // Insights based on correlation coefficient
    if (correlation.correlationCoefficient > 0.5) {
      insights.push({
        id: 'strong-correlation',
        type: 'positive',
        severity: 'success',
        title: 'Forte correlação estudo-desempenho',
        description: `Coeficiente de ${correlation.correlationCoefficient.toFixed(2)} indica que alunos que estudam mais têm melhor desempenho.`,
        metric: 'Correlação',
        value: correlation.correlationCoefficient,
        dataSource: 'study_progress + answer_progress',
      });
    } else if (correlation.correlationCoefficient < 0.2) {
      insights.push({
        id: 'weak-correlation',
        type: 'risk',
        severity: 'warning',
        title: 'Correlação estudo-desempenho fraca',
        description: 'Estudar mais não está resultando em melhor desempenho. Investigar qualidade do conteúdo.',
        metric: 'Correlação',
        value: correlation.correlationCoefficient,
        action: 'Revisar conteúdo didático',
        dataSource: 'study_progress + answer_progress',
      });
    }

    // Content gaps
    const contentGaps = correlation.areaCorrelation.filter(a => a.gap === 'content');
    if (contentGaps.length > 0) {
      insights.push({
        id: 'content-gap',
        type: 'risk',
        severity: 'warning',
        title: `Gap de conteúdo: ${contentGaps[0].area}`,
        description: `${contentGaps[0].studyPercentage}% estudo mas apenas ${contentGaps[0].accuracy}% acurácia. Revisar material.`,
        metric: 'Gap Pedagógico',
        value: contentGaps[0].accuracy,
        action: 'Revisar material didático',
        dataSource: 'study_progress + answer_progress',
      });
    }

    // Activation opportunities
    const activationGaps = correlation.areaCorrelation.filter(a => a.gap === 'activation');
    if (activationGaps.length > 0) {
      insights.push({
        id: 'activation-opportunity',
        type: 'opportunity',
        severity: 'info',
        title: `Oportunidade: ${activationGaps[0].area}`,
        description: `Apenas ${activationGaps[0].studyPercentage}% de consumo. Incentivar estudo pode melhorar desempenho.`,
        metric: 'Ativação',
        value: activationGaps[0].studyPercentage,
        action: 'Incentivar consumo de aulas',
        dataSource: 'study_progress',
      });
    }
  }

  // Generate Engagement Alerts (B2B: foco em saude institucional)
  const alerts: RiskAlert[] = [];
  
  if (executiveQuery.data) {
    const exec = executiveQuery.data;
    
    // Alerta de baixa atividade (substituiu churn)
    if (exec.lowEngagementCount > 10) {
      alerts.push({
        id: 'low-engagement-alert',
        level: 'warning',
        title: `${exec.lowEngagementCount} alunos com baixa atividade`,
        description: 'Acessaram apenas 1 vez nas últimas 2 semanas',
        count: exec.lowEngagementCount,
        trend: 'stable',
      });
    }

    // Alerta de ativacao
    if (exec.activationRate < 60) {
      alerts.push({
        id: 'activation-alert',
        level: exec.activationRate < 40 ? 'critical' : 'warning',
        title: `Taxa de ativação: ${exec.activationRate}%`,
        description: `${exec.neverActiveCount} alunos matriculados nunca acessaram`,
        percentage: exec.activationRate,
        trend: 'stable',
      });
    }

    if (exec.stickiness >= 30) {
      alerts.push({
        id: 'stickiness-positive',
        level: 'positive',
        title: `Stickiness de ${exec.stickiness}%`,
        description: 'Alunos estão retornando regularmente',
        percentage: exec.stickiness,
        trend: 'up',
      });
    }

    if (exec.activationRate >= 80) {
      alerts.push({
        id: 'activation-positive',
        level: 'positive',
        title: `${exec.activationRate}% dos alunos ativados`,
        description: 'Excelente taxa de ativação da turma',
        percentage: exec.activationRate,
        trend: 'up',
      });
    }
  }

  if (studyCorrelationQuery.data?.hasEnoughData) {
    const gaps = studyCorrelationQuery.data.areaCorrelation.filter(a => a.accuracy < 50);
    if (gaps.length > 0) {
      alerts.push({
        id: 'learning-gaps',
        level: 'warning',
        title: `${gaps.length} área(s) com acurácia < 50%`,
        description: gaps.map(g => g.area).join(', '),
        count: gaps.length,
      });
    }
  }

  if (retentionQuery.data && retentionQuery.data.avgRetentionWeek1 >= 50) {
    alerts.push({
      id: 'retention-positive',
      level: 'positive',
      title: `Retenção semana 1: ${retentionQuery.data.avgRetentionWeek1}%`,
      description: 'Maioria dos novos usuários retorna na segunda semana',
      percentage: retentionQuery.data.avgRetentionWeek1,
      trend: 'up',
    });
  }

  const isLoading = executiveQuery.isLoading || funnelQuery.isLoading || 
    segmentsQuery.isLoading || retentionQuery.isLoading || 
    studyCorrelationQuery.isLoading || engagementQuery.isLoading;

  const error = executiveQuery.error || funnelQuery.error || 
    segmentsQuery.error || retentionQuery.error || 
    studyCorrelationQuery.error || engagementQuery.error;

  return {
    executive: executiveQuery.data ?? null,
    funnel: funnelQuery.data ?? null,
    segments: segmentsQuery.data ?? null,
    retention: retentionQuery.data ?? null,
    studyCorrelation: studyCorrelationQuery.data ?? null,
    engagement: engagementQuery.data ?? null,
    insights,
    alerts,
    isLoading,
    error: error as Error | null,
  };
}
