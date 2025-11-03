/**
 * Sistema de cache inteligente para otimização de performance
 */

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class PerformanceCache {
  private sessionCache: Map<string, any> = new Map();

  // Cache de curto prazo (session)
  setSession<T>(key: string, data: T): void {
    this.sessionCache.set(key, data);
  }

  getSession<T>(key: string): T | null {
    return this.sessionCache.get(key) || null;
  }

  // Cache de longo prazo (localStorage)
  setPersistent<T>(key: string, data: T, ttl: number = 3600000): void {
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      ttl
    };
    try {
      localStorage.setItem(`perf_${key}`, JSON.stringify(item));
    } catch (e) {
      console.warn('Failed to set persistent cache:', e);
    }
  }

  getPersistent<T>(key: string): T | null {
    try {
      const stored = localStorage.getItem(`perf_${key}`);
      if (!stored) return null;

      const item: CacheItem<T> = JSON.parse(stored);
      if (Date.now() - item.timestamp > item.ttl) {
        localStorage.removeItem(`perf_${key}`);
        return null;
      }

      return item.data;
    } catch (e) {
      console.warn('Failed to get persistent cache:', e);
      return null;
    }
  }

  // Cache de dados do usuário
  setUserData(userData: any): void {
    const cacheData = {
      user: userData,
      timestamp: Date.now(),
      expiresIn: 15 * 60 * 1000 // 15 minutos
    };
    
    localStorage.setItem('userCache', JSON.stringify(cacheData));
    sessionStorage.setItem('sessionUser', JSON.stringify(userData));
  }

  getUserData(): any | null {
    const cached = localStorage.getItem('userCache');
    if (!cached) return null;
    
    try {
      const { user, timestamp, expiresIn } = JSON.parse(cached);
      if (Date.now() - timestamp > expiresIn) {
        localStorage.removeItem('userCache');
        return null;
      }
      
      return user;
    } catch (e) {
      return null;
    }
  }

  // Limpar todos os caches
  clearAll(): void {
    this.sessionCache.clear();
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('perf_') || key === 'userCache') {
        localStorage.removeItem(key);
      }
    });
  }

  // Limpar cache específico
  clear(key: string): void {
    this.sessionCache.delete(key);
    localStorage.removeItem(`perf_${key}`);
  }
}

export const performanceCache = new PerformanceCache();

// Hook para buscar conteúdo com cache
export const fetchWithCache = async <T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  ttl: number = 7200000, // 2 horas padrão
  useCache: boolean = true
): Promise<T> => {
  // Tentar cache primeiro
  if (useCache) {
    const cached = performanceCache.getPersistent<T>(cacheKey) ||
                   performanceCache.getSession<T>(cacheKey);
    if (cached) {
      return cached;
    }
  }
  
  // Fetch se não encontrado no cache
  const data = await fetchFn();
  
  // Armazenar em cache
  performanceCache.setSession(cacheKey, data);
  performanceCache.setPersistent(cacheKey, data, ttl);
  
  return data;
};
