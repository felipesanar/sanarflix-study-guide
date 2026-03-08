import React, { useRef, useEffect, useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Check, X, Minus, Ban } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface QuestionStatus {
  id: string;
  acertou: boolean | null;
  anulada: boolean;
}

interface QuestionNavigationRailProps {
  questions: QuestionStatus[];
  currentIndex: number;
  onNavigate: (index: number) => void;
}

// ─── Single Chip ───
const NavChip: React.FC<{
  index: number;
  question: QuestionStatus;
  isCurrent: boolean;
  onClick: () => void;
}> = React.memo(({ index, question, isCurrent, onClick }) => {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isCurrent && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [isCurrent]);

  const statusConfig = question.anulada
    ? { bg: 'bg-purple-500/10 dark:bg-purple-500/15', text: 'text-purple-700 dark:text-purple-300', ring: 'ring-purple-500/40', dot: 'bg-purple-500', icon: Ban }
    : question.acertou === true
      ? { bg: 'bg-green-500/10 dark:bg-green-500/15', text: 'text-green-700 dark:text-green-300', ring: 'ring-green-500/40', dot: 'bg-green-500', icon: Check }
      : question.acertou === false
        ? { bg: 'bg-red-500/10 dark:bg-red-500/15', text: 'text-red-700 dark:text-red-300', ring: 'ring-red-500/40', dot: 'bg-red-500', icon: X }
        : { bg: 'bg-amber-500/8 dark:bg-amber-500/12', text: 'text-amber-700 dark:text-amber-300', ring: 'ring-amber-500/40', dot: 'bg-amber-500', icon: Minus };

  const StatusIcon = statusConfig.icon;

  return (
    <motion.button
      ref={ref}
      onClick={onClick}
      whileTap={{ scale: 0.92 }}
      className={cn(
        'relative flex flex-col items-center justify-center shrink-0 transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
        // Chip sizing
        'w-10 h-12 sm:w-11 sm:h-14 rounded-xl',
        // Base styles
        statusConfig.bg, statusConfig.text,
        // Hover
        'hover:brightness-95 dark:hover:brightness-110',
        // Current state
        isCurrent && [
          'ring-2 ring-offset-2 ring-offset-background shadow-lg z-10',
          statusConfig.ring,
          'scale-105',
        ],
      )}
      title={`Questão ${index + 1}`}
      aria-label={`Questão ${index + 1}${question.anulada ? ', anulada' : question.acertou === true ? ', correta' : question.acertou === false ? ', errada' : ', não respondida'}`}
      aria-current={isCurrent ? 'step' : undefined}
    >
      {/* Number */}
      <span className={cn(
        'text-xs font-bold leading-none transition-all duration-150',
        isCurrent && 'text-sm',
      )}>
        {index + 1}
      </span>

      {/* Status indicator */}
      <span className={cn(
        'mt-1 flex items-center justify-center transition-all duration-200',
        isCurrent ? 'w-4 h-4' : 'w-3 h-3',
      )}>
        <StatusIcon className={cn(
          'transition-all duration-200',
          isCurrent ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5',
          question.acertou === true ? 'text-green-600 dark:text-green-400' : '',
          question.acertou === false ? 'text-red-600 dark:text-red-400' : '',
          question.anulada ? 'text-purple-600 dark:text-purple-400' : '',
          question.acertou === null && !question.anulada ? 'text-amber-600 dark:text-amber-400' : '',
        )} />
      </span>
    </motion.button>
  );
});

NavChip.displayName = 'NavChip';

// ─── Arrow Button ───
const ArrowButton: React.FC<{
  direction: 'left' | 'right';
  onClick: () => void;
  disabled: boolean;
}> = ({ direction, onClick, disabled }) => (
  <motion.button
    whileTap={disabled ? {} : { scale: 0.9 }}
    onClick={onClick}
    disabled={disabled}
    className={cn(
      'shrink-0 flex items-center justify-center',
      'w-10 h-10 sm:w-11 sm:h-11 rounded-xl',
      'border border-border/60 bg-card',
      'transition-all duration-200',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
      disabled
        ? 'opacity-30 cursor-not-allowed'
        : 'hover:bg-muted hover:border-border hover:shadow-sm active:bg-muted/80 cursor-pointer',
    )}
    aria-label={direction === 'left' ? 'Questão anterior' : 'Próxima questão'}
  >
    {direction === 'left'
      ? <ChevronLeft className="w-4 h-4 text-foreground/70" />
      : <ChevronRight className="w-4 h-4 text-foreground/70" />
    }
  </motion.button>
);

