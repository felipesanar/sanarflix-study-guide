import React, { useState } from 'react';
import { BookMarked, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from '@/components/ui/drawer';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useErrorNotebook, ErrorReason, REASON_LABELS, AddEntryParams } from '@/hooks/useErrorNotebook';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface AddToErrorNotebookDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  questionId: string;
  simuladoId: string;
  simuladoNome: string;
  grandeArea?: string | null;
  especialidade?: string | null;
  tema?: string | null;
  wasCorrect: boolean;
  onSuccess: () => void;
}

const REASON_OPTIONS: { value: ErrorReason; label: string; description: string }[] = [
  { value: 'did_not_know', label: 'Não sabia', description: 'Gap de conteúdo' },
  { value: 'did_not_remember', label: 'Não lembrei', description: 'Sabia, mas não veio à mente' },
  { value: 'did_not_understand_statement', label: 'Não entendi o enunciado', description: 'Erro de interpretação' },
  { value: 'answered_without_confidence', label: 'Acertei sem certeza', description: 'Acertou no chute' },
];

const MAX_LEARNING_TEXT = 280;

export const AddToErrorNotebookDrawer: React.FC<AddToErrorNotebookDrawerProps> = ({
  isOpen,
  onOpenChange,
  questionId,
  simuladoId,
  simuladoNome,
  grandeArea,
  especialidade,
  tema,
  wasCorrect,
  onSuccess,
}) => {
  const isMobile = useIsMobile();
  const { addEntry } = useErrorNotebook();
  const [reason, setReason] = useState<ErrorReason | ''>('');
  const [learningText, setLearningText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [reasonError, setReasonError] = useState(false);

  const resetForm = () => {
    setReason('');
    setLearningText('');
    setReasonError(false);
  };

  const handleSave = async () => {
    if (!reason) {
      setReasonError(true);
      return;
    }
    setIsSaving(true);

    const params: AddEntryParams = {
      question_id: questionId,
      simulado_id: simuladoId,
      simulado_nome: simuladoNome,
      grande_area: grandeArea,
      especialidade,
      tema,
      reason: reason as ErrorReason,
      learning_text: learningText || null,
      was_correct: wasCorrect,
    };

    const success = await addEntry(params);
    setIsSaving(false);

    if (success) {
      toast({ title: 'Adicionado ao Caderno de Erros', description: 'Registro salvo com sucesso.' });
      resetForm();
      onOpenChange(false);
      onSuccess();
    } else {
      toast({ title: 'Erro ao salvar', description: 'Tente novamente.', variant: 'destructive' });
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) resetForm();
    onOpenChange(open);
  };

  const formContent = (
    <div className="space-y-6 px-1">
      {/* Reason selection */}
      <div className="space-y-3">
        <Label className={cn("text-sm font-semibold", reasonError && "text-destructive")}>
          Motivo do erro <span className="text-destructive">*</span>
        </Label>
        <RadioGroup
          value={reason}
          onValueChange={(val) => { setReason(val as ErrorReason); setReasonError(false); }}
          className="grid grid-cols-1 gap-2"
        >
          {REASON_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                reason === opt.value
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:border-primary/30 hover:bg-accent/50",
                reasonError && !reason && "border-destructive/50"
              )}
            >
              <RadioGroupItem value={opt.value} className="mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.description}</p>
              </div>
            </label>
          ))}
        </RadioGroup>
        {reasonError && <p className="text-xs text-destructive">Selecione um motivo</p>}
      </div>

      {/* Learning text */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Aprendizado (opcional)</Label>
        <Textarea
          value={learningText}
          onChange={(e) => setLearningText(e.target.value.slice(0, MAX_LEARNING_TEXT))}
          placeholder="Ex.: Preciso revisar critérios diagnósticos e diferenciar conduta inicial."
          className="resize-none min-h-[80px]"
          maxLength={MAX_LEARNING_TEXT}
        />
        <p className={cn(
          "text-xs text-right",
          learningText.length > MAX_LEARNING_TEXT * 0.9 ? "text-destructive" : "text-muted-foreground"
        )}>
          {learningText.length}/{MAX_LEARNING_TEXT}
        </p>
      </div>

      {/* Context info */}
      {(grandeArea || tema) && (
        <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg space-y-1">
          {grandeArea && <p><span className="font-medium">Área:</span> {grandeArea}</p>}
          {tema && <p><span className="font-medium">Tema:</span> {tema}</p>}
          <p><span className="font-medium">Simulado:</span> {simuladoNome}</p>
        </div>
      )}
    </div>
  );

  const saveButton = (
    <Button onClick={handleSave} disabled={isSaving} className="w-full gap-2">
      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookMarked className="h-4 w-4" />}
      {isSaving ? 'Salvando...' : 'Salvar no Caderno de Erros'}
    </Button>
  );

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={handleOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <BookMarked className="h-5 w-5 text-primary" />
              Adicionar ao Caderno de Erros
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 overflow-y-auto flex-1">
            {formContent}
          </div>
          <DrawerFooter className="pt-4">
            {saveButton}
            <DrawerClose asChild>
              <Button variant="outline" className="w-full">Cancelar</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookMarked className="h-5 w-5 text-primary" />
            Adicionar ao Caderno de Erros
          </DialogTitle>
        </DialogHeader>
        {formContent}
        <DialogFooter className="flex-col sm:flex-row gap-2 pt-4">
          <Button variant="outline" onClick={() => handleOpenChange(false)} className="w-full sm:w-auto">
            Cancelar
          </Button>
          {saveButton}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
