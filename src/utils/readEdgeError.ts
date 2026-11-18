export const ACCESS_EXPIRED_CODE = 'ACCESS_EXPIRED';
export const ACCESS_EXPIRED_MESSAGE = 'Seu período de acesso expirou. Entre em contato com sua IES.';

/** Lê { error, code } do corpo de erro de uma Edge Function (context é Response em supabase-js v2). */
export async function readEdgeError(error: unknown, data?: unknown): Promise<{ message?: string; code?: string }> {
  const pick = (o: any) => (o && typeof o === 'object' ? { message: o.error ? String(o.error) : undefined, code: o.code ? String(o.code) : undefined } : {});
  const ctx = (error as any)?.context;
  try {
    if (ctx && typeof ctx.clone === 'function') {
      const r = pick(await ctx.clone().json());
      if (r.message || r.code) return r;
    } else if (typeof ctx?.body === 'string') {
      const r = pick(JSON.parse(ctx.body));
      if (r.message || r.code) return r;
    }
  } catch { /* corpo não-JSON */ }
  return pick(data);
}
