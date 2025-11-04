import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('get-study-contents: Request received');
    console.log('get-study-contents: Method:', req.method);
    console.log('get-study-contents: Headers:', Object.fromEntries(req.headers.entries()));

    // Create Supabase client with service role to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    console.log('get-study-contents: Auth header present:', !!authHeader);
    
    if (!authHeader) {
      console.error('get-study-contents: Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the user's JWT token
    const token = authHeader.replace('Bearer ', '');
    console.log('get-study-contents: Verifying token...');
    
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError) {
      console.error('get-study-contents: Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid token', details: authError.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!user) {
      console.error('get-study-contents: No user found');
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('get-study-contents: User authenticated:', user.id);

    // Get user's IES ID from users table
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id_ies, semestre')
      .eq('id', user.id)
      .single();

    if (userError) {
      console.error('get-study-contents: User fetch error:', userError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user data', details: userError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!userData) {
      console.error('get-study-contents: User data not found');
      return new Response(
        JSON.stringify({ error: 'User not found in database' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('get-study-contents: User IES:', userData.id_ies, 'Semester:', userData.semestre);

    // Fetch conteudos for the user's IES
    const { data: conteudos, error: conteudosError } = await supabaseAdmin
      .from('conteudos')
      .select('id, id_ies, semestre, materia, tema, subtema, aula, link_aula, link_pdf, link_quiz')
      .eq('id_ies', userData.id_ies);

    if (conteudosError) {
      console.error('get-study-contents: Error fetching conteudos:', conteudosError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch conteudos', details: conteudosError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('get-study-contents: Found', conteudos?.length || 0, 'conteudos');

    return new Response(
      JSON.stringify({ data: conteudos || [] }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('get-study-contents: Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
