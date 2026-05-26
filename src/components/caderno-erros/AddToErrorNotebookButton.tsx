import React, { useState, useEffect } from 'react';
import { BookMarked, Loader2, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useErrorNotebook } from '@/hooks/useErrorNotebook';
import { useAnalyticsTracker } from '@/hooks/useAnalyticsTracker';
import { Logger } from '@/utils/logger';

interface AddToErrorNotebookButtonProps {
  questionId: string;
  simuladoId: string;
  onOpenDrawer: () => void;
  className?: string;
}

export const AddToErrorNotebookButton: React.FC<AddToErrorNotebookButtonProps> = ({
  questionId,
  simuladoId,
  onOpenDrawer,
  className,
}) => {
  const { checkIfAdded } = useErrorNotebook();
  const { trackEvent } = useAnalyticsTracker();
  const [isAdded, setIsAdded] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsChecking(true);
    checkIfAdded(questionId, simuladoId).then(added => {
      if (!cancelled) {
        setIsAdded(added);
        setIsChecking(false);
      }
    });
    return () => { cancelled = true; };
  }, [questionId, simuladoId, checkIfAdded]);

  const handleClick = () => {
    if (isAdded) return;
    Logger.info('[ErrorNotebook] Add button clicked', { questionId, simuladoId });
    trackEvent({
      eventName: 'ce_add_clicked',
      category: 'interaction',
      data: { simulado_id: simuladoId, question_id: questionId },
    });
    onOpenDrawer();
  };

  if (isChecking) {
    return (
      <Button variant="outline" size="sm" disabled className={cn("gap-2", className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="hidden sm:inline">Verificando...</span>
      </Button>
    );
  }

  if (isAdded) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        className={cn("gap-2 border-green-500/30 text-green-600 dark:text-green-400", className)}
      >
        <Check className="h-4 w-4" />
        <span className="hidden sm:inline">Adicionado ao Caderno</span>
        <span className="sm:hidden">Adicionado</span>
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      className={cn("gap-2 hover:border-primary/50 hover:text-primary transition-colors", className)}
    >
      <BookMarked className="h-4 w-4" />
      <span className="hidden sm:inline">Adicionar ao Caderno de Erros</span>
      <span className="sm:hidden">Caderno de Erros</span>
    </Button>
  );
};
