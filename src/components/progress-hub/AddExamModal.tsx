import React, { useState } from 'react';
import { Calendar, GraduationCap } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AddExamModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  materias: string[];
  onAdd: (materia: string, examName: string, examDate: string) => Promise<{ error: string | null }>;
}

export const AddExamModal: React.FC<AddExamModalProps> = ({
  open,
  onOpenChange,
  materias,
  onAdd
}) => {
  const [materia, setMateria] = useState('');
  const [examName, setExamName] = useState('');
  const [examDate, setExamDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const minDate = new Date().toISOString().split('T')[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!materia || !examDate) return;

    setIsSubmitting(true);
    const result = await onAdd(materia, examName, examDate);
    setIsSubmitting(false);

    if (!result.error) {
      // Reset form and close
      setMateria('');
      setExamName('');
      setExamDate('');
      onOpenChange(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset form on close
      setMateria('');
      setExamName('');
      setExamDate('');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" aria-hidden="true" />
            Adicionar Prova
          </DialogTitle>
          <DialogDescription>
            Cadastre sua prova para acompanhar seu progresso de estudos.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Materia Select */}
          <div className="space-y-2">
            <Label htmlFor="materia">Matéria *</Label>
            <Select value={materia} onValueChange={setMateria}>
              <SelectTrigger id="materia">
                <SelectValue placeholder="Selecione a matéria" />
              </SelectTrigger>
              <SelectContent>
                {materias.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Exam Name */}
          <div className="space-y-2">
            <Label htmlFor="exam-name">Nome da Prova (opcional)</Label>
            <Input
              id="exam-name"
              type="text"
              placeholder="P1, P2, Prova Final..."
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
              maxLength={50}
            />
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="exam-date">Data da Prova *</Label>
            <div className="relative">
              <Input
                id="exam-date"
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                min={minDate}
                className="pl-10"
                required
              />
              <Calendar 
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" 
                aria-hidden="true" 
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!materia || !examDate || isSubmitting}
            >
              {isSubmitting ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
