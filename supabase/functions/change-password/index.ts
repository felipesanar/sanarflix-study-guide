import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChangePasswordRequest {
  userId: string;
  newPassword: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, newPassword }: ChangePasswordRequest = await req.json();

    if (!userId || !newPassword) {
      return new Response(
        JSON.stringify({ success: false, error: "UserId e nova senha são obrigatórios" }),
        { 
          status: 400, 
          headers: { "Content-Type": "application/json", ...corsHeaders } 
        }
      );
    }

    if (newPassword.length < 6) {
      return new Response(
        JSON.stringify({ success: false, error: "A senha deve ter pelo menos 6 caracteres" }),
        { 
          status: 400, 
          headers: { "Content-Type": "application/json", ...corsHeaders } 
        }
      );
    }

    // Gerar hash da nova senha
    const hashedPassword = await bcrypt.hash(newPassword);

    // Atualizar senha na tabela users
    const { error } = await supabase
      .from('users')
      .update({ senha_hash: hashedPassword })
      .eq('id', userId);

    if (error) {
      console.error("Erro ao atualizar senha:", error);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao atualizar senha" }),
        { 
          status: 500, 
          headers: { "Content-Type": "application/json", ...corsHeaders } 
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Senha alterada com sucesso" }),
      { 
        status: 200, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );

  } catch (error: any) {
    console.error("Erro ao alterar senha:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno do servidor" }),
      { 
        status: 500, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );
  }
};

serve(handler);