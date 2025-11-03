import * as React from 'react';
const { useEffect } = React;
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ApiMateria } from '@/services/studyGuideApi';
import { useStudyProgress } from '@/hooks/useStudyProgress';
import { StudySubtemaItem } from './StudySubtemaItem';

interface StudyMateriaCardProps {
  materia: ApiMateria;
  hideTitle?: boolean;
  semestre: number;
  iesNome: string;
}

export const StudyMateriaCard: React.FC<StudyMateriaCardProps> = ({ 
  materia, 
  hideTitle = false, 
  semestre, 
  iesNome 
}) => {
  const { loadProgress } = useStudyProgress();

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