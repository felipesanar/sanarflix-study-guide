/**
 * Sistema de preload inteligente para recursos críticos
 */

// Preload de recursos pós-login
export const preloadPostLoginResources = async (): Promise<void> => {
  const preloads = [
    import('../pages/StudyGuide'),
    import('../components/CalendarView'),
    import('../components/ProgressCard')
  ];
  
  // Preload não-bloqueante
  Promise.allSettled(preloads).then(() => {
    console.log('Post-login resources preloaded');
  });
};

// Preload de componentes interativos
export const preloadInteractiveComponents = (): void => {
  Promise.allSettled([
    import('../components/ui/dialog'),
    import('../components/ui/sheet'),
    import('../components/ui/accordion')
  ]);
};

// Preload estratégico baseado em uso comum
export const preloadCommonResources = (): void => {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      preloadInteractiveComponents();
    });
  } else {
    setTimeout(preloadInteractiveComponents, 1000);
  }
};
