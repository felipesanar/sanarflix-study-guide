import { useState, useEffect, useRef } from 'react';
import { presenceService } from '@/services/presenceService';

export const useOnlineUsersCount = () => {
  const [count, setCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const handleUpdate = (newCount: number, connected: boolean) => {
      if (mountedRef.current) {
        setCount(newCount);
        setIsConnected(connected);
      }
    };

    const unsubscribe = presenceService.subscribe(handleUpdate);

    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, []);

  return {
    count,
    isConnected,
    isLoading: false,
  };
};
