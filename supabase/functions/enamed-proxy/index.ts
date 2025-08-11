// Public CORS-enabled proxy for ENAMED cronograma API
// Allows only the specified preview domain to consume it

const ALLOWED_ORIGINS = new Set<string>([
  'https://sanarflix-study-guide.lovable.app',
  'https://preview--sanarflix-study-guide.lovable.app',
  'http://localhost:5173',
]);

function buildCorsHeaders(origin?: string): Record<string, string> {
  const allowOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : '*';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };
}

Deno.serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin') || undefined;
  const corsHeaders = buildCorsHeaders(origin);
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const TARGET_BASE = 'https://api-conteudos-enamed.onrender.com/api/cronograma';

    // Preserve and forward query parameters (e.g., week, disciplina)
    const reqUrl = new URL(req.url);
    const targetUrl = new URL(TARGET_BASE);
    reqUrl.searchParams.forEach((value, key) => targetUrl.searchParams.set(key, value));

    const upstream = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });

    const bodyText = await upstream.text();
    const contentType = upstream.headers.get('content-type') ?? 'application/json';

    return new Response(bodyText, {
      status: upstream.status,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': upstream.headers.get('cache-control') ?? 'no-store'
      }
    });
  } catch (error) {
    console.error('enamed-proxy error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch ENAMED content' }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
