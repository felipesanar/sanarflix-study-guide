import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronRight, BookOpen, Calendar, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface WelcomeCardProps {
  hasStudyGuide: boolean;
  hasCronograma: boolean;
}

export const WelcomeCard: React.FC<WelcomeCardProps> = ({ hasStudyGuide, hasCronograma }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const getGreeting = () => {
    const hour = new Date().getHours();
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
      <Card className="relative border-0 bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-primary-foreground shadow-2xl overflow-hidden h-full">
        {/* brilho radial dinâmico */}
        <div className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 bg-white/10 blur-3xl rounded-full" />
        <CardContent className="p-7">
          <div className="flex items-center justify-between h-full">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-sm opacity-90 font-medium">{greeting.text},</p>
                <span className="text-2xl">{greeting.emoji}</span>
              </div>
              <h1 className="text-4xl font-bold mb-3">
                {user?.nome || 'Estudante'}
              </h1>
              <p className="text-base opacity-90 max-w-2xl mb-6">
                Pronto para estudar hoje? 📚
              </p>
              <Button 
                variant="secondary"
                onClick={handleContinueStudy}
                className="relative bg-white/10 hover:bg-white/20 border border-white/30 backdrop-blur-sm transition-all duration-300 group overflow-hidden"
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