// ─── Progress mini-bar ───
const ProgressMiniBar: React.FC<{
  questions: QuestionStatus[];
  currentIndex: number;
}> = ({ questions, currentIndex }) => {
  const total = questions.length;
  const correct = questions.filter(q => q.acertou === true).length;
  const wrong = questions.filter(q => q.acertou === false).length;
  const blank = questions.filter(q => q.acertou === null && !q.anulada).length;

  return (
    <div className="flex items-center gap-3 sm:gap-4 text-[10px] sm:text-[11px] font-medium text-muted-foreground/60">
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-green-500" />
        <span>{correct}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-red-500" />
        <span>{wrong}</span>
      </div>
      {blank > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span>{blank}</span>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───
export const QuestionNavigationRail: React.FC<QuestionNavigationRailProps> = ({
  questions,
  currentIndex,
  onNavigate,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  // Check scroll overflow for edge fades
  const checkScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setShowLeftFade(el.scrollLeft > 8);
    setShowRightFade(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      ro.disconnect();
    };
  }, [checkScroll, questions.length]);

  console.log('[QuestionNav] Rendered with', questions.length, 'questions, current:', currentIndex);

  if (questions.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        'rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm',
        'shadow-sm hover:shadow-md transition-shadow duration-300',
        'p-3 sm:p-4 lg:p-5',
      )}
    >
      {/* Navigation strip */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Left arrow */}
        <ArrowButton
          direction="left"
          onClick={() => onNavigate(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
        />

        {/* Scrollable chips container */}
        <div className="relative flex-1 min-w-0">
          {/* Left fade mask */}
          <div className={cn(
            'absolute left-0 top-0 bottom-0 w-8 sm:w-12 z-10 pointer-events-none',
            'bg-gradient-to-r from-card/80 to-transparent',
            'transition-opacity duration-200',
            showLeftFade ? 'opacity-100' : 'opacity-0',
          )} />

          {/* Scroll area */}
          <div
            ref={scrollContainerRef}
            className="overflow-x-auto scrollbar-none scroll-smooth"
          >
            <div className="flex gap-1.5 sm:gap-2 py-1 px-1 min-w-max">
              {questions.map((q, i) => (
                <NavChip
                  key={q.id}
                  index={i}
                  question={q}
                  isCurrent={i === currentIndex}
                  onClick={() => onNavigate(i)}
                />
              ))}
            </div>
          </div>

          {/* Right fade mask */}
          <div className={cn(
            'absolute right-0 top-0 bottom-0 w-8 sm:w-12 z-10 pointer-events-none',
            'bg-gradient-to-l from-card/80 to-transparent',
            'transition-opacity duration-200',
            showRightFade ? 'opacity-100' : 'opacity-0',
          )} />
        </div>

        {/* Right arrow */}
        <ArrowButton
          direction="right"
          onClick={() => onNavigate(Math.min(questions.length - 1, currentIndex + 1))}
          disabled={currentIndex === questions.length - 1}
        />
      </div>

      {/* Footer: progress text + legend */}
      <div className="flex items-center justify-between mt-3 px-1">
        <p className="text-[11px] sm:text-xs text-muted-foreground/70 font-medium tabular-nums">
          <span className="font-bold text-foreground/80">{currentIndex + 1}</span>
          <span className="mx-1 opacity-40">/</span>
          <span>{questions.length}</span>
          <span className="hidden sm:inline ml-2 opacity-50">·</span>
          <span className="hidden sm:inline ml-2 opacity-50">← → para navegar</span>
        </p>

        <ProgressMiniBar questions={questions} currentIndex={currentIndex} />
      </div>
    </motion.div>
  );
};
