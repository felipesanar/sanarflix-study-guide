// Helpers de validação de input com Zod.
// Nunca expor `.message` de erro do banco/Zod cru ao cliente: pode vazar
// schema, constraints, nomes de tabelas. Use safeParseBody + parseError.

import { z, ZodError, ZodSchema } from 'https://esm.sh/zod@3.23.8';

export { z };

export interface ParseResult<T> {
  success: boolean;
  data?: T;
  error?: { code: 'invalid_body'; issues: Array<{ path: string; message: string }> };
}

export async function safeParseBody<T>(
  req: Request,
  schema: ZodSchema<T>
): Promise<ParseResult<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { success: false, error: { code: 'invalid_body', issues: [{ path: '(root)', message: 'JSON inválido' }] } };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      error: {
        code: 'invalid_body',
        issues: formatZodIssues(result.error),
      },
    };
  }
  return { success: true, data: result.data };
}

export function formatZodIssues(err: ZodError): Array<{ path: string; message: string }> {
  return err.issues.map((i) => ({
    path: i.path.join('.') || '(root)',
    message: i.message,
  }));
}

/**
 * Sanitiza um erro do Supabase/Postgres para resposta ao cliente.
 * Retorna a mensagem genérica e loga o detalhe server-side.
 */
export function sanitizeDbError(
  fnName: string,
  err: { message?: string; code?: string; details?: string } | null | undefined,
  publicMessage = 'Operação falhou. Tente novamente.'
): { error: string; code: string } {
  if (err) {
    console.error(`[${fnName}] DB error`, {
      code: err.code,
      message: err.message,
      details: err.details,
    });
  }
  return { error: publicMessage, code: 'db_error' };
}
