import React, { useState, useEffect } from 'react';
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
  semestre: number;
  iesNome: string;
}

interface StudyAulaItemProps {
  aula: ApiAula;
  materiaId: string;
  semestre: number;
  iesNome: string;
}

interface StudySubtemaItemProps {
  subtema: ApiSubtema;
  materiaId: string;
  semestre: number;
  iesNome: string;
}

const StudyAulaItem: React.FC<StudyAulaItemProps> = ({ aula, materiaId, semestre, iesNome }) => {
  const { user } = useAuth();
  const { progress, toggleContentCompletion } = useStudyProgress();
  
  const handleResourceClick = (url: string, type: string) => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const getProgressKey = (contentType: string, contentId: string, materiaId: string) => {
    return `${contentType}-${contentId}-${materiaId}`;
  };

  const isCompleted = progress.get(getProgressKey('aula', aula.id, materiaId)) || false;

  const handleToggleCompletion = async () => {
    if (!user?.ies_nome) return;
    await toggleContentCompletion('aula', aula.id, materiaId, semestre, iesNome);
  };

  return (
    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-md border border-border/50">
      <div className="flex items-center gap-3">
        <button
          onClick={handleToggleCompletion}
          className={cn(
            "flex items-center justify-center w-6 h-6 rounded-full border-2 transition-all",
            isCompleted 
              ? "bg-green-500 border-green-500 text-white" 
              : "border-muted-foreground hover:border-green-500"
          )}
        >
          {isCompleted && <Check className="h-4 w-4" />}
        </button>
        <div className="flex flex-col">
          <span className={cn(
            "text-sm font-medium",
            isCompleted ? "text-muted-foreground line-through" : "text-foreground"
          )}>
            {aula.nome}
          </span>
          {isCompleted && (
            <span className="text-xs text-green-600 font-medium">✓ Concluído</span>
          )}
        </div>
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

const StudySubtemaItem: React.FC<StudySubtemaItemProps> = ({ subtema, materiaId, semestre, iesNome }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { progress } = useStudyProgress();

  const getProgressKey = (contentType: string, contentId: string, materiaId: string) => {
    return `${contentType}-${contentId}-${materiaId}`;
  };

  // Calcular quantas aulas estão concluídas
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
            "w-full justify-between p-3 h-auto text-left hover:bg-accent/20 transition-all",
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
                "font-medium",
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

export const StudyMateriaCard: React.FC<StudyMateriaCardProps> = ({ materia, hideTitle = false, semestre, iesNome }) => {
  const { progress, loadProgress } = useStudyProgress();

  useEffect(() => {
    loadProgress(materia.id, semestre, iesNome);
  }, [materia.id, semestre, iesNome, loadProgress]);

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
                  <StudySubtemaItem 
                    key={subtema.id} 
                    subtema={subtema} 
                    materiaId={materia.id}
                    semestre={semestre}
                    iesNome={iesNome}
                  />
                ))}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
};