/**
 * Cache local de Home (sessionStorage) extraído de useHomeData.ts.
 *
 * Vida útil curta (10min) para garantir hidratação rápida sem flash de
 * skeleton em revisitas. Server é sempre a fonte de verdade — esse cache
 * é apenas otimização de UX.
 *
 * Idempotente: corrupção de JSON = remoção silenciosa + cache miss.
 */
import { CACHE_TTL } from '@/config/cache';
import { Logger } from '@/utils/logger';
import type { HomeDataSnapshot } from './types';

const CACHE_KEY_PREFIX = 'home_data_cache_';

export function readHomeCache(userId: string): HomeDataSnapshot | null {
  if (!userId) return null;
  const key = `${CACHE_KEY_PREFIX}${userId}`;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HomeDataSnapshot;
    if (parsed?.timestamp && Date.now() - parsed.timestamp < CACHE_TTL.HOME) {
      return parsed;
    }
    return null;
  } catch (e) {
    Logger.warn('[home/cache] read error, clearing', e);
    try { sessionStorage.removeItem(key); } catch { /* noop */ }
    return null;
  }
}

export function writeHomeCache(userId: string, data: Omit<HomeDataSnapshot, 'timestamp'>): void {
  if (!userId) return;
  const key = `${CACHE_KEY_PREFIX}${userId}`;
  try {
    sessionStorage.setItem(key, JSON.stringify({ ...data, timestamp: Date.now() }));
  } catch (e) {
    // Quota excedida / modo privado / storage indisponível — não bloqueia o caller.
    Logger.warn('[home/cache] write failed', e);
  }
}

export function clearHomeCache(userId: string): void {
  if (!userId) return;
  try {
    sessionStorage.removeItem(`${CACHE_KEY_PREFIX}${userId}`);
  } catch { /* noop */ }
}
