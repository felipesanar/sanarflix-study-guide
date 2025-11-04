import { ReactNode, useState, useEffect, useRef } from 'react';
import { PageLoader } from './PageLoader';
import { PageTransition } from './PageTransition';

interface PageWrapperProps {
  children: ReactNode;
  loadingMessage?: string;
  minLoadTime?: number; // tempo mínimo de loading em ms para evitar flash
}

export const PageWrapper = ({ 
  children, 
  loadingMessage,
  minLoadTime = 800 // Aumentado para 800ms para garantir carregamento completo
}: PageWrapperProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [contentReady, setContentReady] = useState(false);
  const mountTimeRef = useRef(Date.now());

  useEffect(() => {
    // Aguarda o conteúdo estar no DOM
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setContentReady(true);
      });
    });
  }, []);

  useEffect(() => {
    if (!contentReady) return;

    const elapsedTime = Date.now() - mountTimeRef.current;
    const remainingTime = Math.max(0, minLoadTime - elapsedTime);

    // Aguarda o tempo mínimo E o conteúdo estar pronto
    const timer = setTimeout(() => {
      // Adiciona um frame extra para garantir que tudo foi renderizado
      requestAnimationFrame(() => {
        setIsLoading(false);
      });
    }, remainingTime);

    return () => clearTimeout(timer);
  }, [contentReady, minLoadTime]);

  if (isLoading) {
    return <PageLoader message={loadingMessage} />;
  }

  return (
    <PageTransition>
      {children}
    </PageTransition>
  );
};
