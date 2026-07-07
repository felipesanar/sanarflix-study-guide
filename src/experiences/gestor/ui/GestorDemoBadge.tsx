import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface GestorDemoBadgeProps {
  className?: string;
}

/**
 * Badge "DADOS DE EXEMPLO" — exibido quando o ViewModel institucional está
 * usando dados mockados (`usingMock=true`), para deixar claro que os números
 * na tela não são reais.
 */
export const GestorDemoBadge: React.FC<GestorDemoBadgeProps> = ({ className }) => (
  <Badge
    variant="outline"
    className={cn('h-6 gap-1 text-[10px] font-medium tracking-wide border-dashed text-muted-foreground', className)}
  >
    DADOS DE EXEMPLO
  </Badge>
);
