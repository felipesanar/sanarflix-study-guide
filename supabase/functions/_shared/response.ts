// Respostas JSON padronizadas para Edge Functions.
// Use sempre estes helpers no lugar de `new Response(JSON.stringify(...))`.

export interface JsonResponseOptions {
  status?: number;
  cors?: Record<string, string> | null;
  extraHeaders?: Record<string, string>;
}

export function jsonResponse<T>(
  body: T,
  opts: JsonResponseOptions = {}
): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.cors ?? {}),
    ...(opts.extraHeaders ?? {}),
  };
  return new Response(JSON.stringify(body), {
    status: opts.status ?? 200,
    headers,
  });
}

export function errorResponse(
  status: number,
  code: string,
  detail?: string,
  cors?: Record<string, string> | null
): Response {
  return jsonResponse({ error: code, detail }, { status, cors });
}

// Status helpers
export const badRequest = (detail?: string, cors?: Record<string, string> | null) =>
  errorResponse(400, 'bad_request', detail, cors);
export const unauthorized = (detail?: string, cors?: Record<string, string> | null) =>
  errorResponse(401, 'unauthorized', detail, cors);
export const forbidden = (detail?: string, cors?: Record<string, string> | null) =>
  errorResponse(403, 'forbidden', detail, cors);
export const tooManyRequests = (detail?: string, cors?: Record<string, string> | null) =>
  errorResponse(429, 'rate_limited', detail, cors);
export const internalError = (cors?: Record<string, string> | null) =>
  errorResponse(500, 'internal_error', 'Ocorreu um erro inesperado.', cors);
