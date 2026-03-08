import React, { useState, useRef } from 'react';
import { Pencil, Trash2, ExternalLink, Loader2, Check, X, Undo2, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ToastAction } from '@/components/ui/toast';
import { ErrorNotebookEntry, ErrorReason, REASON_LABELS, useErrorNotebook } from '@/hooks/useErrorNotebook';
import { useAnalyticsTracker } from '@/hooks/useAnalyticsTracker';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ErrorNotebookItemProps {
  entry: ErrorNotebookEntry;
  onDeleted: () => void;
  onUpdated: () => void;
  showRecurrence?: boolean;
  recurrenceCount?: number;
}

const REASON_COLORS: Record<ErrorReason, string> = {
  did_not_know: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  did_not_remember: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  did_not_understand_statement: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  answered_without_confidence: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
};

export const ErrorNotebookItem: React.FC<ErrorNotebookItemProps> = ({
  entry,
  onDeleted,
  onUpdated,
  showRecurrence,
  recurrenceCount,
}) => {
  const { updateEntry, deleteEntry, restoreEntry } = useErrorNotebook();
  const { trackEvent } = useAnalyticsTracker();
  const [isEditing, setIsEditing] = useState(false);
  const [editReason, setEditReason] = useState<ErrorReason>(entry.reason as ErrorReason);
  const [editLearning, setEditLearning] = useState(entry.learning_text || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleSaveEdit = async () => {
    setIsSaving(true);
    const success = await updateEntry(entry.id, {
      reason: editReason,
      learning_text: editLearning || null,
    });
    setIsSaving(false);
    if (success) {
      setIsEditing(false);
      toast({ title: 'Registro atualizado' });
      onUpdated();
    } else {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    const success = await deleteEntry(entry.id);
    setIsDeleting(false);
    if (success) {
      const { dismiss } = toast({
        title: 'Registro excluído',
        description: 'Clique em Desfazer para restaurar.',
        action: (
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={async () => {
              if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
              const restored = await restoreEntry(entry.id);
              if (restored) {
                toast({ title: 'Registro restaurado' });
                onDeleted(); // refresh list
              }
              dismiss();
            }}
          >
            <Undo2 className="h-3.5 w-3.5" /> Desfazer
          </Button>
        ),
        duration: 5000,
      });
      onDeleted();
    } else {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    }
  };

  const handleNavigateToQuestion = () => {
    trackEvent({
      eventName: 'ce_question_navigated',
      category: 'interaction',
      data: { question_id: entry.question_id },
    });
    window.location.href = `/simulados`;
  };

  const isManual = entry.source === 'manual';

  if (isEditing) {
    return (
      <div className="p-4 rounded-lg border bg-card space-y-3">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Motivo</p>
          <RadioGroup value={editReason} onValueChange={(v) => setEditReason(v as ErrorReason)} className="grid grid-cols-2 gap-2">
            {Object.entries(REASON_LABELS).map(([key, label]) => (
              <label
                key={key}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-md border cursor-pointer text-xs transition-colors",
                  editReason === key ? "border-primary bg-primary/5" : "border-border hover:bg-accent/50"
                )}
              >
                <RadioGroupItem value={key} />
                {label}
              </label>
            ))}
          </RadioGroup>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground">Aprendizado</p>
          <Textarea
            value={editLearning}
            onChange={(e) => setEditLearning(e.target.value.slice(0, 280))}
            className="resize-none min-h-[60px] text-sm"
            maxLength={280}
          />
          <p className="text-xs text-right text-muted-foreground">{editLearning.length}/280</p>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} disabled={isSaving}>
            <X className="h-3.5 w-3.5 mr-1" /> Cancelar
          </Button>
          <Button size="sm" onClick={handleSaveEdit} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
            Salvar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-lg border bg-card hover:shadow-sm transition-shadow group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn("text-xs font-medium", REASON_COLORS[entry.reason as ErrorReason])}>
              {REASON_LABELS[entry.reason as ErrorReason]}
            </Badge>
            {entry.was_correct && (
              <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                Acertou
              </Badge>
            )}
            {isManual && (
              <Badge variant="outline" className="text-xs bg-accent text-accent-foreground border-border gap-1">
                <Tag className="h-3 w-3" /> Manual
              </Badge>
            )}
            {showRecurrence && recurrenceCount && recurrenceCount >= 2 && (
              <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20">
                {recurrenceCount}+ erros neste tema
              </Badge>
            )}
          </div>

          {/* Learning text */}
          {entry.learning_text && (
            <p className="text-sm text-foreground leading-relaxed">{entry.learning_text}</p>
          )}

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {entry.simulado_nome && <span>{entry.simulado_nome}</span>}
            {entry.simulado_nome && <span>•</span>}
            <span>{format(new Date(entry.created_at), "dd MMM yyyy", { locale: ptBR })}</span>
            {entry.especialidade && (
              <>
                <span>•</span>
                <span>{entry.especialidade}</span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsEditing(true)} title="Editar">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {entry.question_id && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNavigateToQuestion} title="Ver questão">
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" title="Excluir" disabled={isDeleting}>
                {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
                <AlertDialogDescription>
                  O registro será removido do seu caderno de erros. Você poderá desfazer nos próximos segundos.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
};
