import React, { useEffect, useRef, useMemo, useState, useCallback, lazy, Suspense } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { BarChart3, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useProgressHub } from '@/hooks/useProgressHub';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveSemester } from '@/hooks/useActiveSemester';
import { useAnalyticsTracker } from '@/hooks/useAnalyticsTracker';
import { usePageTimeTracking } from '@/hooks/usePageTimeTracking';
import { useIsMobile } from '@/hooks/use-mobile';
import { useUserExams, calculateExamInsight } from '@/hooks/useUserExams';
import { toast } from 'sonner';
import {
  ProgressHeroCard,
  NextActionsCard,
  ConsistencyCard,
  SemesterMapCard,
  WeeklyEvolutionCard,
  ProgressHubSkeleton,
  FiltersDrawerMobile,
  FiltersDesktop,
  FilterChips,
  RiskAlertBanner,
  EmptyState,
  DiagnosticsCard,
  CoverageRankingCard,
  ExamTrackerCard,
  useMilestoneCelebration,
  ProgressHubMobile,
  type ProgressFilters,
  type MilestoneType,
} from '@/components/progress-hub';
import type { NextAction, MateriaProgress, ExamInsight } from '@/types/progressHub';
import { AiTutorCard } from '@/components/progress-hub/mobile/AiTutorCard';
import { can } from '@/experiences/access';

// Track milestone thresholds to trigger celebrations
const MILESTONE_THRESHOLDS: MilestoneType[] = [25, 50, 75, 100];

// Helper to get localStorage key for celebrated milestones
const getMilestoneStorageKey = (userId: string, semestre: number) => 
  `celebrated_milestones_${userId}_${semestre}`;

// Type for celebrated milestones storage
type CelebratedMilestones = Record<string, MilestoneType[]>;

