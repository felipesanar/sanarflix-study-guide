import React, { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { BarChart3, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProgressHub } from '@/hooks/useProgressHub';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalyticsTracker } from '@/hooks/useAnalyticsTracker';
import {
  ProgressHeroCard,
  NextActionsCard,
  ConsistencyCard,
  SemesterMapCard,
  WeeklyEvolutionCard,
  ProgressHubSkeleton
} from '@/components/progress-hub';
import type { NextAction } from '@/types/progressHub';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { trackEvent } = useAnalyticsTracker();
  const shouldReduceMotion = useReducedMotion();
  const hasTrackedView = useRef(false);
  const { 
    data, 
    loading, 
    error, 
    syncing, 
    refresh, 
    completeTheme 
  } = useProgressHub();

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
        }
      });
      hasTrackedView.current = true;
    }
  }, [data, trackEvent]);

  // Track continue click
  const handleContinueClick = () => {
    trackEvent({
      eventName: 'navigate_to_guide_from_hub',
      category: 'navigation',
      data: {
        source: 'hero_card_continue',
        target: '/guia-estudos',
        has_last_activity: !!data?.last_activity,
      }
    });
  };

  // Track calendar edit click
  const handleCalendarClick = () => {
    trackEvent({
      eventName: 'calendar_edit_from_hub',
      category: 'navigation',
      data: { source: 'hero_card' }
    });
  };

  // Track next action click
  const handleActionClick = (action: NextAction, actionType: 'view' | 'video' | 'pdf' | 'quiz') => {
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
  };

  // Track theme complete
  const handleCompleteTheme = async (materia: string, tema: string) => {
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
  };

  // Track theme view click
  const handleThemeClick = (materia: string, tema: string) => {
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
  };

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

  return (
    <div className="min-h-screen bg-background relative">
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
          {syncing && (
            <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Sincronizando" />
          )}
        </motion.div>

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
            <ConsistencyCard streak={data.streak} />
          </motion.div>
          <motion.div variants={itemVariants}>
            <WeeklyEvolutionCard evolution={data.weekly_evolution} />
          </motion.div>
        </div>

        {/* Semester Map */}
        <motion.div variants={itemVariants}>
          <SemesterMapCard
            byMateria={data.by_materia}
            byTema={data.by_tema}
            onCompleteTheme={handleCompleteTheme}
            onThemeClick={handleThemeClick}
            syncing={syncing}
          />
        </motion.div>
      </motion.div>
    </div>
  );
};
