import * as React from 'react';
import { Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface GestorTriPendingProps {
  /** Descrição de apoio. */
  description?: string;
}

/**
 * Estado exibido quando o simulado selecionado ainda não tem TRI processado
 * (`headerSummary.triPending`) — os KPIs de proficiência ficam em branco até
 * o processamento terminar.
 */
export const GestorTriPending: React.FC<GestorTriPendingProps> = ({
  description = 'O TRI deste simulado ainda está sendo processado. Os indicadores de proficiência ficarão disponíveis assim que o cálculo for concluído.',
}) => (
  <Card className="border-dashed shadow-none">
    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 mb-3">
        <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
      </div>
      <h3 className="text-base font-semibold mb-1">TRI em processamento</h3>
      <p className="text-sm text-muted-foreground max-w-md">{description}</p>
    </CardContent>
  </Card>
);
