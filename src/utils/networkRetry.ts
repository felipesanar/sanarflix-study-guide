import { getSupabaseClient } from '@/integrations/supabase/client';
import { Logger } from '@/utils/logger';

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff

interface RetryOptions {
  maxRetries?: number;
  retryDelays?: number[];
  shouldRetry?: (error: unknown) => boolean;
}

/**
 * Verifica se o erro é de rede/conexão
 */
function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return true;
  }
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: string }).code;
    return ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'NETWORK_ERROR'].includes(code);
  }
  return false;
}

/**
 * Verifica se o erro é recuperável (vale a pena tentar de novo)
 */
function isRecoverableError(error: unknown): boolean {
  if (isNetworkError(error)) return true;
  
  // Erros HTTP recuperáveis
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status;
    return [408, 429, 500, 502, 503, 504].includes(status);
  }
  
  return false;
}

/**
 * Aguarda um tempo antes de tentar novamente
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wrapper com retry automático para operações de API
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = MAX_RETRIES,
    retryDelays = RETRY_DELAYS,
    shouldRetry = isRecoverableError,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      const delay = retryDelays[Math.min(attempt, retryDelays.length - 1)];
      Logger.warn(`[Retry] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${delay}ms...`, error);
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * API fetch com retry automático
 */
export async function apiFetchWithRetry(
  input: string,
  init?: RequestInit,
  retryOptions?: RetryOptions
): Promise<Response> {
  const supabase = getSupabaseClient();

  return withRetry(async () => {
    const headers = new Headers(init?.headers || {});

    if (!headers.has('Accept')) headers.set('Accept', 'application/json');

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    } catch {}

    const response = await fetch(input, { ...init, headers });

    // Lançar erro para status codes que devem acionar retry
    if (!response.ok && [408, 429, 500, 502, 503, 504].includes(response.status)) {
      const error = new Error(`HTTP ${response.status}`);
      (error as Error & { status: number }).status = response.status;
      throw error;
    }

    return response;
  }, retryOptions);
}

/**
 * Verifica se o navegador está online
 */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

/**
 * Hook-friendly: espera até estar online
 */
export function waitForOnline(timeout = 30000): Promise<boolean> {
  return new Promise((resolve) => {
    if (isOnline()) {
      resolve(true);
      return;
    }

    const handleOnline = () => {
      cleanup();
      resolve(true);
    };

    const timeoutId = setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeout);

    const cleanup = () => {
      window.removeEventListener('online', handleOnline);
      clearTimeout(timeoutId);
    };

    window.addEventListener('online', handleOnline);
  });
}
