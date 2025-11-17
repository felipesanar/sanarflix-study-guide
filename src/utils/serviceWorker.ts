/**
 * Utilitário para registro e gerenciamento do Service Worker
 */

export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  // Verifica suporte
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker não suportado neste navegador');
    return null;
  }

  try {
    const isProd = (import.meta as any)?.env?.PROD === true;
    if (!isProd) {
      return null;
    }
    const isTopLevel = window.top === window.self;
    const isSecure = window.isSecureContext || location.hostname === 'localhost';
    if (!isTopLevel || !isSecure) {
      return null;
    }

    if (document.readyState !== 'complete') {
      await new Promise<void>((resolve) => window.addEventListener('load', () => resolve(), { once: true }));
    }

    if (document.visibilityState === 'hidden') {
      return null;
    }

    if (['blob:', 'data:', 'file:'].includes(location.protocol)) {
      return null;
    }

    let existing: ServiceWorkerRegistration | null = null;
    try {
      existing = await navigator.serviceWorker.getRegistration();
    } catch {}
    if (existing) return existing;

    // Registra o Service Worker
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none', // Sempre busca a versão mais recente
    });

    

    // Verifica atualizações periodicamente (a cada 1 hora)
    setInterval(() => {
      registration.update();
    }, 60 * 60 * 1000);

    // Escuta atualizações
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // Nova versão disponível
          
          
          // Notifica o usuário (você pode adicionar um toast aqui)
          if (window.confirm('Nova versão disponível! Deseja atualizar?')) {
            newWorker.postMessage({ type: 'SKIP_WAITING' });
            window.location.reload();
          }
        }
      });
    });

    // Escuta mudanças de controller (quando novo SW assume)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });

    return registration;
  } catch (error) {
    console.error('[SW] Erro ao registrar Service Worker:', error);
    return null;
  }
};

// Limpa todo o cache (útil para debug/manutenção)
export const clearServiceWorkerCache = async (): Promise<void> => {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
      if (registration?.active) {
      registration.active.postMessage({ type: 'CLEAR_CACHE' });
      }
  } catch (error) {
    console.error('[SW] Erro ao limpar cache:', error);
  }
};

// Desregistra o Service Worker (útil para debug)
export const unregisterServiceWorker = async (): Promise<boolean> => {
  if (!('serviceWorker' in navigator)) return false;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
      const success = await registration.unregister();
      return success;
      }
    return false;
  } catch (error) {
    console.error('[SW] Erro ao desregistrar Service Worker:', error);
    return false;
  }
};

// Verifica se o Service Worker está ativo
export const isServiceWorkerActive = (): boolean => {
  return 'serviceWorker' in navigator && !!navigator.serviceWorker.controller;
};
