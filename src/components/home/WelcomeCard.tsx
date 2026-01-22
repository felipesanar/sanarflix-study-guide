import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getBrazilHour } from '@/utils/timezone';

interface WelcomeCardProps {
  hasStudyGuide: boolean;
  hasCronograma: boolean;
}

export const WelcomeCard: React.FC<WelcomeCardProps> = ({ hasStudyGuide, hasCronograma }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const getGreeting = () => {
    const hour = getBrazilHour();
    if (hour < 12) return { text: 'Bom dia,', emoji: '☀️', period: 'morning' };
    if (hour < 18) return { text: 'Boa tarde,', emoji: '🌤️', period: 'afternoon' };
    return { text: 'Boa noite,', emoji: '🌙', period: 'evening' };
  };

  const greeting = getGreeting();

  const handleContinueStudy = () => {
    if (hasStudyGuide) {
      navigate('/guia-estudos');
    } else if (hasCronograma) {
      navigate('/cronograma-enamed');
    } else {
      navigate('/guia-estudos');
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl card-hero-glass h-full">
      {/* Gradient mesh background */}
      <div className="absolute inset-0 gradient-hero-light dark:gradient-hero-dark opacity-60" />
      
      {/* Decorative gradient orbs */}
      <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-primary/5 dark:bg-primary/10 blur-3xl" />
      <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-blue-500/5 dark:bg-blue-500/8 blur-3xl" />
      
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02] dark:opacity-[0.04]">
        <div className="absolute inset-0 [background-image:radial-gradient(circle_at_1px_1px,currentColor_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>
      
      {/* Content */}
      <div className="relative p-6 md:p-8 lg:p-10">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 lg:gap-8">
          {/* Left content */}
          <div className="flex-1 space-y-4 md:space-y-5">
            {/* Greeting badge */}
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-primary/8 dark:bg-primary/15 border border-primary/10 dark:border-primary/20"
            >
              <span className="text-lg">{greeting.emoji}</span>
              <span className="text-sm font-medium text-primary tracking-wide">
                {greeting.text}
              </span>
            </motion.div>
            
            {/* User name - Hero typography */}
            <motion.h1 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight"
            >
              {user?.nome || 'Estudante'}
            </motion.h1>
            
            {/* Motivational subtext */}
            <motion.p 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="text-muted-foreground text-base md:text-lg max-w-md leading-relaxed"
            >
              Pronto para conquistar seus objetivos hoje?
            </motion.p>
            
            {/* Feature indicators */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.4 }}
              className="flex items-center gap-3 pt-2"
            >
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 dark:bg-muted/30">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-medium text-muted-foreground">Plano personalizado</span>
              </div>
              {hasStudyGuide && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15">
                  <Zap className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Guia ativo</span>
                </div>
              )}
            </motion.div>
          </div>
          
          {/* Right - CTA Button */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="flex-shrink-0"
          >
            <motion.div
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              className="relative"
            >
              {/* Glow effect */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary to-primary/80 blur-xl opacity-30 dark:opacity-40 group-hover:opacity-50 transition-opacity" />
              
              <Button 
                onClick={handleContinueStudy}
                size="lg"
                className="relative group h-14 px-8 rounded-xl bg-gradient-to-r from-primary to-primary/90 hover:from-primary/95 hover:to-primary/85 text-primary-foreground font-semibold shadow-lg hover:shadow-xl transition-all duration-300 text-base"
              >
                <span>Continuar estudos</span>
                <ArrowRight className="ml-2.5 h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
