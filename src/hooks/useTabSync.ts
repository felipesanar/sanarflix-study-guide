import { useEffect, useCallback } from 'react';

interface TabSyncMessage {
  type: 'AUTH_CHANGE' | 'LOGOUT' | 'LOGIN';
  data?: any;
}

export const useTabSync = (onSync: (message: TabSyncMessage) => void) => {
  useEffect(() => {
    // BroadcastChannel para comunicação entre abas
    const channel = new BroadcastChannel('sanarflix-auth');
    
    channel.onmessage = (event) => {
      onSync(event.data);
    };

    // Storage event listener para fallback (funciona entre abas diferentes)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'sanarflix-user' && e.newValue !== e.oldValue) {
        onSync({ 
          type: e.newValue ? 'LOGIN' : 'LOGOUT',
          data: e.newValue ? JSON.parse(e.newValue) : null 
        });
      }
    };

    window.addEventListener('storage', handleStorage);

    return () => {
      channel.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, [onSync]);

  const broadcast = useCallback((message: TabSyncMessage) => {
    const channel = new BroadcastChannel('sanarflix-auth');
    channel.postMessage(message);
    channel.close();
  }, []);

  return { broadcast };
};
