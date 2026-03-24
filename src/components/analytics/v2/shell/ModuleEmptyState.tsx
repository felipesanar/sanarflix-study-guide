import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { SearchX } from 'lucide-react';

interface Props {
  title: string;
  description: string;
}

export const ModuleEmptyState: React.FC<Props> = ({ title, description }) => (
  <Card className="border-dashed bg-muted/10">
    <CardContent className="flex flex-col items-center justify-center py-14 text-center">
      <div className="p-3 rounded-full bg-muted mb-4">
        <SearchX className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md">{description}</p>
      <span className="mt-4 text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
        Ajuste os filtros para continuar
      </span>
    </CardContent>
  </Card>
);