export const Dashboard: React.FC = () => {
  const { user, access } = useAuth();
  const { semestreAtivo, warning: semestreWarning } = useActiveSemester();
  const { trackEvent } = useAnalyticsTracker();
  const shouldReduceMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const hasTrackedView = useRef(false);
  const celebratedMilestonesRef = useRef<CelebratedMilestones>({});
  const hasInitializedMilestones = useRef(false);
  const loadStartTime = useRef(Date.now());

  // Page time tracking
  usePageTimeTracking({
    pageName: 'progress_hub',
  });
  
  const { 
    data, 
    loading, 
    error, 
    syncing, 
    refresh, 
    completeTheme,
    updateStreakGoal 
  } = useProgressHub();

  // User exams for mobile header
  const { exams } = useUserExams();

  // Calculate next exam insight for mobile header
  const nextExam = useMemo((): ExamInsight | null => {
    if (!exams || exams.length === 0 || !data) return null;
    
    // Find the nearest upcoming exam
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    const upcomingExams = exams
      .map(exam => {
        const materiaProgress = data.by_materia.find(m => m.materia === exam.materia) || null;
        return calculateExamInsight(exam, materiaProgress);
      })
      .filter(insight => insight.days_remaining >= 0)
      .sort((a, b) => a.days_remaining - b.days_remaining);
    
    return upcomingExams[0] || null;
  }, [exams, data]);

  // Milestone celebration
  const { showCelebration, CelebrationComponent } = useMilestoneCelebration();

  // Filters state
  const [filters, setFilters] = useState<ProgressFilters>({
    status: 'all',
    materia: null,
    tema: null,
    sortBy: 'alphabetical',
  });
  
  // Search query state (lifted from SemesterMapCard)
  const [mapSearchQuery, setMapSearchQuery] = useState('');

  // Track page view and initial load performance
  useEffect(() => {
    if (data && !hasTrackedView.current) {
      const isFirstView = data.overview.completed === 0;
      const loadTime = Date.now() - loadStartTime.current;
      
      trackEvent({
        eventName: isFirstView ? 'progress_hub_first_view' : 'progress_hub_view',
        category: 'navigation',
        data: {
          percentage: data.overview.percentage,
          streak_current: data.streak.current,
          status_level: data.overview.status_level,
          total_materias: data.overview.total_materias,
          has_cache: loadTime < 200,
          device: isMobile ? 'mobile' : 'desktop',
          load_time_ms: loadTime,
        }
      });

      hasTrackedView.current = true;
    }
  }, [data, trackEvent, isMobile]);

  // Initialize celebrated milestones from localStorage on first load
  useEffect(() => {
    if (!user?.id || !semestreAtivo || hasInitializedMilestones.current) return;
    
    try {
      const storageKey = getMilestoneStorageKey(user.id, semestreAtivo);
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        celebratedMilestonesRef.current = JSON.parse(stored);
      }
    } catch {
      // Ignore parse errors
    }
    hasInitializedMilestones.current = true;
  }, [user?.id, semestreAtivo]);

  // Check for milestone achievements - only triggers when data changes AFTER initialization
  useEffect(() => {
    // Wait for milestone initialization to complete
    if (!data || !user?.id || !semestreAtivo || !hasInitializedMilestones.current) return;

    const storageKey = getMilestoneStorageKey(user.id, semestreAtivo);
    let updated = false;
    let celebrationToShow: { threshold: MilestoneType; materia: string } | null = null;
    const currentCelebrated = { ...celebratedMilestonesRef.current };

    for (const materia of data.by_materia) {
      const materiaName = materia.materia;
      const currentPercentage = materia.percentage;
      const alreadyCelebrated = currentCelebrated[materiaName] || [];

      // Find milestones that were reached but not yet celebrated
      for (const threshold of MILESTONE_THRESHOLDS) {
        if (
          currentPercentage >= threshold && 
          !alreadyCelebrated.includes(threshold)
        ) {
          // Mark as celebrated in our ref
          currentCelebrated[materiaName] = [...alreadyCelebrated, threshold];
          updated = true;

          // Only show celebration if we already had some celebrated milestones
          // (meaning this isn't the first time loading the page)
          if (alreadyCelebrated.length > 0) {
            celebrationToShow = { threshold, materia: materiaName };
          }
          
          break; // Only one celebration at a time per materia
        }
      }
    }

    // Persist to localStorage and update ref if there were updates
    if (updated) {
      celebratedMilestonesRef.current = currentCelebrated;
      localStorage.setItem(storageKey, JSON.stringify(currentCelebrated));
    }

    // Show celebration after state updates (only one per render)
    if (celebrationToShow) {
      showCelebration(celebrationToShow.threshold, celebrationToShow.materia);
      
      trackEvent({
        eventName: 'milestone_achieved',
        category: 'interaction',
        data: {
          milestone: celebrationToShow.threshold,
          materia: celebrationToShow.materia,
        }
      });
    }
  }, [data, user?.id, semestreAtivo, showCelebration, trackEvent]);

  // Filter materias and temas based on filters
  const filteredData = useMemo(() => {
    if (!data) return null;

    let byMateria = data.by_materia;
    let byTema = data.by_tema;
    let bySubtema = data.by_subtema || [];

    // Filter by materia
    if (filters.materia) {
      byMateria = byMateria.filter(m => m.materia === filters.materia);
      byTema = byTema.filter(t => t.materia === filters.materia);
      bySubtema = bySubtema.filter(s => s.materia === filters.materia);
    }

    // Filter by tema
    if (filters.tema) {
      byTema = byTema.filter(t => t.tema === filters.tema);
      bySubtema = bySubtema.filter(s => s.tema === filters.tema);
    }

    // Filter by status
    if (filters.status === 'pending') {
      byMateria = byMateria.filter(m => m.percentage < 100);
      byTema = byTema.filter(t => t.percentage < 100);
      bySubtema = bySubtema.filter(s => s.percentage < 100);
    } else if (filters.status === 'completed') {
      byMateria = byMateria.filter(m => m.percentage === 100);
      byTema = byTema.filter(t => t.percentage === 100);
      bySubtema = bySubtema.filter(s => s.percentage === 100);
    }

    // Sort
    const sortFn = (a: any, b: any) => {
      switch (filters.sortBy) {
        case 'backlog':
          return (b.total - b.completed) - (a.total - a.completed);
        case 'percentage':
          return a.percentage - b.percentage;
        case 'inactive':
          return (b.days_inactive || 0) - (a.days_inactive || 0);
        default:
          return a.materia?.localeCompare(b.materia) || a.tema?.localeCompare(b.tema) || 0;
      }
    };

    return { 
      byMateria: [...byMateria].sort(sortFn), 
      byTema: [...byTema].sort(sortFn), 
      bySubtema: [...bySubtema].sort(sortFn) 
    };
  }, [data, filters]);

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.status !== 'all') count++;
    if (filters.materia !== null) count++;
    if (filters.tema !== null) count++;
    if (filters.sortBy !== 'alphabetical') count++;
    return count;
  }, [filters]);

  // Get materias list for filter
  const materiasList = useMemo(() => {
    if (!data) return [];
    return data.by_materia.map(m => m.materia).sort();
  }, [data]);

  // Get temas list for filter (dependent on selected materia)
  const temasList = useMemo(() => {
    if (!data || !filters.materia) return [];
    return data.by_tema
      .filter(t => t.materia === filters.materia)
      .map(t => t.tema)
      .sort();
  }, [data, filters.materia]);

  // Total counts for filter results
  const totalCount = useMemo(() => {
    if (!data) return 0;
    return data.by_materia.length + data.by_tema.length;
  }, [data]);

  const filteredCount = useMemo(() => {
    if (!filteredData) return 0;
    return filteredData.byMateria.length + filteredData.byTema.length;
  }, [filteredData]);

  // Handle filter changes
  const handleFiltersChange = useCallback((newFilters: ProgressFilters) => {
    setFilters(newFilters);
    trackEvent({
      eventName: 'progress_hub_filter_applied',
      category: 'interaction',
      data: {
        filter_type: newFilters.status !== 'all' ? 'status' : (newFilters.materia ? 'materia' : 'sort'),
        filter_value: newFilters.status !== 'all' ? newFilters.status : newFilters.materia || newFilters.sortBy,
        results_count: filteredCount,
      }
    });
  }, [trackEvent, filteredCount]);

  const handleRemoveFilter = useCallback((key: keyof ProgressFilters) => {
    setFilters(prev => ({
      ...prev,
      [key]: key === 'status' ? 'all' : key === 'sortBy' ? 'alphabetical' : null,
      // Reset tema if materia is being cleared
      ...(key === 'materia' ? { tema: null } : {}),
    }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({ status: 'all', materia: null, tema: null, sortBy: 'alphabetical' });
  }, []);

  // Track continue click
  const handleContinueClick = useCallback(() => {
    trackEvent({
      eventName: 'navigate_to_guide_from_hub',
      category: 'navigation',
      data: {
        source: 'hero_card_continue',
        target: '/guia-estudos',
        has_last_activity: !!data?.last_activity,
      }
    });
  }, [data, trackEvent]);

  // Track calendar edit click
  const handleCalendarClick = useCallback(() => {
    trackEvent({
      eventName: 'calendar_edit_from_hub',
      category: 'navigation',
      data: { source: 'hero_card' }
    });
  }, [trackEvent]);

  // Track next action click
  const handleActionClick = useCallback((action: NextAction, actionType: 'view' | 'video' | 'pdf' | 'quiz') => {
    trackEvent({
      eventName: 'click_next_action',
      category: 'interaction',
      data: {
        action_id: action.id,
        action_type: action.type,
        content_type: actionType,
        materia: action.materia || null,
        tema: action.tema || null,
      }
    });
  }, [trackEvent]);

  // Track theme complete
  const handleCompleteTheme = useCallback(async (materia: string, tema: string) => {
    const result = await completeTheme(materia, tema);
    
    if (result.success) {
      trackEvent({
        eventName: 'mark_theme_complete',
        category: 'interaction',
        data: {
          materia,
          tema,
          aulas_count: result.aulas_completed || 0,
        }
      });
    }
    
    return result;
  }, [completeTheme, trackEvent]);

  // Track theme view click
  const handleThemeClick = useCallback((materia: string, tema: string) => {
    trackEvent({
      eventName: 'navigate_to_guide_from_hub',
      category: 'navigation',
      data: {
        source: 'semester_map',
        target: '/guia-estudos',
        materia,
        tema,
      }
    });
  }, [trackEvent]);

  // Handle goal change
  const handleGoalChange = useCallback((goal: number) => {
    if (!data) return;
    
    const oldGoal = data.streak.goal;
    updateStreakGoal?.(goal);
    
    trackEvent({
      eventName: 'streak_goal_changed',
      category: 'interaction',
      data: {
        old_goal: oldGoal,
        new_goal: goal,
      }
    });

    toast.success(`Meta atualizada para ${goal} dias/semana`);
  }, [data, updateStreakGoal, trackEvent]);

  // Handle risk alert navigate
  const handleRiskNavigate = useCallback((materia: string, tema: string) => {
    trackEvent({
      eventName: 'navigate_to_guide_from_hub',
      category: 'navigation',
      data: {
        source: 'risk_alert',
        materia,
        tema,
      }
    });
    navigate(`/guia-estudos?materia=${encodeURIComponent(materia)}&tema=${encodeURIComponent(tema)}`);
  }, [navigate, trackEvent]);

  // Track diagnostics insight click
  const handleDiagnosticClick = useCallback((insightType: string, materia: string, tema?: string) => {
    trackEvent({
      eventName: 'progress_hub_diagnostic_clicked',
      category: 'interaction',
      data: {
        insight_type: insightType,
        materia,
        tema: tema || null,
        source_card: 'diagnostics',
      }
    });
  }, [trackEvent]);

  // Track coverage ranking click
  const handleCoverageClick = useCallback((materia: string, rank: number, direction: 'low' | 'high') => {
    trackEvent({
      eventName: 'progress_hub_coverage_ranking_clicked',
      category: 'interaction',
      data: {
        materia,
        rank_position: rank,
        direction,
      }
    });
  }, [trackEvent]);

  // Track weekly chart interaction
  const handleChartInteract = useCallback((weekIndex: number, metric: 'aulas' | '%') => {
    trackEvent({
      eventName: 'progress_hub_weekly_chart_interacted',
      category: 'interaction',
      data: {
        week_index: weekIndex,
        metric,
      }
    });
  }, [trackEvent]);

  // Track semester map toggle
  const handleSemesterMapToggle = useCallback((materia: string, tema: string, expanded: boolean) => {
    trackEvent({
      eventName: 'progress_hub_semester_map_toggled',
      category: 'interaction',
      data: {
        level: tema ? 'tema' : 'materia',
        materia,
        tema: tema || null,
        expanded,
      }
    });
  }, [trackEvent]);

  // Handle risk alert dismiss
  const handleRiskDismiss = useCallback((alertId: string) => {
    trackEvent({
      eventName: 'risk_alert_dismissed',
      category: 'interaction',
      data: { alert_id: alertId }
    });
  }, [trackEvent]);

  // Show skeleton while loading
  if (loading && !data) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <ProgressHubSkeleton />
        </div>
      </div>
    );
  }

  // Error state
  if (error && !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4" role="alert">
          <p className="text-muted-foreground">{error}</p>
          <Button 
            onClick={refresh} 
            variant="outline" 
            className="gap-2 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  // === MOBILE LAYOUT ===
  if (isMobile) {
    return (
      <>
        {/* Milestone Celebration Portal */}
        {CelebrationComponent}
        
        <ProgressHubMobile
          data={data}
          syncing={syncing}
          semestreWarning={semestreWarning}
          user={user ? { ies_nome: user.ies_nome } : undefined}
          semestreAtivo={semestreAtivo}
          nextExam={nextExam}
          filteredData={filteredData}
          filters={filters}
          materiasList={materiasList}
          temasList={temasList}
          activeFiltersCount={activeFiltersCount}
          totalCount={totalCount}
          filteredCount={filteredCount}
          onFiltersChange={handleFiltersChange}
          onRemoveFilter={handleRemoveFilter}
          onClearFilters={handleClearFilters}
          onContinueClick={handleContinueClick}
          onCalendarClick={handleCalendarClick}
          onActionClick={handleActionClick}
          onGoalChange={handleGoalChange}
          onRiskNavigate={handleRiskNavigate}
          onRiskDismiss={handleRiskDismiss}
          onDiagnosticClick={handleDiagnosticClick}
          onCoverageClick={handleCoverageClick}
          onChartInteract={handleChartInteract}
          onThemeClick={handleThemeClick}
          onSemesterMapToggle={handleSemesterMapToggle}
          onExamAdded={(materia, daysUntil) => {
            trackEvent({
              eventName: 'progress_hub_exam_added',
              category: 'interaction',
              data: { materia, days_until_exam: daysUntil, success: true }
            });
          }}
          onExamRemoved={(examId, daysUntil) => {
            trackEvent({
              eventName: 'progress_hub_exam_removed',
              category: 'interaction',
              data: { exam_id_hash: examId.substring(0, 8), days_until_exam: daysUntil }
            });
          }}
          onExamClicked={(examId, source) => {
            trackEvent({
              eventName: 'progress_hub_exam_clicked',
              category: 'interaction',
              data: { exam_id_hash: examId.substring(0, 8), source }
            });
          }}
        />
      </>
    );
  }

  // === DESKTOP LAYOUT ===
  const containerVariants = shouldReduceMotion ? {} : {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = shouldReduceMotion ? {} : {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0, transition: { duration: 0.25 } }
  };

  const hasFilteredResults = filteredData && (filteredData.byMateria.length > 0 || filteredData.byTema.length > 0);

  return (
    <div className="min-h-screen bg-background relative">
      {/* Milestone Celebration Portal */}
      {CelebrationComponent}

      {/* Background pattern */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.015] dark:opacity-[0.03]" aria-hidden="true">
        <div className="absolute inset-0 [background-image:radial-gradient(circle_at_1px_1px,currentColor_1px,transparent_1px)] [background-size:32px_32px]" />
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg" aria-hidden="true">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Central de Progresso</h1>
              <p className="text-sm text-muted-foreground">
                {user?.ies_nome} • {semestreAtivo ? `${semestreAtivo}º período` : 'Período não definido'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {syncing && (
              <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Sincronizando" />
            )}
          </div>
        </motion.div>

        {/* Semester Warning Banner */}
        {(semestreWarning || data.user?.semestre_warning) && (
          <motion.div variants={itemVariants}>
            <Alert className="border-chart-3/50 bg-chart-3/10">
              <AlertTriangle className="h-4 w-4" style={{ color: 'hsl(var(--chart-3))' }} />
              <AlertDescription className="text-foreground">
                {semestreWarning || data.user?.semestre_warning}. Os dados podem não refletir seu progresso real.
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        {/* Risk Alerts */}
        {data.risk_alerts && data.risk_alerts.length > 0 && (
          <motion.div variants={itemVariants}>
            <RiskAlertBanner
              alerts={data.risk_alerts}
              onNavigate={handleRiskNavigate}
              onDismiss={handleRiskDismiss}
            />
          </motion.div>
        )}

        {/* Main Grid Layout - 12 columns */}
        <motion.div 
          variants={containerVariants}
          className="grid grid-cols-12 gap-5 lg:gap-6"
        >
          {/* === ROW 1: Hero (8-9 cols) + Suas Provas (4-3 cols) === */}
          <motion.div variants={itemVariants} className="col-span-12 lg:col-span-8 xl:col-span-9">
            <ProgressHeroCard
              overview={data.overview}
              streak={data.streak}
              lastActivity={data.last_activity}
              user={data.user}
              onContinueClick={handleContinueClick}
              onCalendarClick={handleCalendarClick}
            />
          </motion.div>
          
          <motion.div variants={itemVariants} className="col-span-12 lg:col-span-4 xl:col-span-3">
            <ExamTrackerCard
              byMateria={data.by_materia}
              materiasList={materiasList}
              compact
              onExamAdded={(materia, daysUntil) => {
                trackEvent({
                  eventName: 'progress_hub_exam_added',
                  category: 'interaction',
                  data: { materia, days_until_exam: daysUntil, success: true }
                });
              }}
              onExamRemoved={(examId, daysUntil) => {
                trackEvent({
                  eventName: 'progress_hub_exam_removed',
                  category: 'interaction',
                  data: { exam_id_hash: examId.substring(0, 8), days_until_exam: daysUntil }
                });
              }}
              onExamClicked={(examId, source) => {
                trackEvent({
                  eventName: 'progress_hub_exam_clicked',
                  category: 'interaction',
                  data: { exam_id_hash: examId.substring(0, 8), source }
                });
              }}
            />
          </motion.div>

          {/* === ROW 2: Next Actions (6 cols) + [AI Coach + Consistency stacked] (6 cols) === */}
          <motion.div variants={itemVariants} className="col-span-12 md:col-span-6">
            <NextActionsCard 
              actions={data.next_actions} 
              onActionClick={handleActionClick}
            />
          </motion.div>
          
          <motion.div variants={itemVariants} className="col-span-12 md:col-span-6 flex flex-col gap-4 lg:gap-5">
            {can(access, 'admin.tools') && <AiTutorCard />}
            <ConsistencyCard 
              streak={data.streak} 
              onGoalChange={handleGoalChange}
              syncing={syncing}
            />
            <div className="flex-1 min-h-0 overflow-hidden">
            <DiagnosticsCard 
              byMateria={data.by_materia}
              byTema={data.by_tema}
              onInsightClick={handleDiagnosticClick}
            />
            </div>
          </motion.div>

          {/* === ROW 3: Weekly Evolution (6 cols) + Coverage (6 cols) === */}
          <motion.div variants={itemVariants} className="col-span-12 md:col-span-6">
            <WeeklyEvolutionCard 
              evolution={data.weekly_evolution}
              totalContent={data.overview.total}
              onChartInteract={handleChartInteract}
            />
          </motion.div>
          
          <motion.div variants={itemVariants} className="col-span-12 md:col-span-6">
            <CoverageRankingCard byMateria={data.by_materia} onMateriaClick={handleCoverageClick} />
          </motion.div>

          {/* === ROW 4: Filters Section === */}
          <motion.div variants={itemVariants} className="col-span-12 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <h2 className="text-lg font-semibold">Mapa do Semestre</h2>
              
              {/* Mobile: Filter drawer */}
              {isMobile && (
                <div className="ml-auto">
                  <FiltersDrawerMobile
                    filters={filters}
                    materias={materiasList}
                    temas={temasList}
                    onFiltersChange={handleFiltersChange}
                    activeCount={activeFiltersCount}
                    totalCount={totalCount}
                    filteredCount={filteredCount}
                  />
                </div>
              )}
            </div>
            
            {/* Desktop: Inline filters */}
            {!isMobile && (
              <FiltersDesktop
                filters={filters}
                materias={materiasList}
                temas={temasList}
                onFiltersChange={handleFiltersChange}
                totalCount={totalCount}
                filteredCount={filteredCount}
                searchQuery={mapSearchQuery}
                onSearchChange={setMapSearchQuery}
              />
            )}
          </motion.div>

          {/* Active filter chips (mobile only) */}
          {isMobile && activeFiltersCount > 0 && (
            <motion.div variants={itemVariants} className="col-span-12">
              <FilterChips
                filters={filters}
                onRemoveFilter={handleRemoveFilter}
                onClearAll={handleClearFilters}
              />
            </motion.div>
          )}

          {/* === ROW 5: Semester Map === */}
          <motion.div variants={itemVariants} className="col-span-12">
            {hasFilteredResults ? (
              <SemesterMapCard
                byMateria={filteredData.byMateria}
                byTema={filteredData.byTema}
                bySubtema={filteredData.bySubtema}
                onThemeClick={handleThemeClick}
                searchQuery={mapSearchQuery}
                onSearchChange={setMapSearchQuery}
              />
            ) : (
              <EmptyState onClearFilters={handleClearFilters} />
            )}
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
};