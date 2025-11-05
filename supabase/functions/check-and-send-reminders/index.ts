import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting reminder check at:', new Date().toISOString());

    // Buscar todos os usuários com lembretes habilitados
    const { data: reminders, error: remindersError } = await supabase
      .from('study_reminders')
      .select('*')
      .eq('enabled', true)
      .eq('notify_email', true);

    if (remindersError) {
      console.error('Error fetching reminders:', remindersError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch reminders' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${reminders?.length || 0} active reminders`);

    if (!reminders || reminders.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active reminders found', processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obter dia da semana atual no horário de Brasília (GMT-3)
    const now = new Date();
    const brasiliaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const dayOfWeek = brasiliaTime.getDay();
    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const today = dayNames[dayOfWeek];
    
    console.log(`Current time (UTC): ${now.toISOString()}`);
    console.log(`Current time (Brasília): ${brasiliaTime.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
    console.log(`Today is: ${today}`);

    let sentCount = 0;
    let errorCount = 0;

    // Para cada usuário com lembrete ativo
    for (const reminder of reminders) {
      try {
        // Buscar informações do usuário
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(reminder.user_id);
        
        if (userError || !userData?.user) {
          console.error(`Error fetching user ${reminder.user_id}:`, userError);
          errorCount++;
          continue;
        }

        const userEmail = userData.user.email;
        const userName = userData.user.user_metadata?.nome || userData.user.user_metadata?.name || 'Estudante';

        // Buscar arranjos do calendário do usuário
        const { data: arrangements, error: arrangementsError } = await supabase
          .from('calendar_arrangements')
          .select('*')
          .eq('user_id', reminder.user_id);

        if (arrangementsError) {
          console.error(`Error fetching arrangements for user ${reminder.user_id}:`, arrangementsError);
          errorCount++;
          continue;
        }

        // Filtrar matérias de hoje
        const todaySubjects = (arrangements || [])
          .filter(arr => arr.day === today)
          .map(arr => ({
            name: arr.item_key,
            day: arr.day,
            week: arr.week,
          }));

        if (todaySubjects.length === 0) {
          console.log(`No subjects scheduled today for user ${userEmail}`);
          continue;
        }

        console.log(`Sending reminder to ${userEmail} for ${todaySubjects.length} subjects`);

        // Chamar função de envio de email
        const { error: sendError } = await supabase.functions.invoke('send-study-reminder', {
          body: {
            userEmail,
            userName,
            subjects: todaySubjects,
          },
        });

        if (sendError) {
          console.error(`Error sending reminder to ${userEmail}:`, sendError);
          errorCount++;
        } else {
          console.log(`Reminder sent successfully to ${userEmail}`);
          sentCount++;
        }

      } catch (error) {
        console.error(`Error processing reminder for user ${reminder.user_id}:`, error);
        errorCount++;
      }
    }

    console.log(`Reminder check completed. Sent: ${sentCount}, Errors: ${errorCount}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Reminder check completed',
        processed: reminders.length,
        sent: sentCount,
        errors: errorCount,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in check-and-send-reminders:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
