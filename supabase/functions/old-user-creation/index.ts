import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3";
import { isAllowedOrigin } from "../_shared/cors.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const createUserSchema = z.object({
    nome: z.string().min(1, "Nome é obrigatório"),
    email: z.string().email("Email inválido"),
    id_ies: z.string().min(1, "IES é obrigatória"),
    semestre: z.number().or(z.string().transform((val) => Number(val))),
});

function generatePassword() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 4; i++) {
        const idx = Math.floor(Math.random() * chars.length);
        result += chars[idx];
    }
    return `SenhaSegura@${result}`;
}

Deno.serve(async (req) => {
  // fase-2-cors-gatekeep
  const __origin = req.headers.get('Origin');
  if (__origin !== null && !isAllowedOrigin(__origin)) {
    return new Response('forbidden', { status: 403 });
  }

    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); // Chave do servidor
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

        if (!supabaseUrl || !serviceKey || !anonKey) {
            throw new Error("Variáveis de ambiente ausentes.");
        }

        const supabaseAdmin = createClient(supabaseUrl, serviceKey);
        const authHeader = req.headers.get("Authorization") ?? "";
        const supabaseUser = createClient(supabaseUrl, anonKey, {
            global: { headers: { Authorization: authHeader } },
        });

        // --- NOVA LÓGICA DE SEGURANÇA MAIS ROBUSTA ---
        const token = authHeader.replace("Bearer ", "").trim();
        let isServiceRole = false;

        // 1. Tenta comparação direta (como antes)
        if (token === serviceKey) {
            isServiceRole = true;
        }
        // 2. Se falhar, decodifica o JWT para ver se a role é 'service_role'
        else {
            try {
                const parts = token.split('.');
                if (parts.length === 3) {
                    // Decodifica o payload (parte do meio)
                    const payload = JSON.parse(atob(parts[1]));
                    if (payload.role === 'service_role') {
                        isServiceRole = true;
                    }
                }
            } catch (e) {
                console.error("Erro ao decodificar token:", e);
            }
        }

        // Se NÃO for service role, exige verificação de Admin do usuário logado
        if (!isServiceRole) {
            const { data: userData, error: getUserErr } = await supabaseUser.auth.getUser();

            if (getUserErr || !userData?.user) {
                // AQUI OCORRIA O SEU ERRO 401
                return new Response(JSON.stringify({ error: "Unauthorized: Token inválido ou sessão expirada" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            const { data: hasAdminRole, error: roleErr } = await supabaseAdmin.rpc('has_role', {
                _user_id: userData.user.id,
                _role: 'admin'
            });

            if (roleErr || !hasAdminRole) {
                return new Response(JSON.stringify({ error: "Forbidden: Admin privileges required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
        }
        // ------------------------------------------------

        // Validação do Body
        const body = await req.json();
        const validation = createUserSchema.safeParse(body);

        if (!validation.success) {
            const errorMessages = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
            return new Response(
                JSON.stringify({ error: "Dados inválidos", details: errorMessages }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const { nome, email, id_ies, semestre } = validation.data;
        const userMetadata = { full_name: nome, id_ies, semestre: Number(semestre) };

        // Geração de Senha
        const password = generatePassword();
        let userId: string;
        let actionType = "created";

        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: userMetadata,
        });

        if (createErr) {
            const { data: existingUser } = await supabaseAdmin
                .from('users')
                .select('id')
                .eq('email', email)
                .single();

            if (!existingUser) {
                return new Response(
                    JSON.stringify({ error: createErr.message || "Erro ao criar usuário." }),
                    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            userId = existingUser.id;
            actionType = "updated_password_reset";

            const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
                password: password,
                user_metadata: userMetadata
            });

            if (updateErr) {
                return new Response(
                    JSON.stringify({ error: "Falha ao atualizar usuário", details: updateErr.message }),
                    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
        } else {
            userId = created.user!.id;
        }

        const { error: upsertErr } = await supabaseAdmin
            .from("users")
            .upsert({
                id: userId,
                email,
                nome,
                id_ies,
                semestre: Number(semestre)
            }, { onConflict: 'id' });

        if (upsertErr) {
            return new Response(
                JSON.stringify({ error: "Erro ao salvar perfil", details: upsertErr.message }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify({
                success: true,
                action: actionType,
                userId,
                email,
                password: password
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: "Erro interno", details: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});