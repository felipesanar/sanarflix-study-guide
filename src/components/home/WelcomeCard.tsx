import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, BookOpen, Sparkles } from 'lucide-react';
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
    if (hour < 12) return { text: 'BOM DIA,', emoji: '☀️' };
    if (hour < 18) return { text: 'BOA TARDE,', emoji: '🌤️' };
    return { text: 'BOA NOITE,', emoji: '🌙' };
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
    <Card className="relative overflow-hidden border-0 bg-card shadow-sm hover:shadow-md transition-shadow duration-300 h-full">
      {/* Subtle background pattern */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.02] dark:opacity-[0.04]">
        <div className="absolute inset-0 [background-image:radial-gradient(circle_at_1px_1px,currentColor_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>
      
      <CardContent className="relative p-6 lg:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          {/* Left content */}
          <div className="flex-1 space-y-4">
            {/* Greeting label */}
            <div className="flex items-center gap-2">
              <span className="text-lg">{greeting.emoji}</span>
              <span className="text-xs font-semibold tracking-widest text-primary uppercase">
                {greeting.text}
              </span>
            </div>
            
            {/* User name */}
            <h1 className="text-3xl lg:text-4xl font-bold text-foreground tracking-tight">
              {user?.nome || 'Estudante'}
            </h1>
            
            {/* Motivational text */}
            <p className="text-muted-foreground text-base max-w-md">
              Pronto para dominar seus estudos hoje? 📚
            </p>
            
            {/* Study Guide icon indicator */}
            <div className="flex items-center gap-2 pt-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
            </div>
          </div>
          
          {/* Right - CTA Button */}
          <div className="flex-shrink-0">
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button 
                onClick={handleContinueStudy}
                size="lg"
                className="group relative h-12 px-6 rounded-xl bg-foreground text-background hover:bg-foreground/90 dark:bg-foreground dark:text-background dark:hover:bg-foreground/90 font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <span>Continuar estudos</span>
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform duration-200" />
              </Button>
            </motion.div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
