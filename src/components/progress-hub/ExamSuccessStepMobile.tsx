import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, Plus, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { ExamInsight } from '@/types/progressHub';

interface ExamSuccessStepMobileProps {
  insight: ExamInsight;
  onAddAnother: () => void;
  onClose: () => void;
}

// Confetti burst component for mobile
const ConfettiBurst: React.FC = () => {
  const [particles, setParticles] = useState<Array<{
    id: number;
    x: number;
    y: number;
    color: string;
    rotation: number;
    scale: number;
  }>>([]);

  useEffect(() => {
    const colors = [
      'hsl(var(--primary))',
      'hsl(142, 76%, 36%)', // emerald
      'hsl(45, 93%, 47%)',  // amber
      'hsl(262, 83%, 58%)', // violet
      'hsl(0, 84%, 60%)',   // rose
    ];

    const newParticles = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 60,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      scale: 0.5 + Math.random() * 0.5,
    }));

    setParticles(newParticles);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          initial={{ 
            opacity: 1, 
            y: '100%',
            x: `${particle.x}%`,
            scale: 0,
            rotate: 0,
          }}
          animate={{ 
            opacity: [1, 1, 0],
            y: [`100%`, `${particle.y}%`],
            scale: particle.scale,
            rotate: particle.rotation,
          }}
          transition={{ 
            duration: 1.2 + Math.random() * 0.5,
            ease: [0.23, 1, 0.32, 1],
          }}
          className="absolute w-3 h-3 rounded-sm"
          style={{ backgroundColor: particle.color }}
        />
      ))}
    </div>
  );
};

export const ExamSuccessStepMobile: React.FC<ExamSuccessStepMobileProps> = ({
  insight,
  onAddAnother,
  onClose,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const { exam, days_remaining, materia_progress, message, status } = insight;

  const getStatusColor = (s: typeof status) => {
    switch (s) {
      case 'critical': return 'text-destructive';
      case 'warning': return 'text-amber-500';
      case 'on_track': return 'text-emerald-500';
      case 'excellent': return 'text-primary';
    }
  };

  return (
    <div className="relative py-8 min-h-[60vh] flex flex-col">
      {/* Confetti animation (if reduced motion allows) */}
      {!shouldReduceMotion && <ConfettiBurst />}

      {/* Success content */}
      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
        {/* Animated checkmark */}
        <motion.div
          initial={shouldReduceMotion ? {} : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
          className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center"
        >
          <motion.div
            initial={shouldReduceMotion ? {} : { scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 300, delay: 0.4 }}
          >
            <Check className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
          </motion.div>
        </motion.div>

        {/* Title */}
        <motion.div
          initial={shouldReduceMotion ? {} : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h3 className="text-2xl font-bold">Prova Adicionada!</h3>
          <p className="text-muted-foreground mt-1 text-base">Boa sorte nos estudos 🎯</p>
        </motion.div>

        {/* Preview card */}
        <motion.div
          initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="w-full bg-muted/50 rounded-2xl p-5 text-left space-y-4"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-lg">{exam.materia}</span>
            {exam.exam_name && (
              <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
                {exam.exam_name}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2 text-base">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <span>{format(new Date(exam.exam_date), "d 'de' MMMM", { locale: ptBR })}</span>
            <span className={cn("font-semibold", getStatusColor(status))}>
              ({days_remaining === 0 ? 'Hoje!' : 
                days_remaining === 1 ? 'Amanhã' : 
                `${days_remaining} dias`})
            </span>
          </div>

          {materia_progress && (
            <div className="space-y-2">
              <Progress value={materia_progress.percentage} className="h-2.5" />
              <p className="text-sm text-muted-foreground">
                {materia_progress.percentage}% concluído • {message}
              </p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Action buttons - Large for mobile */}
      <motion.div
        initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="flex gap-3 pt-4"
      >
        <Button
          variant="outline"
          className="flex-1 h-14 gap-2 rounded-2xl text-base font-medium"
          onClick={onAddAnother}
        >
          <Plus className="h-5 w-5" />
          Adicionar outra
        </Button>
        <Button
          className="flex-1 h-14 rounded-2xl text-base font-semibold"
          onClick={onClose}
        >
          Fechar
        </Button>
      </motion.div>
    </div>
  );
};
