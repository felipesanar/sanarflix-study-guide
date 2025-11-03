import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Play, FileText, HelpCircle, Check } from 'lucide-react';
import { ApiAula } from '@/services/studyGuideApi';
import { cn } from '@/lib/utils';
import { useStudyProgress } from '@/hooks/useStudyProgress';
import { useAuth } from '@/contexts/AuthContext';

interface StudyAulaItemProps {
  aula: ApiAula;
  materiaId: string;
  semestre: number;
  iesNome: string;
}

export const StudyAulaItem: React.FC<StudyAulaItemProps> = ({ 
  aula, 
  materiaId, 
  semestre, 
  iesNome 
}) => {
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