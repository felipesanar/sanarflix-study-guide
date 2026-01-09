/**
 * Utilitário centralizado para tratamento de erros
 * Padroniza o handling de erros em toda a aplicação
 */

import Logger from './logger';
import { toast } from '@/hooks/use-toast';

/**
 * Interface para erros tipados com mensagem garantida
 */
export interface ErrorWithMessage {
  message: string;
  code?: string;
  status?: number;
  details?: unknown;
}

/**
 * Type guard para verificar se um erro tem mensagem
 */
export function isErrorWithMessage(error: unknown): error is ErrorWithMessage {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as Record<string, unknown>).message === 'string'
  );
}

/**
 * Extrai mensagem de qualquer tipo de erro de forma segura
 */
export function getErrorMessage(error: unknown): string {
  if (isErrorWithMessage(error)) {
    return error.message;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  return 'Erro desconhecido';
}

/**
 * Handler padronizado para erros de API
 * Loga o erro e exibe toast apropriado
 */
export function handleApiError(
  error: unknown,
  context: string,
  options?: {
    showToast?: boolean;
    toastTitle?: string;
    fallbackMessage?: string;
  }
): string {
  const {
    showToast = true,
    toastTitle = 'Erro',
    fallbackMessage = 'Ocorreu um erro inesperado',
  } = options || {};

  const message = getErrorMessage(error) || fallbackMessage;
  
  // Log estruturado
  Logger.error(`${context}: ${message}`, error);
  
  // Toast opcional
  if (showToast) {
    toast({
      title: toastTitle,
      description: message,
      variant: 'destructive',
      duration: 4000,
    });
  }
  
  return message;
}

/**
 * Handler para erros em Edge Functions (Deno)
 * Retorna mensagem formatada para Response JSON
 */
export function getEdgeFunctionErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  if (isErrorWithMessage(error)) {
    return error.message;
  }
  
  return 'Internal server error';
}

/**
 * Cria Response de erro padronizada para Edge Functions
 */
export function createErrorResponse(
  error: unknown,
  corsHeaders: Record<string, string>,
  statusCode: number = 500
): Response {
  const message = getEdgeFunctionErrorMessage(error);
  
  return new Response(
    JSON.stringify({ error: message }),
    { 
      status: statusCode, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

/**
 * Wrapper para operações async com error handling padronizado
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: string,
  options?: {
    showToast?: boolean;
    fallbackMessage?: string;
    rethrow?: boolean;
  }
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    handleApiError(error, context, options);
    
    if (options?.rethrow) {
      throw error;
    }
    
    return null;
  }
}
