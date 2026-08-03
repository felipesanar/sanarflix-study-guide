import * as React from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import Logger from '@/utils/logger';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';

interface BlocoErrorBoundaryProps {
  /** Identificador do bloco para telemetria (`gestor_erro_bloco`, spec §10) — sem PII. */
  bloco: string;
  children: React.ReactNode;
}

/**
 * Error boundary POR BLOCO (spec §8.4): um gráfico quebrado não derruba a tela.
 * O fallback é o mesmo `EstadoErro` do erro de query — do ponto de vista da
 * gestora, "este bloco falhou, tente de novo" é um estado só.
 */
export const BlocoErrorBoundary: React.FC<BlocoErrorBoundaryProps> = ({ bloco, children }) => (
  <ErrorBoundary
    onError={(erro) =>
      Logger.error(
        `[gestor] erro no bloco ${bloco}`,
        erro instanceof Error ? erro.message : String(erro),
      )
    }
    fallbackRender={({ resetErrorBoundary }) => (
      <EstadoErro
        titulo="Não foi possível exibir este bloco"
        descricao="O resto da página continua disponível."
        onRetry={resetErrorBoundary}
      />
    )}
  >
    {children}
  </ErrorBoundary>
);
