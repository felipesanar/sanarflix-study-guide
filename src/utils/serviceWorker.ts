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
    // Registra o Service Worker
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none', // Sempre busca a versão mais recente
    });

    console.log('[SW] Service Worker registrado com sucesso:', registration.scope);

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
          console.log('[SW] Nova versão do Service Worker disponível');
          
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
      console.log('[SW] Novo Service Worker assumiu o controle');
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
      console.log('[SW] Cache limpo com sucesso');
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
      console.log('[SW] Service Worker desregistrado:', success);
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
