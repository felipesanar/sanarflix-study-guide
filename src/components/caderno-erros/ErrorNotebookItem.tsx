import React, { useState, useRef } from 'react';
import { Pencil, Trash2, Loader2, Check, X, Undo2, Tag, ChevronDown, Eye, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ToastAction } from '@/components/ui/toast';
import { ErrorNotebookEntry, ErrorReason, REASON_LABELS, QuestionDetails, useErrorNotebook } from '@/hooks/useErrorNotebook';
import { useAnalyticsTracker } from '@/hooks/useAnalyticsTracker';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';

interface ErrorNotebookItemProps {
  entry: ErrorNotebookEntry;
  onDeleted: () => void;
  onUpdated: () => void;
  showRecurrence?: boolean;
  recurrenceCount?: number;
}

const REASON_COLORS: Record<ErrorReason, string> = {
  did_not_know: 'bg-red-500/8 text-red-600 dark:text-red-400 border-red-500/15',
  did_not_remember: 'bg-amber-500/8 text-amber-600 dark:text-amber-400 border-amber-500/15',
  did_not_understand_statement: 'bg-blue-500/8 text-blue-600 dark:text-blue-400 border-blue-500/15',
  answered_without_confidence: 'bg-purple-500/8 text-purple-600 dark:text-purple-400 border-purple-500/15',
};

const REASON_ACCENT: Record<ErrorReason, string> = {
  did_not_know: 'border-l-red-500/60',
  did_not_remember: 'border-l-amber-500/60',
  did_not_understand_statement: 'border-l-blue-500/60',
  answered_without_confidence: 'border-l-purple-500/60',
};

