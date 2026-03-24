import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Only allow S3 sanar URLs
    const allowed = url.startsWith('https://sanar-courses-platform-files.s3.');
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'URL not allowed' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const imageResponse = await fetch(url);
    if (!imageResponse.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch image' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const arrayBuffer = await imageResponse.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    
    // Convert to base64
    let binary = '';
    for (let i = 0; i < uint8.length; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    const base64 = btoa(binary);
    
    const contentType = imageResponse.headers.get('content-type') || 'image/png';
    const dataUrl = `data:${contentType};base64,${base64}`;

    return new Response(JSON.stringify({ dataUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
