import React, { useState, useCallback, useMemo } from 'react';
import { RotateCcw, Check, X, ArrowRight, Trophy, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Progress } from '@/components/ui/progress';
import { ErrorNotebookEntry, ErrorReason, REASON_LABELS } from '@/hooks/useErrorNotebook';
import { useAnalyticsTracker } from '@/hooks/useAnalyticsTracker';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface FlashcardModeProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  entries: ErrorNotebookEntry[];
}

const REASON_COLORS: Record<ErrorReason, string> = {
  did_not_know: 'bg-red-500/10 text-red-600 dark:text-red-400',
  did_not_remember: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  did_not_understand_statement: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  answered_without_confidence: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
};

export const FlashcardMode: React.FC<FlashcardModeProps> = ({ isOpen, onOpenChange, entries }) => {
  const isMobile = useIsMobile();
  const { trackEvent } = useAnalyticsTracker();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [results, setResults] = useState<('remembered' | 'forgot')[]>([]);
  const [isFinished, setIsFinished] = useState(false);

  const shuffled = useMemo(() => {
    const arr = [...entries];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [entries]);

  const current = shuffled[currentIndex];
  const progress = entries.length > 0 ? ((currentIndex) / entries.length) * 100 : 0;

  const resetState = useCallback(() => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setResults([]);
    setIsFinished(false);
  }, []);

  const handleOpen = useCallback((open: boolean) => {
    if (open) {
      resetState();
      trackEvent({ eventName: 'ce_flashcard_started', category: 'interaction', data: { total: entries.length } });
    }
    onOpenChange(open);
  }, [onOpenChange, resetState, trackEvent, entries.length]);

  const handleAnswer = useCallback((answer: 'remembered' | 'forgot') => {
    const newResults = [...results, answer];
    setResults(newResults);

    if (currentIndex + 1 >= shuffled.length) {
      const remembered = newResults.filter(r => r === 'remembered').length;
      const forgot = newResults.filter(r => r === 'forgot').length;
      trackEvent({
        eventName: 'ce_flashcard_completed',
        category: 'interaction',
        data: { total: newResults.length, remembered, forgot },
      });
      setIsFinished(true);
    } else {
      setCurrentIndex(prev => prev + 1);
      setIsFlipped(false);
    }
  }, [currentIndex, results, shuffled.length, trackEvent]);

  const rememberedCount = results.filter(r => r === 'remembered').length;
  const forgotCount = results.filter(r => r === 'forgot').length;

  const content = (
    <div className="flex flex-col h-full min-h-[400px]">
      {isFinished ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 px-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Trophy className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">Revisão concluída!</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {results.length} cards revisados
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{rememberedCount}</p>
                <p className="text-xs text-muted-foreground">Lembrei</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{forgotCount}</p>
                <p className="text-xs text-muted-foreground">Não lembrei</p>
              </CardContent>
            </Card>
          </div>
          <p className="text-lg font-semibold text-foreground">
            {results.length > 0 ? Math.round((rememberedCount / results.length) * 100) : 0}% de acerto
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={resetState} className="gap-2">
              <RotateCcw className="h-4 w-4" /> Refazer
            </Button>
            <Button onClick={() => handleOpen(false)}>Fechar</Button>
          </div>
        </div>
      ) : current ? (
        <div className="flex-1 flex flex-col">
          {/* Progress */}
          <div className="px-4 pt-2 pb-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>{currentIndex + 1} de {shuffled.length}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>

          {/* Card */}
          <div className="flex-1 flex items-center justify-center px-4 pb-4">
            <Card
              className={cn(
                "w-full max-w-lg cursor-pointer transition-all duration-300 hover:shadow-md min-h-[220px] flex",
                isFlipped && "ring-2 ring-primary/30"
              )}
              onClick={() => setIsFlipped(!isFlipped)}
            >
              <CardContent className="p-6 flex-1 flex flex-col justify-center">
                {!isFlipped ? (
                  <div className="space-y-4 text-center">
                    <Brain className="h-8 w-8 text-muted-foreground mx-auto" />
                    <div className="space-y-2">
                      {current.grande_area && (
                        <p className="text-xs text-muted-foreground">{current.grande_area}</p>
                      )}
                      <p className="text-lg font-semibold text-foreground">
                        {current.tema || current.especialidade || 'Sem tema'}
                      </p>
                      <Badge variant="outline" className={cn("text-xs", REASON_COLORS[current.reason as ErrorReason])}>
                        {REASON_LABELS[current.reason as ErrorReason]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Toque para ver o aprendizado</p>
                  </div>
                ) : (
                  <div className="space-y-4 text-center">
                    <p className="text-sm text-foreground leading-relaxed">
                      {current.learning_text || (
                        <span className="text-muted-foreground italic">Nenhum aprendizado registrado</span>
                      )}
                    </p>
                    {current.simulado_nome && (
                      <p className="text-xs text-muted-foreground">
                        Simulado: {current.simulado_nome}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <div className="px-4 pb-6 flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="lg"
              onClick={() => handleAnswer('forgot')}
              className="gap-2 border-red-500/30 hover:bg-red-500/10 text-red-600 dark:text-red-400 flex-1 max-w-[160px]"
            >
              <X className="h-5 w-5" /> Não lembrei
            </Button>
            <Button
              size="lg"
              onClick={() => handleAnswer('remembered')}
              className="gap-2 bg-green-600 hover:bg-green-700 text-white flex-1 max-w-[160px]"
            >
              <Check className="h-5 w-5" /> Lembrei
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={handleOpen}>
        <DrawerContent className="max-h-[95vh]">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Modo Revisão
            </DrawerTitle>
          </DrawerHeader>
          {content}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpen}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Modo Revisão
          </DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
};
