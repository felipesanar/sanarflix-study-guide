import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Flame, Target, Trophy, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { StreakGoalSlider } from './StreakGoalSlider';
import type { ProgressStreak } from '@/types/progressHub';
import { cn } from '@/lib/utils';

interface ConsistencyCardProps {
  streak: ProgressStreak;
  onGoalChange?: (goal: number) => void;
  syncing?: boolean;
}

const DAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const DAYS_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export const ConsistencyCard: React.FC<ConsistencyCardProps> = ({ 
  streak, 
  onGoalChange,
  syncing = false 
}) => {
  const shouldReduceMotion = useReducedMotion();
  const progressPercent = Math.min((streak.active_days_week / streak.goal) * 100, 100);
  const metGoal = streak.active_days_week >= streak.goal;
  const daysRemaining = Math.max(0, streak.goal - streak.active_days_week);

  // Animation helpers
  const getAnimationProps = (delay: number) => shouldReduceMotion ? {} : {
    initial: { scale: 0.8, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    transition: { delay }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Flame 
              className={cn(
                "h-5 w-5 transition-colors",
                metGoal ? "text-orange-500" : "text-muted-foreground"
              )} 
              aria-hidden="true"
            />
            Sua consistência
          </CardTitle>
          {onGoalChange && (
            <StreakGoalSlider
              currentGoal={streak.goal}
              onGoalChange={onGoalChange}
              disabled={syncing}
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Weekly dots */}
        <div 
          className="flex items-center justify-between" 
          role="group" 
          aria-label={`Atividade semanal: ${streak.active_days_week} dias ativos`}
        >
          {DAYS.map((day, i) => {
            const isActive = i < streak.active_days_week;
            const isToday = i === new Date().getDay();
            
            return (
              <motion.div
                key={i}
                {...getAnimationProps(i * 0.05)}
                className="flex flex-col items-center gap-1"
              >
                <span 
                  className={cn(
                    "text-[10px] font-medium",
                    isToday ? "text-primary" : "text-muted-foreground"
                  )}
                  aria-hidden="true"
                >
                  {day}
                </span>
                <div
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isToday
                        ? "bg-primary/20 border-2 border-primary border-dashed"
                        : "bg-muted"
                  )}
                  role="checkbox"
                  aria-checked={isActive}
                  aria-label={`${DAYS_FULL[i]}: ${isActive ? 'ativo' : 'inativo'}`}
                >
                  {isActive && (
                    <motion.div
                      initial={shouldReduceMotion ? {} : { scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={shouldReduceMotion ? {} : { type: 'spring', stiffness: 500, damping: 20 }}
                      aria-hidden="true"
                    >
                      ✓
                    </motion.div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Progress to goal */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Meta semanal</span>
            <span className="font-medium">
              {streak.active_days_week}/{streak.goal} dias
            </span>
          </div>
          <Progress 
            value={progressPercent} 
            className="h-2" 
            aria-label={`Progresso da meta: ${Math.round(progressPercent)}%`}
          />
        </div>

        {/* Status message */}
        <motion.div
          initial={shouldReduceMotion ? {} : { opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={shouldReduceMotion ? {} : { delay: 0.3 }}
          className={cn(
            "flex items-center gap-2 p-3 rounded-lg text-sm",
            metGoal
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300"
              : "bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
          )}
          role="status"
        >
          {metGoal ? (
            <>
              <Trophy className="h-4 w-4" aria-hidden="true" />
              <span>Parabéns! Você bateu sua meta esta semana 🎉</span>
            </>
          ) : daysRemaining === 1 ? (
            <>
              <Target className="h-4 w-4" aria-hidden="true" />
              <span>Falta apenas <strong>1 dia</strong> para bater sua meta!</span>
            </>
          ) : (
            <>
              <Calendar className="h-4 w-4" aria-hidden="true" />
              <span>Faltam <strong>{daysRemaining} dias</strong> para sua meta</span>
            </>
          )}
        </motion.div>

        {/* Current streak */}
        {streak.current > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Flame className="h-4 w-4 text-orange-500" aria-hidden="true" />
            <span>
              Sequência atual: <strong className="text-foreground">{streak.current} dias</strong>
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
