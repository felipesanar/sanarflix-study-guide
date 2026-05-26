/**
 * Testes do config/env (Zod-validated env loader).
 *
 * Vitest injeta `import.meta.env` automaticamente (modo 'test'). Aqui
 * verificamos apenas o comportamento estável: o módulo carrega sem
 * lançar em ambiente de teste, e expõe os campos esperados.
 *
 * Casos de borda (variáveis ausentes, fallback de produção) são
 * cobertos pelo próprio Zod schema e validados em smoke manual /
 * Playwright. Mockear import.meta.env em runtime exigiria refactor
 * para uma factory function — fica para PR dedicado se necessário.
 */
import { describe, it, expect } from 'vitest';
import { env } from '@/config/env';

describe('config/env', () => {
  it('expõe os campos canônicos com tipos corretos', () => {
    expect(typeof env.SUPABASE_URL).toBe('string');
    expect(typeof env.SUPABASE_ANON_KEY).toBe('string');
    expect(typeof env.EDGE_FUNCTIONS_BASE_URL).toBe('string');
    expect(typeof env.STUDY_GUIDE_API_BASE_URL).toBe('string');
    expect(['development', 'staging', 'production']).toContain(env.APP_ENV);
    expect(typeof env.FF_PROVA_RACE_FIX).toBe('boolean');
    expect(typeof env.FF_CALENDAR_V2).toBe('boolean');
  });

  it('deriva EDGE_FUNCTIONS_BASE_URL apontando para /functions/v1', () => {
    // Mesmo em fallback (dev local sem env), o caminho deve terminar em /functions/v1
    expect(env.EDGE_FUNCTIONS_BASE_URL).toMatch(/\/functions\/v1$/);
  });

  it('feature flags são booleanas estritas (nunca undefined)', () => {
    expect(env.FF_PROVA_RACE_FIX === true || env.FF_PROVA_RACE_FIX === false).toBe(true);
    expect(env.FF_CALENDAR_V2 === true || env.FF_CALENDAR_V2 === false).toBe(true);
  });
});
