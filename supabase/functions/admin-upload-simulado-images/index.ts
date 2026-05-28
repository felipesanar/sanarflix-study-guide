// Edge Function: admin-upload-simulado-images
//
// Recebe imagens em base64 (já extraídas de um XLSX no cliente), faz upload
// no bucket público `imagensSimulado` e devolve as URLs públicas para que o
// frontend persista nas colunas `imagem` e `imagem_comentario` da tabela
// `questoes_simulado`.
//
// AuthN/AuthZ: dupla validação — JWT do usuário + RBAC `admin` via has_role().
// Service role só vive aqui no servidor.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { z } from 'https://esm.sh/zod@3.23.8';
import { isAllowedOrigin } from "../_shared/cors.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ImageSchema = z.object({
  ordem: z.number().int().min(1),
  slot: z.enum(['enunciado', 'enunciado2', 'comentario']),
  data: z.string().min(1),
  mime: z.string().regex(/^image\//),
});

const BodySchema = z.object({
  simulado_id: z.string().uuid(),
  images: z.array(ImageSchema).min(1).max(1000),
});

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/webp': 'webp',
};

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function jsonResponse(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  // fase-2-cors-gatekeep
  const __origin = req.headers.get('Origin');
  if (__origin !== null && !isAllowedOrigin(__origin)) {
    return new Response('forbidden', { status: 403 });
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: 'Server misconfigured' }, 500);
  }

  // 1. AuthN — valida JWT do usuário com cliente anon
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    return jsonResponse({ error: 'Missing Authorization header' }, 401);
  }

  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userError } = await anonClient.auth.getUser();
  if (userError || !userData?.user) {
    return jsonResponse({ error: 'Invalid token' }, 401);
  }
  const userId = userData.user.id;

  // 2. AuthZ — confirma role admin via service role
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: hasRole, error: roleError } = await adminClient.rpc('has_role', {
    _user_id: userId,
    _role: 'admin',
  });
  if (roleError) {
    console.error('[admin-upload-simulado-images] has_role error:', roleError);
    return jsonResponse({ error: 'Failed to verify role' }, 500);
  }
  if (!hasRole) {
    return jsonResponse({ error: 'Forbidden — admin role required' }, 403);
  }

  // 3. Validação do body
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }
  const parsed = BodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return jsonResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
    );
  }
  const { simulado_id, images } = parsed.data;

  console.log(
    `[admin-upload-simulado-images] user=${userId} simulado=${simulado_id} count=${images.length}`,
  );

  // 4. Upload em série (poucos itens normalmente; evita explosão de concorrência)
  const urls: Array<{ ordem: number; slot: 'enunciado' | 'comentario'; url: string }> = [];
  const errors: Array<{ ordem: number; slot: string; message: string }> = [];

  for (const img of images) {
    try {
      const ext = EXT_BY_MIME[img.mime] ?? 'png';
      const path = `${simulado_id}/${img.ordem}_${img.slot}.${ext}`;
      const bytes = base64ToBytes(img.data);

      const { error: uploadError } = await adminClient.storage
        .from('imagensSimulado')
        .upload(path, bytes, {
          contentType: img.mime,
          upsert: true,
        });
      if (uploadError) throw uploadError;

      const { data: publicData } = adminClient.storage
        .from('imagensSimulado')
        .getPublicUrl(path);
      // Adiciona timestamp para invalidar cache em re-uploads
      const url = `${publicData.publicUrl}?v=${Date.now()}`;
      urls.push({ ordem: img.ordem, slot: img.slot, url });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(
        `[admin-upload-simulado-images] failed ordem=${img.ordem} slot=${img.slot}:`,
        message,
      );
      errors.push({ ordem: img.ordem, slot: img.slot, message });
    }
  }

  return jsonResponse({ urls, errors, total: images.length }, 200);
});
