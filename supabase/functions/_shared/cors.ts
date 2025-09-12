// Secure CORS configuration with origin validation
const ALLOWED_ORIGINS = new Set([
  'https://gvqvrmkizemwsasmupmo.lovable.app',
  'https://sanarflix-study-guide.lovable.app',
  'https://guiadeestudos.sanar.com.br',
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
    'Access-Control-Max-Age': '86400' // 24 hours preflight cache
  };
};

// Legacy export for backward compatibility - use buildCorsHeaders instead
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};