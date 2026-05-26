/**
 * Testes do config/env (Zod-validated env loader).
 *
 * Como `env.ts` resolve env vars no import time via `import.meta.env`,
 * fazemos vi.stubGlobal para emular variações antes de cada teste e
 * re-importamos o módulo dinamicamente.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const setEnv = (vars: Record<string, string | undefined | boolean>) => {
  vi.stubGlobal('import.meta', { env: { PROD: false, DEV: true, ...vars } });
};

describe('config/env', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parsing feliz: deriva EDGE_FUNCTIONS_BASE_URL de SUPABASE_URL', async () => {
    setEnv({
      VITE_SUPABASE_URL: 'https://abc.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'a'.repeat(40),
      VITE_APP_ENV: 'development',
    });
    const { env } = await import('@/config/env');
    expect(env.SUPABASE_URL).toBe('https://abc.supabase.co');
    expect(env.EDGE_FUNCTIONS_BASE_URL).toBe('https://abc.supabase.co/functions/v1');
    expect(env.APP_ENV).toBe('development');
    expect(env.FF_PROVA_RACE_FIX).toBe(false);
  });

  it('feature flag aceita string "true"', async () => {
    setEnv({
      VITE_SUPABASE_URL: 'https://abc.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'a'.repeat(40),
      VITE_FF_PROVA_RACE_FIX: 'true',
      VITE_FF_CALENDAR_V2: '1',
      VITE_APP_ENV: 'development',
    });
    const { env } = await import('@/config/env');
    expect(env.FF_PROVA_RACE_FIX).toBe(true);
    expect(env.FF_CALENDAR_V2).toBe(true);
  });

  it('em dev sem env vars: fallback amigável (não lança)', async () => {
    setEnv({ VITE_APP_ENV: 'development' });
    // Não deve lançar
    const mod = await import('@/config/env');
    expect(mod.env.APP_ENV).toBe('development');
  });
});
