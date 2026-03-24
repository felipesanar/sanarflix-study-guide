import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { SearchX } from 'lucide-react';

interface Props {
  title: string;
  description: string;
}

export const ModuleEmptyState: React.FC<Props> = ({ title, description }) => (
  <Card className="border-dashed">
    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-3 rounded-full bg-muted/60 mb-3">
        <SearchX className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md">{description}</p>
    </CardContent>
  </Card>
);
