import React from 'react';
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Logger from '@/utils/logger';

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  const navigate = useNavigate();

  const handleGoHome = () => {
    navigate('/');
    resetErrorBoundary();
  };

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 bg-destructive/10 rounded-full w-fit">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-xl">Oops! Algo deu errado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-center">
            Ocorreu um erro inesperado na aplicação. Nossa equipe foi notificada 
            automaticamente e está trabalhando para resolver o problema.
          </p>
          
          {import.meta.env.DEV && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                Detalhes técnicos (apenas em desenvolvimento)
              </summary>
              <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-32">
                {error.message}
                {error.stack && `\n\n${error.stack}`}
              </pre>
            </details>
          )}

          <div className="flex flex-col sm:flex-row gap-2 pt-4">
            <Button 
              onClick={resetErrorBoundary} 
              className="flex-1"
              variant="default"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Tentar Novamente
            </Button>
            
            <Button 
              onClick={handleGoHome} 
              variant="outline"
              className="flex-1"
            >
              <Home className="mr-2 h-4 w-4" />
              Ir para Início
            </Button>
          </div>

          <Button 
            onClick={handleReload} 
            variant="ghost" 
            size="sm"
            className="w-full text-muted-foreground"
          >
            Recarregar Página
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
}

export const ErrorBoundary: React.FC<ErrorBoundaryProps> = ({ 
  children, 
  fallback: FallbackComponent = ErrorFallback 
}) => {
  const handleError = (error: Error, errorInfo: { componentStack: string }) => {
    // Log do erro para monitoramento
    Logger.error('React Error Boundary caught an error', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      componentStack: errorInfo.componentStack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });

    // Em produção, você pode enviar para um serviço como Sentry
    if (import.meta.env.PROD) {
      // TODO: Integrar com Sentry ou outro serviço de monitoramento
      // Sentry.captureException(error, {
      //   contexts: {
      //     react: {
      //       componentStack: errorInfo.componentStack,
      //     },
      //   },
      // });
    }
  };

  const handleReset = () => {
    Logger.info('Error boundary reset triggered');
  };

  return (
    <ReactErrorBoundary
      FallbackComponent={FallbackComponent}
      onError={handleError}
      onReset={handleReset}
      resetKeys={[window.location.pathname]} // Reset quando a rota mudar
    >
      {children}
    </ReactErrorBoundary>
  );
};

/**
 * Hook para capturar erros assíncronos que não são pegos pelo Error Boundary
 */
export const useErrorHandler = () => {
  const handleError = React.useCallback((error: Error, context?: string) => {
    Logger.error(`Async error${context ? ` in ${context}` : ''}`, error);
    
    // Você pode mostrar um toast ou notificação aqui
    // toast.error('Ocorreu um erro inesperado. Tente novamente.');
  }, []);

  return handleError;
};

/**
 * Wrapper para funções assíncronas que podem gerar erros
 */
export const withErrorHandling = <T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: string
): T => {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      Logger.error(`Error in ${context || fn.name}`, error);
      throw error; // Re-throw para que o componente possa lidar com o erro
    }
  }) as T;
};