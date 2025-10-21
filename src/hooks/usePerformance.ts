import { useEffect, useRef, useCallback } from 'react';
import Logger from '@/utils/logger';

/**
 * Hook para monitoramento de performance de componentes React
 */
export const usePerformance = (componentName: string) => {
  const renderStartTime = useRef<number>(0);
  const mountTime = useRef<number>(0);

  useEffect(() => {
    mountTime.current = performance.now();
    
    return () => {
      const unmountTime = performance.now();
      const totalLifetime = unmountTime - mountTime.current;
      Logger.performance(`${componentName} lifetime`, totalLifetime);
    };
  }, [componentName]);

  const startRender = useCallback(() => {
    renderStartTime.current = performance.now();
  }, []);

  const endRender = useCallback(() => {
    if (renderStartTime.current > 0) {
      const renderTime = performance.now() - renderStartTime.current;
      Logger.performance(`${componentName} render`, renderTime);
      renderStartTime.current = 0;
    }
  }, [componentName]);

  return { startRender, endRender };
};

/**
 * Hook para medir performance de operações assíncronas
 */
export const useAsyncPerformance = () => {
  const measureAsync = useCallback(async <T>(
    operation: string,
    asyncFn: () => Promise<T>
  ): Promise<T> => {
    const startTime = performance.now();
    
    try {
      const result = await asyncFn();
      const duration = performance.now() - startTime;
      Logger.performance(operation, duration, { success: true });
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      Logger.performance(operation, duration, { success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }, []);

  return { measureAsync };
};

/**
 * Hook para monitorar Web Vitals
 */
export const useWebVitals = () => {
  useEffect(() => {
    // Importação dinâmica para reduzir bundle size
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      const reportMetric = (metric: any) => {
        Logger.performance(`WebVital: ${metric.name}`, metric.value, {
          id: metric.id,
          rating: metric.rating,
          delta: metric.delta,
        });
      };

      getCLS(reportMetric);
      getFID(reportMetric);
      getFCP(reportMetric);
      getLCP(reportMetric);
      getTTFB(reportMetric);
    }).catch(() => {
      // web-vitals não disponível, ignorar silenciosamente
    });
  }, []);
};

/**
 * Hook para detectar renderizações desnecessárias
 */
export const useWhyDidYouUpdate = (name: string, props: Record<string, any>) => {
  const previousProps = useRef<Record<string, any>>();

  useEffect(() => {
    if (previousProps.current) {
      const allKeys = Object.keys({ ...previousProps.current, ...props });
      const changedProps: Record<string, { from: any; to: any }> = {};

      allKeys.forEach(key => {
        if (previousProps.current![key] !== props[key]) {
          changedProps[key] = {
            from: previousProps.current![key],
            to: props[key],
          };
        }
      });

      if (Object.keys(changedProps).length) {
        Logger.debug(`${name} re-rendered due to:`, changedProps);
      }
    }

    previousProps.current = props;
  });
};

/**
 * Hook para medir tempo de carregamento de dados
 */
export const useLoadingTime = (isLoading: boolean, operationName: string) => {
  const startTime = useRef<number>(0);

  useEffect(() => {
    if (isLoading && startTime.current === 0) {
      startTime.current = performance.now();
    } else if (!isLoading && startTime.current > 0) {
      const loadingTime = performance.now() - startTime.current;
      Logger.performance(`Loading: ${operationName}`, loadingTime);
      startTime.current = 0;
    }
  }, [isLoading, operationName]);
};

/**
 * Hook para detectar componentes lentos
 */
export const useSlowComponentDetection = (componentName: string, threshold = 16) => {
  const renderCount = useRef(0);
  const slowRenders = useRef(0);

  useEffect(() => {
    const startTime = performance.now();

    return () => {
      const renderTime = performance.now() - startTime;
      renderCount.current++;

      if (renderTime > threshold) {
        slowRenders.current++;
        Logger.warn(`Slow render detected in ${componentName}`, {
          renderTime,
          renderCount: renderCount.current,
          slowRenders: slowRenders.current,
          slowRenderPercentage: (slowRenders.current / renderCount.current) * 100,
        });
      }
    };
  });
};

/**
 * Hook para monitorar uso de memória
 */
export const useMemoryMonitoring = (componentName: string) => {
  useEffect(() => {
    const checkMemory = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        Logger.performance(`Memory usage for ${componentName}`, 0, {
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
        });
      }
    };

    // Verificar memória na montagem e desmontagem
    checkMemory();
    
    return () => {
      checkMemory();
    };
  }, [componentName]);
};

/**
 * Hook para medir performance de scroll
 */
export const useScrollPerformance = () => {
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animationId: number;

    const measureScrollFPS = () => {
      frameCount++;
      const currentTime = performance.now();
      
      if (currentTime - lastTime >= 1000) {
        const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
        
        if (fps < 30) {
          Logger.warn('Low scroll FPS detected', { fps });
        }
        
        frameCount = 0;
        lastTime = currentTime;
      }
      
      animationId = requestAnimationFrame(measureScrollFPS);
    };

    const handleScroll = () => {
      if (!animationId) {
        animationId = requestAnimationFrame(measureScrollFPS);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, []);
};

/**
 * Decorator para medir performance de métodos de classe
 */
export const measureMethodPerformance = (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
  const originalMethod = descriptor.value;

  descriptor.value = function (...args: any[]) {
    const startTime = performance.now();
    const result = originalMethod.apply(this, args);

    if (result instanceof Promise) {
      return result.finally(() => {
        const duration = performance.now() - startTime;
        Logger.performance(`${target.constructor.name}.${propertyName}`, duration);
      });
    } else {
      const duration = performance.now() - startTime;
      Logger.performance(`${target.constructor.name}.${propertyName}`, duration);
      return result;
    }
  };

  return descriptor;
};