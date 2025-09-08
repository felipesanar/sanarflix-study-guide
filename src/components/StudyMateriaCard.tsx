import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Play, FileText, HelpCircle } from 'lucide-react';
import { ApiMateria, ApiTema, ApiSubtema, ApiAula } from '@/services/studyGuideApi';
import { cn } from '@/lib/utils';

interface StudyMateriaCardProps {
  materia: ApiMateria;
}

interface StudyAulaItemProps {
  aula: ApiAula;
}

interface StudySubtemaItemProps {
  subtema: ApiSubtema;
}

const StudyAulaItem: React.FC<StudyAulaItemProps> = ({ aula }) => {
  const handleResourceClick = (url: string, type: string) => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-md border border-border/50">
      <span className="text-sm font-medium text-foreground">{aula.nome}</span>
      <div className="flex gap-2">
        {aula.video && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleResourceClick(aula.video!, 'video')}
            className="h-8 px-3 text-xs hover:bg-primary hover:text-primary-foreground"
          >
            <Play className="h-3 w-3 mr-1" />
            Aula
          </Button>
        )}
        {aula.pdf && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleResourceClick(aula.pdf!, 'pdf')}
            className="h-8 px-3 text-xs hover:bg-primary hover:text-primary-foreground"
          >
            <FileText className="h-3 w-3 mr-1" />
            PDF
          </Button>
        )}
        {aula.quiz && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleResourceClick(aula.quiz!, 'quiz')}
            className="h-8 px-3 text-xs hover:bg-primary hover:text-primary-foreground"
          >
            <HelpCircle className="h-3 w-3 mr-1" />
            Quiz
          </Button>
        )}
      </div>
    </div>
  );
};

const StudySubtemaItem: React.FC<StudySubtemaItemProps> = ({ subtema }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between p-3 h-auto text-left hover:bg-accent/20"
        >
          <span className="font-medium text-foreground">{subtema.nome}</span>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-4 pt-2 space-y-2 animate-accordion-down">
        {subtema.aulas.map((aula) => (
          <StudyAulaItem key={aula.id} aula={aula} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
};

export const StudyMateriaCard: React.FC<StudyMateriaCardProps> = ({ materia }) => {
  return (
    <Card className="mb-6 shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-foreground">
          {materia.nome}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="w-full">
          {materia.temas.map((tema) => (
            <AccordionItem key={tema.id} value={tema.id} className="border-border/50">
              <AccordionTrigger className="text-left font-medium text-foreground hover:no-underline">
                {tema.nome}
              </AccordionTrigger>
              <AccordionContent className="space-y-2 pt-2">
                {tema.subtemas.map((subtema) => (
                  <StudySubtemaItem key={subtema.id} subtema={subtema} />
                ))}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
};