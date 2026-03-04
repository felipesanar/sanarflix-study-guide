import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Save, Search, Sparkles, MoreHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { CalendarEvent, DAY_NAMES_SHORT, DAY_NAMES_FULL, SyncStatus, getMateriaColor, getMateriaIcon } from './types';
import { SubjectBankCard, CreateNewCard } from './SubjectBankCard';
import { DayColumnCard } from './DayColumnCard';
import { DropZone, EmptyDayState } from './DropZone';
import { FloatingActionBar } from './FloatingActionBar';
import { Skeleton } from '@/components/ui/skeleton';

interface CalendarEditorDesktopProps {
  events: CalendarEvent[];
  availableSubjects: string[];
  onAddEvent: (subjectName: string, day: number) => void;
  onRemoveEvent: (eventId: string) => void;
  onSave: () => void;
  onClose: () => void;
  onUndo: () => void;
  onReset: () => void;
  onEventClick?: (event: CalendarEvent) => void;
  syncStatus: SyncStatus;
  isSaving?: boolean;
  isLoading?: boolean;
  canUndo?: boolean;
  variant?: 'dark' | 'light';
}

export const CalendarEditorDesktop: React.FC<CalendarEditorDesktopProps> = ({
  events,
  availableSubjects,
  onAddEvent,
  onRemoveEvent,
  onSave,
  onClose,
  onUndo,
  onReset,
  onEventClick,
  syncStatus,
  isSaving = false,
  isLoading = false,
  canUndo = true,
  variant = 'dark'
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);

  // Filter subjects by search
  const filteredSubjects = useMemo(() => {
    if (!searchQuery.trim()) return availableSubjects;
    const query = searchQuery.toLowerCase();
    return availableSubjects.filter(s => s.toLowerCase().includes(query));
  }, [availableSubjects, searchQuery]);

  // Group events by day
  const eventsByDay = useMemo(() => {
    const grouped: Record<number, CalendarEvent[]> = {};
    for (let i = 0; i < 7; i++) {
      grouped[i] = events.filter(e => e.day === i);
    }
    return grouped;
  }, [events]);

  // Count events per day
  const eventsCount = useMemo(() => {
    const counts: Record<number, number> = {};
    for (let i = 0; i < 7; i++) {
      counts[i] = eventsByDay[i].length;
    }
    return counts;
  }, [eventsByDay]);

  const handleDragStart = (subjectName: string) => {
    console.log('[StudyCalendarEditor] Drag start:', subjectName);
    setDraggedItem(subjectName);
  };

  const handleDragEnd = () => {
    console.log('[StudyCalendarEditor] Drag end');
    setDraggedItem(null);
    setDragOverDay(null);
  };

  const handleDragOver = (e: React.DragEvent, day: number) => {
    e.preventDefault();
    setDragOverDay(day);
  };

  const handleDrop = (e: React.DragEvent, day: number) => {
    e.preventDefault();
    if (draggedItem) {
      onAddEvent(draggedItem, day);
    }
    setDraggedItem(null);
    setDragOverDay(null);
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={cn(
          "fixed inset-0 z-[9999]",
          variant === 'dark' ? "bg-[#09090b]" : "bg-white"
        )}
      >
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-10 w-40" />
          </div>
          <div className="flex gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-44" />
            ))}
          </div>
          <div className="grid grid-cols-7 gap-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-64 w-full" />
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        "fixed inset-0 z-[9999] flex flex-col overflow-hidden",
        variant === 'dark' ? "bg-[#09090b]" : "bg-slate-50"
      )}
    >
      {/* Header */}
      <header className={cn(
        "sticky top-0 z-50 border-b backdrop-blur-xl",
        variant === 'dark'
          ? "bg-background/95 border-border/50 shadow-lg shadow-black/20"
          : "bg-white/95 border-border/30 shadow-sm"
      )}>
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Left side */}
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                aria-label="Voltar ao calendário"
                className={cn(
                  "gap-2",
                  variant === 'dark' ? "hover:bg-muted" : "hover:bg-muted/50"
                )}
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>

              <div className={cn(
                "w-px h-6",
                variant === 'dark' ? "bg-border/50" : "bg-border/30"
              )} />

              <div className="flex items-center gap-3">
                <h1 className={cn(
                  "text-lg font-bold",
                  variant === 'dark' ? "text-foreground" : "text-foreground"
                )}>
                  Calendário de Estudos
                </h1>
              </div>
            </div>

            {/* Right side */}
            <Button
              size="sm"
              onClick={onSave}
              disabled={isSaving}
              aria-label="Salvar alterações do calendário"
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-5"
            >
              <Save className="h-4 w-4" />
              Salvar Alterações
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">

          {/* Subject Bank Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className={cn(
                  "h-4 w-4",
                  variant === 'dark' ? "text-muted-foreground" : "text-muted-foreground"
                )} />
                <span className={cn(
                  "text-xs font-semibold uppercase tracking-wide",
                  variant === 'dark' ? "text-muted-foreground" : "text-muted-foreground"
                )}>
                  {variant === 'light' ? 'Banco de Matérias' : 'Arraste para Adicionar'}
                </span>
              </div>

              {/* Search */}
              <div className="relative w-64">
                <Search className={cn(
                  "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4",
                  variant === 'dark' ? "text-muted-foreground" : "text-muted-foreground"
                )} />
                <Input
                  placeholder="Buscar matéria..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(
                    "pl-9 h-10 rounded-lg",
                    variant === 'dark'
                      ? "bg-card border-border/50 focus:border-primary/50"
                      : "bg-white border-border/30 focus:border-primary/50"
                  )}
                />
              </div>
            </div>

            {/* Subject Cards */}
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2">
              {filteredSubjects.map((subject, idx) => (
                <SubjectBankCard
                  key={idx}
                  name={subject}
                  onDragStart={() => handleDragStart(subject)}
                  onDragEnd={handleDragEnd}
                  isDragging={draggedItem === subject}
                  variant={variant}
                />
              ))}
              {variant === 'light' && <CreateNewCard />}
            </div>
          </div>

          {/* Weekly Grid */}
          <div className="relative">
            <div className="grid grid-cols-7 gap-3">
              {Array.from({ length: 7 }).map((_, dayIdx) => (
                <div key={dayIdx} className="flex flex-col min-h-[450px]">
                  {/* Day header */}
                  <div className={cn(
                    "flex items-center justify-between p-3 rounded-t-xl",
                    variant === 'dark'
                      ? "bg-card/80 border border-b-0 border-border/40"
                      : "bg-muted/50 border border-b-0 border-border/30"
                  )}>
                    <span className={cn(
                      "font-semibold",
                      variant === 'dark' ? "text-foreground" : "text-foreground"
                    )}>
                      {variant === 'light' ? DAY_NAMES_FULL[dayIdx] : DAY_NAMES_SHORT[dayIdx]}
                    </span>
                    {variant === 'light' && (
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 h-5 bg-muted"
                        >
                          {eventsCount[dayIdx]}
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Day content */}
                  <div
                    className={cn(
                      "flex-1 rounded-b-xl border border-t-0 p-3 space-y-2 relative overflow-y-auto transition-colors duration-200",
                      variant === 'dark'
                        ? "bg-card/40 border-border/40"
                        : "bg-white border-border/30",
                      dragOverDay === dayIdx && (
                        variant === 'dark'
                          ? "bg-primary/10"
                          : "bg-primary/5"
                      )
                    )}
                    onDragOver={(e) => handleDragOver(e, dayIdx)}
                    onDragLeave={() => setDragOverDay(null)}
                    onDrop={(e) => handleDrop(e, dayIdx)}
                  >
                    {/* Drop zone overlay */}
                    <DropZone
                      isActive={dragOverDay === dayIdx && draggedItem !== null}
                      variant={variant}
                    />

                    {/* Events or empty state */}
                    {eventsByDay[dayIdx].length > 0 ? (
                      <AnimatePresence>
                        {eventsByDay[dayIdx].map((event) => (
                          <DayColumnCard
                            key={event.id}
                            event={event}
                            onRemove={onRemoveEvent}
                            onClick={() => onEventClick?.(event)}
                            variant={variant}
                            isCompact={true}
                          />
                        ))}
                      </AnimatePresence>
                    ) : (
                      !draggedItem && (
                        <EmptyDayState variant={variant} size="md" />
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>

      {/* Floating action bar */}
      <FloatingActionBar
        onUndo={onUndo}
        onReset={onReset}
        syncStatus={syncStatus}
        canUndo={canUndo}
        variant={variant}
      />
    </motion.div>
  );
};
