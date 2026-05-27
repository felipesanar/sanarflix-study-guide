/**
 * Utilitário para registro e gerenciamento do Service Worker
 */

import { Logger } from '@/utils/logger';
export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  // Verifica suporte
  if (!('serviceWorker' in navigator)) {
    Logger.warn('Service Worker não suportado neste navegador');
    return null;
  }

  try {
    const isProd = (import.meta as any)?.env?.PROD === true;
    if (!isProd) {
      return null;
    }

    // Pular SW em hosts de preview/sandbox da Lovable. O preview rebuilda
    // com frequência e qualquer mudança no sw.js disparava `controllerchange`
    // → `location.reload()` → loop infinito após o login. Produção real
    // (academy.sanar.com.br / sanarflix-study-guide.lovable.app) segue ativa.
    const host = location.hostname;
    const isLovablePreview =
      host.endsWith('.lovable.app') &&
      (host.startsWith('id-preview--') || host.startsWith('preview--'));
    if (isLovablePreview) {
      // Limpa SWs antigos que possam ter ficado registrados em sessões anteriores
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      } catch {}
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

    // Escuta atualizações - usuário decide via confirm() quando aplicar.
    // Removido o listener global de `controllerchange` que disparava reload
    // automático e causava loop em ambientes que reativam o SW (preview).
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          if (window.confirm('Nova versão disponível! Deseja atualizar?')) {
            newWorker.postMessage({ type: 'SKIP_WAITING' });
            window.location.reload();
          }
        }
      });
    });

    return registration;
  } catch (error) {
    Logger.error('[SW] Erro ao registrar Service Worker:', error);
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
    Logger.error('[SW] Erro ao limpar cache:', error);
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
    Logger.error('[SW] Erro ao desregistrar Service Worker:', error);
    return false;
  }
};

// Verifica se o Service Worker está ativo
export const isServiceWorkerActive = (): boolean => {
  return 'serviceWorker' in navigator && !!navigator.serviceWorker.controller;
};
