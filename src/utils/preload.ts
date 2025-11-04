/**
 * Sistema de preload inteligente para recursos críticos
 */

// Preload de recursos pós-login (mais agressivo)
export const preloadPostLoginResources = async (): Promise<void> => {
  const preloads = [
    import('../pages/StudyGuide'),
    import('../pages/Home'),
    import('../components/CalendarView'),
    import('../components/ProgressCard'),
    import('../components/Layout'),
  ];
  
  // Preload não-bloqueante com prioridade
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      Promise.allSettled(preloads);
    }, { timeout: 2000 });
  } else {
    Promise.allSettled(preloads);
  }
};

// Preload de rotas específicas baseado em navegação
export const preloadRoute = (routeName: string): void => {
  const routeMap: Record<string, () => Promise<any>> = {
    'study-guide': () => import('../pages/StudyGuide'),
    'dashboard': () => import('../pages/Dashboard'),
    'intensivao': () => import('../pages/IntensivaoEnamed'),
    'simulado': () => import('../pages/SimuladoDesempenho'),
    'cronograma': () => import('../pages/CronogramaEnamed'),
    'analytics': () => import('../pages/Analytics'),
    'home': () => import('../pages/Home'),
  };

  const preloadFn = routeMap[routeName];
  if (preloadFn && 'requestIdleCallback' in window) {
    requestIdleCallback(() => {
      preloadFn().catch(() => {
        // Silently fail, will load on demand
      });
    });
  }
};

// Preload de componentes interativos
export const preloadInteractiveComponents = (): void => {
  const components = [
    import('../components/ui/dialog'),
    import('../components/ui/sheet'),
    import('../components/ui/accordion'),
    import('../components/ui/popover'),
    import('../components/ui/select'),
  ];
  
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      Promise.allSettled(components);
    }, { timeout: 3000 });
  }
};

// Preload estratégico baseado em uso comum
export const preloadCommonResources = (): void => {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      preloadInteractiveComponents();
      preloadPostLoginResources();
    }, { timeout: 1000 });
  } else {
    setTimeout(() => {
      preloadInteractiveComponents();
      preloadPostLoginResources();
    }, 1000);
  }
};

// Auto-preload baseado em hover de links
export const setupLinkPrefetch = (): void => {
  if (typeof window === 'undefined') return;

  const linkRouteMap: Record<string, string> = {
    '/guia-estudos': 'study-guide',
    '/dashboard': 'dashboard',
    '/intensivao-enamed': 'intensivao',
    '/desempenho-simulado': 'simulado',
    '/cronograma-enamed': 'cronograma',
    '/analytics': 'analytics',
    '/home': 'home',
  };

  document.addEventListener('mouseover', (e) => {
    const target = e.target as HTMLElement;
    const link = target.closest('a[href]') as HTMLAnchorElement;
    
    if (link && link.href) {
      const url = new URL(link.href);
      const route = linkRouteMap[url.pathname];
      if (route) {
        preloadRoute(route);
      }
    }
  }, { passive: true });
};
