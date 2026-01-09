import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Database, Clock } from 'lucide-react';

interface EmptyStateProps {
  titulo: string;
  motivo: string;
  sugestao?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  titulo,
  motivo,
  sugestao,
}) => {
  return (
    <Card className="border-dashed">
      <CardContent className="p-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 rounded-full bg-muted">
            <Database className="w-6 h-6 text-muted-foreground" />
          </div>
        </div>
        <h3 className="font-semibold text-lg mb-2">{titulo}</h3>
        <p className="text-muted-foreground text-sm max-w-md mx-auto mb-4">
          {motivo}
        </p>
        {sugestao && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>{sugestao}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
