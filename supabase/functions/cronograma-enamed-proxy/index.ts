import { buildCorsHeaders, isAllowedOrigin } from '../_shared/cors.ts';

const EXTERNAL_API_URL = 'https://api-enamed-b2c.onrender.com/api/cronograma';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = buildCorsHeaders(origin);
  
  // Reject requests from unauthorized origins
  if (!corsHeaders) {
    return new Response('Forbidden', { status: 403 });
  }
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Fetching cronograma data from external API...');
    
    // Fetch data from the external API
    const response = await fetch(EXTERNAL_API_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Sanarflix-Study-Guide/1.0'
      }
    });

    if (!response.ok) {
      console.error(`External API error: ${response.status} ${response.statusText}`);
      throw new Error(`External API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('API Response structure:', JSON.stringify(data, null, 2));
    console.log(`Successfully fetched ${Array.isArray(data) ? data.length : 'unknown'} items from external API`);

    // Return the data with CORS headers
    return new Response(JSON.stringify(data), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Error in cronograma-enamed-proxy:', errorMessage);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch cronograma data',
        message: errorMessage 
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});