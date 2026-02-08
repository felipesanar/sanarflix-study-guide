import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BarChart3, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProgressHub } from '@/hooks/useProgressHub';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalyticsTracker } from '@/hooks/useAnalyticsTracker';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import {
  ProgressHeroCard,
  NextActionsCard,
  ConsistencyCard,
  SemesterMapCard,
  WeeklyEvolutionCard,
  ProgressHubSkeleton,
  FiltersDrawerMobile,
  FilterChips,
  RiskAlertBanner,
  EmptyState,
  PreProvaMode,
  SpacedRevisionCard,
  useMilestoneCelebration,
  type ProgressFilters,
  type MilestoneType,
} from '@/components/progress-hub';
import type { NextAction, RiskAlert, MateriaProgress } from '@/types/progressHub';

// Track milestone thresholds to trigger celebrations
const MILESTONE_THRESHOLDS: MilestoneType[] = [25, 50, 75, 100];

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { trackEvent } = useAnalyticsTracker();
  const shouldReduceMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const hasTrackedView = useRef(false);
  const previousMateriaProgress = useRef<Map<string, number>>(new Map());
  
  const { 
    data, 
    loading, 
    error, 
    syncing, 
    refresh, 
    completeTheme,
    updateStreakGoal 
  } = useProgressHub();

  // Milestone celebration
  const { showCelebration, CelebrationComponent } = useMilestoneCelebration();

  // Pre-prova mode from URL
  const isPreProvaMode = searchParams.get('mode') === 'preprova';

  // Filters state
  const [filters, setFilters] = useState<ProgressFilters>({
    status: 'all',
    materia: null,
  });

  // Track page view
  useEffect(() => {
    if (data && !hasTrackedView.current) {
      const isFirstView = data.overview.completed === 0;
      
      trackEvent({
        eventName: isFirstView ? 'progress_hub_first_view' : 'progress_hub_view',
        category: 'navigation',
        data: {
          percentage: data.overview.percentage,
          streak_current: data.streak.current,
          status_level: data.overview.status_level,
          total_materias: data.overview.total_materias,
          is_preprova_mode: isPreProvaMode,
        }
      });
      hasTrackedView.current = true;
    }
  }, [data, trackEvent, isPreProvaMode]);

  // Check for milestone achievements
  useEffect(() => {
    if (!data) return;

    // Check each materia for milestone crossing
    for (const materia of data.by_materia) {
      const prevPercentage = previousMateriaProgress.current.get(materia.materia) || 0;
      const currentPercentage = materia.percentage;

      // Find any threshold that was crossed
      for (const threshold of MILESTONE_THRESHOLDS) {
        if (prevPercentage < threshold && currentPercentage >= threshold) {
          showCelebration(threshold, materia.materia);
          
          trackEvent({
            eventName: 'milestone_achieved',
            category: 'interaction',
            data: {
              milestone: threshold,
              materia: materia.materia,
            }
          });
          break; // Only show one celebration at a time
        }
      }

      previousMateriaProgress.current.set(materia.materia, currentPercentage);
    }
  }, [data, showCelebration, trackEvent]);

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

    return { byMateria, byTema, bySubtema };
  }, [data, filters]);

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.status !== 'all') count++;
    if (filters.materia !== null) count++;
    return count;
  }, [filters]);

  // Get materias list for filter
  const materiasList = useMemo(() => {
    if (!data) return [];
    return data.by_materia.map(m => m.materia).sort();
  }, [data]);

  // Handle filter changes
  const handleFiltersChange = useCallback((newFilters: ProgressFilters) => {
    setFilters(newFilters);
    trackEvent({
      eventName: 'filter_applied',
      category: 'interaction',
      data: {
        filter_type: newFilters.status !== 'all' ? 'status' : 'materia',
        filter_value: newFilters.status !== 'all' ? newFilters.status : newFilters.materia,
      }
    });
  }, [trackEvent]);

  const handleRemoveFilter = useCallback((key: keyof ProgressFilters) => {
    setFilters(prev => ({
      ...prev,
      [key]: key === 'status' ? 'all' : null,
    }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({ status: 'all', materia: null });
  }, []);

  // Handle pre-prova mode toggle
  const handlePreProvaToggle = useCallback((active: boolean) => {
    if (active) {
      setSearchParams({ mode: 'preprova' });
      trackEvent({
        eventName: 'preprova_mode_activated',
        category: 'interaction',
        data: {}
      });
    } else {
      searchParams.delete('mode');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams, trackEvent]);

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

  // Handle risk alert dismiss
  const handleRiskDismiss = useCallback((alertId: string) => {
    trackEvent({
      eventName: 'risk_alert_dismissed',
      category: 'interaction',
      data: { alert_id: alertId }
    });
  }, [trackEvent]);

  // Handle spaced revision navigate
  const handleRevisionNavigate = useCallback((materia: string, tema: string) => {
    trackEvent({
      eventName: 'navigate_to_guide_from_hub',
      category: 'navigation',
      data: {
        source: 'spaced_revision',
        materia,
        tema,
      }
    });
  }, [trackEvent]);

  // Handle pre-prova navigate
  const handlePreProvaNavigate = useCallback((materia: string, tema: string) => {
    trackEvent({
      eventName: 'navigate_to_guide_from_hub',
      category: 'navigation',
      data: {
        source: 'preprova_checklist',
        materia,
        tema,
      }
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


  const containerVariants = shouldReduceMotion ? {} : {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 }
    }
  };

  const itemVariants = shouldReduceMotion ? {} : {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35 } }
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
                {user?.ies_nome} • {user?.semestre}º período
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {syncing && (
              <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Sincronizando" />
            )}
          </div>
        </motion.div>

        {/* Risk Alerts */}
        {data.risk_alerts && data.risk_alerts.length > 0 && !isPreProvaMode && (
          <motion.div variants={itemVariants}>
            <RiskAlertBanner
              alerts={data.risk_alerts}
              onNavigate={handleRiskNavigate}
              onDismiss={handleRiskDismiss}
            />
          </motion.div>
        )}

        {/* Pre-Prova Mode (when active, shows prominently) */}
        {isPreProvaMode && (
          <motion.div variants={itemVariants}>
            <PreProvaMode
              byTema={data.by_tema}
              onNavigate={handlePreProvaNavigate}
              onActivate={handlePreProvaToggle}
            />
          </motion.div>
        )}

        {/* Hero Card */}
        <motion.div variants={itemVariants}>
          <ProgressHeroCard
            overview={data.overview}
            streak={data.streak}
            lastActivity={data.last_activity}
            user={data.user}
            onContinueClick={handleContinueClick}
            onCalendarClick={handleCalendarClick}
          />
        </motion.div>

        {/* Grid: Next Actions + Consistency + Evolution */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div variants={itemVariants}>
            <NextActionsCard 
              actions={data.next_actions} 
              onActionClick={handleActionClick}
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <ConsistencyCard 
              streak={data.streak} 
              onGoalChange={handleGoalChange}
              syncing={syncing}
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <WeeklyEvolutionCard evolution={data.weekly_evolution} />
          </motion.div>
        </div>

        {/* Pre-Prova Toggle (when not active) + Spaced Revision */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {!isPreProvaMode && (
            <motion.div variants={itemVariants}>
              <PreProvaMode
                byTema={data.by_tema}
                onNavigate={handlePreProvaNavigate}
                onActivate={handlePreProvaToggle}
              />
            </motion.div>
          )}
          <motion.div variants={itemVariants}>
            <SpacedRevisionCard
              byTema={data.by_tema}
              onNavigate={handleRevisionNavigate}
            />
          </motion.div>
        </div>

        {/* Filters Section */}
        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Mapa do Semestre</h2>
            {/* Mobile: Filter drawer */}
            {isMobile && (
              <FiltersDrawerMobile
                filters={filters}
                materias={materiasList}
                onFiltersChange={handleFiltersChange}
                activeCount={activeFiltersCount}
              />
            )}
          </div>
          
          {/* Desktop: Inline filter chips */}
          {!isMobile && (
            <div className="flex items-center gap-2 ml-auto">
              <FiltersDrawerMobile
                filters={filters}
                materias={materiasList}
                onFiltersChange={handleFiltersChange}
                activeCount={activeFiltersCount}
              />
            </div>
          )}
        </motion.div>

        {/* Active filter chips */}
        {activeFiltersCount > 0 && (
          <motion.div variants={itemVariants}>
            <FilterChips
              filters={filters}
              onRemoveFilter={handleRemoveFilter}
              onClearAll={handleClearFilters}
            />
          </motion.div>
        )}

        {/* Semester Map or Empty State */}
        <motion.div variants={itemVariants}>
          {hasFilteredResults ? (
            <SemesterMapCard
              byMateria={filteredData.byMateria}
              byTema={filteredData.byTema}
              bySubtema={filteredData.bySubtema}
              onCompleteTheme={handleCompleteTheme}
              onThemeClick={handleThemeClick}
              syncing={syncing}
            />
          ) : (
            <EmptyState onClearFilters={handleClearFilters} />
          )}
        </motion.div>
      </motion.div>
    </div>
  );
};