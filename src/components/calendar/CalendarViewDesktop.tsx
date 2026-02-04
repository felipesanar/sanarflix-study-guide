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
      "shadow-2xl transition-all duration-300 overflow-hidden border-0",
      isDark 
        ? "bg-gradient-to-br from-zinc-900 via-[#0f0f11] to-zinc-950 ring-1 ring-white/5" 
        : "bg-gradient-to-br from-white via-slate-50 to-slate-100 ring-1 ring-black/5"
    )}>
      {/* Header */}
      <CardHeader className={cn(
        "pb-4 pt-5 relative overflow-hidden",
        isDark ? "border-b border-white/5 bg-white/[0.02]" : "border-b border-black/5 bg-white/50"
      )}>
        {/* Glow effect for header */}
        {isDark && (
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-50" />
        )}
        
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-4">
            <div className={cn(
              "p-2.5 rounded-xl shadow-inner",
              isDark ? "bg-primary/10 shadow-black/20 ring-1 ring-white/5" : "bg-primary/5 shadow-inner ring-1 ring-black/5"
            )}>
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className={cn(
                "text-xl font-bold tracking-tight",
                isDark ? "text-white" : "text-foreground"
              )}>
                Calendário de Estudos
              </CardTitle>
              <CardDescription className={cn(
                "text-sm font-medium",
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
              "gap-2 font-medium transition-all shadow-lg h-9 px-4 rounded-full",
              isDark 
                ? "border-white/10 bg-zinc-800/50 hover:bg-zinc-700 hover:text-white hover:border-white/20 text-zinc-100" 
                : "border-black/5 bg-white hover:bg-slate-50 text-slate-700 hover:text-foreground"
            )}
          >
            <Edit2 className="h-3.5 w-3.5" />
            Editar Agenda
          </Button>
        </div>
      </CardHeader>

      {/* Day Navigation - Underline style */}
      <div className={cn(
        "px-6 pt-2 pb-0",
        isDark ? "bg-black/20" : "bg-slate-50/50"
      )}>
        <div className="flex items-center justify-between border-b border-transparent">
          {DAYS.map((day, idx) => {
            const isActive = idx === activeDay;
            const isToday = idx === today;
            const hasEvents = events.some(e => e.day === idx);
            
            return (
              <button
                key={day}
                onClick={() => setActiveDay(idx)}
                className={cn(
                  "relative px-4 py-3 text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-t-lg group",
                  isActive
                    ? isDark ? "text-white" : "text-foreground"
                    : isDark ? "text-zinc-500 hover:text-zinc-300" : "text-muted-foreground hover:text-foreground",
                  isToday && !isActive && "font-semibold",
                  // Hover effect background
                  !isActive && (isDark ? "hover:bg-white/5" : "hover:bg-black/5")
                )}
                aria-label={`Ver ${day}`}
              >
                <div className="flex flex-col items-center gap-1">
                  <span className="relative">
                    {day}
                    {isToday && (
                      <span className={cn(
                        "absolute -top-1 -right-2 w-1.5 h-1.5 rounded-full animate-pulse",
                        "bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]"
                      )} />
                    )}
                  </span>
                  
                  {/* Events indicator dot */}
                  <div className={cn(
                    "w-1 h-1 rounded-full transition-all duration-300",
                    hasEvents 
                      ? (isActive ? "bg-primary" : (isDark ? "bg-zinc-600" : "bg-slate-400"))
                      : "opacity-0 scale-0"
                  )} />
                </div>

                {/* Active underline with glow */}
                {isActive && (
                  <motion.div
                    layoutId="active-day-underline"
                    className={cn(
                      "absolute bottom-0 left-0 right-0 h-[3px] bg-primary rounded-t-full",
                      isDark && "shadow-[0_-2px_8px_rgba(var(--primary),0.4)]"
                    )}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Weekly Grid */}
      <CardContent className="p-6">
        <div className={cn(
          "grid grid-cols-7 gap-4 min-h-[420px]",
          isDark ? "bg-black/20 rounded-2xl p-2 ring-1 ring-white/5 inset-shadow" : "bg-slate-50/80 rounded-2xl p-2 ring-1 ring-black/5"
        )}>
          {DAYS.map((day, dayIdx) => {
            const dayEvents = events.filter(e => e.day === dayIdx);
            const isActive = dayIdx === activeDay;
            const isToday = dayIdx === today;
            
            return (
              <div 
                key={dayIdx} 
                className={cn(
                  "flex flex-col rounded-xl overflow-hidden transition-all duration-300",
                  isActive && isDark && "bg-white/[0.02]",
                  isActive && !isDark && "bg-white shadow-sm"
                )}
              >
                {/* Day content container */}
                <div className={cn(
                  "flex-1 p-2 space-y-2.5 rounded-xl transition-all duration-300 min-h-[380px]",
                  // Active column highlighting
                  isActive 
                    ? (isDark ? "bg-white/[0.03] ring-1 ring-white/10" : "bg-white ring-1 ring-black/[0.05]")
                    : "opacity-60 grayscale-[0.3] hover:opacity-100 hover:grayscale-0"
                )}>
                  {dayEvents.length === 0 ? (
                    <div className={cn(
                      "flex flex-col items-center justify-center h-full gap-2",
                      isDark ? "text-zinc-700" : "text-slate-300"
                    )}>
                      <div className="w-1 h-1 rounded-full bg-current opacity-50" />
                      <div className="w-1 h-1 rounded-full bg-current opacity-50" />
                      <div className="w-1 h-1 rounded-full bg-current opacity-50" />
                    </div>
                  ) : (
                    <AnimatePresence mode="popLayout">
                      {dayEvents.map((event, idx) => (
                        <motion.div
                          key={event.id}
                          initial={{ opacity: 0, scale: 0.9, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ 
                            delay: idx * 0.05,
                            type: "spring",
                            stiffness: 400,
                            damping: 25 
                          }}
                          onClick={() => onEventClick(event)}
                          className={cn(
                            "group relative rounded-lg overflow-hidden cursor-pointer",
                            "transition-all duration-200 ease-out",
                            // Hover effects
                            "hover:-translate-y-0.5 hover:shadow-lg",
                            isDark
                              ? "hover:shadow-black/40 hover:ring-1 hover:ring-white/20 bg-zinc-800/80 backdrop-blur-sm"
                              : "hover:shadow-xl hover:shadow-primary/5 hover:ring-1 hover:ring-primary/20 bg-white"
                          )}
                          style={{
                            // Border glow effect on left
                            boxShadow: isDark 
                              ? `inset 3px 0 0 0 ${event.color}, 0 4px 6px -1px rgba(0, 0, 0, 0.3)` 
                              : `inset 3px 0 0 0 ${event.color}, 0 2px 4px rgba(0, 0, 0, 0.05)`
                          }}
                        >
                          {/* Inner gradient for depth */}
                          <div 
                            className={cn(
                              "absolute inset-0 opacity-[0.08] pointer-events-none transition-opacity group-hover:opacity-[0.15]",
                              "bg-gradient-to-r from-transparent to-white/10"
                            )}
                            style={{ backgroundColor: event.color }}
                          />

                          <div className="pl-3.5 pr-2 py-3 relative z-10">
                            {/* Category label */}
                            <div className="flex items-center justify-between mb-1">
                              <span 
                                className={cn(
                                  "text-[9px] font-bold uppercase tracking-wider opacity-90",
                                )}
                                style={{ color: event.color }}
                              >
                                {getMateriaIcon(event.materia)}
                              </span>
                            </div>
                            
                            {/* Subject name */}
                            <h4 
                              className={cn(
                                "font-bold leading-snug break-words hyphens-auto tracking-tight",
                                isDark ? "text-zinc-100" : "text-zinc-700"
                              )}
                              style={{ 
                                fontSize: 'clamp(0.7rem, 0.9vw, 0.825rem)',
                              }}
                            >
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
