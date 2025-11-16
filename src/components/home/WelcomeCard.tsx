import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronRight, BookOpen, Calendar, Settings } from 'lucide-react';
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
      <Card className="relative bg-white/10 dark:bg-card/10 backdrop-blur-xl border border-white/20 dark:border-border/40 ring-1 ring-white/30 shadow-2xl overflow-hidden h-full">
        <div className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 bg-white/20 blur-3xl rounded-full" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
        <CardContent className="relative z-10 py-5 sm:py-6 md:py-7 pr-5 sm:pr-6 md:pr-7 pl-3 sm:pl-6 md:pl-7">
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
              <Button 
                variant="secondary"
                onClick={handleContinueStudy}
                className="relative bg-primary text-primary-foreground hover:bg-primary/90 border border-primary/40 shadow-md transition-all duration-300 group overflow-hidden"
              >
                {/* brilho ao passar o mouse */}
                <span className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="absolute -left-8 top-0 h-full w-16 rotate-12 bg-white/10 blur-sm" />
                </span>
                {hasStudyGuide ? (
                  <>
                    <BookOpen className="mr-2 h-4 w-4" />
                    Continuar estudos
                  </>
                ) : hasCronograma ? (
                  <>
                    <Calendar className="mr-2 h-4 w-4" />
                    Ver cronograma
                  </>
                ) : (
                  <>
                    <Settings className="mr-2 h-4 w-4" />
                    Configurar estudos
                  </>
                )}
                <ChevronRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
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
      </Card>
    </motion.div>
  );
};