export const ErrorNotebookItem: React.FC<ErrorNotebookItemProps> = ({
  entry,
  onDeleted,
  onUpdated,
  showRecurrence,
  recurrenceCount,
}) => {
  const { updateEntry, deleteEntry, restoreEntry, fetchQuestionDetails } = useErrorNotebook();
  const { trackEvent } = useAnalyticsTracker();
  const [isEditing, setIsEditing] = useState(false);
  const [editReason, setEditReason] = useState<ErrorReason>(entry.reason as ErrorReason);
  const [editLearning, setEditLearning] = useState(entry.learning_text || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [questionOpen, setQuestionOpen] = useState(false);
  const [questionDetails, setQuestionDetails] = useState<QuestionDetails | null>(null);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [questionFetched, setQuestionFetched] = useState(false);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleExpandQuestion = async () => {
    if (!questionOpen && !questionFetched && entry.question_id) {
      setQuestionLoading(true);
      const details = await fetchQuestionDetails(entry.question_id);
      setQuestionDetails(details);
      setQuestionFetched(true);
      setQuestionLoading(false);
      trackEvent({ eventName: 'ce_question_expanded', category: 'interaction', data: { question_id: entry.question_id } });
    }
    setQuestionOpen(!questionOpen);
  };

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
          <ToastAction
            altText="Desfazer exclusão"
            onClick={async () => {
              if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
              const restored = await restoreEntry(entry.id);
              if (restored) {
                toast({ title: 'Registro restaurado' });
                onDeleted();
              }
              dismiss();
            }}
          >
            <Undo2 className="h-3.5 w-3.5 mr-1" /> Desfazer
          </ToastAction>
        ),
        duration: 5000,
      });
      onDeleted();
    } else {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    }
  };

  const isManual = entry.source === 'manual';
  const hasQuestion = !!entry.question_id;

  if (isEditing) {
    return (
      <div className="p-4 sm:p-5 rounded-2xl border border-border/50 bg-card space-y-4 shadow-sm">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Motivo</p>
          <RadioGroup value={editReason} onValueChange={(v) => setEditReason(v as ErrorReason)} className="grid grid-cols-2 gap-2">
            {Object.entries(REASON_LABELS).map(([key, label]) => (
              <label
                key={key}
                className={cn(
                  "flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer text-xs transition-all duration-200",
                  editReason === key ? "border-primary bg-primary/5 shadow-sm" : "border-border/50 hover:bg-accent/30"
                )}
              >
                <RadioGroupItem value={key} />
                {label}
              </label>
            ))}
          </RadioGroup>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Aprendizado</p>
          <Textarea
            value={editLearning}
            onChange={(e) => setEditLearning(e.target.value.slice(0, 280))}
            className="resize-none min-h-[70px] text-sm rounded-xl border-border/50"
            maxLength={280}
          />
          <p className="text-xs text-right text-muted-foreground/60 font-mono">{editLearning.length}/280</p>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} disabled={isSaving} className="rounded-lg">
            <X className="h-3.5 w-3.5 mr-1" /> Cancelar
          </Button>
          <Button size="sm" onClick={handleSaveEdit} disabled={isSaving} className="rounded-lg">
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
            Salvar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "rounded-2xl border bg-card transition-all duration-200 hover:shadow-md border-l-[3px]",
      REASON_ACCENT[entry.reason as ErrorReason] || 'border-l-border',
      "border-border/40"
    )}>
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-2.5">
            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className={cn("text-[11px] font-medium rounded-full px-2.5 py-0.5 border", REASON_COLORS[entry.reason as ErrorReason])}>
                {REASON_LABELS[entry.reason as ErrorReason]}
              </Badge>
              {entry.was_correct && (
                <Badge variant="outline" className="text-[11px] rounded-full px-2.5 py-0.5 bg-emerald-500/8 text-emerald-600 dark:text-emerald-400 border-emerald-500/15">
                  Acertou
                </Badge>
              )}
              {isManual && (
                <Badge variant="outline" className="text-[11px] rounded-full px-2.5 py-0.5 bg-accent text-accent-foreground border-border/50 gap-1">
                  <Tag className="h-2.5 w-2.5" /> Manual
                </Badge>
              )}
              {showRecurrence && recurrenceCount && recurrenceCount >= 2 && (
                <Badge variant="outline" className="text-[11px] rounded-full px-2.5 py-0.5 bg-orange-500/8 text-orange-600 dark:text-orange-400 border-orange-500/15">
                  {recurrenceCount}× reincidente
                </Badge>
              )}
            </div>

            {/* Learning text */}
            {entry.learning_text && (
              <div className="flex gap-3">
                <div className="w-0.5 shrink-0 rounded-full bg-primary/20 mt-0.5" />
                <p className="text-[14px] leading-relaxed text-foreground/90">{entry.learning_text}</p>
              </div>
            )}

            {/* Meta info */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground/70 uppercase tracking-wide font-medium">
              {entry.simulado_nome && <span>{entry.simulado_nome}</span>}
              {entry.simulado_nome && <span className="text-border">·</span>}
              <span>{format(new Date(entry.created_at), "dd MMM yyyy", { locale: ptBR })}</span>
              {entry.especialidade && (
                <>
                  <span className="text-border">·</span>
                  <span>{entry.especialidade}</span>
                </>
              )}
            </div>
          </div>

          {/* Actions - always visible on mobile */}
          <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-accent/50" onClick={() => setIsEditing(true)} title="Editar">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive" title="Excluir" disabled={isDeleting}>
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

        {/* Expand question button */}
        {hasQuestion && (
          <button
            onClick={handleExpandQuestion}
            className="mt-3 flex items-center gap-2 text-xs text-primary/70 hover:text-primary font-medium transition-colors duration-200 group/expand"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>{questionOpen ? 'Ocultar questão' : 'Ver questão original'}</span>
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", questionOpen && "rotate-180")} />
          </button>
        )}
      </div>

      {/* Expandable question preview */}
      {hasQuestion && questionOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="border-t border-border/30"
        >
          <div className="p-4 sm:p-5 bg-muted/20 rounded-b-2xl">
            {questionLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
                <div className="space-y-2 mt-4">
                  {[1, 2, 3, 4].map(i => (
                    <Skeleton key={i} className="h-10 w-full rounded-xl" />
                  ))}
                </div>
              </div>
            ) : questionDetails ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Questão Original</span>
                  {questionDetails.grau_dificuldade && (
                    <Badge variant="outline" className="text-[10px] rounded-full px-2 py-0 ml-auto border-border/50">
                      {questionDetails.grau_dificuldade}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">{questionDetails.enunciado}</p>
                
                {questionDetails.imagem && (
                  <img src={questionDetails.imagem} alt="Imagem da questão" className="max-w-full rounded-xl border border-border/30 max-h-64 object-contain" />
                )}

                <div className="space-y-2">
                  {['a', 'b', 'c', 'd'].map(letter => {
                    const text = questionDetails[`alternativa_${letter}` as keyof QuestionDetails] as string;
                    if (!text) return null;
                    const isCorrect = questionDetails.correta?.toLowerCase() === letter;
                    return (
                      <div
                        key={letter}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-xl border text-sm transition-colors",
                          isCorrect
                            ? "bg-emerald-500/8 border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                            : "bg-card border-border/30 text-foreground/80"
                        )}
                      >
                        <span className={cn(
                          "flex items-center justify-center w-6 h-6 rounded-lg text-xs font-bold shrink-0 mt-0.5",
                          isCorrect ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted/50 text-muted-foreground"
                        )}>
                          {letter.toUpperCase()}
                        </span>
                        <span className="leading-relaxed flex-1">{text}</span>
                        {isCorrect && <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-1" />}
                      </div>
                    );
                  })}
                </div>

                {questionDetails.comentario && (
                  <div className="mt-3 p-3.5 rounded-xl bg-primary/5 border border-primary/10">
                    <p className="text-xs font-semibold text-primary mb-1.5">Comentário</p>
                    <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">{questionDetails.comentario}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">Não foi possível carregar a questão.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">A questão pode ter sido removida ou você não tem mais acesso.</p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};
