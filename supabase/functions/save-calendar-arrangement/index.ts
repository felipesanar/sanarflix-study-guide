import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface CalendarArrangement {
  item_key: string;
  week: string;
  day: string;
  position: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      console.error('Missing Authorization header');
      return new Response(
        JSON.stringify({ error: 'Authorization header is required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Validate token and get user
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !userData?.user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = userData.user.id;

    const { arrangements } = await req.json() as { arrangements: CalendarArrangement[] };

    if (!arrangements || !Array.isArray(arrangements)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request body. Expected { arrangements: CalendarArrangement[] }' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    

    // Delete existing arrangements for this user
    const { error: deleteError } = await supabaseAdmin
      .from('calendar_arrangements')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error deleting existing arrangements:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to clear existing arrangements' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert new arrangements
    if (arrangements.length > 0) {
      const arrangementsToInsert = arrangements.map((arr, index) => ({
        user_id: userId,
        item_key: arr.item_key,
        week: arr.week,
        day: arr.day,
        position: arr.position !== undefined ? arr.position : index,
      }));

      const { error: insertError } = await supabaseAdmin
        .from('calendar_arrangements')
        .insert(arrangementsToInsert);

      if (insertError) {
        console.error('Error inserting arrangements:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to save calendar arrangements' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Calendar arrangements saved successfully',
        count: arrangements.length 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in save-calendar-arrangement:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
