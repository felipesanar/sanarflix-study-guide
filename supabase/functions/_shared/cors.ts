// Secure CORS configuration with origin validation
const ALLOWED_ORIGINS = new Set([
  'https://gvqvrmkizemwsasmupmo.supabase.co',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080',
]);

export const isAllowedOrigin = (origin?: string): boolean => {
  if (!origin) return false;
  return ALLOWED_ORIGINS.has(origin) || origin.endsWith('.app.github.dev');
};

export const buildCorsHeaders = (origin?: string): Record<string, string> | null => {
  if (!isAllowedOrigin(origin)) return null;
  
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };
};

// Legacy export for backward compatibility - use buildCorsHeaders instead
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};