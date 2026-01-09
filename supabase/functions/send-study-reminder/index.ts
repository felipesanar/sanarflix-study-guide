import { Resend } from 'https://esm.sh/resend@4.0.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReminderRequest {
  userEmail: string;
  userName: string;
  subjects: Array<{
    name: string;
    day: string;
    week: string;
    time?: string;
  }>;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userEmail, userName, subjects }: ReminderRequest = await req.json();

    if (!userEmail || !subjects || subjects.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar lista de matérias formatada
    const subjectsList = subjects.map(s => 
      `<li><strong>${s.name}</strong> - ${s.day} (${s.week})${s.time ? ` às ${s.time}` : ''}</li>`
    ).join('');

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; background-color: #f4f4f4; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #800000, #a00000); padding: 30px; text-align: center; color: white; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { padding: 30px; }
            .content h2 { color: #333; margin-top: 0; }
            .subjects-list { background: #f9f9f9; border-left: 4px solid #800000; padding: 15px 20px; margin: 20px 0; }
            .subjects-list ul { margin: 10px 0; padding-left: 20px; }
            .subjects-list li { margin: 8px 0; color: #555; }
            .cta-button { display: inline-block; background: #800000; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
            .footer { background: #f4f4f4; padding: 20px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📚 Lembrete de Estudos</h1>
            </div>
            <div class="content">
              <h2>Olá, ${userName || 'Estudante'}!</h2>
              <p>Este é um lembrete sobre suas matérias agendadas para hoje:</p>
              
              <div class="subjects-list">
                <strong>📖 Matérias de Hoje:</strong>
                <ul>
                  ${subjectsList}
                </ul>
              </div>
              
              <p>Não se esqueça de revisar o conteúdo e manter seus estudos em dia!</p>
              
              <p style="text-align: center;">
                <a href="${Deno.env.get('SUPABASE_URL')}" class="cta-button">
                  Acessar Guia de Estudos
                </a>
              </p>
              
              <p style="color: #666; font-size: 14px; margin-top: 30px;">
                💡 <strong>Dica:</strong> Organize seu tempo e mantenha uma rotina de estudos consistente para melhores resultados!
              </p>
            </div>
            <div class="footer">
              <p>Este é um lembrete automático do seu Guia de Estudos.</p>
              <p>Para gerenciar suas notificações, acesse as configurações do aplicativo.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    

    const { data, error } = await resend.emails.send({
      from: 'Guia de Estudos <onboarding@resend.dev>',
      to: [userEmail],
      subject: '📚 Lembrete: Matérias Agendadas para Hoje',
      html: emailHtml,
    });

    if (error) {
      console.error('Error sending email:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-study-reminder:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
