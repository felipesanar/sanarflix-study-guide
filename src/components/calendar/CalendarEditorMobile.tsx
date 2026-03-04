import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, MoreVertical, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CalendarEvent, SyncStatus, getMateriaColor, getMateriaIcon, getMateriaCategory } from './types';
import { DaySelectorMobile } from './DaySelectorMobile';
import { SubjectDrawerMobile } from './SubjectDrawerMobile';
import { MobileFooterActions } from './FloatingActionBar';
import { DropZone } from './DropZone';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface CalendarEditorMobileProps {
  events: CalendarEvent[];
  availableSubjects: string[];
  onAddEvent: (subjectName: string, day: number) => void;
  onRemoveEvent: (eventId: string) => void;
  onSave: () => void;
  onClose: () => void;
  onUndo: () => void;
  onReset?: () => void;
  onEventClick?: (event: CalendarEvent) => void;
  syncStatus: SyncStatus;
  isSaving?: boolean;
  isLoading?: boolean;
  canUndo?: boolean;
  variant?: 'dark' | 'light';
}

export const CalendarEditorMobile: React.FC<CalendarEditorMobileProps> = ({
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
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDay());
  const [drawerExpanded, setDrawerExpanded] = useState(true);

  // Group events by day
  const eventsByDay = useMemo(() => {
    const grouped: Record<number, CalendarEvent[]> = {};
    for (let i = 0; i < 7; i++) {
      grouped[i] = events.filter(e => e.day === i);
    }
    return grouped;
  }, [events]);

  // Count events per day for the selector
  const eventsPerDay = useMemo(() => {
    const counts: Record<number, number> = {};
    for (let i = 0; i < 7; i++) {
      counts[i] = eventsByDay[i].length;
    }
    return counts;
  }, [eventsByDay]);

  // Events for selected day
  const selectedDayEvents = eventsByDay[selectedDay] || [];

  const handleAddFromDrawer = (subjectName: string) => {
    onAddEvent(subjectName, selectedDay);
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={cn(
          "fixed inset-0 z-[9999] flex flex-col",
          variant === 'dark' ? "bg-background" : "bg-white"
        )}
      >
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-10 w-10" />
          </div>
          <div className="flex gap-2 justify-between">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-10" />
            ))}
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
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
        "fixed inset-0 z-[9999] flex flex-col",
        variant === 'dark' ? "bg-background" : "bg-white"
      )}
    >
      {/* Header */}
      <header className={cn(
        "flex items-center justify-between px-4 py-4 border-b relative z-20",
        variant === 'dark'
          ? "bg-[#09090b] border-white/10"
          : "bg-white border-black/5 shadow-sm"
      )}>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Fechar editor"
          className={cn(
            "h-10 w-10 text-zinc-500 rounded-full",
            variant === 'dark' ? "hover:bg-white/10 hover:text-white" : "hover:bg-black/5 hover:text-black"
          )}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex flex-col items-center">
          <h1 className={cn(
            "text-base font-bold",
            variant === 'dark' ? "text-white" : "text-foreground"
          )}>
            Editar Agenda
          </h1>
          <span className={cn(
            "text-[10px] font-medium opacity-60",
            variant === 'dark' ? "text-zinc-400" : "text-zinc-500"
          )}>
            Modo Premium
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Mais opções"
          className={cn(
            "h-10 w-10 text-zinc-500 rounded-full",
            variant === 'dark' ? "hover:bg-white/10" : "hover:bg-black/5"
          )}
        >
          <MoreVertical className="h-5 w-5" />
        </Button>
      </header>

      {/* Day Selector */}
      <DaySelectorMobile
        selectedDay={selectedDay}
        onSelectDay={setSelectedDay}
        eventsPerDay={eventsPerDay}
        variant={variant}
      />

      {/* Day Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4">
          {/* Day header */}
          <div className="flex items-center justify-between mb-4">
            <span className={cn(
              "text-xs font-semibold uppercase tracking-wide",
              variant === 'dark' ? "text-muted-foreground" : "text-muted-foreground"
            )}>
              Planejamento do Dia
            </span>
            <Badge
              className={cn(
                "text-[10px] px-2",
                variant === 'dark'
                  ? "bg-primary/20 text-primary border-primary/30"
                  : "bg-primary/10 text-primary border-primary/20"
              )}
            >
              {selectedDayEvents.length} Matérias
            </Badge>
          </div>

          {/* Events list with add slots */}
          <div className="space-y-3">
            {selectedDayEvents.length === 0 ? (
              <>
                <DropZone
                  isActive={false}
                  variant={variant}
                  size="lg"
                  showAddButton
                  onAddClick={() => setDrawerExpanded(true)}
                />
                <div className={cn(
                  "text-center py-8",
                  variant === 'dark' ? "text-muted-foreground" : "text-muted-foreground"
                )}>
                  <p className="text-sm">Nenhuma matéria agendada</p>
                  <p className="text-xs mt-1">Toque no + ou arraste da gaveta abaixo</p>
                </div>
              </>
            ) : (
              <AnimatePresence>
                {selectedDayEvents.map((event, idx) => (
                  <React.Fragment key={event.id}>
                    {/* Event card */}
                    <MobileEventCard
                      event={event}
                      onRemove={onRemoveEvent}
                      onClick={() => onEventClick?.(event)}
                      variant={variant}
                    />

                    {/* Add slot between cards */}
                    <DropZone
                      isActive={false}
                      variant={variant}
                      size="sm"
                      showAddButton
                      onAddClick={() => setDrawerExpanded(true)}
                    />
                  </React.Fragment>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* Subject Drawer */}
        <SubjectDrawerMobile
          subjects={availableSubjects}
          onAddSubject={handleAddFromDrawer}
          variant={variant}
          isExpanded={drawerExpanded}
          onToggleExpand={() => setDrawerExpanded(!drawerExpanded)}
        />
      </div>

      {/* Footer Actions */}
      <MobileFooterActions
        onUndo={onUndo}
        onSave={onSave}
        isSaving={isSaving}
        canUndo={canUndo}
        variant={variant}
      />
    </motion.div>
  );
};

// Mobile Event Card Component
interface MobileEventCardProps {
  event: CalendarEvent;
  onRemove: (id: string) => void;
  onClick?: () => void;
  variant: 'dark' | 'light';
}

const MobileEventCard: React.FC<MobileEventCardProps> = ({
  event,
  onRemove,
  onClick,
  variant
}) => {
  const category = getMateriaCategory(event.materia);
  const icon = getMateriaIcon(event.materia);

  const getCategoryColor = (cat: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      'ANATOMIA': { bg: 'bg-blue-500/20', text: 'text-blue-400' },
      'FISIOLOGIA': { bg: 'bg-orange-500/20', text: 'text-orange-400' },
      'BIOQUÍMICA': { bg: 'bg-green-500/20', text: 'text-green-400' },
      'PATOLOGIA': { bg: 'bg-purple-500/20', text: 'text-purple-400' },
      'HISTOLOGIA': { bg: 'bg-pink-500/20', text: 'text-pink-400' },
      'IMUNOLOGIA': { bg: 'bg-cyan-500/20', text: 'text-cyan-400' },
      'FARMACOLOGIA': { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
      'CLÍNICA': { bg: 'bg-red-500/20', text: 'text-red-400' },
    };
    return colors[cat] || { bg: 'bg-muted', text: 'text-muted-foreground' };
  };

  const catColor = getCategoryColor(category);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className={cn(
        "p-4 rounded-2xl border-l-4 transition-all duration-200",
        variant === 'dark'
          ? "bg-card/90 border-t border-r border-b border-border/40"
          : "bg-white border-t border-r border-b border-border/30 shadow-sm"
      )}
      style={{ borderLeftColor: event.color }}
      onClick={onClick}
    >
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1 min-w-0">
          <Badge
            variant="secondary"
            className={cn(
              "mb-2 text-[10px] px-2 py-0 h-5",
              catColor.bg, catColor.text
            )}
          >
            {category}
          </Badge>
          <h4 className={cn(
            "font-semibold text-base leading-tight",
            variant === 'dark' ? "text-foreground" : "text-foreground"
          )}>
            {event.title}
          </h4>
          <p className={cn(
            "text-sm mt-1 line-clamp-2",
            variant === 'dark' ? "text-muted-foreground" : "text-muted-foreground"
          )}>
            Estudo programado para esta matéria.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 opacity-60 flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(event.id);
          }}
          aria-label="Remover matéria do dia"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </Button>
      </div>
    </motion.div>
  );
};
