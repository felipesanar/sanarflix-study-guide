import React, { useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ArrowRight, CalendarDays } from 'lucide-react';
import { format, differenceInDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface ExamCalendarStepMobileProps {
  selectedDate: Date | undefined;
  onSelect: (date: Date | undefined) => void;
  onNext: () => void;
  onClose: () => void;
}

export const ExamCalendarStepMobile: React.FC<ExamCalendarStepMobileProps> = ({
  selectedDate,
  onSelect,
  onNext,
  onClose,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const today = useMemo(() => startOfDay(new Date()), []);

  // Calculate days until exam
  const daysUntil = useMemo(() => {
    if (!selectedDate) return null;
    return differenceInDays(startOfDay(selectedDate), today);
  }, [selectedDate, today]);

  // Get urgency color based on days remaining
  const getUrgencyStyles = (days: number | null) => {
    if (days === null) return '';
    if (days === 0) return 'text-destructive font-bold';
    if (days === 1) return 'text-orange-500 font-semibold';
    if (days <= 7) return 'text-amber-500 font-medium';
    return 'text-emerald-600 dark:text-emerald-400';
  };

  // Format countdown message
  const getCountdownMessage = (days: number | null) => {
    if (days === null) return null;
    if (days === 0) return { emoji: '😮', text: 'Hoje!' };
    if (days === 1) return { emoji: '🔥', text: 'Amanhã!' };
    if (days <= 7) return { emoji: '⏰', text: `em ${days} dias` };
    if (days <= 30) return { emoji: '📅', text: `em ${days} dias` };
    return { emoji: '✨', text: `em ${days} dias` };
  };

  const countdownInfo = getCountdownMessage(daysUntil);

  return (
    <div className="flex flex-col min-h-0 max-h-[85vh]">
      {/* Header - Compact */}
      <div className="flex items-center gap-3 py-3 px-1 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <CalendarDays className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-tight">Quando será sua prova?</h2>
          <p className="text-sm text-muted-foreground">Selecione a data</p>
        </div>
      </div>

      {/* Scrollable Content */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col items-center py-2 px-1">
          {/* Calendar - Responsive sizing */}
          <motion.div
            initial={shouldReduceMotion ? {} : { scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-[340px]"
          >
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={onSelect}
              disabled={(date) => startOfDay(date) < today}
              locale={ptBR}
              className={cn(
                "rounded-xl border border-border shadow-sm p-2 pointer-events-auto",
                "bg-card w-full mx-auto"
              )}
              classNames={{
                months: "flex flex-col space-y-3",
                month: "space-y-2",
                caption: "flex justify-center pt-1 relative items-center text-sm font-semibold",
                caption_label: "text-sm font-semibold",
                nav: "space-x-1 flex items-center",
                nav_button: cn(
                  "h-8 w-8 bg-transparent p-0 opacity-70 hover:opacity-100",
                  "hover:bg-accent rounded-lg transition-all active:scale-95"
                ),
                nav_button_previous: "absolute left-0",
                nav_button_next: "absolute right-0",
                table: "w-full border-collapse",
                head_row: "flex justify-around",
                head_cell: "text-muted-foreground rounded-md w-9 font-medium text-xs",
                row: "flex w-full mt-1 justify-around",
                cell: cn(
                  "relative p-0.5 text-center text-sm focus-within:relative focus-within:z-20",
                  "h-9 w-9"
                ),
                day: cn(
                  "h-9 w-9 p-0 font-normal rounded-lg text-sm",
                  "transition-all duration-150",
                  "active:scale-90",
                  "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                ),
                day_selected: cn(
                  "bg-primary text-primary-foreground font-bold",
                  "scale-105 shadow-md shadow-primary/30",
                  "ring-2 ring-primary ring-offset-1 ring-offset-background"
                ),
                day_today: "bg-accent text-accent-foreground font-semibold",
                day_outside: "text-muted-foreground opacity-40",
                day_disabled: "text-muted-foreground opacity-25 cursor-not-allowed",
                day_hidden: "invisible",
              }}
            />
          </motion.div>

          {/* Date feedback - Animated */}
          <div className="h-14 flex items-center justify-center mt-2">
            <AnimatePresence mode="wait">
              {selectedDate && countdownInfo && (
                <motion.div
                  key={selectedDate.toISOString()}
                  initial={shouldReduceMotion ? {} : { opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={shouldReduceMotion ? {} : { opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className="text-center"
                >
                  <p className="text-base font-semibold flex items-center gap-2 justify-center">
                    <span className="text-xl">{countdownInfo.emoji}</span>
                    {format(selectedDate, "d 'de' MMMM", { locale: ptBR })}
                  </p>
                  <p className={cn("text-sm", getUrgencyStyles(daysUntil))}>
                    {countdownInfo.text}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </ScrollArea>

      {/* CTA Button - Fixed at bottom with safe area */}
      <div className="shrink-0 pt-3 pb-2">
        <motion.div
          initial={shouldReduceMotion ? {} : { opacity: 0, y: 10 }}
          animate={{ 
            opacity: selectedDate ? 1 : 0.5, 
            y: 0,
          }}
          transition={{ duration: 0.2 }}
        >
          <Button
            className="w-full h-12 text-base gap-2 rounded-xl font-semibold"
            disabled={!selectedDate}
            onClick={onNext}
          >
            Próximo
            <ArrowRight className="h-5 w-5" />
          </Button>
        </motion.div>
      </div>
    </div>
  );
};
