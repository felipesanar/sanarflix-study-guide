import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { DAY_NAMES_SHORT } from './types';

interface DaySelectorMobileProps {
  selectedDay: number;
  onSelectDay: (day: number) => void;
  eventsPerDay: Record<number, number>;
  variant?: 'dark' | 'light';
  baseDate?: Date;
}

export const DaySelectorMobile: React.FC<DaySelectorMobileProps> = ({
  selectedDay,
  onSelectDay,
  eventsPerDay,
  variant = 'dark',
  baseDate = new Date()
}) => {
  // Calculate dates for the week
  const getWeekDates = () => {
    const today = baseDate;
    const currentDay = today.getDay();
    const dates: Date[] = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - currentDay + i);
      dates.push(date);
    }
    
    return dates;
  };

  const weekDates = getWeekDates();

  return (
    <div className={cn(
      "px-4 py-3 border-b",
      variant === 'dark' ? "bg-background border-border/50" : "bg-white border-border/30"
    )}>
      <div className="flex justify-between items-center gap-1">
        {weekDates.map((date, idx) => {
          const isSelected = idx === selectedDay;
          const hasEvents = eventsPerDay[idx] > 0;
          
          return (
            <button
              key={idx}
              onClick={() => onSelectDay(idx)}
              className="flex flex-col items-center gap-1 flex-1 py-2 relative"
            >
              {/* Day name */}
              <span className={cn(
                "text-[10px] font-medium uppercase",
                isSelected 
                  ? "text-primary" 
                  : variant === 'dark' 
                    ? "text-muted-foreground" 
                    : "text-muted-foreground"
              )}>
                {DAY_NAMES_SHORT[idx]}
              </span>
              
              {/* Date number */}
              <div className="relative">
                {isSelected && (
                  <motion.div
                    layoutId="selectedDay"
                    className="absolute inset-0 bg-primary rounded-full"
                    initial={false}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
                <span className={cn(
                  "relative z-10 w-9 h-9 flex items-center justify-center text-sm font-semibold rounded-full transition-colors",
                  isSelected 
                    ? "text-primary-foreground" 
                    : variant === 'dark'
                      ? "text-foreground"
                      : "text-foreground"
                )}>
                  {date.getDate()}
                </span>
              </div>

              {/* Event indicator dot */}
              {hasEvents && !isSelected && (
                <motion.div 
                  className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    variant === 'dark' ? "bg-primary/60" : "bg-primary/70"
                  )}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                />
              )}
              {isSelected && hasEvents && (
                <motion.div 
                  className="w-1.5 h-1.5 rounded-full bg-primary"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
