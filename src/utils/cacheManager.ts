/**
 * Gerenciador de cache com invalidação inteligente
 * Suporta TTL, invalidação por tag, e limpeza automática
 */

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
  tags: string[];
}

interface CacheOptions {
  ttl?: number; // Time-to-live em ms
  tags?: string[]; // Tags para invalidação em grupo
}

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutos
const CLEANUP_INTERVAL = 60 * 1000; // Limpeza a cada 1 minuto

class CacheManager {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startCleanupTimer();
  }

  /**
   * Armazena um valor no cache
   */
  set<T>(key: string, value: T, options: CacheOptions = {}): void {
    const { ttl = DEFAULT_TTL, tags = [] } = options;

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl,
      tags,
    });
  }

  /**
   * Recupera um valor do cache
   * Retorna undefined se expirado ou não existir
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) return undefined;

    const isExpired = Date.now() - entry.timestamp > entry.ttl;
    if (isExpired) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  /**
   * Verifica se uma chave existe e é válida
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Remove uma chave específica
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Invalida todas as entradas com uma tag específica
   */
  invalidateByTag(tag: string): number {
    let count = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.includes(tag)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Invalida entradas que correspondem a um padrão de chave
   */
  invalidateByPattern(pattern: RegExp): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Limpa todo o cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Limpa entradas expiradas
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Retorna estatísticas do cache
   */
  stats(): { size: number; oldestEntry: number | null } {
    let oldest: number | null = null;

    for (const entry of this.cache.values()) {
      if (oldest === null || entry.timestamp < oldest) {
        oldest = entry.timestamp;
      }
    }

    return {
      size: this.cache.size,
      oldestEntry: oldest,
    };
  }

  private startCleanupTimer(): void {
    if (typeof window !== 'undefined') {
      this.cleanupTimer = setInterval(() => {
        this.cleanup();
      }, CLEANUP_INTERVAL);
    }
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
  }
}

// Singleton global
export const cacheManager = new CacheManager();

// Helpers para casos específicos
export const homeDataCache = {
  key: (userId: string) => `home_data_${userId}`,
  tags: ['home', 'user-data'],
  ttl: 10 * 60 * 1000, // 10 minutos

  set: <T>(userId: string, data: T) => {
    cacheManager.set(homeDataCache.key(userId), data, {
      ttl: homeDataCache.ttl,
      tags: homeDataCache.tags,
    });
  },

  get: <T>(userId: string) => cacheManager.get<T>(homeDataCache.key(userId)),

  invalidate: (userId: string) => cacheManager.delete(homeDataCache.key(userId)),

  invalidateAll: () => cacheManager.invalidateByTag('home'),
};

export const studyGuideCache = {
  key: (iesId: string, semestre: number) => `study_guide_${iesId}_${semestre}`,
  tags: ['study-guide'],
  ttl: 30 * 60 * 1000, // 30 minutos

  set: <T>(iesId: string, semestre: number, data: T) => {
    cacheManager.set(studyGuideCache.key(iesId, semestre), data, {
      ttl: studyGuideCache.ttl,
      tags: studyGuideCache.tags,
    });
  },

  get: <T>(iesId: string, semestre: number) => cacheManager.get<T>(studyGuideCache.key(iesId, semestre)),

  invalidate: (iesId: string, semestre: number) => cacheManager.delete(studyGuideCache.key(iesId, semestre)),

  invalidateAll: () => cacheManager.invalidateByTag('study-guide'),
};
