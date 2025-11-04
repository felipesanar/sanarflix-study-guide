import { ReactNode, useState, useEffect } from 'react';
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
  minLoadTime = 300 
}: PageWrapperProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Marca como pronto imediatamente
    const readyTimer = setTimeout(() => {
      setIsReady(true);
    }, 50);

    // Respeita tempo mínimo de loading para evitar flash
    const loadTimer = setTimeout(() => {
      setIsLoading(false);
    }, minLoadTime);

    return () => {
      clearTimeout(readyTimer);
      clearTimeout(loadTimer);
    };
  }, [minLoadTime]);

  if (!isReady || isLoading) {
    return <PageLoader message={loadingMessage} />;
  }

  return (
    <PageTransition>
      {children}
    </PageTransition>
  );
};
