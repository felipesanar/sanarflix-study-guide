// Study Calendar Premium View - Mobile (Dark & Light)
// Read-only visualization with day tabs and vertical list

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Edit2, BookOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CalendarEvent, getMateriaIcon } from './types';

interface CalendarViewMobileProps {
  events: CalendarEvent[];
  onEdit: () => void;
  onEventClick: (event: CalendarEvent) => void;
  variant?: 'dark' | 'light';
}

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DAYS_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export const CalendarViewMobile: React.FC<CalendarViewMobileProps> = ({
  events,
  onEdit,
  onEventClick,
  variant = 'dark'
}) => {
  const today = new Date().getDay();
  const [selectedDay, setSelectedDay] = useState<number>(today);
  const isDark = variant === 'dark';
  
  const dayEvents = events.filter(e => e.day === selectedDay);
  
  // Get current date info for the day selector
  const currentDate = new Date();
  const startOfWeek = new Date(currentDate);
  startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

  console.log('[StudyCalendarView] render mobile', { eventsCount: events.length, selectedDay, variant });

  return (
    <Card className={cn(
      "shadow-lg overflow-hidden transition-all",
      isDark 
        ? "bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border-zinc-800" 
        : "bg-card border-border/50"
    )}>
      {/* Header */}
      <CardHeader className={cn(
        "pb-3",
        isDark ? "border-b border-zinc-800" : "border-b border-border/30"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={cn(
              "p-1.5 rounded-lg",
              isDark ? "bg-primary/20" : "bg-primary/10"
            )}>
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className={cn(
                "text-base font-bold",
                isDark ? "text-white" : "text-foreground"
              )}>
                Calendário de Estudos
              </CardTitle>
              <CardDescription className={cn(
                "text-xs",
                isDark ? "text-zinc-400" : "text-muted-foreground"
              )}>
                Toque nas matérias para ver os conteúdos
              </CardDescription>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={onEdit}
            className={cn(
              "gap-1.5 h-8 text-xs font-medium",
              isDark 
                ? "border-zinc-700 bg-zinc-800/50 hover:bg-zinc-700 text-white" 
                : "border-border hover:bg-accent"
            )}
          >
            <Edit2 className="h-3.5 w-3.5" />
            Editar
          </Button>
        </div>
      </CardHeader>

      {/* Day Selector - Horizontal scroll with dates */}
      <div className={cn(
        "px-3 py-3",
        isDark ? "bg-zinc-900/50" : "bg-muted/30"
      )}>
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {DAYS.map((day, idx) => {
            const isSelected = idx === selectedDay;
            const isToday = idx === today;
            const date = new Date(startOfWeek);
            date.setDate(startOfWeek.getDate() + idx);
            const dayNumber = date.getDate();
            const hasEvents = events.some(e => e.day === idx);
            
            return (
              <button
                key={idx}
                onClick={() => setSelectedDay(idx)}
                className={cn(
                  "flex flex-col items-center min-w-[48px] px-2 py-2 rounded-xl transition-all",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : isDark
                      ? "text-zinc-400 hover:bg-zinc-800/50"
                      : "text-muted-foreground hover:bg-accent/50"
                )}
                aria-label={`Ver ${DAYS_FULL[idx]}`}
                aria-pressed={isSelected}
              >
                <span className={cn(
                  "text-[10px] font-medium uppercase",
                  isSelected ? "text-primary-foreground/80" : ""
                )}>
                  {day}
                </span>
                <span className={cn(
                  "text-lg font-bold mt-0.5",
                  isSelected ? "" : isToday ? "text-primary" : ""
                )}>
                  {dayNumber}
                </span>
                {hasEvents && !isSelected && (
                  <div className={cn(
                    "w-1 h-1 rounded-full mt-0.5",
                    isDark ? "bg-zinc-500" : "bg-muted-foreground/50"
                  )} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Day Content */}
      <CardContent className="p-3 pt-4">
        {/* Day header with count */}
        <div className="flex items-center justify-between mb-3">
          <h3 className={cn(
            "text-sm font-semibold",
            isDark ? "text-zinc-300" : "text-muted-foreground"
          )}>
            {DAYS_FULL[selectedDay]}
          </h3>
          <Badge 
            variant="secondary" 
            className={cn(
              "text-xs font-medium",
              isDark 
                ? "bg-zinc-800 text-zinc-300 border-zinc-700" 
                : "bg-muted text-muted-foreground"
            )}
          >
            {dayEvents.length} {dayEvents.length === 1 ? 'matéria' : 'matérias'}
          </Badge>
        </div>

        {/* Events list */}
        <AnimatePresence mode="wait">
          {dayEvents.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={cn(
                "flex flex-col items-center justify-center py-8 rounded-xl",
                isDark ? "bg-zinc-800/30" : "bg-muted/30"
              )}
            >
              <BookOpen className={cn(
                "h-10 w-10 mb-3",
                isDark ? "text-zinc-600" : "text-muted-foreground/40"
              )} />
              <p className={cn(
                "text-sm font-medium",
                isDark ? "text-zinc-400" : "text-muted-foreground"
              )}>
                Nada planejado para {DAYS_FULL[selectedDay].toLowerCase()}
              </p>
              <p className={cn(
                "text-xs mt-1",
                isDark ? "text-zinc-500" : "text-muted-foreground/70"
              )}>
                Toque em "Editar" para adicionar matérias
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="events"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2.5"
            >
              {dayEvents.map((event, idx) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => onEventClick(event)}
                  className={cn(
                    "relative rounded-xl overflow-hidden cursor-pointer transition-all",
                    "active:scale-[0.98]",
                    isDark
                      ? "bg-zinc-800/60 hover:bg-zinc-800/80 border border-zinc-700/50"
                      : "bg-card hover:bg-accent/30 border border-border/50 shadow-sm"
                  )}
                >
                  {/* Colored accent bar */}
                  <div 
                    className="absolute left-0 top-0 bottom-0 w-1"
                    style={{ backgroundColor: event.color }}
                  />
                  
                  <div className="pl-4 pr-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Category/icon */}
                        <span 
                          className="text-base"
                          role="img" 
                          aria-label="Ícone da matéria"
                        >
                          {getMateriaIcon(event.materia)}
                        </span>
                        
                        {/* Title */}
                        <h4 className={cn(
                          "text-sm font-semibold mt-1",
                          isDark ? "text-white" : "text-foreground"
                        )}>
                          {event.title}
                        </h4>
                        
                      </div>
                      
                      {/* Color dot indicator */}
                      <div 
                        className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0"
                        style={{ backgroundColor: event.color }}
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
};
