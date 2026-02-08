import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Rocket, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  userName?: string;
  type?: 'first_access' | 'no_filter_results';
  onClearFilters?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  userName,
  type = 'first_access',
  onClearFilters,
}) => {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  const getAnimationProps = (props: object) => shouldReduceMotion ? {} : props;

  if (type === 'no_filter_results') {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <BookOpen className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          </div>
          <h3 className="text-lg font-medium mb-2">Nenhum resultado</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm">
            Os filtros aplicados não retornaram nenhum conteúdo. Tente ajustar sua busca.
          </p>
          {onClearFilters && (
            <Button 
              variant="outline" 
              onClick={onClearFilters}
              className="focus-visible:ring-2 focus-visible:ring-ring"
            >
              Limpar filtros
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // First access empty state
  return (
    <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary/5 via-background to-primary/10">
      {/* Background pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" aria-hidden="true">
        <div className="absolute inset-0 [background-image:radial-gradient(circle_at_1px_1px,currentColor_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>

      <CardContent className="relative flex flex-col items-center justify-center py-12 sm:py-16 text-center px-6">
        {/* Animated icon */}
        <motion.div
          {...getAnimationProps({
            initial: { scale: 0, rotate: -10 },
            animate: { scale: 1, rotate: 0 },
            transition: { type: 'spring', stiffness: 200, damping: 15 }
          })}
          className="relative mb-6"
        >
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
            <Rocket className="h-10 w-10 text-primary-foreground" aria-hidden="true" />
          </div>
          <motion.div
            {...getAnimationProps({
              initial: { scale: 0 },
              animate: { scale: 1 },
              transition: { delay: 0.3 }
            })}
            className="absolute -top-2 -right-2"
          >
            <Sparkles className="h-6 w-6 text-yellow-500" aria-hidden="true" />
          </motion.div>
        </motion.div>

        {/* Text content */}
        <motion.div
          {...getAnimationProps({
            initial: { opacity: 0, y: 20 },
            animate: { opacity: 1, y: 0 },
            transition: { delay: 0.2 }
          })}
          className="space-y-3 mb-8"
        >
          <h2 className="text-2xl sm:text-3xl font-bold">
            {userName ? `Olá, ${userName.split(' ')[0]}! 👋` : 'Hora de começar!'}
          </h2>
          <p className="text-muted-foreground max-w-md">
            Sua jornada começa agora. Acesse o Guia de Estudos, conclua sua primeira aula 
            e veja seu progresso crescer aqui.
          </p>
        </motion.div>

        {/* CTA */}
        <motion.div
          {...getAnimationProps({
            initial: { opacity: 0, y: 10 },
            animate: { opacity: 1, y: 0 },
            transition: { delay: 0.4 }
          })}
        >
          <Button
            size="lg"
            onClick={() => navigate('/guia-estudos')}
            className="gap-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <BookOpen className="h-5 w-5" aria-hidden="true" />
            Começar a estudar
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </motion.div>

        {/* Tips */}
        <motion.div
          {...getAnimationProps({
            initial: { opacity: 0 },
            animate: { opacity: 1 },
            transition: { delay: 0.6 }
          })}
          className="mt-10 flex flex-wrap justify-center gap-4 text-xs text-muted-foreground"
        >
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" />
            <span>Acompanhe seu progresso</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-blue-500" aria-hidden="true" />
            <span>Mantenha sua sequência</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-purple-500" aria-hidden="true" />
            <span>Conquiste seu semestre</span>
          </div>
        </motion.div>
      </CardContent>
    </Card>
  );
};
