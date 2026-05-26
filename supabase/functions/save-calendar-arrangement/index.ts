import { buildCorsHeaders } from '../_shared/cors.ts';
import { createAdminClient, extractToken, getAuthenticatedUser } from '../_shared/auth.ts';
import { safeParseBody, sanitizeDbError, z } from '../_shared/validate.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import {
  jsonResponse,
  badRequest,
  unauthorized,
  forbidden,
  tooManyRequests,
  internalError,
} from '../_shared/response.ts';

const FN_NAME = 'save-calendar-arrangement';

const arrangementSchema = z.object({
  item_key: z.string().min(1).max(200),
  week: z.string().min(1).max(20),
  day: z.string().min(1).max(20),
  position: z.number().int().nonnegative().optional(),
});

const bodySchema = z.object({
  arrangements: z.array(arrangementSchema).max(500),
});

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const cors = buildCorsHeaders(origin);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    if (!cors) return forbidden('origin not allowed', null);
    return new Response(null, { headers: cors });
  }

  if (!cors) return forbidden('origin not allowed', null);

  try {
    // Rate limit: 30 reqs/min por IP (operação não pesada mas evitamos abuso)
    const rl = await checkRateLimit(req, { key: FN_NAME, limitPerMin: 30 });
    if (!rl.allowed) return tooManyRequests('rate limit exceeded', cors);

    const admin = createAdminClient();

    // Autenticação autoritativa via JWT
    const token = extractToken(req);
    const user = await getAuthenticatedUser(admin, token);
    if (!user) return unauthorized('invalid or missing token', cors);

    // Validação de schema + tamanho do array (anti-DoS)
    const parsed = await safeParseBody(req, bodySchema);
    if (!parsed.success || !parsed.data) {
      return badRequest(parsed.error?.issues?.[0]?.message ?? 'invalid body', cors);
    }
    const { arrangements } = parsed.data;

    // Limpa arranjos anteriores do usuário
    const { error: deleteError } = await admin
      .from('calendar_arrangements')
      .delete()
      .eq('user_id', user.id);

    if (deleteError) {
      sanitizeDbError(FN_NAME, deleteError);
      return internalError(cors);
    }

    // Insere novos arranjos
    if (arrangements.length > 0) {
      const rows = arrangements.map((arr, index) => ({
        user_id: user.id,
        item_key: arr.item_key,
        week: arr.week,
        day: arr.day,
        position: arr.position !== undefined ? arr.position : index,
      }));

      const { error: insertError } = await admin
        .from('calendar_arrangements')
        .insert(rows);

      if (insertError) {
        sanitizeDbError(FN_NAME, insertError);
        return internalError(cors);
      }
    }

    return jsonResponse(
      { success: true, count: arrangements.length },
      { status: 200, cors }
    );
  } catch (err) {
    console.error(`[${FN_NAME}] unexpected error`, err);
    return internalError(cors);
  }
});
