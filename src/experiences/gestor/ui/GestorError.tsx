import * as React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
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
 * O botão de retry usa o padrão CTA premium do guia (gradiente primary sutil
 * + sombra), com um ícone de refresh que gira 180° no hover como toque de
 * "ação circular" (equivalente ao `translate-x` do CTA de avanço).
 */
export const GestorError: React.FC<GestorErrorProps> = ({
  message = 'Não foi possível carregar os dados.',
  onRetry,
}) => (
  <Card className="border-destructive/20">
    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10 mb-3">
        <AlertCircle className="h-5 w-5 text-destructive" />
      </div>
      <h3 className="text-base font-semibold mb-1">Algo deu errado</h3>
      <p className="text-sm text-muted-foreground max-w-md mb-4">{message}</p>
      {onRetry && (
        <Button
          size="sm"
          onClick={onRetry}
          className="group rounded-xl bg-gradient-to-r from-primary/90 to-primary/80 hover:from-primary hover:to-primary/90 shadow-md hover:shadow-lg transition-all duration-300"
        >
          Tentar novamente
          <RefreshCw className="ml-1.5 h-3.5 w-3.5 group-hover:rotate-180 transition-transform duration-300" />
        </Button>
      )}
    </CardContent>
  </Card>
);
