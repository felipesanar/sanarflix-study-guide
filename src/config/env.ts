import { z } from 'zod';
import { Logger } from '@/utils/logger';

const rawEnv = {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
  VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined,
  VITE_STUDY_GUIDE_API_BASE_URL: import.meta.env.VITE_STUDY_GUIDE_API_BASE_URL as string | undefined,
  VITE_EDGE_FUNCTIONS_BASE_URL: import.meta.env.VITE_EDGE_FUNCTIONS_BASE_URL as string | undefined,
  VITE_APP_ENV: import.meta.env.VITE_APP_ENV as string | undefined,
  VITE_FF_PROVA_RACE_FIX: import.meta.env.VITE_FF_PROVA_RACE_FIX as string | undefined,
  VITE_FF_CALENDAR_V2: import.meta.env.VITE_FF_CALENDAR_V2 as string | undefined,
  PROD: import.meta.env.PROD as boolean,
};

// Fallback canônico de produção, espelhando os valores hardcoded em
// src/integrations/supabase/client.ts (gerado pela Lovable). A anon key é
// pública por design. Mantém o app auto-suficiente quando o ambiente de
// deploy não injeta as VITE_* — as VITE_* ainda têm prioridade quando presentes.
const DEFAULT_SUPABASE_URL = 'https://gvqvrmkizemwsasmupmo.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2cXZybWtpemVtd3Nhc211cG1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5NzU1OTksImV4cCI6MjA2OTU1MTU5OX0.8viZ7xflE9Yb4vrKzaaKuMsQFLhr_NgyhrJtnDIFCOU';

const boolFromString = z
  .union([z.string(), z.boolean(), z.undefined()])
  .transform((v) => v === true || v === 'true' || v === '1');

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(20),
  STUDY_GUIDE_API_BASE_URL: z.string().url(),
  EDGE_FUNCTIONS_BASE_URL: z.string().url(),
  APP_ENV: z.enum(['development', 'staging', 'production']),
  FF_PROVA_RACE_FIX: boolFromString,
  FF_CALENDAR_V2: boolFromString,
});

export type AppEnv = z.infer<typeof envSchema> & { IS_VALID: boolean };

function buildEnv(): AppEnv {
  const supabaseUrl = rawEnv.VITE_SUPABASE_URL ?? DEFAULT_SUPABASE_URL;
  const supabaseAnonKey =
    rawEnv.VITE_SUPABASE_ANON_KEY ?? rawEnv.VITE_SUPABASE_PUBLISHABLE_KEY ?? DEFAULT_SUPABASE_ANON_KEY;
  const appEnv = rawEnv.VITE_APP_ENV ?? (rawEnv.PROD ? 'production' : 'development');

  // Derived defaults so envs that only set SUPABASE_URL still work.
  const edgeBase =
    rawEnv.VITE_EDGE_FUNCTIONS_BASE_URL ??
    (supabaseUrl ? `${supabaseUrl}/functions/v1` : undefined);

  const studyGuideBase =
    rawEnv.VITE_STUDY_GUIDE_API_BASE_URL ??
    (supabaseUrl
      ? `${supabaseUrl.replace('.supabase.co', '.functions.supabase.co')}/study-guide-proxy`
      : undefined);

  const parsed = envSchema.safeParse({
    SUPABASE_URL: supabaseUrl,
    SUPABASE_ANON_KEY: supabaseAnonKey,
    STUDY_GUIDE_API_BASE_URL: studyGuideBase,
    EDGE_FUNCTIONS_BASE_URL: edgeBase,
    APP_ENV: appEnv,
    FF_PROVA_RACE_FIX: rawEnv.VITE_FF_PROVA_RACE_FIX,
    FF_CALENDAR_V2: rawEnv.VITE_FF_CALENDAR_V2,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    const message =
      `[env] Variáveis de ambiente inválidas ou ausentes:\n${issues}\n` +
      `Consulte .env.example para o conjunto esperado.`;

    // Nunca derrubamos o app: logamos e seguimos com fallback marcado como inválido.
    // main.tsx detecta IS_VALID === false e renderiza tela de erro amigável.
    // eslint-disable-next-line no-console
    Logger.error(message);

    return {
      SUPABASE_URL: supabaseUrl ?? 'http://localhost:54321',
      SUPABASE_ANON_KEY: supabaseAnonKey ?? 'missing-anon-key',
      STUDY_GUIDE_API_BASE_URL: studyGuideBase ?? 'http://localhost:54321/functions/v1/study-guide-proxy',
      EDGE_FUNCTIONS_BASE_URL: edgeBase ?? 'http://localhost:54321/functions/v1',
      APP_ENV: appEnv as AppEnv['APP_ENV'],
      FF_PROVA_RACE_FIX: false,
      FF_CALENDAR_V2: false,
      IS_VALID: false,
    };
  }

  return { ...parsed.data, IS_VALID: true };
}

export const env: AppEnv = buildEnv();
