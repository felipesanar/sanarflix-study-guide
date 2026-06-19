import React, { useState, useMemo } from 'react';
import { PlusCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from '@/components/ui/drawer';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useErrorNotebook, ErrorReason, REASON_LABELS, ErrorNotebookEntry } from '@/hooks/useErrorNotebook';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ManualEntryFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  existingEntries: ErrorNotebookEntry[];
  onSuccess: () => void;
}

const REASON_OPTIONS: { value: ErrorReason; label: string; description: string }[] = [
  { value: 'did_not_know', label: 'Não sabia', description: 'Gap de conteúdo' },
  { value: 'did_not_remember', label: 'Não lembrei', description: 'Sabia, mas não veio à mente' },
  { value: 'did_not_understand_statement', label: 'Não entendi o enunciado', description: 'Erro de interpretação' },
  { value: 'answered_without_confidence', label: 'Acertei sem certeza', description: 'Acertou no chute' },
];

const MAX_LEARNING_TEXT = 280;

export const ManualEntryForm: React.FC<ManualEntryFormProps> = ({
  isOpen,
  onOpenChange,
  existingEntries,
  onSuccess,
}) => {
  const isMobile = useIsMobile();
  const { addEntry } = useErrorNotebook();
  const [grandeArea, setGrandeArea] = useState('');
  const [tema, setTema] = useState('');
  const [reason, setReason] = useState<ErrorReason | ''>('');
  const [learningText, setLearningText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [reasonError, setReasonError] = useState(false);

  const existingAreas = useMemo(() =>
    [...new Set(existingEntries.map(e => e.grande_area).filter(Boolean) as string[])].sort(),
    [existingEntries]
  );

  const resetForm = () => {
    setGrandeArea('');
    setTema('');
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

    const success = await addEntry({
      question_id: null,
      simulado_id: null,
      simulado_nome: null,
      grande_area: grandeArea.trim() || null,
      tema: tema.trim() || null,
      reason: reason as ErrorReason,
      learning_text: learningText || null,
      was_correct: false,
      source: 'manual',
    });

    setIsSaving(false);

    if (success) {
      toast({ title: 'Erro manual adicionado', description: 'Registro salvo no Caderno de Erros.' });
      resetForm();
      onOpenChange(false);
      onSuccess();
    } else {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) resetForm();
    onOpenChange(open);
  };

  const formContent = (
    <div className="space-y-5 px-1">
      {/* Grande Área */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Grande Área</Label>
        {/* Texto livre COM sugestões das áreas já usadas (datalist): permite
            escolher uma existente OU digitar uma nova. Corrige o SAN-2986, em que
            o dropdown fechado prendia o aluno às áreas já adicionadas. */}
        <Input
          value={grandeArea}
          onChange={(e) => setGrandeArea(e.target.value)}
          placeholder={existingAreas.length > 0 ? 'Selecione ou digite uma nova...' : 'Ex.: Clínica Médica'}
          list="manual-entry-areas"
          autoComplete="off"
        />
        {existingAreas.length > 0 && (
          <datalist id="manual-entry-areas">
            {existingAreas.map(a => <option key={a} value={a} />)}
          </datalist>
        )}
      </div>

      {/* Tema */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Tema</Label>
        <Input
          value={tema}
          onChange={(e) => setTema(e.target.value)}
          placeholder="Ex.: Insuficiência Cardíaca"
        />
      </div>

      {/* Reason */}
      <div className="space-y-3">
        <Label className={cn("text-sm font-semibold", reasonError && "text-destructive")}>
          Motivo <span className="text-destructive">*</span>
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
          placeholder="O que aprendeu com esse erro?"
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
    </div>
  );

  const saveButton = (
    <Button onClick={handleSave} disabled={isSaving} className="w-full gap-2">
      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
      {isSaving ? 'Salvando...' : 'Adicionar ao Caderno'}
    </Button>
  );

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={handleOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>Adicionar erro manual</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 overflow-y-auto flex-1">{formContent}</div>
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
          <DialogTitle>Adicionar erro manual</DialogTitle>
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
