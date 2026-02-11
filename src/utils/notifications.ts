/**
 * Utilitário para gerenciar notificações push no navegador
 */

import { supabase } from '@/integrations/supabase/client';

export type NotificationPermission = 'granted' | 'denied' | 'default';

/**
 * Verifica se o navegador suporta notificações
 */
export const isNotificationSupported = (): boolean => {
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
};

/**
 * Solicita permissão para enviar notificações
 */
export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!isNotificationSupported()) {
    console.warn('Notificações não são suportadas neste navegador');
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission as NotificationPermission;
  } catch (error) {
    console.error('Erro ao solicitar permissão de notificação:', error);
    return 'denied';
  }
};

/**
 * Retorna o status atual da permissão de notificação
 */
export const getNotificationPermission = (): NotificationPermission => {
  if (!isNotificationSupported()) {
    return 'denied';
  }
  return Notification.permission as NotificationPermission;
};

/**
 * Obtém a chave pública VAPID do servidor
 */
export const getVapidPublicKey = async (): Promise<string | null> => {
  try {
    const { data, error } = await supabase.functions.invoke('get-vapid-key');
    if (error) {
      console.error('Erro ao obter chave VAPID:', error);
      return null;
    }
    return data?.publicKey || null;
  } catch (error) {
    console.error('Erro ao obter chave VAPID:', error);
    return null;
  }
};

/**
 * Converte chave VAPID para Uint8Array
 */
const urlBase64ToUint8Array = (base64String: string): ArrayBuffer => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
};

/**
 * Registra subscription de push no servidor
 */
export const subscribeToPush = async (): Promise<boolean> => {
  if (!isNotificationSupported()) {
    console.warn('Push não é suportado');
    return false;
  }

  const permission = getNotificationPermission();
  if (permission !== 'granted') {
    console.warn('Permissão de notificação não concedida');
    return false;
  }

  try {
    const vapidKey = await getVapidPublicKey();
    if (!vapidKey) {
      console.error('Chave VAPID não disponível');
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    
    // Verifica se já existe uma subscription
    let subscription = await (registration as any).pushManager.getSubscription();
    
    if (!subscription) {
      // Cria nova subscription
      subscription = await (registration as any).pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }

    // Envia subscription para o servidor
    const { error } = await supabase.functions.invoke('save-push-subscription', {
      body: {
        subscription: subscription.toJSON(),
        action: 'subscribe',
      },
    });

    if (error) {
      console.error('Erro ao salvar subscription:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Erro ao registrar push subscription:', error);
    return false;
  }
};

/**
 * Remove subscription de push
 */
export const unsubscribeFromPush = async (): Promise<boolean> => {
  if (!isNotificationSupported()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await (registration as any).pushManager.getSubscription();

    if (subscription) {
      // Remove do servidor
      await supabase.functions.invoke('save-push-subscription', {
        body: {
          subscription: subscription.toJSON(),
          action: 'unsubscribe',
        },
      });

      // Remove localmente
      await subscription.unsubscribe();
    }

    return true;
  } catch (error) {
    console.error('Erro ao cancelar subscription:', error);
    return false;
  }
};

/**
 * Envia uma notificação de teste
 */
export const sendTestNotification = async (
  title: string = 'Sanarflix - Teste de Notificação',
  body: string = 'As notificações estão funcionando corretamente! 🎉'
): Promise<boolean> => {
  if (!isNotificationSupported()) {
    console.warn('Notificações não são suportadas');
    return false;
  }

  const permission = getNotificationPermission();
  
  if (permission !== 'granted') {
    console.warn('Permissão de notificação não concedida');
    return false;
  }

  try {
    // Verifica se há um service worker ativo
    const registration = await navigator.serviceWorker.ready;
    
    await registration.showNotification(title, {
      body,
      icon: '/lovable-uploads/efb6cdcc-7e6b-4bd1-acc1-0dec71e055ff.png',
      badge: '/lovable-uploads/efb6cdcc-7e6b-4bd1-acc1-0dec71e055ff.png',
      tag: 'test-notification',
      requireInteraction: false,
    });

    return true;
  } catch (error) {
    console.error('Erro ao enviar notificação de teste:', error);
    return false;
  }
};

/**
 * Envia uma notificação de lembrete de estudo
 */
export const sendStudyReminderNotification = async (
  subjects: Array<{ name: string; day?: string; week?: string }>
): Promise<boolean> => {
  if (!isNotificationSupported() || getNotificationPermission() !== 'granted') {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    
    const subjectsList = subjects.map(s => s.name).join(', ');
    const body = subjects.length === 1
      ? `Você tem ${subjects[0].name} agendada para hoje`
      : `Você tem ${subjects.length} matérias agendadas: ${subjectsList}`;

    await registration.showNotification('📚 Lembrete de Estudo', {
      body,
      icon: '/lovable-uploads/efb6cdcc-7e6b-4bd1-acc1-0dec71e055ff.png',
      badge: '/lovable-uploads/efb6cdcc-7e6b-4bd1-acc1-0dec71e055ff.png',
      tag: 'study-reminder',
      requireInteraction: true,
      data: {
        subjects,
        timestamp: Date.now(),
      },
    });

    return true;
  } catch (error) {
    console.error('Erro ao enviar notificação de lembrete:', error);
    return false;
  }
};
