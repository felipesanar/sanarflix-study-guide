import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Play, FileText, HelpCircle, Check } from 'lucide-react';
import { ApiMateria, ApiTema, ApiSubtema, ApiAula } from '@/services/studyGuideApi';
import { cn } from '@/lib/utils';
import { useStudyProgress } from '@/hooks/useStudyProgress';
import { useAuth } from '@/contexts/AuthContext';

interface StudyMateriaCardProps {
  materia: ApiMateria;
  hideTitle?: boolean;
}

interface StudyAulaItemProps {
  aula: ApiAula;
  materiaId: string;
}

interface StudySubtemaItemProps {
  subtema: ApiSubtema;
  materiaId: string;
}

const StudyAulaItem: React.FC<StudyAulaItemProps> = ({ aula, materiaId }) => {
  const { user } = useAuth();
  const { isCompleted, toggleCompletion } = useStudyProgress(materiaId, user?.semestre);
  const isAulaCompleted = isCompleted('aula', aula.id);

  const handleResourceClick = (url: string, type: string) => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleToggleCompletion = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleCompletion('aula', aula.id, materiaId);
  };

  return (
    <div className={cn(
      "flex items-center justify-between p-3 rounded-md border border-border/50 transition-colors",
      isAulaCompleted ? "bg-green-50 border-green-200" : "bg-muted/30"
    )}>
      <div className="flex items-center gap-3">
        <button
          onClick={handleToggleCompletion}
          className={cn(
            "flex items-center justify-center w-6 h-6 rounded border-2 transition-colors",
            isAulaCompleted 
              ? "bg-green-500 border-green-500 text-white" 
              : "border-muted-foreground/30 hover:border-green-500"
          )}
        >
          {isAulaCompleted && <Check className="h-4 w-4" />}
        </button>
        <span className={cn(
          "text-sm font-medium",
          isAulaCompleted ? "text-green-700" : "text-foreground"
        )}>
          {aula.nome}
        </span>
        {isAulaCompleted && (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
            Concluído
          </span>
        )}
      </div>
      <div className="flex gap-2">
        {aula.video && (
          <Button
            size="default"
            variant="outline"
            onClick={() => handleResourceClick(aula.video!, 'video')}
            className="h-10 px-4 text-sm hover:bg-primary hover:text-primary-foreground"
          >
            <Play className="h-4 w-4 mr-2" />
            Aula
          </Button>
        )}
        {aula.pdf && (
          <Button
            size="default"
            variant="outline"
            onClick={() => handleResourceClick(aula.pdf!, 'pdf')}
            className="h-10 px-4 text-sm hover:bg-primary hover:text-primary-foreground"
          >
            <FileText className="h-4 w-4 mr-2" />
            PDF
          </Button>
        )}
        {aula.quiz && (
          <Button
            size="default"
            variant="outline"
            onClick={() => handleResourceClick(aula.quiz!, 'quiz')}
            className="h-10 px-4 text-sm hover:bg-primary hover:text-primary-foreground"
          >
            <HelpCircle className="h-4 w-4 mr-2" />
            Quiz
          </Button>
        )}
      </div>
    </div>
  );
};

const StudySubtemaItem: React.FC<StudySubtemaItemProps> = ({ subtema, materiaId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const { isCompleted, toggleCompletion } = useStudyProgress(materiaId, user?.semestre);
  const isSubtemaCompleted = isCompleted('subtema', subtema.id);

  const handleToggleCompletion = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleCompletion('subtema', subtema.id, materiaId);
  };

  // Calculate completion stats for this subtema
  const totalAulas = subtema.aulas.length;
  const completedAulas = subtema.aulas.filter(aula => isCompleted('aula', aula.id)).length;
  const hasPartialCompletion = completedAulas > 0 && completedAulas < totalAulas;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between p-3 h-auto text-left hover:bg-accent/20"
        >
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleCompletion}
              className={cn(
                "flex items-center justify-center w-5 h-5 rounded border-2 transition-colors",
                isSubtemaCompleted 
                  ? "bg-green-500 border-green-500 text-white" 
                  : hasPartialCompletion
                  ? "bg-orange-200 border-orange-400"
                  : "border-muted-foreground/30 hover:border-green-500"
              )}
            >
              {isSubtemaCompleted && <Check className="h-3 w-3" />}
            </button>
            <span className="font-medium text-foreground">{subtema.nome}</span>
            {totalAulas > 0 && (
              <span className="text-xs text-muted-foreground">
                {completedAulas}/{totalAulas} aulas
              </span>
            )}
          </div>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-4 pt-2 space-y-2 animate-accordion-down">
        {subtema.aulas.map((aula) => (
          <StudyAulaItem key={aula.id} aula={aula} materiaId={materiaId} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
};

export const StudyMateriaCard: React.FC<StudyMateriaCardProps> = ({ materia, hideTitle = false }) => {
  return (
    <Card className="mb-6 shadow-sm hover:shadow-md transition-shadow">
      {!hideTitle && (
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-foreground">
            {materia.nome}
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className={hideTitle ? "pt-6" : ""}>
        <Accordion type="multiple" className="w-full">
          {materia.temas.map((tema) => (
            <AccordionItem key={tema.id} value={tema.id} className="border-border/50">
              <AccordionTrigger className="text-left font-medium text-foreground hover:no-underline">
                {tema.nome}
              </AccordionTrigger>
              <AccordionContent className="space-y-2 pt-2">
                {tema.subtemas.map((subtema) => (
                  <StudySubtemaItem key={subtema.id} subtema={subtema} materiaId={materia.id} />
                ))}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
};