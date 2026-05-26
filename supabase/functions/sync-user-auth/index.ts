import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { triggerNovuEvent } from "../_shared/novu.ts";
import { buildCanonicalLink } from "../_shared/auth-links.ts";
import { maskEmail } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};



serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { email } = await req.json();
    
    if (!email) {
      return new Response(JSON.stringify({ error: 'Email é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    console.log(`[sync-user-auth] Attempting to sync user: ${maskEmail(normalizedEmail)}`);

    // 1. Check if user exists in public.users
    const { data: publicUser, error: publicUserError } = await supabaseAdmin
      .from('users')
      .select('id, nome, email, id_ies, semestre')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (publicUserError) {
      console.error('[sync-user-auth] Error fetching public user:', publicUserError);
      return new Response(JSON.stringify({ error: 'Erro ao buscar usuário' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!publicUser) {
      console.log('[sync-user-auth] User not found in public.users');
      return new Response(JSON.stringify({ error: 'Usuário não encontrado em public.users' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[sync-user-auth] Found public user (ID: ${publicUser.id})`);

    // 2. Check if user already exists in auth.users
    const { data: authUsersList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('[sync-user-auth] Error listing auth users:', listError);
      return new Response(JSON.stringify({ error: 'Erro ao verificar auth.users' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const existingAuthUser = authUsersList.users.find(
      u => u.email?.toLowerCase() === normalizedEmail
    );

    if (existingAuthUser) {
      console.log(`[sync-user-auth] User already exists in auth.users with ID: ${existingAuthUser.id}`);
      
      if (existingAuthUser.id === publicUser.id) {
        return new Response(JSON.stringify({ 
          error: 'Usuário já está sincronizado corretamente',
          already_synced: true 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`[sync-user-auth] ID mismatch. Updating public.users ID from ${publicUser.id} to ${existingAuthUser.id}`);
      
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({ id: existingAuthUser.id })
        .eq('email', normalizedEmail);

      if (updateError) {
        console.error('[sync-user-auth] Error updating public.users ID:', updateError);
        return new Response(JSON.stringify({ error: 'Erro ao atualizar ID do usuário' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ 
        success: true,
        message: 'IDs sincronizados. Usuário já possui senha configurada no auth.',
        user_id: existingAuthUser.id,
        password_reset_needed: true
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. User doesn't exist in auth.users - create it
    console.log('[sync-user-auth] Creating user in auth.users...');
    
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let tempPassword = '';
    for (let i = 0; i < 12; i++) {
      tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const { data: newAuthUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: publicUser.nome,
        id_ies: publicUser.id_ies,
        semestre: publicUser.semestre
      }
    });

    if (createError) {
      console.error('[sync-user-auth] Error creating auth user:', createError);
      return new Response(JSON.stringify({ error: `Erro ao criar usuário no auth: ${createError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[sync-user-auth] Auth user created with ID: ${newAuthUser.user.id}`);

    // 4. Update public.users with the new auth.users ID
    const { error: updateIdError } = await supabaseAdmin
      .from('users')
      .update({ id: newAuthUser.user.id })
      .eq('email', normalizedEmail);

    if (updateIdError) {
      console.error('[sync-user-auth] Error updating public.users with new ID:', updateIdError);
      await supabaseAdmin.auth.admin.deleteUser(newAuthUser.user.id);
      return new Response(JSON.stringify({ error: 'Erro ao sincronizar IDs' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 5. Generate recovery link and send welcome email via Novu
    let emailSent = false;
    try {
      const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: normalizedEmail,
        options: { redirectTo: 'https://academy.sanar.com.br/auth/update-password' }
      });
      const confirmationUrl = buildCanonicalLink({
        properties: linkData?.properties ?? {},
        redirectPath: '/auth/update-password',
      });

      const firstName = publicUser.nome.split(' ')[0];
      const novuResult = await triggerNovuEvent({
        name: 'welcome-academy-email',
        payload: { name: publicUser.nome, email: normalizedEmail, confirmationUrl },
        to: [{ subscriberId: newAuthUser.user.id, firstName, email: normalizedEmail }],
        disableTracking: true,
      });
      emailSent = novuResult.ok;
      if (!emailSent) {
        console.log('[sync-user-auth] Novu email failed:', novuResult.error);
      }
    } catch (err) {
      console.error('[sync-user-auth] Error sending welcome email:', err);
    }

    console.log('[sync-user-auth] Successfully synced user!');

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Usuário sincronizado com sucesso! Email de acesso enviado.',
      user_id: newAuthUser.user.id,
      emailSent
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[sync-user-auth] Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
