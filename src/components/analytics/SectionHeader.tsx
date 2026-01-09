import React from 'react';
import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  titulo: string;
  subtitulo: string;
  icon: React.ReactNode;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  titulo,
  subtitulo,
  icon,
  className,
}) => {
  return (
    <div className={cn('mb-4', className)}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <h2 className="text-lg font-semibold">{titulo}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{subtitulo}</p>
    </div>
  );
};
