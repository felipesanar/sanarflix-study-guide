import { ReactNode, useState, useEffect, useRef } from 'react';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { PageLoader } from './PageLoader';
import { PageTransition } from './PageTransition';

interface PageWrapperProps {
  children: ReactNode;
  loadingMessage?: string;
  minLoadTime?: number;
  waitForData?: boolean;
  skeleton?: ReactNode; // Skeleton específico da página
}

export const PageWrapper = ({ 
  children, 
  loadingMessage,
  minLoadTime = 800,
  waitForData = true,
  skeleton
}: PageWrapperProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [contentReady, setContentReady] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const mountTimeRef = useRef(Date.now());
  const hasShownContentRef = useRef(false);
  
  // Monitora se há requisições em andamento
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  const hasActiveRequests = isFetching > 0 || isMutating > 0;

  // Marca conteúdo como pronto no DOM
  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setContentReady(true);
      });
    });
  }, []);

  // Controla o tempo mínimo
  useEffect(() => {
    const elapsedTime = Date.now() - mountTimeRef.current;
    const remainingTime = Math.max(0, minLoadTime - elapsedTime);

    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, remainingTime);

    return () => clearTimeout(timer);
  }, [minLoadTime]);

  // Decide quando parar o loading
  useEffect(() => {
    // Só no primeiro carregamento
    if (hasShownContentRef.current) return;

    const shouldShow = contentReady && minTimeElapsed && (!waitForData || !hasActiveRequests);

    if (shouldShow) {
      // Aguarda um frame extra para garantir renderização completa
      requestAnimationFrame(() => {
        setIsLoading(false);
        hasShownContentRef.current = true;
      });
    }
  }, [contentReady, minTimeElapsed, hasActiveRequests, waitForData]);

  if (isLoading) {
    // Usa skeleton específico se fornecido, senão usa PageLoader genérico
    return skeleton || <PageLoader message={loadingMessage} />;
  }

  return (
    <PageTransition>
      {children}
    </PageTransition>
  );
};
