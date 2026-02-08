import React from 'react';
import { motion, AnimatePresence, useReducedMotion, Variants } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Play, Calendar } from 'lucide-react';

interface MobileStickyCtaBarProps {
  visible: boolean;
  onContinue: () => void;
  onOrganize: () => void;
}

export const MobileStickyCtaBar: React.FC<MobileStickyCtaBarProps> = ({
  visible,
  onContinue,
  onOrganize,
}) => {
  const shouldReduceMotion = useReducedMotion();

  const variants: Variants = shouldReduceMotion ? {} : {
    hidden: { y: 100, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', bounce: 0.2, duration: 0.4 } },
    exit: { y: 100, opacity: 0, transition: { duration: 0.2 } },
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={variants}
          className="fixed bottom-0 left-0 right-0 z-50 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 px-4 bg-background/95 backdrop-blur-lg border-t border-border/50"
          style={{ 
            // Avoid conflict with bottom nav (add extra padding if needed)
            paddingBottom: 'calc(env(safe-area-inset-bottom) + 4.5rem)' 
          }}
        >
          <div className="flex gap-3 max-w-md mx-auto">
            <Button
              onClick={onContinue}
              className="flex-1 h-12 gap-2 text-sm font-semibold rounded-xl shadow-lg shadow-primary/20"
            >
              <Play className="h-4 w-4" fill="currentColor" />
              Continuar
            </Button>
            <Button
              onClick={onOrganize}
              variant="outline"
              className="h-12 px-5 gap-2 text-sm font-medium rounded-xl"
            >
              <Calendar className="h-4 w-4" />
              Organizar
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
