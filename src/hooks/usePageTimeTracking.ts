import { useEffect, useRef, useCallback } from 'react';
import { useAnalyticsTracker } from './useAnalyticsTracker';

interface UsePageTimeTrackingOptions {
  pageName: string;
  minDurationMs?: number;
  enabled?: boolean;
}

/**
 * Hook to track time spent on a page
 * Fires on visibilitychange, beforeunload, or component unmount
 */
export const usePageTimeTracking = ({
  pageName,
  minDurationMs = 1000,
  enabled = true
}: UsePageTimeTrackingOptions) => {
  const { trackEvent } = useAnalyticsTracker();
  const startTimeRef = useRef<number>(Date.now());
  const hasFiredRef = useRef(false);

  const getScrollDepthBucket = useCallback(() => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (docHeight <= 0) return '100';
    const percent = Math.round((scrollTop / docHeight) * 100);
    if (percent <= 25) return '0-25';
    if (percent <= 50) return '25-50';
    if (percent <= 75) return '50-75';
    return '75-100';
  }, []);

  const sendTimeOnPage = useCallback(() => {
    if (!enabled || hasFiredRef.current) return;
    
    const duration = Date.now() - startTimeRef.current;
    if (duration < minDurationMs) return;

    hasFiredRef.current = true;

    trackEvent({
      eventName: `${pageName}_time_on_page`,
      category: 'navigation',
      data: {
        duration_ms: duration,
        scroll_depth_bucket: getScrollDepthBucket(),
      }
    });
  }, [enabled, minDurationMs, pageName, trackEvent, getScrollDepthBucket]);

  useEffect(() => {
    if (!enabled) return;

    // Reset on mount
    startTimeRef.current = Date.now();
    hasFiredRef.current = false;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        sendTimeOnPage();
      }
    };

    const handleBeforeUnload = () => {
      sendTimeOnPage();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      sendTimeOnPage();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enabled, sendTimeOnPage]);

  return { sendTimeOnPage };
};

export default usePageTimeTracking;
