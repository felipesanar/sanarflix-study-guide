// Rate limiting baseado em Deno KV (nativo no Supabase Edge Runtime).
// Janela deslizante simples: contador por chave com TTL.
//
// Uso típico:
//   const rl = await checkRateLimit(req, { key: 'b2b-create-user', limitPerMin: 5 });
//   if (!rl.allowed) return tooManyRequests();
//
// Para fallback em ambientes sem KV (testes locais), usamos um Map em memória.

const memoryStore = new Map<string, { count: number; resetAt: number }>();

let kvInstance: Deno.Kv | null | undefined;
async function getKv(): Promise<Deno.Kv | null> {
  if (kvInstance !== undefined) return kvInstance;
  try {
    // openKv pode lançar se não habilitado no projeto.
    kvInstance = await Deno.openKv();
  } catch {
    kvInstance = null;
  }
  return kvInstance;
}

export interface RateLimitOptions {
  /** Identificador da rota/operação (ex: 'b2b-create-user'). */
  key: string;
  /** Limite por minuto por IP (default: 10). */
  limitPerMin?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number; // segundos até reset
}

function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

export async function checkRateLimit(
  req: Request,
  opts: RateLimitOptions
): Promise<RateLimitResult> {
  const limit = opts.limitPerMin ?? 10;
  const ip = getClientIp(req);
  const window = Math.floor(Date.now() / 60_000);
  const fullKey = `rl:${opts.key}:${ip}:${window}`;

  const kv = await getKv();
  if (kv) {
    const current = await kv.get<number>([fullKey]);
    const count = (current.value ?? 0) + 1;
    // TTL 65s: cobre a janela inteira + buffer.
    await kv.set([fullKey], count, { expireIn: 65_000 });
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetIn: 60 - (Math.floor(Date.now() / 1000) % 60),
    };
  }

  // Fallback em memória (não compartilha entre instâncias)
  const now = Date.now();
  const existing = memoryStore.get(fullKey);
  if (!existing || existing.resetAt < now) {
    memoryStore.set(fullKey, { count: 1, resetAt: now + 65_000 });
    return { allowed: true, remaining: limit - 1, resetIn: 60 };
  }
  existing.count += 1;
  return {
    allowed: existing.count <= limit,
    remaining: Math.max(0, limit - existing.count),
    resetIn: Math.ceil((existing.resetAt - now) / 1000),
  };
}
