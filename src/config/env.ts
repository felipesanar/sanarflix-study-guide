export const env = {
  STUDY_GUIDE_API_BASE_URL: 'https://gvqvrmkizemwsasmupmo.functions.supabase.co/study-guide-proxy',
  APP_ENV: (import.meta.env.VITE_APP_ENV ?? (import.meta.env.PROD ? 'production' : 'development')) as 'development' | 'production' | 'staging',
};

env.STUDY_GUIDE_API_BASE_URL = import.meta.env.VITE_STUDY_GUIDE_API_BASE_URL ?? env.STUDY_GUIDE_API_BASE_URL;
