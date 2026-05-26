import React from 'react';
import { motion } from 'framer-motion';
import { MessageSquarePlus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useFeedback } from './FeedbackProvider';

export const FeedbackFab: React.FC = () => {
  const { openFeedback } = useFeedback();
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -2, scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => openFeedback()}
            aria-label="Enviar feedback"
            className="relative inline-flex items-center justify-center w-10 h-10 rounded-xl bg-card border border-border hover:border-primary/40 shadow-lg transition-all"
          >
            <MessageSquarePlus className="h-5 w-5 text-primary" />
            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
          </motion.button>
        </TooltipTrigger>
        <TooltipContent side="left" className="text-xs">
          Conte pra gente <span className="ml-1 opacity-60">(Shift+F)</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
