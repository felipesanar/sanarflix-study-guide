import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { isAllowedOrigin } from "../_shared/cors.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  // fase-2-cors-gatekeep
  const __origin = req.headers.get('Origin');
  if (__origin !== null && !isAllowedOrigin(__origin)) {
    return new Response('forbidden', { status: 403 });
  }

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header first
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('get-study-contents: Missing or invalid authorization header');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Create admin client (service role can validate any JWT without session)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Validate JWT using admin client
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      console.error('get-study-contents: Auth error:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid token', details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Read optional parameters from body or query string
    let semestreFilter: string | null = null;
    let listSemestresOnly = false;
    try {
      const url = new URL(req.url);
      semestreFilter = url.searchParams.get('semestre');
      listSemestresOnly = url.searchParams.get('listSemestresOnly') === 'true';
      if (req.method === 'POST') {
        const body = await req.json().catch(() => null);
        if (body?.semestre && !semestreFilter) semestreFilter = String(body.semestre);
        if (body?.listSemestresOnly) listSemestresOnly = true;
      }
    } catch (_) { /* ignore parse errors */ }

    // ── Fast path: return only distinct semestres via RPC ──
    if (listSemestresOnly) {
      const { data: semData, error: semError } = await supabaseAdmin
        .rpc('get_distinct_semestres', { p_ies_id: userData.id_ies });

      if (semError) {
        console.error('get-study-contents: Error fetching semestres:', semError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch semestres', details: semError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const distinctSemestres = (semData || []).map((r: any) => r.semestre);
      console.log(`get-study-contents: Returning ${distinctSemestres.length} distinct semestres for IES ${userData.id_ies}`);
      return new Response(
        JSON.stringify({ semestres: distinctSemestres }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build query
    let allConteudos: any[] = [];

    if (semestreFilter) {
      // Semester-filtered query — typically < 1000 rows, no pagination needed
      // Try multiple formats: raw value, "Xº Semestre", "INTERNATO"
      const normalizedSem = semestreFilter.trim();
      const semNum = parseInt(normalizedSem);
      const possibleValues = [normalizedSem];
      if (!isNaN(semNum)) {
        possibleValues.push(`${semNum}º Semestre`, `${semNum}º semestre`, String(semNum));
      }
      if (normalizedSem.toUpperCase() === 'INTERNATO') {
        possibleValues.push('INTERNATO', 'internato', 'Internato');
      }
      // Map high numeric semesters (>=9) or 0 to also search for INTERNATO
      if (!isNaN(semNum) && (semNum >= 9 || semNum === 0)) {
        possibleValues.push('INTERNATO', 'internato', 'Internato');
      }

      // Paginated fetch for semester-filtered query
      const uniqueValues = [...new Set(possibleValues)];
      const PAGE_SIZE = 1000;
      let from = 0;
      let hasMore = true;

      // Case-insensitive matching to tolerate stored variants like "2º SEMESTRE", "2º semestre", "2º Semestre"
      const orFilter = uniqueValues
        .map(v => `semestre.ilike.${v.replace(/,/g, '\\,')}`)
        .join(',');

      while (hasMore) {
        const { data, error: queryError } = await supabaseAdmin
          .from('conteudos')
          .select('id, id_ies, semestre, materia, tema, subtema, aula, link_aula, link_pdf, link_quiz')
          .eq('id_ies', userData.id_ies)
          .or(orFilter)
          .range(from, from + PAGE_SIZE - 1);

        if (queryError) {
          console.error('get-study-contents: Error fetching filtered conteudos:', queryError);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch conteudos', details: queryError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (data && data.length > 0) {
          allConteudos = allConteudos.concat(data);
          from += PAGE_SIZE;
          hasMore = data.length === PAGE_SIZE;
        } else {
          hasMore = false;
        }
      }
      console.log(`get-study-contents: Fetched ${allConteudos.length} records for IES ${userData.id_ies}, semestre filter: ${normalizedSem}`);
    } else {
      // No filter — fetch ALL using pagination (backwards compatible)
      const PAGE_SIZE = 1000;
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error: pageError } = await supabaseAdmin
          .from('conteudos')
          .select('id, id_ies, semestre, materia, tema, subtema, aula, link_aula, link_pdf, link_quiz')
          .eq('id_ies', userData.id_ies)
          .range(from, from + PAGE_SIZE - 1);

        if (pageError) {
          console.error('get-study-contents: Error fetching conteudos page:', pageError);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch conteudos', details: pageError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (data && data.length > 0) {
          allConteudos = allConteudos.concat(data);
          from += PAGE_SIZE;
          hasMore = data.length === PAGE_SIZE;
        } else {
          hasMore = false;
        }
      }
      console.log(`get-study-contents: Fetched ${allConteudos.length} total records for IES ${userData.id_ies} (no filter)`);
    }

    return new Response(
      JSON.stringify({ data: allConteudos }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('get-study-contents: Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
