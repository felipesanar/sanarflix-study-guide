import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ApiSemestre } from '@/services/studyGuideApi';

interface StudySemesterSelectorProps {
  semestres: ApiSemestre[];
  selectedSemestre: number | null;
  onSemestreChange: (semestre: number) => void;
  isLoading?: boolean;
}

export const StudySemesterSelector: React.FC<StudySemesterSelectorProps> = ({
  semestres,
  selectedSemestre,
  onSemestreChange,
  isLoading = false
}) => {
  return (
    <div className="bg-card p-4 rounded-lg shadow-sm border border-input mb-6">
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-foreground">
          Selecionar Semestre:
        </label>
        <div className="min-w-[200px]">
          <Select 
            value={selectedSemestre?.toString() || ''} 
            onValueChange={(value) => onSemestreChange(parseInt(value))}
            disabled={isLoading || semestres.length === 0}
          >
            <SelectTrigger className="h-9 bg-card">
              <SelectValue placeholder={isLoading ? "Carregando..." : "Escolha um semestre"} />
            </SelectTrigger>
            <SelectContent>
              {semestres.map((semestre) => (
                <SelectItem key={semestre.id} value={semestre.numero.toString()}>
                  {semestre.numero}º Semestre
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};