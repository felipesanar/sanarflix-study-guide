import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Trophy, Star, Sparkles, PartyPopper, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type MilestoneType = 25 | 50 | 75 | 100;

interface MilestoneCelebrationProps {
  milestone: MilestoneType;
  materiaName?: string;
  onClose: () => void;
  autoClose?: boolean;
  autoCloseDelay?: number;
}

const MILESTONE_CONFIG: Record<MilestoneType, {
  icon: typeof Trophy;
  title: string;
  message: string;
  emoji: string;
  bgGradient: string;
  iconColor: string;
}> = {
  25: {
    icon: Star,
    title: 'Bom começo!',
    message: 'Você completou 25% do conteúdo.',
    emoji: '⭐',
    bgGradient: 'from-blue-500/10 via-blue-500/5 to-transparent',
    iconColor: 'text-blue-500'
  },
  50: {
    icon: Trophy,
    title: 'Metade do caminho!',
    message: 'Você já está na metade. Continue assim!',
    emoji: '🏆',
    bgGradient: 'from-amber-500/10 via-amber-500/5 to-transparent',
    iconColor: 'text-amber-500'
  },
  75: {
    icon: Sparkles,
    title: 'Quase lá!',
    message: 'Falta pouco para dominar tudo.',
    emoji: '✨',
    bgGradient: 'from-purple-500/10 via-purple-500/5 to-transparent',
    iconColor: 'text-purple-500'
  },
  100: {
    icon: PartyPopper,
    title: 'Concluído!',
    message: 'Você dominou todo o conteúdo!',
    emoji: '🎉',
    bgGradient: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
    iconColor: 'text-emerald-500'
  }
};

export const MilestoneCelebration: React.FC<MilestoneCelebrationProps> = ({
  milestone,
  materiaName,
  onClose,
  autoClose = true,
  autoCloseDelay = 5000,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const config = MILESTONE_CONFIG[milestone];
  const Icon = config.icon;

  // Auto-close timer
  useEffect(() => {
    if (!autoClose) return;
    
    const timer = setTimeout(onClose, autoCloseDelay);
    return () => clearTimeout(timer);
  }, [autoClose, autoCloseDelay, onClose]);

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 20 }}
      className={cn(
        "fixed bottom-24 left-4 right-4 sm:left-auto sm:right-6 sm:w-80 z-50",
        "rounded-2xl border shadow-2xl overflow-hidden",
        "bg-gradient-to-br",
        config.bgGradient,
        "bg-background"
      )}
      role="alert"
      aria-live="polite"
    >
      {/* Confetti animation (only for 100%) */}
      {milestone === 100 && !shouldReduceMotion && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ 
                x: Math.random() * 100 + '%', 
                y: -10, 
                rotate: 0,
                opacity: 1 
              }}
              animate={{ 
                y: '120%', 
                rotate: Math.random() * 360,
                opacity: 0 
              }}
              transition={{ 
                duration: 2 + Math.random(), 
                delay: Math.random() * 0.5,
                ease: 'easeOut'
              }}
              className={cn(
                "absolute w-2 h-2 rounded-sm",
                i % 3 === 0 ? 'bg-emerald-400' : i % 3 === 1 ? 'bg-yellow-400' : 'bg-blue-400'
              )}
            />
          ))}
        </div>
      )}

      <div className="relative p-4">
        {/* Close button */}
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 h-8 w-8 p-0"
          onClick={onClose}
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </Button>

        <div className="flex items-start gap-4 pr-8">
          {/* Icon */}
          <motion.div
            initial={shouldReduceMotion ? {} : { scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
            className={cn(
              "flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center",
              "bg-gradient-to-br from-background to-muted shadow-inner"
            )}
          >
            <Icon className={cn("h-6 w-6", config.iconColor)} aria-hidden="true" />
          </motion.div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <motion.p
              initial={shouldReduceMotion ? {} : { opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="font-bold text-lg flex items-center gap-2"
            >
              {config.title}
              <span className="text-xl" aria-hidden="true">{config.emoji}</span>
            </motion.p>
            <motion.p
              initial={shouldReduceMotion ? {} : { opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-sm text-muted-foreground mt-0.5"
            >
              {materiaName ? (
                <>
                  <span className="font-medium text-foreground">{materiaName}</span>
                  {': '}
                  {config.message}
                </>
              ) : (
                config.message
              )}
            </motion.p>
          </div>
        </div>

        {/* Progress indicator for auto-close */}
        {autoClose && (
          <motion.div
            initial={{ scaleX: 1 }}
            animate={{ scaleX: 0 }}
            transition={{ duration: autoCloseDelay / 1000, ease: 'linear' }}
            className="absolute bottom-0 left-0 right-0 h-1 bg-primary/30 origin-left"
          />
        )}
      </div>
    </motion.div>
  );
};

// Hook to manage celebration state
export const useMilestoneCelebration = () => {
  const [celebration, setCelebration] = useState<{
    milestone: MilestoneType;
    materiaName?: string;
  } | null>(null);

  const showCelebration = (milestone: MilestoneType, materiaName?: string) => {
    setCelebration({ milestone, materiaName });
  };

  const hideCelebration = () => {
    setCelebration(null);
  };

  const CelebrationComponent = celebration ? (
    <AnimatePresence>
      <MilestoneCelebration
        milestone={celebration.milestone}
        materiaName={celebration.materiaName}
        onClose={hideCelebration}
      />
    </AnimatePresence>
  ) : null;

  return {
    showCelebration,
    hideCelebration,
    CelebrationComponent,
    isShowing: celebration !== null
  };
};
