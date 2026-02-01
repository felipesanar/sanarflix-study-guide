/**
 * Sistema de preload inteligente para recursos críticos
 */

// Preload de recursos pós-login (somente componentes críticos)
export const preloadPostLoginResources = async (): Promise<void> => {
  const preloads = [
    import('../components/Layout'),
    import('../components/ProgressCard'),
  ];
  
  // Preload não-bloqueante com prioridade
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      Promise.allSettled(preloads);
    }, { timeout: 3000 });
  } else {
    setTimeout(() => Promise.allSettled(preloads), 1000);
  }
};

// Preload de rotas específicas baseado em navegação
export const preloadRoute = (routeName: string): void => {
  const routeMap: Record<string, () => Promise<any>> = {
    'study-guide': () => import('../pages/StudyGuide'),
    'dashboard': () => import('../pages/Dashboard'),
    'simulado': () => import('../pages/SimuladoDesempenho'),
    'analytics': () => import('../pages/Analytics'),
    'home': () => import('../pages/Home'),
    'simulados': () => import('../pages/Simulados'),
    'sanarclass': () => import('../pages/SanarClass'),
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

// Preload estratégico baseado em uso comum (reduzido)
export const preloadCommonResources = (): void => {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      preloadInteractiveComponents();
    }, { timeout: 2000 });
  } else {
    setTimeout(preloadInteractiveComponents, 1500);
  }
};

// Auto-preload baseado em hover de links
export const setupLinkPrefetch = (): void => {
  if (typeof window === 'undefined') return;

  const linkRouteMap: Record<string, string> = {
    '/guia-estudos': 'study-guide',
    '/dashboard': 'dashboard',
    '/desempenho-simulado': 'simulado',
    '/analytics': 'analytics',
    '/home': 'home',
    '/simulados': 'simulados',
    '/sanarclass': 'sanarclass',
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
