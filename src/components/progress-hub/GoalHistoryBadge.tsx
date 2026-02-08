import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Trophy, Flame, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GoalHistoryBadgeProps {
  weeksAchieved: number;
  className?: string;
}

export const GoalHistoryBadge: React.FC<GoalHistoryBadgeProps> = ({
  weeksAchieved,
  className
}) => {
  const shouldReduceMotion = useReducedMotion();

  if (weeksAchieved <= 0) return null;

  // Determine milestone level
  const getMilestone = (weeks: number) => {
    if (weeks >= 12) return { level: 'legendary', icon: Star, color: 'text-purple-500' };
    if (weeks >= 8) return { level: 'master', icon: Trophy, color: 'text-yellow-500' };
    if (weeks >= 4) return { level: 'consistent', icon: Flame, color: 'text-orange-500' };
    return { level: 'starting', icon: Flame, color: 'text-muted-foreground' };
  };

  const milestone = getMilestone(weeksAchieved);
  const Icon = milestone.icon;

  return (
    <motion.div
      initial={shouldReduceMotion ? {} : { opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "flex items-center gap-1.5 text-xs",
        className
      )}
      role="status"
      aria-label={`${weeksAchieved} semanas consecutivas atingindo a meta`}
    >
      <Icon className={cn("h-3.5 w-3.5", milestone.color)} aria-hidden="true" />
      <span className="text-muted-foreground">
        <strong className="text-foreground">{weeksAchieved}</strong>
        {weeksAchieved === 1 ? ' semana seguida' : ' semanas seguidas'}
      </span>
    </motion.div>
  );
};
