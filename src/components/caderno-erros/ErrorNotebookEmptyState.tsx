import React from 'react';
import { BookMarked, Search } from 'lucide-react';

interface ErrorNotebookEmptyStateProps {
  type: 'no-entries' | 'no-results';
}

export const ErrorNotebookEmptyState: React.FC<ErrorNotebookEmptyStateProps> = ({ type }) => {
  if (type === 'no-results') {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-muted/80 flex items-center justify-center mb-4">
          <Search className="h-7 w-7 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Nenhum resultado encontrado</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Tente ajustar seus filtros ou busca para encontrar seus registros.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <BookMarked className="h-7 w-7 text-primary" />
      </div>
      <h3 className="text-lg font-semibold mb-2">Seu caderno de erros está vazio</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Ao revisar suas questões nos simulados, adicione erros ao caderno para acompanhar seus gaps e evitar repeti-los.
      </p>
    </div>
  );
};
