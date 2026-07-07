import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface GestorErrorProps {
  /** Mensagem de erro a exibir. @default 'Não foi possível carregar os dados.' */
  message?: string;
  /** Callback de nova tentativa. Quando omitido, o botão não é exibido. */
  onRetry?: () => void;
}

/**
 * Estado de erro padrão das telas do console de Gestão — ícone + mensagem +
 * "Tentar novamente" (retry), no mesmo espírito visual de `ModuleEmptyState`.
 */
export const GestorError: React.FC<GestorErrorProps> = ({
  message = 'Não foi possível carregar os dados.',
  onRetry,
}) => (
  <Card className="border-destructive/20">
    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-3 rounded-full bg-destructive/10 mb-3">
        <AlertCircle className="h-5 w-5 text-destructive" />
      </div>
      <h3 className="text-base font-semibold mb-1">Algo deu errado</h3>
      <p className="text-sm text-muted-foreground max-w-md mb-4">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </CardContent>
  </Card>
);
