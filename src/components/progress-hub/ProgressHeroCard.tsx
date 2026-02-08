import React from 'react';
import { motion } from 'framer-motion';
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
  return <Icon className="h-4 w-4" />;
};

export const ProgressHeroCard: React.FC<ProgressHeroCardProps> = ({
  overview,
  streak,
  lastActivity,
  user
}) => {
  const navigate = useNavigate();
  const statusConfig = STATUS_CONFIG[overview.status_level];

  const handleContinue = () => {
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
    navigate('/guia-estudos?view=calendar&edit=true');
  };

  return (
    <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary/5 via-background to-primary/10 dark:from-primary/10 dark:via-background dark:to-primary/5">
      {/* Subtle pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]">
        <div className="absolute inset-0 [background-image:radial-gradient(circle_at_1px_1px,currentColor_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>

      <CardContent className="relative p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          {/* Left: Progress circle + status */}
          <div className="flex items-center gap-4 lg:gap-6">
            {/* Progress ring */}
            <motion.div 
              className="relative"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              <svg className="w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 -rotate-90">
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
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: overview.percentage / 100 }}
                  transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
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
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
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
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <StatusIcon status={overview.status_level} />
                {overview.status_message}
              </motion.div>

              {/* Stats */}
              <motion.div 
                className="space-y-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
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
          <div className="flex-1 flex flex-col sm:flex-row lg:flex-col xl:flex-row gap-4 lg:items-end xl:items-center lg:justify-end">
            {/* Streak mini card */}
            <motion.div 
              className="flex items-center gap-3 bg-muted/50 rounded-xl px-4 py-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <div className="flex items-center gap-1.5">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-3 h-3 rounded-sm transition-colors",
                      i < streak.active_days_week
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
              className="flex flex-col sm:flex-row gap-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <Button 
                onClick={handleContinue}
                size="lg"
                className="gap-2"
              >
                <Play className="h-4 w-4" />
                <span className="hidden sm:inline">Continuar de onde parei</span>
                <span className="sm:hidden">Continuar</span>
              </Button>
              <Button 
                onClick={handleOpenCalendar}
                variant="outline"
                size="lg"
                className="gap-2"
              >
                <Calendar className="h-4 w-4" />
                <span className="hidden sm:inline">Organizar semana</span>
                <span className="sm:hidden">Agenda</span>
              </Button>
            </motion.div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
