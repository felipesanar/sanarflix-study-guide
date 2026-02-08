import React, { useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ArrowRight, CalendarDays } from 'lucide-react';
import { format, differenceInDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
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
    <div className="flex flex-col py-4 space-y-4">
      {/* Header - Mobile optimized */}
      <div className="flex items-center gap-3 px-1">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <CalendarDays className="h-6 w-6 text-primary" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Quando será sua prova?</h2>
          <p className="text-sm text-muted-foreground">Selecione a data</p>
        </div>
      </div>

      {/* Calendar - Large touch targets for mobile */}
      <motion.div
        initial={shouldReduceMotion ? {} : { scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="flex justify-center"
      >
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={onSelect}
          disabled={(date) => startOfDay(date) < today}
          locale={ptBR}
          className={cn(
            "rounded-2xl border-2 border-border shadow-lg p-3 pointer-events-auto",
            "bg-card w-full"
          )}
          classNames={{
            months: "flex flex-col space-y-4",
            month: "space-y-3",
            caption: "flex justify-center pt-1 relative items-center text-base font-semibold",
            caption_label: "text-base font-semibold",
            nav: "space-x-1 flex items-center",
            nav_button: cn(
              "h-10 w-10 bg-transparent p-0 opacity-70 hover:opacity-100",
              "hover:bg-accent rounded-xl transition-all active:scale-95"
            ),
            nav_button_previous: "absolute left-1",
            nav_button_next: "absolute right-1",
            table: "w-full border-collapse",
            head_row: "flex justify-between",
            head_cell: "text-muted-foreground rounded-md w-12 font-medium text-xs",
            row: "flex w-full mt-1 justify-between",
            cell: cn(
              "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
              "h-12 w-12" // 48px for touch-friendly targets
            ),
            day: cn(
              "h-12 w-12 p-0 font-normal rounded-2xl text-base",
              "transition-all duration-150",
              "active:scale-90",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            ),
            day_selected: cn(
              "bg-primary text-primary-foreground font-bold",
              "scale-110 shadow-lg shadow-primary/40",
              "ring-2 ring-primary ring-offset-2 ring-offset-background"
            ),
            day_today: "bg-accent text-accent-foreground font-semibold",
            day_outside: "text-muted-foreground opacity-40",
            day_disabled: "text-muted-foreground opacity-25 cursor-not-allowed",
            day_hidden: "invisible",
          }}
        />
      </motion.div>

      {/* Date feedback - Animated */}
      <div className="h-16 flex items-center justify-center">
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
              <p className="text-xl font-semibold flex items-center gap-2 justify-center">
                <span className="text-2xl">{countdownInfo.emoji}</span>
                {format(selectedDate, "d 'de' MMMM", { locale: ptBR })}
              </p>
              <p className={cn("text-sm mt-0.5", getUrgencyStyles(daysUntil))}>
                {countdownInfo.text}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* CTA Button - Large for mobile */}
      <motion.div
        initial={shouldReduceMotion ? {} : { opacity: 0, y: 10 }}
        animate={{ 
          opacity: selectedDate ? 1 : 0.5, 
          y: 0,
        }}
        transition={{ duration: 0.2 }}
        className="pt-2"
      >
        <Button
          className="w-full h-14 text-lg gap-2 rounded-2xl font-semibold"
          disabled={!selectedDate}
          onClick={onNext}
        >
          Próximo
          <ArrowRight className="h-5 w-5" />
        </Button>
      </motion.div>
    </div>
  );
};
