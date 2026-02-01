import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SimuladoToNotify {
  id: string;
  nome: string;
  liberacao_desempenho: 'agendado' | 'ao_encerrar';
  data_liberacao_desempenho: string | null;
  status: string;
  data_encerramento: string | null;
}

interface UserToNotify {
  user_id: string;
  email: string;
  nome: string;
  simulado_nome: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    console.log(`[notify-performance-released] Running at ${now.toISOString()}`);

    // Find simulados where performance should be released
    // 1. Agendado: data_liberacao_desempenho <= now AND notifications not sent
    // 2. Ao Encerrar: status = 'encerrado' OR data_encerramento <= now AND notifications not sent

    const { data: simulados, error: simuladosError } = await supabase
      .from('simulados_admin')
      .select('id, nome, liberacao_desempenho, data_liberacao_desempenho, status, data_encerramento')
      .in('liberacao_desempenho', ['agendado', 'ao_encerrar']);

    if (simuladosError) {
      throw simuladosError;
    }

    const simuladosToNotify: SimuladoToNotify[] = (simulados || []).filter((s: any) => {
      if (s.liberacao_desempenho === 'agendado') {
        return s.data_liberacao_desempenho && new Date(s.data_liberacao_desempenho) <= now;
      }
      if (s.liberacao_desempenho === 'ao_encerrar') {
        return s.status === 'encerrado' || 
          (s.data_encerramento && new Date(s.data_encerramento) <= now);
      }
      return false;
    });

    console.log(`[notify-performance-released] Found ${simuladosToNotify.length} simulados eligible for notification`);

    if (simuladosToNotify.length === 0) {
      return new Response(
        JSON.stringify({ message: "No simulados to notify", notified: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check which users completed these simulados and haven't been notified
    // We'll use a simple approach: check simulados_finalizados for users who completed
    // and compare against a tracking table (we'll create one or use metadata)

    const usersToNotify: UserToNotify[] = [];

    for (const simulado of simuladosToNotify) {
      // Get users who finalized this simulado
      const { data: finalizados, error: finalizadosError } = await supabase
        .from('simulados_finalizados')
        .select('user_id')
        .eq('simulado_id', simulado.id);

      if (finalizadosError) {
        console.error(`Error fetching finalizados for ${simulado.id}:`, finalizadosError);
        continue;
      }

      if (!finalizados || finalizados.length === 0) {
        continue;
      }

      // Get user details for each finalized user
      const userIds = finalizados.map((f: any) => f.user_id);
      
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, email, nome')
        .in('id', userIds);

      if (usersError) {
        console.error(`Error fetching users:`, usersError);
        continue;
      }

      for (const user of users || []) {
        usersToNotify.push({
          user_id: user.id,
          email: user.email,
          nome: user.nome,
          simulado_nome: simulado.nome
        });
      }
    }

    console.log(`[notify-performance-released] ${usersToNotify.length} users to notify`);

    // Send emails if Resend is configured
    let emailsSent = 0;
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);

      for (const user of usersToNotify) {
        try {
          await resend.emails.send({
            from: "SanarFlix Academy <onboarding@resend.dev>",
            to: [user.email],
            subject: `📊 Desempenho Liberado: ${user.simulado_nome}`,
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
              </head>
              <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 40px 20px;">
                      <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                        <!-- Header -->
                        <tr>
                          <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px 30px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">
                              📊 Desempenho Liberado!
                            </h1>
                          </td>
                        </tr>
                        <!-- Content -->
                        <tr>
                          <td style="padding: 40px 30px;">
                            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                              Olá, <strong>${user.nome}</strong>!
                            </p>
                            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                              O desempenho do simulado <strong>"${user.simulado_nome}"</strong> já está disponível para consulta.
                            </p>
                            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                              Acesse a plataforma para ver seus resultados detalhados, incluindo:
                            </p>
                            <ul style="color: #374151; font-size: 16px; line-height: 1.8; margin: 0 0 30px; padding-left: 20px;">
                              <li>Taxa de acerto geral</li>
                              <li>Desempenho por área</li>
                              <li>Análise por especialidade</li>
                              <li>Comparativo com outros alunos</li>
                            </ul>
                            <!-- CTA Button -->
                            <table role="presentation" style="width: 100%;">
                              <tr>
                                <td style="text-align: center;">
                                  <a href="https://sanarflix-study-guide.lovable.app/simulados?aba=desempenho" 
                                     style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                                    Ver Meu Desempenho
                                  </a>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <!-- Footer -->
                        <tr>
                          <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="color: #6b7280; font-size: 14px; margin: 0;">
                              SanarFlix Academy - Seu parceiro na jornada médica
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </body>
              </html>
            `,
          });
          emailsSent++;
          console.log(`[notify-performance-released] Email sent to ${user.email}`);
        } catch (emailError) {
          console.error(`[notify-performance-released] Failed to send email to ${user.email}:`, emailError);
        }
      }
    } else {
      console.log("[notify-performance-released] RESEND_API_KEY not configured, skipping email notifications");
    }

    return new Response(
      JSON.stringify({ 
        message: "Notifications processed", 
        simuladosProcessed: simuladosToNotify.length,
        usersToNotify: usersToNotify.length,
        emailsSent
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("[notify-performance-released] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
