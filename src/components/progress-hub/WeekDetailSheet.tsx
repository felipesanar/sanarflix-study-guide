import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, ChevronRight, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { format, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface WeekDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weekStart: string | null;
  completedCount: number;
}

export const WeekDetailSheet: React.FC<WeekDetailSheetProps> = ({
  open,
  onOpenChange,
  weekStart,
  completedCount,
}) => {
  const navigate = useNavigate();

  if (!weekStart) return null;

  const weekStartDate = parseISO(weekStart);
  const weekEndDate = endOfWeek(weekStartDate, { weekStartsOn: 1 });

  const formattedRange = `${format(weekStartDate, "dd 'de' MMMM", { locale: ptBR })} - ${format(weekEndDate, "dd 'de' MMMM", { locale: ptBR })}`;

  const handleViewAll = () => {
    onOpenChange(false);
    navigate('/guia-estudos');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Semana
          </SheetTitle>
          <SheetDescription>
            {formattedRange}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Summary */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-primary/5 border border-primary/10">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completedCount}</p>
                <p className="text-sm text-muted-foreground">
                  {completedCount === 1 ? 'aula concluída' : 'aulas concluídas'}
                </p>
              </div>
            </div>
            <Badge 
              variant="secondary" 
              className={cn(
                completedCount >= 10 && "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
                completedCount >= 5 && completedCount < 10 && "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
                completedCount < 5 && "bg-muted text-muted-foreground"
              )}
            >
              {completedCount >= 10 ? 'Excelente!' : completedCount >= 5 ? 'Bom ritmo' : 'Continue!'}
            </Badge>
          </div>

          {/* Motivational message */}
          <div className="text-center py-4">
            {completedCount >= 10 ? (
              <>
                <p className="text-lg font-semibold">🎉 Semana produtiva!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Você está arrasando nos estudos
                </p>
              </>
            ) : completedCount >= 5 ? (
              <>
                <p className="text-lg font-semibold">💪 Bom trabalho!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Mantenha a consistência
                </p>
              </>
            ) : completedCount > 0 ? (
              <>
                <p className="text-lg font-semibold">🌱 Um começo!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Cada aula conta. Continue!
                </p>
              </>
            ) : (
              <>
                <p className="text-lg font-semibold">📚 Hora de estudar!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Comece com uma aula rápida
                </p>
              </>
            )}
          </div>

          {/* CTA */}
          <Button
            className="w-full"
            onClick={handleViewAll}
          >
            Ver Guia de Estudos
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
