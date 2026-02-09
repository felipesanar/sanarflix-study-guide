import { useSyncExternalStore, useCallback } from 'react';
import { presenceService } from '@/services/presenceService';

// Initialize channel immediately on module load
presenceService.getChannel();

export const useOnlineUsersCount = () => {
  const subscribe = useCallback((onStoreChange: () => void) => {
    return presenceService.subscribe(onStoreChange);
  }, []);

  const getCountSnapshot = useCallback(() => {
    return presenceService.getCount();
  }, []);

  const getConnectedSnapshot = useCallback(() => {
    return presenceService.getIsConnected();
  }, []);

  const count = useSyncExternalStore(subscribe, getCountSnapshot, getCountSnapshot);
  const isConnected = useSyncExternalStore(subscribe, getConnectedSnapshot, getConnectedSnapshot);

  return {
    count,
    isConnected,
    isLoading: false,
  };
};
