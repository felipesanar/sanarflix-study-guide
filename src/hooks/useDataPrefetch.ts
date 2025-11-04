import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';

// Mapa de probabilidades de navegação entre rotas
const ROUTE_PROBABILITIES: Record<string, Record<string, number>> = {
  '/home': {
    '/guia-estudos': 0.7,
    '/desempenho-simulado': 0.4,
    '/intensivao-enamed': 0.35,
  },
  '/guia-estudos': {
    '/home': 0.5,
    '/desempenho-simulado': 0.3,
  },
  '/desempenho-simulado': {
    '/guia-estudos': 0.6,
    '/analytics': 0.3,
  },
  '/intensivao-enamed': {
    '/cronograma-enamed': 0.6,
    '/guia-estudos': 0.4,
  },
  '/cronograma-enamed': {
    '/intensivao-enamed': 0.5,
    '/home': 0.3,
  },
};

// Funções de prefetch para cada rota
const PREFETCH_FUNCTIONS: Record<string, (queryClient: any) => Promise<void>> = {
  '/guia-estudos': async (queryClient) => {
    // Prefetch de conteúdos do guia de estudos
    await queryClient.prefetchQuery({
      queryKey: ['/study-guide-proxy'],
      staleTime: 5 * 60 * 1000, // 5 minutos
    });
  },
  '/desempenho-simulado': async (queryClient) => {
    // Prefetch de dados de desempenho
    await queryClient.prefetchQuery({
      queryKey: ['/enamed-proxy'],
      staleTime: 5 * 60 * 1000,
    });
  },
  '/intensivao-enamed': async (queryClient) => {
    // Prefetch de dados do intensivão
    await queryClient.prefetchQuery({
      queryKey: ['/enamed-proxy'],
      staleTime: 5 * 60 * 1000,
    });
  },
  '/cronograma-enamed': async (queryClient) => {
    // Prefetch de cronograma
    await queryClient.prefetchQuery({
      queryKey: ['/cronograma-enamed-proxy'],
      staleTime: 5 * 60 * 1000,
    });
  },
};

export const useDataPrefetch = () => {
  const queryClient = useQueryClient();
  const location = useLocation();

  useEffect(() => {
    const currentRoute = location.pathname;
    const adjacentRoutes = ROUTE_PROBABILITIES[currentRoute] || {};

    // Prefetch rotas com probabilidade > 30%
    const routesToPrefetch = Object.entries(adjacentRoutes)
      .filter(([_, probability]) => probability >= 0.3)
      .sort((a, b) => b[1] - a[1]) // Ordena por probabilidade
      .slice(0, 2); // Máximo 2 rotas

    // Agenda prefetch usando requestIdleCallback
    if ('requestIdleCallback' in window) {
      requestIdleCallback(
        () => {
          routesToPrefetch.forEach(([route, probability], index) => {
            const prefetchFn = PREFETCH_FUNCTIONS[route];
            if (prefetchFn) {
              // Delay progressivo baseado na prioridade
              setTimeout(() => {
                prefetchFn(queryClient).catch(() => {
                  // Silently fail
                });
              }, index * 1000);
            }
          });
        },
        { timeout: 3000 }
      );
    }
  }, [location.pathname, queryClient]);
};
