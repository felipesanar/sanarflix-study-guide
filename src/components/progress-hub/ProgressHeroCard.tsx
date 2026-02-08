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
  const statusConfig = STATUS_CONFIG[overview.status_level];

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

      <CardContent className="relative p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 sm:gap-6">
          {/* Left: Progress circle + status */}
          <div className="flex items-center gap-4 lg:gap-6">
            {/* Progress ring */}
            <motion.div 
              className="relative"
              {...getAnimationProps({
                initial: { scale: 0.8, opacity: 0 },
                animate: { scale: 1, opacity: 1 },
                transition: { duration: 0.5, ease: 'easeOut' }
              })}
            >
              <svg 
                className="w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 -rotate-90"
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
                  className="text-2xl sm:text-3xl lg:text-4xl font-bold"
                  {...getAnimationProps({
                    initial: { opacity: 0 },
                    animate: { opacity: 1 },
                    transition: { delay: 0.5 }
                  })}
                >
                  {overview.percentage}%
                </motion.span>
                <span className="text-[10px] sm:text-xs text-muted-foreground">concluído</span>
              </div>
            </motion.div>

            {/* Status + numbers */}
            <div className="flex flex-col gap-2">
              {/* Status badge */}
              <motion.div 
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium w-fit",
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
                className="space-y-1"
                {...getAnimationProps({
                  initial: { opacity: 0 },
                  animate: { opacity: 1 },
                  transition: { delay: 0.4 }
                })}
              >
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{overview.completed}</span> de {overview.total} aulas
                </p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{overview.total_materias}</span> matérias • <span className="font-semibold text-foreground">{overview.total_temas}</span> temas
                </p>
              </motion.div>
            </div>
          </div>

          {/* Right: Streak + CTAs */}
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 lg:flex-1 lg:justify-end">
            {/* Streak mini card */}
            <motion.div 
              className="flex items-center gap-3 bg-muted/50 rounded-xl px-4 py-3 shrink-0 w-full sm:w-auto"
              role="status"
              aria-label={`Atividade semanal: ${streak.active_days_week} de ${streak.goal} dias`}
              {...getAnimationProps({
                initial: { opacity: 0, y: 10 },
                animate: { opacity: 1, y: 0 },
                transition: { delay: 0.5 }
              })}
            >
              <div className="flex items-center gap-1.5" aria-hidden="true">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-3 h-3 rounded-sm transition-colors",
                      streak.active_days_of_week?.includes(i)
                        ? "bg-primary"
                        : "bg-muted-foreground/20"
                    )}
                  />
                ))}
              </div>
              <div className="text-sm">
                <span className="font-semibold">{streak.active_days_week}</span>
                <span className="text-muted-foreground">/{streak.goal} dias</span>
              </div>
            </motion.div>

            {/* CTAs */}
            <motion.div 
              className="flex flex-col sm:flex-row flex-wrap gap-2 w-full sm:w-auto"
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
                  "gap-2 flex-1 sm:flex-initial min-w-[140px] justify-center",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "transition-all duration-200 hover:shadow-md active:scale-[0.98]"
                )}
              >
                <Play className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="hidden md:inline">Continuar de onde parei</span>
                <span className="md:hidden">Continuar</span>
              </Button>
              <Button 
                onClick={handleOpenCalendar}
                variant="outline"
                size="default"
                className={cn(
                  "gap-2 flex-1 sm:flex-initial min-w-[120px] justify-center",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "transition-all duration-200 hover:shadow-sm active:scale-[0.98]"
                )}
              >
                <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="hidden md:inline">Organizar semana</span>
                <span className="md:hidden">Organizar</span>
              </Button>
            </motion.div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
