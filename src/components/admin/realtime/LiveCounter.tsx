import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface LiveCounterProps {
  value: number;
  label: string;
  icon: React.ReactNode;
  colorClass?: string;
  showPulse?: boolean;
}

export const LiveCounter = ({
  value,
  label,
  icon,
  colorClass = 'text-primary',
  showPulse = false,
}: LiveCounterProps) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (value !== displayValue) {
      setIsAnimating(true);
      
      // Animate number change
      const steps = 10;
      const diff = value - displayValue;
      const stepValue = diff / steps;
      let current = displayValue;
      let step = 0;

      const interval = setInterval(() => {
        step++;
        current += stepValue;
        setDisplayValue(Math.round(current));

        if (step >= steps) {
          setDisplayValue(value);
          clearInterval(interval);
          setTimeout(() => setIsAnimating(false), 300);
        }
      }, 30);

      return () => clearInterval(interval);
    }
  }, [value, displayValue]);

  return (
    <div className="relative flex flex-col items-center justify-center p-4 rounded-xl bg-card border">
      {/* Pulse effect when value changes */}
      <AnimatePresence>
        {(showPulse || isAnimating) && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0.5 }}
            animate={{ scale: 1.5, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="absolute inset-0 rounded-xl bg-primary/20"
          />
        )}
      </AnimatePresence>

      <div className={cn('mb-2', colorClass)}>{icon}</div>
      
      <motion.div
        key={displayValue}
        initial={isAnimating ? { scale: 1.2, opacity: 0.8 } : false}
        animate={{ scale: 1, opacity: 1 }}
        className={cn('text-3xl font-bold tabular-nums', colorClass)}
      >
        {displayValue.toLocaleString('pt-BR')}
      </motion.div>
      
      <p className="text-xs text-muted-foreground mt-1 text-center">{label}</p>

      {/* Live indicator */}
      {showPulse && (
        <div className="absolute top-2 right-2 flex items-center gap-1">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
        </div>
      )}
    </div>
  );
};
