import React, { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, Flame, ChevronRight, Play,
  Rocket, RefreshCw, Zap, Crown
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useProgressHub } from '@/hooks/useProgressHub';
import { useAnalyticsTracker } from '@/hooks/useAnalyticsTracker';
import { STATUS_CONFIG } from '@/types/progressHub';
import { cn } from '@/lib/utils';

const StatusIcon = ({ status }: { status: string }) => {
  const icons: Record<string, React.FC<{ className?: string }>> = {
    starting: Rocket,
    recovering: RefreshCw,
    consistent: TrendingUp,
    accelerating: Zap,
    dominating: Crown
  };
  const Icon = icons[status] || TrendingUp;
  return <Icon className="h-3.5 w-3.5" />;
};

export const ProgressSummaryCard: React.FC = () => {
  const navigate = useNavigate();
  const { data, loading, error } = useProgressHub();
  const { trackEvent } = useAnalyticsTracker();
  const shouldReduceMotion = useReducedMotion();
  const hasTrackedView = useRef(false);

  // Track card view
  useEffect(() => {
    if (data && !hasTrackedView.current) {
      trackEvent({
        eventName: 'progress_summary_card_view',
        category: 'interaction',
        data: {
          percentage: data.overview.percentage,
          streak_current: data.streak.current,
          status_level: data.overview.status_level,
        }
      });
      hasTrackedView.current = true;
    }
  }, [data, trackEvent]);

  const handleViewProgress = () => {
    trackEvent({
      eventName: 'open_from_home',
      category: 'navigation',
      data: { source: 'progress_summary_card' }
    });
    navigate('/dashboard');
  };

  const handleContinueStudying = () => {
    trackEvent({
      eventName: 'navigate_to_guide_from_hub',
      category: 'navigation',
      data: {
        source: 'progress_summary_card',
        target: '/guia-estudos',
      }
    });
    
    if (data?.last_activity) {
      const params = new URLSearchParams();
      if (data.last_activity.materia) params.set('materia', data.last_activity.materia);
      if (data.last_activity.tema) params.set('tema', data.last_activity.tema);
      navigate(`/guia-estudos?${params.toString()}`);
    } else {
      navigate('/guia-estudos');
    }
  };

  // Loading state
  if (loading && !data) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state - don't show card
  if (error && !data) {
    return null;
  }

  if (!data) {
    return null;
  }

  const { overview, streak } = data;
  const statusConfig = STATUS_CONFIG[overview.status_level] || STATUS_CONFIG.starting;
  const metGoal = streak.active_days_week >= streak.goal;

  const animationProps = shouldReduceMotion 
    ? {} 
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.3 }
      };

  return (
    <motion.div {...animationProps}>
      <Card className="overflow-hidden border-primary/10 hover:border-primary/20 transition-colors">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center gap-4">
            {/* Progress Ring */}
            <div className="relative flex-shrink-0">
              <svg className="w-16 h-16 -rotate-90" aria-hidden="true">
                {/* Background circle */}
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  strokeWidth="5"
                  fill="none"
                  className="stroke-muted"
                />
                {/* Progress circle */}
                <motion.circle
                  cx="32"
                  cy="32"
                  r="28"
                  strokeWidth="5"
                  fill="none"
                  strokeLinecap="round"
                  className="stroke-primary"
                  initial={shouldReduceMotion ? { pathLength: overview.percentage / 100 } : { pathLength: 0 }}
                  animate={{ pathLength: overview.percentage / 100 }}
                  transition={shouldReduceMotion ? {} : { duration: 0.8, ease: 'easeOut' }}
                  style={{
                    strokeDasharray: '176',
                    strokeDashoffset: `calc(176 - (176 * ${overview.percentage}) / 100)`
                  }}
                />
              </svg>
              {/* Center percentage */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold" aria-label={`${overview.percentage} por cento concluído`}>
                  {overview.percentage}%
                </span>
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-2">
              {/* Status badge */}
              <div className="flex items-center gap-2 flex-wrap">
                <span 
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium",
                    statusConfig.color
                  )}
                >
                  <StatusIcon status={overview.status_level} />
                  {overview.status_message}
                </span>

                {/* Streak badge */}
                {streak.current > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                    <Flame className="h-3 w-3" />
                    {streak.current} dias
                  </span>
                )}
              </div>

              {/* Progress summary */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{overview.completed} de {overview.total} aulas</span>
                  <span className={cn(
                    metGoal ? "text-emerald-600 dark:text-emerald-400" : ""
                  )}>
                    {streak.active_days_week}/{streak.goal} dias
                  </span>
                </div>
                <Progress value={overview.percentage} className="h-1.5" />
              </div>
            </div>

            {/* CTA */}
            <Button
              variant="ghost"
              size="icon"
              className="flex-shrink-0 rounded-full h-10 w-10"
              onClick={handleViewProgress}
              aria-label="Ver Central de Progresso"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          {/* Quick action row */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
            <button 
              onClick={handleViewProgress}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
            >
              Ver progresso completo
            </button>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-xs gap-1.5"
              onClick={handleContinueStudying}
            >
              <Play className="h-3 w-3" />
              Continuar
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
