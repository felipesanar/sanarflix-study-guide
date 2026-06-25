import * as React from 'react';
import { Suspense } from 'react';
import { PageWrapper } from '@/components/PageWrapper';

interface ExperiencePageProps {
  children: React.ReactNode;
  /** Mensagem exibida enquanto a página carrega. */
  loadingMessage?: string;
  /** Aguarda o término das queries antes de revelar o conteúdo. */
  waitForData?: boolean;
  /** Skeleton específico da página (fallback do Suspense e do PageWrapper). */
  skeleton?: React.ReactNode;
}

/**
 * Wrapper padrão de uma página dentro de uma experiência.
 *
 * Encapsula o boilerplate de carregamento usado pelo roteador: um
 * {@link Suspense} para o carregamento lazy do módulo da página e o
 * {@link PageWrapper} para a transição/gating de dados. As rotas de cada
 * experiência (ver buildAppRoutes) renderizam suas páginas através dele.
 */
export const ExperiencePage: React.FC<ExperiencePageProps> = ({
  children,
  loadingMessage,
  waitForData = true,
  skeleton,
}) => (
  <Suspense fallback={skeleton ?? <div className="min-h-screen bg-background" />}>
    <PageWrapper
      loadingMessage={loadingMessage}
      waitForData={waitForData}
      skeleton={skeleton}
    >
      {children}
    </PageWrapper>
  </Suspense>
);
