// Study Calendar Premium View - Desktop (Dark & Light)
// Read-only visualization of the weekly calendar

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Edit2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CalendarEvent, getMateriaColor, getMateriaIcon } from './types';

interface CalendarViewDesktopProps {
  events: CalendarEvent[];
  onEdit: () => void;
  onEventClick: (event: CalendarEvent) => void;
  variant?: 'dark' | 'light';
}

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const CalendarViewDesktop: React.FC<CalendarViewDesktopProps> = ({
  events,
  onEdit,
  onEventClick,
  variant = 'dark'
}) => {
  const [activeDay, setActiveDay] = useState<number>(new Date().getDay());
  const today = new Date().getDay();
  const isDark = variant === 'dark';

  console.log('[StudyCalendarView] render desktop', { eventsCount: events.length, variant });

  return (
    <Card className={cn(
      "shadow-lg transition-all duration-300 overflow-hidden",
      isDark 
        ? "bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border-zinc-800" 
        : "bg-card border-border/50"
    )}>
      {/* Header */}
      <CardHeader className={cn(
        "pb-2",
        isDark ? "border-b border-zinc-800" : "border-b border-border/30"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              isDark ? "bg-primary/20" : "bg-primary/10"
            )}>
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className={cn(
                "text-lg font-bold",
                isDark ? "text-white" : "text-foreground"
              )}>
                Calendário de Estudos
              </CardTitle>
              <CardDescription className={cn(
                "text-sm",
                isDark ? "text-zinc-400" : "text-muted-foreground"
              )}>
                Clique nas matérias para ver os conteúdos
              </CardDescription>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={onEdit}
            className={cn(
              "gap-2 font-medium transition-all",
              isDark 
                ? "border-zinc-700 bg-zinc-800/50 hover:bg-zinc-700 text-white" 
                : "border-border hover:bg-accent"
            )}
          >
            <Edit2 className="h-4 w-4" />
            Editar
          </Button>
        </div>
      </CardHeader>

      {/* Day Navigation - Underline style */}
      <div className={cn(
        "px-6 pt-4",
        isDark ? "border-b border-zinc-800/50" : "border-b border-border/30"
      )}>
        <div className="flex items-center justify-between">
          {DAYS.map((day, idx) => {
            const isActive = idx === activeDay;
            const isToday = idx === today;
            const hasEvents = events.some(e => e.day === idx);
            
            return (
              <button
                key={day}
                onClick={() => setActiveDay(idx)}
                className={cn(
                  "relative px-3 py-2 text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-t",
                  isActive
                    ? isDark ? "text-white" : "text-foreground"
                    : isDark ? "text-zinc-500 hover:text-zinc-300" : "text-muted-foreground hover:text-foreground",
                  isToday && !isActive && "font-semibold"
                )}
                aria-label={`Ver ${day}`}
              >
                <span className="relative">
                  {day}
                  {isToday && (
                    <span className={cn(
                      "absolute -top-1 -right-1.5 w-1.5 h-1.5 rounded-full",
                      "bg-primary"
                    )} />
                  )}
                </span>
                {/* Active underline */}
                {isActive && (
                  <motion.div
                    layoutId="active-day-underline"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
                {/* Has events indicator */}
                {hasEvents && !isActive && (
                  <div className={cn(
                    "absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full",
                    isDark ? "bg-zinc-600" : "bg-muted-foreground/40"
                  )} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Weekly Grid */}
      <CardContent className="p-4">
        <div className={cn(
          "grid grid-cols-7 gap-3 min-h-[400px]",
          isDark ? "bg-zinc-900/50 rounded-xl p-3" : "bg-muted/20 rounded-xl p-3"
        )}>
          {DAYS.map((day, dayIdx) => {
            const dayEvents = events.filter(e => e.day === dayIdx);
            const isActive = dayIdx === activeDay;
            const isToday = dayIdx === today;
            
            return (
              <div 
                key={dayIdx} 
                className={cn(
                  "flex flex-col rounded-xl overflow-hidden transition-all duration-200",
                  isActive && isDark && "ring-1 ring-primary/40",
                  isActive && !isDark && "ring-1 ring-primary/30"
                )}
              >
                {/* Day header - hidden on grid, navigation is above */}
                <div className={cn(
                  "min-h-[320px] p-2 space-y-2 rounded-xl transition-colors",
                  isDark 
                    ? isActive 
                      ? "bg-gradient-to-b from-zinc-800/80 to-zinc-800/40 border border-zinc-700/50" 
                      : "bg-zinc-800/30 border border-zinc-800/30"
                    : isActive
                      ? "bg-card border border-primary/20 shadow-sm"
                      : "bg-card/50 border border-border/30"
                )}>
                  {dayEvents.length === 0 ? (
                    <div className={cn(
                      "flex items-center justify-center h-full min-h-[100px]",
                      isDark ? "text-zinc-600" : "text-muted-foreground/40"
                    )}>
                      <span className="text-xs">—</span>
                    </div>
                  ) : (
                    <AnimatePresence mode="popLayout">
                      {dayEvents.map((event, idx) => (
                        <motion.div
                          key={event.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ delay: idx * 0.05 }}
                          onClick={() => onEventClick(event)}
                          className={cn(
                            "group relative rounded-lg overflow-hidden cursor-pointer transition-all duration-200",
                            "hover:scale-[1.02] active:scale-[0.98]",
                            isDark
                              ? "hover:ring-1 hover:ring-white/10"
                              : "hover:shadow-md"
                          )}
                          style={{
                            backgroundColor: isDark 
                              ? `${event.color}30` 
                              : `${event.color}15`
                          }}
                        >
                          {/* Colored accent bar */}
                          <div 
                            className="absolute left-0 top-0 bottom-0 w-1 rounded-l"
                            style={{ backgroundColor: event.color }}
                          />
                          
                          <div className="pl-3 pr-2 py-2.5">
                            {/* Category label if available */}
                            <div 
                              className={cn(
                                "text-[10px] font-semibold uppercase tracking-wide mb-1",
                                isDark ? "opacity-80" : "opacity-70"
                              )}
                              style={{ color: event.color }}
                            >
                              {getMateriaIcon(event.materia)}
                            </div>
                            
                            {/* Subject name */}
                            <h4 className={cn(
                              "text-sm font-semibold leading-tight",
                              isDark ? "text-white" : "text-foreground"
                            )}>
                              {event.title}
                            </h4>
                            
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
