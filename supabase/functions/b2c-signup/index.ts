import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Input validation schema
const signupSchema = z.object({
  nome: z.string()
    .trim()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome muito longo')
    .regex(/^[a-zA-ZÀ-ÿ\s]+$/, 'Nome deve conter apenas letras e espaços'),
  email: z.string()
    .trim()
    .email('Email inválido')
    .max(255, 'Email muito longo'),
  password: z.string()
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .max(100, 'Senha muito longa')
    .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiúscula')
    .regex(/[a-z]/, 'Senha deve conter pelo menos uma letra minúscula')
    .regex(/[0-9]/, 'Senha deve conter pelo menos um número'),
  semestre: z.number()
    .int('Semestre deve ser um número inteiro')
    .min(1, 'Semestre mínimo: 1')
    .max(12, 'Semestre máximo: 12')
});

const generatePassword = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const body = await req.json();
    
    // Validate input with zod schema
    let validatedData;
    try {
      validatedData = signupSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
        return new Response(
          JSON.stringify({ error: 'Validation failed', details: errorMessages }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw error;
    }

    const { nome, email, password, semestre } = validatedData;

    // B2C IES ID (from the query result)
    const B2C_IES_ID = "abec7c7d-ef07-4871-9e19-090f4d951e5e";

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: {
        full_name: nome,
      },
      email_confirm: true, // Auto-confirm email for B2C users
    });

    if (authError) {
      console.error("Error creating auth user:", authError);
      
      // Check if user already exists
      if (authError.message.includes('already registered')) {
        return new Response(
          JSON.stringify({ error: "E-mail já cadastrado na plataforma" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!authData.user) {
      return new Response(
        JSON.stringify({ error: "Failed to create user" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert user profile into users table
    const { error: profileError } = await supabaseAdmin
      .from("users")
      .upsert({
        id: authData.user.id,
        email: email,
        nome: nome,
        semestre: semestre,
        id_ies: B2C_IES_ID,
      });

    if (profileError) {
      console.error("Error creating user profile:", profileError);
      
      // If profile creation fails, we should clean up the auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      
      return new Response(
        JSON.stringify({ error: "Failed to create user profile" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        message: "User created successfully",
        user: {
          id: authData.user.id,
          email: authData.user.email,
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});