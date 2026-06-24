import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Logger } from '@/utils/logger';

// Mapa de probabilidades de navegação baseado em análise de comportamento
const NAVIGATION_PROBABILITIES: Record<string, Record<string, number>> = {
  '/login': {
    '/home': 0.95,
    '/guia-estudos': 0.3,
  },
  '/home': {
    '/guia-estudos': 0.7,
    '/desempenho-simulado': 0.4,
    '/dashboard': 0.3,
    '/simulados': 0.5,
  },
  '/guia-estudos': {
    '/home': 0.5,
    '/desempenho-simulado': 0.3,
  },
  '/desempenho-simulado': {
    '/guia-estudos': 0.6,
    '/home': 0.4,
    '/analytics': 0.3,
  },
  '/dashboard': {
    '/guia-estudos': 0.5,
    '/analytics': 0.4,
    '/home': 0.3,
  },
  '/analytics': {
    '/dashboard': 0.6,
    '/home': 0.4,
  },
  '/simulados': {
    '/home': 0.4,
    '/desempenho-simulado': 0.5,
  },
};

// Mapa de rotas para imports dinâmicos
const ROUTE_IMPORTS: Record<string, () => Promise<any>> = {
  '/home': () => import('../pages/Home'),
  '/guia-estudos': () => import('../pages/StudyGuide'),
  '/desempenho-simulado': () => import('../pages/SimuladoDesempenho'),
  '/dashboard': () => import('../pages/Dashboard'),
  '/analytics': () => import('../pages/Analytics'),
  '/admin/usuarios': () => import('@/experiences/admin/pages/UsuariosPage'),
  '/simulados': () => import('../pages/Simulados'),
  '/sanarclass': () => import('../pages/SanarClass'),
};

interface NavigationHistory {
  from: string;
  to: string;
  timestamp: number;
}

const STORAGE_KEY = 'sanarflix_navigation_history';
const MAX_HISTORY_SIZE = 100;

class NavigationTracker {
  private history: NavigationHistory[] = [];

  constructor() {
    this.loadHistory();
  }

  private loadHistory() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.history = JSON.parse(stored);
      }
    } catch (e) {
      Logger.warn('Failed to load navigation history', e);
    }
  }

  private saveHistory() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history.slice(-MAX_HISTORY_SIZE)));
    } catch (e) {
      Logger.warn('Failed to save navigation history', e);
    }
  }

  track(from: string, to: string) {
    this.history.push({
      from,
      to,
      timestamp: Date.now(),
    });
    this.saveHistory();
  }

  // Calcula probabilidades personalizadas baseadas no histórico do usuário
  getPersonalizedProbabilities(currentRoute: string): Record<string, number> {
    const recentHistory = this.history.slice(-50); // Últimas 50 navegações
    const fromCurrentRoute = recentHistory.filter(h => h.from === currentRoute);
    
    if (fromCurrentRoute.length === 0) {
      return NAVIGATION_PROBABILITIES[currentRoute] || {};
    }

    const counts: Record<string, number> = {};
    fromCurrentRoute.forEach(h => {
      counts[h.to] = (counts[h.to] || 0) + 1;
    });

    const total = fromCurrentRoute.length;
    const personalizedProbs: Record<string, number> = {};
    
    Object.entries(counts).forEach(([route, count]) => {
      personalizedProbs[route] = count / total;
    });

    // Mescla com probabilidades base (70% personalizado, 30% base)
    const baseProbs = NAVIGATION_PROBABILITIES[currentRoute] || {};
    const merged: Record<string, number> = {};
    
    const allRoutes = new Set([...Object.keys(personalizedProbs), ...Object.keys(baseProbs)]);
    allRoutes.forEach(route => {
      const personal = personalizedProbs[route] || 0;
      const base = baseProbs[route] || 0;
      merged[route] = personal * 0.7 + base * 0.3;
    });

    return merged;
  }
}

const tracker = new NavigationTracker();

export const useIntelligentPrefetch = () => {
  const location = useLocation();

  useEffect(() => {
    const currentPath = location.pathname;
    
    // Rastreia navegação
    const previousPath = sessionStorage.getItem('current_route');
    if (previousPath && previousPath !== currentPath) {
      tracker.track(previousPath, currentPath);
    }
    sessionStorage.setItem('current_route', currentPath);

    // Calcula probabilidades personalizadas
    const probabilities = tracker.getPersonalizedProbabilities(currentPath);
    
    // Threshold mínimo para prefetch (30%)
    const PREFETCH_THRESHOLD = 0.3;
    
    // Ordena rotas por probabilidade
    const routesToPrefetch = Object.entries(probabilities)
      .filter(([_, prob]) => prob >= PREFETCH_THRESHOLD)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3); // Máximo de 3 rotas para prefetch

    // Agenda prefetch usando requestIdleCallback
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        routesToPrefetch.forEach(([route, probability], index) => {
          const importFn = ROUTE_IMPORTS[route];
          if (importFn) {
            // Delay progressivo baseado na prioridade
            setTimeout(() => {
              importFn().catch(() => {
                // Silently fail, will load on demand
              });
            }, index * 500); // 0ms, 500ms, 1000ms
          }
        });
      }, { timeout: 2000 });
    }
  }, [location.pathname]);
};
