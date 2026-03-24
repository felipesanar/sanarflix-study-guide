// Public CORS-enabled proxy for Study Guide API
// Proxies requests to https://api-guias-de-estudos.onrender.com and adds proper CORS headers.
// Supports path passthrough: /study-guide-proxy/<iesName> and /study-guide-proxy/<iesName>/<semestre>

const ALLOWED_ORIGINS = new Set<string>([
  'https://gvqvrmkizemwsasmupmo.lovableproject.com',
  'https://preview--sanarflix-study-guide.lovable.app',
  'https://guiadeestudos.sanar.com.br',
  'https://academy.sanar.com.br',
  'http://localhost:5173',
]);

const isAllowedOrigin = (origin?: string): boolean => {
  if (!origin) return false;
  return ALLOWED_ORIGINS.has(origin) || origin.endsWith('.app.github.dev') || origin.endsWith('.sandbox.lovable.dev');
};

function buildCorsHeaders(origin?: string): Record<string, string> | null {
  if (origin && isAllowedOrigin(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    };
  }
  return null;
}

Deno.serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin') || undefined;
  const corsHeaders = buildCorsHeaders(origin);

  // Reject unauthorized origins
  if (!corsHeaders) {
    return new Response(
      JSON.stringify({ error: 'Origin não autorizado', origin, allowedOrigins: Array.from(ALLOWED_ORIGINS) }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const TARGET_BASE = 'https://api-guias-de-estudos.onrender.com';
    const reqUrl = new URL(req.url);

    // Compute path after the function name, preserving leading slash semantics
    // reqUrl.pathname looks like "/study-guide-proxy" or "/study-guide-proxy/Famp/4"
    const functionPrefix = '/study-guide-proxy';
    let passthroughPath = reqUrl.pathname.startsWith(functionPrefix)
      ? reqUrl.pathname.slice(functionPrefix.length)
      : '/';
    if (passthroughPath === '') passthroughPath = '/';

    const targetUrl = new URL(TARGET_BASE + passthroughPath);
    // Forward query params, if any
    reqUrl.searchParams.forEach((value, key) => targetUrl.searchParams.set(key, value));

    const upstream = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: { Accept: '*/*' },
    });

    const bodyText = await upstream.text();
    const upstreamContentType = upstream.headers.get('content-type') || 'text/html; charset=utf-8';

    // Return upstream body as-is; frontend parser handles pure JSON or HTML-wrapped JSON
    return new Response(bodyText, {
      status: upstream.status,
      headers: {
        ...corsHeaders,
        'Content-Type': upstreamContentType,
        'Cache-Control': upstream.headers.get('cache-control') ?? 'no-store',
      },
    });
  } catch (error) {
    console.error('study-guide-proxy error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch Study Guide content' }), {
      status: 502,
      headers: { ...buildCorsHeaders(origin)!, 'Content-Type': 'application/json' },
    });
  }
});