export const env = {
  STUDY_GUIDE_API_BASE_URL: 'https://gvqvrmkizemwsasmupmo.functions.supabase.co/study-guide-proxy',
  ENAMED_API_BASE_URL: 'https://gvqvrmkizemwsasmupmo.supabase.co/functions/v1/enamed-proxy',
  CRONOGRAMA_API_URL: 'https://gvqvrmkizemwsasmupmo.supabase.co/functions/v1/cronograma-enamed-proxy',
  APP_ENV: (import.meta.env.VITE_APP_ENV ?? (import.meta.env.PROD ? 'production' : 'development')) as 'development' | 'production' | 'staging',
};

env.STUDY_GUIDE_API_BASE_URL = import.meta.env.VITE_STUDY_GUIDE_API_BASE_URL ?? env.STUDY_GUIDE_API_BASE_URL;
env.ENAMED_API_BASE_URL = import.meta.env.VITE_ENAMED_API_BASE_URL ?? env.ENAMED_API_BASE_URL;
env.CRONOGRAMA_API_URL = import.meta.env.VITE_CRONOGRAMA_API_URL ?? env.CRONOGRAMA_API_URL;
