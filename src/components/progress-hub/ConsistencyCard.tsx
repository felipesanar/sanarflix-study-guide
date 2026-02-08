import React from 'react';
import { motion } from 'framer-motion';
import { Flame, Target, Trophy, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { ProgressStreak } from '@/types/progressHub';
import { cn } from '@/lib/utils';

interface ConsistencyCardProps {
  streak: ProgressStreak;
}

const DAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export const ConsistencyCard: React.FC<ConsistencyCardProps> = ({ streak }) => {
  const progressPercent = Math.min((streak.active_days_week / streak.goal) * 100, 100);
  const metGoal = streak.active_days_week >= streak.goal;
  const daysRemaining = Math.max(0, streak.goal - streak.active_days_week);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Flame className={cn(
            "h-5 w-5 transition-colors",
            metGoal ? "text-orange-500" : "text-muted-foreground"
          )} />
          Sua consistência
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Weekly dots */}
        <div className="flex items-center justify-between">
          {DAYS.map((day, i) => {
            const isActive = i < streak.active_days_week;
            const isToday = i === new Date().getDay();
            
            return (
              <motion.div
                key={i}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className="flex flex-col items-center gap-1"
              >
                <span className={cn(
                  "text-[10px] font-medium",
                  isToday ? "text-primary" : "text-muted-foreground"
                )}>
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
                >
                  {isActive && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 20 }}
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
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Status message */}
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={cn(
            "flex items-center gap-2 p-3 rounded-lg text-sm",
            metGoal
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300"
              : "bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
          )}
        >
          {metGoal ? (
            <>
              <Trophy className="h-4 w-4" />
              <span>Parabéns! Você bateu sua meta esta semana 🎉</span>
            </>
          ) : daysRemaining === 1 ? (
            <>
              <Target className="h-4 w-4" />
              <span>Falta apenas <strong>1 dia</strong> para bater sua meta!</span>
            </>
          ) : (
            <>
              <Calendar className="h-4 w-4" />
              <span>Faltam <strong>{daysRemaining} dias</strong> para sua meta</span>
            </>
          )}
        </motion.div>

        {/* Current streak */}
        {streak.current > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Flame className="h-4 w-4 text-orange-500" />
            <span>
              Sequência atual: <strong className="text-foreground">{streak.current} dias</strong>
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
