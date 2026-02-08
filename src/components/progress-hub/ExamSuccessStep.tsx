import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, Plus, Calendar, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { ExamInsight } from '@/types/progressHub';

interface ExamSuccessStepProps {
  insight: ExamInsight;
  onAddAnother: () => void;
  onClose: () => void;
}

// Confetti particle component
const ConfettiParticle: React.FC<{ index: number }> = ({ index }) => {
  const colors = [
    'bg-primary',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-blue-500',
    'bg-pink-500',
    'bg-purple-500',
  ];

  const randomColor = colors[index % colors.length];
  const randomX = Math.random() * 200 - 100;
  const randomDelay = Math.random() * 0.3;
  const randomDuration = 1 + Math.random() * 0.5;
  const randomRotation = Math.random() * 720 - 360;
  const size = 6 + Math.random() * 6;

  return (
    <motion.div
      initial={{
        opacity: 1,
        x: 0,
        y: 0,
        rotate: 0,
        scale: 1,
      }}
      animate={{
        opacity: 0,
        x: randomX,
        y: 150 + Math.random() * 100,
        rotate: randomRotation,
        scale: 0,
      }}
      transition={{
        duration: randomDuration,
        delay: randomDelay,
        ease: "easeOut",
      }}
      className={cn(
        "absolute rounded-sm",
        randomColor
      )}
      style={{
        width: size,
        height: size,
        left: '50%',
        top: '20%',
      }}
    />
  );
};

// Confetti burst component
const ConfettiBurst: React.FC = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 24 }).map((_, i) => (
        <ConfettiParticle key={i} index={i} />
      ))}
    </div>
  );
};

export const ExamSuccessStep: React.FC<ExamSuccessStepProps> = ({
  insight,
  onAddAnother,
  onClose,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (!shouldReduceMotion) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [shouldReduceMotion]);

  const percentage = insight.materia_progress?.percentage || 0;

  // Format exam date - parse correctly to avoid timezone issues
  const [year, month, day] = insight.exam.exam_date.split('-').map(Number);
  const examDateParsed = new Date(year, month - 1, day);
  const formattedDate = format(
    examDateParsed,
    "d 'de' MMMM",
    { locale: ptBR }
  );

  return (
    <div className="relative flex flex-col items-center justify-center h-full text-center space-y-6 py-4">
      {/* Confetti animation */}
      {showConfetti && <ConfettiBurst />}

      {/* Animated checkmark */}
      <motion.div
        initial={shouldReduceMotion ? {} : { scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{
          type: "spring",
          stiffness: 200,
          damping: 15,
          delay: 0.1,
        }}
        className="relative"
      >
        {/* Glow effect */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: [0, 0.5, 0], scale: [0.5, 1.5, 2] }}
          transition={{ duration: 1, delay: 0.2 }}
          className="absolute inset-0 rounded-full bg-primary/20 blur-xl"
        />
        
        {/* Check circle */}
        <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center shadow-lg shadow-primary/30">
          <motion.div
            initial={shouldReduceMotion ? {} : { scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 300 }}
          >
            <Check className="h-10 w-10 text-primary-foreground" strokeWidth={3} />
          </motion.div>
        </div>
      </motion.div>

      {/* Success message */}
      <motion.div
        initial={shouldReduceMotion ? {} : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="space-y-1"
      >
        <h3 className="text-2xl font-bold flex items-center gap-2 justify-center">
          <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
          Prova Adicionada!
        </h3>
        <p className="text-muted-foreground">Boa sorte nos estudos 🎯</p>
      </motion.div>

      {/* Exam preview card */}
      <motion.div
        initial={shouldReduceMotion ? {} : { opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
        className="w-full max-w-sm bg-gradient-to-br from-card to-muted/30 rounded-2xl p-5 text-left space-y-4 border shadow-lg"
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-0.5">
            <h4 className="font-semibold text-lg">{insight.exam.materia}</h4>
            {insight.exam.exam_name && (
              <p className="text-sm text-muted-foreground">
                {insight.exam.exam_name}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-sm bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
            {insight.days_remaining}d
          </div>
        </div>

        {/* Date */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" aria-hidden="true" />
          <span>{formattedDate}</span>
        </div>

        {/* Progress */}
        {insight.materia_progress && (
          <div className="space-y-2">
            <Progress value={percentage} className="h-2.5" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {insight.materia_progress.completed}/{insight.materia_progress.total} aulas
              </span>
              <span className="font-medium">{percentage}%</span>
            </div>
          </div>
        )}

        {/* Message */}
        <p className="text-sm text-muted-foreground italic">
          {insight.message}
        </p>
      </motion.div>

      {/* Action buttons */}
      <motion.div
        initial={shouldReduceMotion ? {} : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="flex gap-3 w-full max-w-sm pt-2"
      >
        <Button
          variant="outline"
          className="flex-1 h-12 gap-2 rounded-xl"
          onClick={onAddAnother}
        >
          <Plus className="h-4 w-4" />
          Adicionar outra
        </Button>
        <Button
          className="flex-1 h-12 rounded-xl font-medium"
          onClick={onClose}
        >
          Fechar
        </Button>
      </motion.div>
    </div>
  );
};
