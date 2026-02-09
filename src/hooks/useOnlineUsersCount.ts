import { useSyncExternalStore } from 'react';
import { presenceService } from '@/services/presenceService';

// Initialize channel immediately on module load
presenceService.getChannel();

export const useOnlineUsersCount = () => {
  const subscribe = (onStoreChange: () => void) => {
    return presenceService.subscribe(onStoreChange);
  };

  const getSnapshot = () => {
    return {
      count: presenceService.getCount(),
      isConnected: presenceService.getIsConnected(),
    };
  };

  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    count: state.count,
    isConnected: state.isConnected,
    isLoading: false, // Never loading - show 0 while connecting
  };
};
