import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar conexão com o banco
    const { data: dbCheck, error: dbError } = await supabase
      .from('ies')
      .select('id')
      .limit(1);

    const dbStatus = dbError ? 'unhealthy' : 'healthy';

    // Verificar autenticação
    const authStatus = 'healthy'; // Auth está implícito se chegou aqui

    // Métricas básicas
    const now = new Date().toISOString();
    const uptime = Deno.uptime?.() || 0;

    const healthReport = {
      status: dbError ? 'degraded' : 'healthy',
      timestamp: now,
      uptime_seconds: uptime,
      services: {
        database: {
          status: dbStatus,
          message: dbError ? dbError.message : 'Connected',
        },
        auth: {
          status: authStatus,
          message: 'Service available',
        },
        edge_functions: {
          status: 'healthy',
          message: 'Running',
        },
      },
      version: '1.0.0',
      environment: Deno.env.get('ENVIRONMENT') || 'production',
    };

    return new Response(JSON.stringify(healthReport), {
      status: dbError ? 503 : 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: message,
      }),
      {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
