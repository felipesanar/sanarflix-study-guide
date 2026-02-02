import { ReactNode, useState, useEffect, useRef, useMemo } from 'react';
import { useIsFetching, useIsMutating, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { PageLoader } from './PageLoader';
import { PageTransition } from './PageTransition';

interface PageWrapperProps {
  children: ReactNode;
  loadingMessage?: string;
  minLoadTime?: number;
  waitForData?: boolean;
  skeleton?: ReactNode;
  enforceMinTime?: boolean;
}

export const PageWrapper = ({ 
  children, 
  loadingMessage,
  minLoadTime = 0,
  waitForData = true,
  skeleton,
  enforceMinTime = false
}: PageWrapperProps) => {
  const location = useLocation();
  const queryClient = useQueryClient();
  
  // Verificar sessionStorage e cache do React Query SINCRONAMENTE antes do estado inicial
  const wasVisited = sessionStorage.getItem(`visited_${location.pathname}`);
  const hasCachedData = useMemo(() => {
    const queries = queryClient.getQueryCache().getAll();
    return queries.some(q => q.state.data !== undefined && q.state.status === 'success');
  }, [queryClient]);
  
  // Estado inicial baseado no cache - evita skeleton em revisitas
  const [isLoading, setIsLoading] = useState(() => {
    // Se já visitou E tem dados em cache, não mostrar loading
    if (wasVisited && hasCachedData) return false;
    // Se já visitou mas não tem cache, mostrar loading breve
    if (wasVisited) return false;
    // Primeira visita: mostrar loading
    return true;
  });
  
  const [contentReady, setContentReady] = useState(!wasVisited);
  const [minTimeElapsed, setMinTimeElapsed] = useState(!wasVisited || minLoadTime === 0);
  const mountTimeRef = useRef(Date.now());
  const isFirstVisit = !wasVisited;

  // Marca conteúdo como pronto no DOM
  useEffect(() => {
    if (contentReady) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setContentReady(true);
      });
    });
  }, [contentReady]);

  // Controla o tempo mínimo
  useEffect(() => {
    if (minTimeElapsed) return;
    if (!isFirstVisit && enforceMinTime) {
      setMinTimeElapsed(true);
      return;
    }

    const elapsedTime = Date.now() - mountTimeRef.current;
    const remainingTime = Math.max(0, minLoadTime - elapsedTime);

    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, remainingTime);

    return () => clearTimeout(timer);
  }, [minLoadTime, isFirstVisit, enforceMinTime, minTimeElapsed]);

  // Monitora requisições em andamento
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  const hasActiveRequests = isFetching > 0 || isMutating > 0;

  // Decide quando parar o loading
  useEffect(() => {
    if (!isLoading) return;
    
    const shouldShow = isFirstVisit 
      ? contentReady && minTimeElapsed && (!waitForData || !hasActiveRequests)
      : contentReady && (!waitForData || !hasActiveRequests);

    if (shouldShow) {
      requestAnimationFrame(() => {
        setIsLoading(false);
        if (isFirstVisit) {
          sessionStorage.setItem(`visited_${location.pathname}`, 'true');
        }
      });
    }
  }, [contentReady, minTimeElapsed, hasActiveRequests, waitForData, isFirstVisit, location.pathname, isLoading]);

  if (isLoading) {
    return skeleton || <PageLoader message={loadingMessage} />;
  }

  return (
    <PageTransition>
      {children}
    </PageTransition>
  );
};
