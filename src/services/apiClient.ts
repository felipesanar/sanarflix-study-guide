import { getSupabaseClient } from '@/integrations/supabase/client';

export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const supabase = getSupabaseClient();
  const headers = new Headers(init?.headers || {});

  if (!headers.has('Accept')) headers.set('Accept', 'application/json');

  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  } catch {}

  return fetch(input, { ...init, headers });
}
