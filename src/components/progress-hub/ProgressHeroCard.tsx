import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Rocket, RefreshCw, TrendingUp, Zap, Crown, 
  ArrowRight, Calendar, Play 
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { ProgressOverview, ProgressStreak, LastActivity, ProgressHubUser } from '@/types/progressHub';
import { STATUS_CONFIG } from '@/types/progressHub';
import { cn } from '@/lib/utils';

interface ProgressHeroCardProps {
  overview: ProgressOverview;
  streak: ProgressStreak;
  lastActivity: LastActivity | null;
  user: ProgressHubUser;
  onContinueClick?: () => void;
  onCalendarClick?: () => void;
}

const StatusIcon = ({ status }: { status: ProgressOverview['status_level'] }) => {
  const icons = {
    starting: Rocket,
    recovering: RefreshCw,
    consistent: TrendingUp,
    accelerating: Zap,
    dominating: Crown
  };
  const Icon = icons[status];
  return <Icon className="h-4 w-4" aria-hidden="true" />;
};

export const ProgressHeroCard: React.FC<ProgressHeroCardProps> = ({
  overview,
  streak,
  lastActivity,
  user,
  onContinueClick,
  onCalendarClick
}) => {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  const statusConfig = STATUS_CONFIG[overview.status_level] || STATUS_CONFIG.starting;

  const handleContinue = () => {
    onContinueClick?.();
    if (lastActivity) {
      const params = new URLSearchParams();
      if (lastActivity.materia) params.set('materia', lastActivity.materia);
      if (lastActivity.tema) params.set('tema', lastActivity.tema);
      navigate(`/guia-estudos?${params.toString()}`);
    } else {
      navigate('/guia-estudos');
    }
  };

  const handleOpenCalendar = () => {
    onCalendarClick?.();
    navigate('/guia-estudos?view=calendar&edit=true');
  };

  // Animation variants with reduced motion support
  const getAnimationProps = (props: object) => shouldReduceMotion ? {} : props;

  return (
    <Card 
      className={cn(
        "relative overflow-hidden border-0",
        "bg-gradient-to-br from-primary/5 via-background to-primary/10",
        "dark:from-primary/10 dark:via-background dark:to-primary/5",
        "shadow-sm hover:shadow-md transition-shadow duration-300"
      )}
      role="region"
      aria-label="Resumo do progresso"
    >
      {/* Subtle pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]" aria-hidden="true">
        <div className="absolute inset-0 [background-image:radial-gradient(circle_at_1px_1px,currentColor_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>

      <CardContent className="relative p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:gap-5">
          {/* Top row: Progress circle + status + streak */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Left: Progress circle + status */}
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Progress ring */}
              <motion.div 
                className="relative shrink-0"
                {...getAnimationProps({
                  initial: { scale: 0.8, opacity: 0 },
                  animate: { scale: 1, opacity: 1 },
                  transition: { duration: 0.5, ease: 'easeOut' }
                })}
              >
                <svg 
                  className="w-20 h-20 sm:w-24 sm:h-24 -rotate-90"
                  role="img"
                  aria-label={`Progresso: ${overview.percentage}% concluído`}
                >
                  {/* Background circle */}
                  <circle
                    cx="50%"
                    cy="50%"
                    r="45%"
                    strokeWidth="8"
                    fill="none"
                    className="stroke-muted"
                  />
                  {/* Progress circle */}
                  <motion.circle
                    cx="50%"
                    cy="50%"
                    r="45%"
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                    className="stroke-primary"
                    initial={shouldReduceMotion ? { pathLength: overview.percentage / 100 } : { pathLength: 0 }}
                    animate={{ pathLength: overview.percentage / 100 }}
                    transition={shouldReduceMotion ? {} : { duration: 1, ease: 'easeOut', delay: 0.2 }}
                    style={{
                      strokeDasharray: '283',
                      strokeDashoffset: `calc(283 - (283 * ${overview.percentage}) / 100)`
                    }}
                  />
                </svg>
                {/* Center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.span 
                    className="text-xl sm:text-2xl font-bold"
                    {...getAnimationProps({
                      initial: { opacity: 0 },
                      animate: { opacity: 1 },
                      transition: { delay: 0.5 }
                    })}
                  >
                    {overview.percentage}%
                  </motion.span>
                  <span className="text-[10px] text-muted-foreground">concluído</span>
                </div>
              </motion.div>

              {/* Status + numbers */}
              <div className="flex flex-col gap-1.5 min-w-0">
                {/* Status badge */}
                <motion.div 
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium w-fit",
                    statusConfig.color
                  )}
                  {...getAnimationProps({
                    initial: { opacity: 0, x: -10 },
                    animate: { opacity: 1, x: 0 },
                    transition: { delay: 0.3 }
                  })}
                >
                  <StatusIcon status={overview.status_level} />
                  <span>{overview.status_message}</span>
                </motion.div>

                {/* Stats */}
                <motion.div 
                  className="space-y-0.5"
                  {...getAnimationProps({
                    initial: { opacity: 0 },
                    animate: { opacity: 1 },
                    transition: { delay: 0.4 }
                  })}
                >
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">{overview.completed}</span> de {overview.total} aulas
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{overview.total_materias}</span> matérias • <span className="font-medium text-foreground">{overview.total_temas}</span> temas
                  </p>
                </motion.div>
              </div>
            </div>

            {/* Streak mini card - moves to right on sm+ */}
            <motion.div 
              className="flex items-center gap-2 sm:gap-3 bg-muted/50 rounded-lg px-3 py-2 w-fit shrink-0"
              role="status"
              aria-label={`Atividade semanal: ${streak.active_days_week} de ${streak.goal} dias`}
              {...getAnimationProps({
                initial: { opacity: 0, y: 10 },
                animate: { opacity: 1, y: 0 },
                transition: { delay: 0.5 }
              })}
            >
              <div className="flex items-center gap-1" aria-hidden="true">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-2.5 h-2.5 rounded-sm transition-colors",
                      streak.active_days_of_week?.includes(i)
                        ? "bg-primary"
                        : "bg-muted-foreground/20"
                    )}
                  />
                ))}
              </div>
              <div className="text-sm whitespace-nowrap">
                <span className="font-semibold">{streak.active_days_week}</span>
                <span className="text-muted-foreground">/{streak.goal} dias</span>
              </div>
            </motion.div>
          </div>

          {/* Bottom row: CTAs */}
          <motion.div 
            className="flex flex-row gap-2"
            {...getAnimationProps({
              initial: { opacity: 0, y: 10 },
              animate: { opacity: 1, y: 0 },
              transition: { delay: 0.6 }
            })}
          >
            <Button 
              onClick={handleContinue}
              size="default"
              className={cn(
                "gap-2 justify-center flex-1 sm:flex-none",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "transition-all duration-200 hover:shadow-md active:scale-[0.98]"
              )}
            >
              <Play className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Continuar</span>
            </Button>
            <Button 
              onClick={handleOpenCalendar}
              variant="outline"
              size="default"
              className={cn(
                "gap-2 justify-center flex-1 sm:flex-none",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "transition-all duration-200 hover:shadow-sm active:scale-[0.98]"
              )}
            >
              <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Organizar</span>
            </Button>
          </motion.div>
        </div>
      </CardContent>
    </Card>
  );
};
