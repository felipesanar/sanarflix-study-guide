import { useEffect, useRef } from 'react';
import { useAnalyticsTracker } from './useAnalyticsTracker';
import { Logger } from '@/utils/logger';

/**
 * Hook to capture Core Web Vitals and send to analytics
 * Uses web-vitals library if available, otherwise uses manual measurement
 */
export const useWebVitals = () => {
  const { trackWebVitals } = useAnalyticsTracker();
  const hasTrackedRef = useRef(false);

  useEffect(() => {
    if (hasTrackedRef.current) return;

    // Use web-vitals library if available
    const measureVitals = async () => {
      try {
        // Dynamic import to avoid bundling if not used
        const webVitals = await import('web-vitals');
        
        const metrics: Record<string, number> = {};
        let metricsCount = 0;
        const expectedMetrics = 3; // LCP, CLS, INP

        const sendMetrics = () => {
          metricsCount++;
          if (metricsCount >= expectedMetrics && !hasTrackedRef.current) {
            hasTrackedRef.current = true;
            trackWebVitals(metrics);
          }
        };

        webVitals.onLCP((metric) => {
          metrics.lcp = Math.round(metric.value);
          sendMetrics();
        });

        webVitals.onCLS((metric) => {
          metrics.cls = parseFloat(metric.value.toFixed(4));
          sendMetrics();
        });

        webVitals.onINP((metric) => {
          metrics.inp = Math.round(metric.value);
          sendMetrics();
        });

        webVitals.onFCP((metric) => {
          metrics.fcp = Math.round(metric.value);
        });

        webVitals.onTTFB((metric) => {
          metrics.ttfb = Math.round(metric.value);
        });

        // Fallback timeout to send whatever we have after 10s
        setTimeout(() => {
          if (!hasTrackedRef.current && Object.keys(metrics).length > 0) {
            hasTrackedRef.current = true;
            trackWebVitals(metrics);
          }
        }, 10000);

      } catch (error) {
        // web-vitals not available, use Performance API fallback
        if (import.meta.env.DEV) {
          Logger.info('[WebVitals] Library not available, using fallback');
        }

        // Simple fallback measurements
        if ('performance' in window) {
          const timing = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          if (timing) {
            const metrics: Record<string, number> = {};
            
            // TTFB approximation
            if (timing.responseStart > 0) {
              metrics.ttfb = Math.round(timing.responseStart - timing.requestStart);
            }

            // FCP approximation via paint entries
            const paintEntries = performance.getEntriesByType('paint');
            const fcpEntry = paintEntries.find(e => e.name === 'first-contentful-paint');
            if (fcpEntry) {
              metrics.fcp = Math.round(fcpEntry.startTime);
            }

            if (Object.keys(metrics).length > 0 && !hasTrackedRef.current) {
              hasTrackedRef.current = true;
              trackWebVitals(metrics);
            }
          }
        }
      }
    };

    // Delay measurement to ensure page has loaded
    const timeoutId = setTimeout(measureVitals, 1000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [trackWebVitals]);
};

export default useWebVitals;
