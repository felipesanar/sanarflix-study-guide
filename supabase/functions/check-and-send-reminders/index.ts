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

    

    // Obter horário atual no fuso de Brasília
    const now = new Date();
    const brasiliaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const currentHour = brasiliaTime.getHours();
    const currentMinute = brasiliaTime.getMinutes();
    const currentTimeString = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}:00`;
    
    const dayOfWeek = brasiliaTime.getDay();
    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const today = dayNames[dayOfWeek];
    
    
    
    
    

    // Buscar lembretes habilitados configurados para o horário exato (hora:minuto)
    const { data: reminders, error: remindersError } = await supabase
      .from('study_reminders')
      .select('*')
      .eq('enabled', true)
      .eq('reminder_time', currentTimeString);

    if (remindersError) {
      console.error('Error fetching reminders:', remindersError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch reminders' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    


    if (!reminders || reminders.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: `No reminders scheduled for ${currentTimeString}`, 
          processed: 0,
          currentTime: currentTimeString,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let sentCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

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
          skippedCount++;
          continue;
        }

        

        // Enviar email se configurado
        if (reminder.notify_email) {
          const { error: emailError } = await supabase.functions.invoke('send-study-reminder', {
            body: {
              userEmail,
              userName,
              subjects: todaySubjects,
            },
          });

          if (emailError) {
            console.error(`Error sending email reminder to ${userEmail}:`, emailError);
            errorCount++;
          } else {
          }
        }

        // Enviar notificação push se configurado
        if (reminder.notify_push) {
          // TODO: Implementar envio de notificação push
        }

        sentCount++;

      } catch (error) {
        console.error(`Error processing reminder for user ${reminder.user_id}:`, error);
        errorCount++;
      }
    }

    

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Reminder check completed',
        currentTime: currentTimeString,
        currentDay: today,
        processed: reminders.length,
        sent: sentCount,
        skipped: skippedCount,
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
