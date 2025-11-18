import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronRight, BookOpen, Calendar, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getBrazilHour } from '@/utils/timezone';
import { cn } from '@/lib/utils';

interface WelcomeCardProps {
  hasStudyGuide: boolean;
  hasCronograma: boolean;
}

export const WelcomeCard: React.FC<WelcomeCardProps> = ({ hasStudyGuide, hasCronograma }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sheenHover, setSheenHover] = useState(false);

  const getGreeting = () => {
    const hour = getBrazilHour();
    if (hour < 12) return { text: 'Bom dia', emoji: '☀️' };
    if (hour < 18) return { text: 'Boa tarde', emoji: '🌤️' };
    return { text: 'Boa noite', emoji: '🌙' };
  };

  const greeting = getGreeting();

  const handleContinueStudy = () => {
    if (hasStudyGuide) {
      navigate('/guia-estudos');
    } else if (hasCronograma) {
      navigate('/cronograma-enamed');
    } else {
      // Open modal or navigate to study guide setup
      navigate('/guia-estudos');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      style={{ perspective: 1000 }}
      whileHover={{ y: -2 }}
    >
      <Card className="relative isolate bg-white/10 dark:bg-card/10 backdrop-blur-xl ring-1 ring-white/30 shadow-2xl overflow-hidden h-full">
        <div className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 bg-white/20 blur-3xl rounded-full z-0" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 z-0" />
        <CardContent className={cn("relative z-10 py-5 sm:py-6 md:py-7 pr-5 sm:pr-6 md:pr-7 pl-3 sm:pl-6 md:pl-7", hasStudyGuide && "pb-16") }>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-start md:justify-between gap-4 ml-4 md:ml-0">
            <div className="flex-1">
              <div className="flex items-center gap-0 mb-2">
                <span className="text-2xl">{greeting.emoji}</span>
                <p className="text-sm opacity-90 font-medium">{greeting.text},</p>
              </div>
              <h1 className="text-4xl font-bold mb-2">
                {user?.nome || 'Estudante'}
              </h1>
              <p className="text-base opacity-90 max-w-2xl mb-4">
                Pronto para estudar hoje? 📚
              </p>
              
            </div>
            <div className="hidden xl:block">
              <motion.div
                whileHover={{ scale: 1.04, rotateZ: 1 }}
                className="w-32 h-32 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm ring-1 ring-white/20"
              >
                <BookOpen className="h-16 w-16 text-white" />
              </motion.div>
            </div>
          </div>
          
        </CardContent>
        {hasStudyGuide && (
          <div className="absolute bottom-4 right-4 z-20">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.985 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="transform-gpu"
            >
              <Button 
                variant="secondary"
                onClick={handleContinueStudy}
                className="relative inline-flex items-center gap-1.5 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full font-semibold tracking-wide bg-red-50 text-foreground hover:bg-red-100 border border-red-200 shadow-xl ring-1 ring-red-200 dark:bg-neutral-900 dark:text-white dark:border-white/10 dark:ring-white/10 hover:shadow-2xl transition-all duration-300 group overflow-hidden"
                
              >
                <span className="pointer-events-none absolute inset-0 opacity-90">
                  <span
                    className="absolute inset-0 hidden dark:block"
                    style={{
                      backgroundImage:
                        'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 30%, rgba(255,255,255,0.01) 50%, rgba(255,255,255,0.03) 70%, rgba(255,255,255,0.07) 100%)',
                    }}
                  />
                  <span
                    className="absolute inset-0 dark:hidden"
                    style={{
                      backgroundImage:
                        'linear-gradient(135deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.08) 35%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.10) 70%, rgba(255,255,255,0.18) 100%)',
                    }}
                  />
                </span>
                Continuar estudos
                <ChevronRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
              </Button>
            </motion.div>
          </div>
        )}
      </Card>
    </motion.div>
  );
};
