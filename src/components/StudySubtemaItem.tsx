import * as React from 'react';
const { useState } = React;
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Check } from 'lucide-react';
import { ApiSubtema } from '@/services/studyGuideApi';
import { cn } from '@/lib/utils';
import { useStudyProgress } from '@/hooks/useStudyProgress';
import { StudyAulaItem } from './StudyAulaItem';

interface StudySubtemaItemProps {
  subtema: ApiSubtema;
  materiaId: string;
  semestre: number;
  iesNome: string;
}

export const StudySubtemaItem: React.FC<StudySubtemaItemProps> = ({ 
  subtema, 
  materiaId, 
  semestre, 
  iesNome 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { progress } = useStudyProgress();

  const getProgressKey = (contentType: string, contentId: string, materiaId: string) => {
    return `${contentType}-${contentId}-${materiaId}`;
  };

  // Calculate completed lessons
  const completedAulas = subtema.aulas.filter(aula => 
    progress.get(getProgressKey('aula', aula.id, materiaId)) || false
  ).length;
  
  const totalAulas = subtema.aulas.length;
  const allCompleted = completedAulas === totalAulas && totalAulas > 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-between p-3 h-auto text-left hover:bg-accent/20 transition-all rounded-lg",
            allCompleted && "bg-green-50 hover:bg-green-100 border border-green-200"
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex items-center justify-center w-5 h-5 rounded-full border-2 transition-all",
              allCompleted 
                ? "bg-green-500 border-green-500 text-white" 
                : "border-muted-foreground"
            )}>
              {allCompleted && <Check className="h-3 w-3" />}
            </div>
            <div className="flex flex-col">
              <span className={cn(
                "font-medium text-sm",
                allCompleted ? "text-green-700" : "text-foreground"
              )}>
                {subtema.nome}
              </span>
              <span className="text-xs text-muted-foreground">
                {completedAulas}/{totalAulas} aulas
                {allCompleted && <span className="text-green-600 font-medium ml-2">✓ Concluído</span>}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {allCompleted && (
              <span className="px-2 py-1 bg-green-500 text-white text-xs font-medium rounded-full">
                Concluído
              </span>
            )}
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-4 pt-2 space-y-2 animate-accordion-down">
        {subtema.aulas.map((aula) => (
          <StudyAulaItem 
            key={aula.id} 
            aula={aula} 
            materiaId={materiaId}
            semestre={semestre}
            iesNome={iesNome}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
};