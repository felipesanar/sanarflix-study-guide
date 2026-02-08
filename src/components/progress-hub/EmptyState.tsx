import React from 'react';
import { BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface EmptyStateProps {
  onClearFilters?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onClearFilters }) => {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <BookOpen className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-medium mb-2">Nenhum resultado</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-sm">
          Os filtros aplicados não retornaram nenhum conteúdo. Tente ajustar sua busca.
        </p>
        {onClearFilters && (
          <Button 
            variant="outline" 
            onClick={onClearFilters}
            className="focus-visible:ring-2 focus-visible:ring-ring"
          >
            Limpar filtros
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
