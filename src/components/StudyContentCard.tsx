
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { ExternalLink, Play, FileText, PenTool } from 'lucide-react';
import { StudyContent } from '@/types';
import { useStudy } from '@/contexts/StudyContext';

interface StudyContentCardProps {
  content: StudyContent;
}

export const StudyContentCard: React.FC<StudyContentCardProps> = ({ content }) => {
  const { toggleContentCompletion } = useStudy();

  const getContentIcon = () => {
    switch (content.type) {
      case 'video':
        return <Play className="h-4 w-4 text-primary" />;
      case 'exercise':
        return <PenTool className="h-4 w-4 text-success-600" />;
      case 'reading':
        return <FileText className="h-4 w-4 text-gray-600" />;
      default:
        return <Play className="h-4 w-4 text-primary" />;
    }
  };

  const getContentTypeBadge = () => {
    const typeMap = {
      video: { label: 'Vídeo', className: 'bg-primary-50 text-primary-700' },
      exercise: { label: 'Exercício', className: 'bg-success-50 text-success-700' },
      reading: { label: 'Leitura', className: 'bg-gray-50 text-gray-700' }
    };
    
    const type = typeMap[content.type] || typeMap.video;
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${type.className}`}>
        {getContentIcon()}
        <span className="ml-1">{type.label}</span>
      </span>
    );
  };

  return (
    <Card className={`transition-all duration-300 hover:shadow-md ${
      content.completed 
        ? 'bg-success-50/50 border-success-200 shadow-sm' 
        : 'bg-white hover:bg-gray-50 border-gray-200'
    }`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 mt-1">
            <Checkbox
              checked={content.completed}
              onCheckedChange={() => toggleContentCompletion(content.id)}
              className={`h-5 w-5 ${
                content.completed 
                  ? 'data-[state=checked]:bg-success-600 data-[state=checked]:border-success-600' 
                  : ''
              }`}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="flex-1">
                <h3 className={`font-medium text-sm mb-1 leading-5 ${
                  content.completed ? 'text-success-700 line-through' : 'text-gray-900'
                }`}>
                  {content.name}
                </h3>
                
                <div className="flex items-center gap-2 mb-2">
                  {getContentTypeBadge()}
                  <span className="text-xs text-gray-500">
                    Semana {content.week}
                  </span>
                </div>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(content.sanarflixUrl, '_blank')}
                className="flex-shrink-0 h-8 px-3 text-xs hover:bg-primary-50 hover:border-primary-300 hover:text-primary-700 transition-colors"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Acessar
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                {content.discipline}
              </span>
              
              {content.completed && (
                <span className="text-xs text-success-600 font-medium animate-pulse-success">
                  ✓ Concluído
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
