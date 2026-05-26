import { z } from 'zod';

const rawEnv = {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
  VITE_STUDY_GUIDE_API_BASE_URL: import.meta.env.VITE_STUDY_GUIDE_API_BASE_URL as string | undefined,
  VITE_EDGE_FUNCTIONS_BASE_URL: import.meta.env.VITE_EDGE_FUNCTIONS_BASE_URL as string | undefined,
  VITE_APP_ENV: import.meta.env.VITE_APP_ENV as string | undefined,
  VITE_FF_PROVA_RACE_FIX: import.meta.env.VITE_FF_PROVA_RACE_FIX as string | undefined,
  VITE_FF_CALENDAR_V2: import.meta.env.VITE_FF_CALENDAR_V2 as string | undefined,
  PROD: import.meta.env.PROD as boolean,
};

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

export type AppEnv = z.infer<typeof envSchema>;

function buildEnv(): AppEnv {
  const supabaseUrl = rawEnv.VITE_SUPABASE_URL;
  const supabaseAnonKey = rawEnv.VITE_SUPABASE_ANON_KEY;
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

    // Em produção falhamos rápido para não subir com config quebrada.
    // Em desenvolvimento mantemos o app de pé com erro visível para acelerar onboarding.
    if (appEnv === 'production') {
      throw new Error(message);
    }
    // eslint-disable-next-line no-console
    console.error(message);

    // Fallback mínimo para dev local quando o .env ainda não foi configurado.
    // Estes valores NÃO devem ser usados em produção e o schema acima impede.
    return {
      SUPABASE_URL: supabaseUrl ?? 'http://localhost:54321',
      SUPABASE_ANON_KEY: supabaseAnonKey ?? 'missing-anon-key',
      STUDY_GUIDE_API_BASE_URL: studyGuideBase ?? 'http://localhost:54321/functions/v1/study-guide-proxy',
      EDGE_FUNCTIONS_BASE_URL: edgeBase ?? 'http://localhost:54321/functions/v1',
      APP_ENV: appEnv as AppEnv['APP_ENV'],
      FF_PROVA_RACE_FIX: false,
      FF_CALENDAR_V2: false,
    };
  }

  return parsed.data;
}

export const env: AppEnv = buildEnv();
