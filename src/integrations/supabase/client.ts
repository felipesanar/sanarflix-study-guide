import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { env } from '@/config/env';

const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = env.SUPABASE_ANON_KEY;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

let clientInstance: ReturnType<typeof createClient<Database>> | null = null;

export const getSupabaseClient = () => {
  if (!clientInstance) {
    clientInstance = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        storage: {
          getItem: (key) => {
            try {
              return localStorage.getItem(key);
            } catch {
              return null;
            }
          },
          setItem: (key, value) => {
            try {
              localStorage.setItem(key, value);
            } catch {
              // Silently fail in incognito/restricted storage
            }
          },
          removeItem: (key) => {
            try {
              localStorage.removeItem(key);
            } catch {
              // Silently fail
            }
          },
        },
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return clientInstance;
};

export const supabase = getSupabaseClient();
