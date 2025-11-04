import { ReactNode, useState, useEffect, useRef } from 'react';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { PageLoader } from './PageLoader';
import { PageTransition } from './PageTransition';

interface PageWrapperProps {
  children: ReactNode;
  loadingMessage?: string;
  minLoadTime?: number;
  waitForData?: boolean;
  skeleton?: ReactNode;
  enforceMinTime?: boolean; // Força o tempo mínimo sempre no primeiro carregamento
}

export const PageWrapper = ({ 
  children, 
  loadingMessage,
  minLoadTime = 1000,
  waitForData = true,
  skeleton,
  enforceMinTime = true
}: PageWrapperProps) => {
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [contentReady, setContentReady] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const mountTimeRef = useRef(Date.now());
  
  // Controla se é a primeira visita à página usando sessionStorage
  const isFirstVisit = useRef(
    !sessionStorage.getItem(`visited_${location.pathname}`)
  ).current;
  
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

  // Controla o tempo mínimo - sempre respeitado no primeiro carregamento
  useEffect(() => {
    // Se não é primeira visita e enforceMinTime está ativo, pula o delay
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
  }, [minLoadTime, isFirstVisit, enforceMinTime]);

  // Decide quando parar o loading
  useEffect(() => {
    // No primeiro carregamento, garantir que TODOS os requisitos sejam atendidos
    const shouldShow = isFirstVisit 
      ? contentReady && minTimeElapsed && (!waitForData || !hasActiveRequests)
      : contentReady && (!waitForData || !hasActiveRequests);

    if (shouldShow) {
      // Aguarda um frame extra para garantir renderização completa
      requestAnimationFrame(() => {
        setIsLoading(false);
        // Marca a página como visitada
        if (isFirstVisit) {
          sessionStorage.setItem(`visited_${location.pathname}`, 'true');
        }
      });
    }
  }, [contentReady, minTimeElapsed, hasActiveRequests, waitForData, isFirstVisit, location.pathname]);

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
