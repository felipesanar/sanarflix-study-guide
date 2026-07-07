import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BulkStepperProps {
  /** Rótulo de cada passo, na ordem de exibição. */
  steps: string[];
  /** Passo atual, 1-indexado. */
  currentStep: number;
  className?: string;
}

/** Stepper visual reutilizável para os wizards de importação: círculos numerados + linha, passo ativo bg-primary. */
export function BulkStepper({ steps, currentStep, className }: BulkStepperProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2 text-xs', className)}>
      {steps.map((label, idx) => {
        const n = idx + 1;
        const isActive = currentStep === n;
        const isDone = currentStep > n;
        return (
          <div key={label} className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono font-semibold',
                isDone && 'bg-primary/20 text-primary',
                isActive && 'bg-primary text-primary-foreground',
                !isActive && !isDone && 'bg-muted text-muted-foreground',
              )}
            >
              {isDone ? <Check className="h-3 w-3" /> : n}
            </div>
            <span className={cn(isActive ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{label}</span>
            {idx < steps.length - 1 && <div className="h-px w-8 bg-border" aria-hidden />}
          </div>
        );
      })}
    </div>
  );
}
