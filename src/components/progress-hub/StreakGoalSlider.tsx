import React, { useState, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Target, Settings2 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface StreakGoalSliderProps {
  currentGoal: number;
  onGoalChange: (goal: number) => void;
  disabled?: boolean;
}

const GOAL_DESCRIPTIONS: Record<number, string> = {
  2: 'Ritmo leve',
  3: 'Ritmo equilibrado',
  4: 'Ritmo intenso',
  5: 'Ritmo máximo',
};

export const StreakGoalSlider: React.FC<StreakGoalSliderProps> = ({
  currentGoal,
  onGoalChange,
  disabled = false,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [tempGoal, setTempGoal] = useState(currentGoal);
  const [open, setOpen] = useState(false);

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setTempGoal(currentGoal);
    }
    setOpen(isOpen);
  };

  const handleApply = useCallback(() => {
    onGoalChange(tempGoal);
    setOpen(false);
  }, [tempGoal, onGoalChange]);

  const hasChanges = tempGoal !== currentGoal;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 px-2 gap-1.5 text-xs text-muted-foreground hover:text-foreground",
            "focus-visible:ring-2 focus-visible:ring-ring"
          )}
          disabled={disabled}
          aria-label="Configurar meta semanal"
        >
          <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Ajustar meta</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        align="end" 
        className="w-72"
        sideOffset={8}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" aria-hidden="true" />
            <h4 className="font-medium text-sm">Meta semanal</h4>
          </div>

          <p className="text-xs text-muted-foreground">
            Quantos dias por semana você quer estudar?
          </p>

          <div className="space-y-3">
            {/* Goal display */}
            <div className="flex items-center justify-between">
              <motion.span
                key={tempGoal}
                initial={shouldReduceMotion ? {} : { scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-3xl font-bold text-primary"
              >
                {tempGoal}
              </motion.span>
              <span className="text-sm text-muted-foreground">
                {tempGoal === 1 ? 'dia' : 'dias'} / semana
              </span>
            </div>

            {/* Slider */}
            <Slider
              value={[tempGoal]}
              onValueChange={([value]) => setTempGoal(value)}
              min={2}
              max={5}
              step={1}
              className="py-2"
              aria-label="Meta de dias por semana"
            />

            {/* Labels */}
            <div className="flex justify-between text-[10px] text-muted-foreground px-1">
              <span>2</span>
              <span>3</span>
              <span>4</span>
              <span>5</span>
            </div>

            {/* Description */}
            <motion.div
              key={tempGoal}
              initial={shouldReduceMotion ? {} : { opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <span className="text-sm font-medium text-muted-foreground">
                {GOAL_DESCRIPTIONS[tempGoal]}
              </span>
            </motion.div>
          </div>

          {/* Apply button */}
          <Button
            onClick={handleApply}
            size="sm"
            className="w-full focus-visible:ring-2 focus-visible:ring-ring"
            disabled={!hasChanges}
          >
            {hasChanges ? 'Salvar meta' : 'Meta atual'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
