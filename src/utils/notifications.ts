/**
 * Utilitário para gerenciar notificações push no navegador
 */

export type NotificationPermission = 'granted' | 'denied' | 'default';

/**
 * Verifica se o navegador suporta notificações
 */
export const isNotificationSupported = (): boolean => {
  return 'Notification' in window && 'serviceWorker' in navigator;
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
