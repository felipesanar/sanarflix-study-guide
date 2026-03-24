import React, { useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ArrowRight, X, CalendarDays } from 'lucide-react';
import { format, differenceInDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

interface ExamCalendarStepProps {
  selectedDate: Date | undefined;
  onSelect: (date: Date | undefined) => void;
  onNext: () => void;
  onClose: () => void;
}

export const ExamCalendarStep: React.FC<ExamCalendarStepProps> = ({
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
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <CalendarDays className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Quando será sua prova?</h2>
            <p className="text-sm text-muted-foreground">Selecione a data no calendário</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 -mr-2"
          onClick={onClose}
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar - Centered, natural size */}
      <div className="flex justify-center py-2">
        <motion.div
          initial={shouldReduceMotion ? {} : { scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={onSelect}
            disabled={(date) => startOfDay(date) < today}
            locale={ptBR}
            className={cn(
              "rounded-2xl border-2 border-border shadow-lg p-4 pointer-events-auto",
              "bg-card"
            )}
            classNames={{
              months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
              month: "space-y-4",
              caption: "flex justify-center pt-1 relative items-center text-base font-semibold",
              caption_label: "text-base font-semibold",
              nav: "space-x-1 flex items-center",
              nav_button: cn(
                "h-8 w-8 bg-transparent p-0 opacity-70 hover:opacity-100",
                "hover:bg-accent rounded-lg transition-all"
              ),
              nav_button_previous: "absolute left-1",
              nav_button_next: "absolute right-1",
              table: "w-full border-collapse space-y-1",
              head_row: "flex",
              head_cell: "text-muted-foreground rounded-md w-10 font-medium text-[0.8rem]",
              row: "flex w-full mt-2",
              cell: cn(
                "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
                "h-10 w-10"
              ),
              day: cn(
                "h-10 w-10 p-0 font-normal rounded-xl",
                "hover:bg-accent hover:scale-105 transition-all duration-150",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              ),
              day_selected: cn(
                "bg-primary text-primary-foreground font-semibold",
                "hover:bg-primary hover:text-primary-foreground",
                "scale-110 shadow-lg shadow-primary/30",
                "ring-2 ring-primary ring-offset-2 ring-offset-background"
              ),
              day_today: "bg-accent text-accent-foreground font-semibold",
              day_outside: "text-muted-foreground opacity-50",
              day_disabled: "text-muted-foreground opacity-30 cursor-not-allowed",
              day_hidden: "invisible",
            }}
          />
        </motion.div>
      </div>

      {/* Date feedback - Fixed height */}
      <div className="h-14 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {selectedDate && countdownInfo && (
            <motion.div
              key={selectedDate.toISOString()}
              initial={shouldReduceMotion ? {} : { opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={shouldReduceMotion ? {} : { opacity: 0, y: -10, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="text-center"
            >
              <p className="text-lg font-semibold flex items-center gap-2 justify-center">
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

      {/* CTA Button - Always visible */}
      <Button
        className="w-full h-12 text-base gap-2 rounded-xl font-medium"
        disabled={!selectedDate}
        onClick={onNext}
      >
        Próximo
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
};
