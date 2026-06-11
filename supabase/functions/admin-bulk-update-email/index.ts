// Edge Function: admin-bulk-update-email
// Permite que admins atualizem em lote o email de alunos.
//
// Garantias de segurança (ver .lovable/plan.md):
//  - Allowlist de Origin
//  - Rate limit 5/min/IP
//  - JWT obrigatório + role 'admin' verificada via has_role()
//  - Bloqueia roles protegidas (admin/gestor/gestor_grupo/professor/atendimento)
//  - Bloqueia self-update
//  - Pré-check de colisão em public.users
//  - Atualiza auth.users (fonte de verdade) antes de public.users
//  - Invalida sessões ativas com auth.admin.signOut(id, 'global')
//  - Notifica o novo email via Novu (sem clique obrigatório)
//  - Registra cada operação em admin_audit_log
//  - Cap de 50 linhas por invocação

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { isAllowedOrigin } from "../_shared/cors.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import { maskEmail } from "../_shared/auth.ts";
import { triggerNovuEvent } from "../_shared/novu.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_ROWS_PER_INVOCATION = 50;
const PROTECTED_ROLES = new Set([
  "admin",
  "gestor",
  "gestor_grupo",
  "professor",
  "atendimento",
]);

const rowSchema = z.object({
  email_antigo: z.string().trim().toLowerCase().email().max(255),
  email_novo: z.string().trim().toLowerCase().email().max(255),
});
const bodySchema = z.object({
  rows: z.array(rowSchema).min(1).max(MAX_ROWS_PER_INVOCATION),
});

type RowResult = {
  email_antigo: string;
  email_novo: string;
  status: "updated" | "failed";
  reason?: string;
  user_id?: string;
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildNotificationHtml(emailAntigo: string, emailNovo: string): string {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"/><title>Atualização de email</title></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#111;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(180deg,#ffffff 0%,#fde8e8 100%);padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #f1f1f1;border-radius:14px;box-shadow:0 10px 32px rgba(0,0,0,0.08);">
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 16px 0;font-size:22px;color:#111;">Seu email de acesso foi atualizado</h1>
          <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#444;">
            Olá! Um administrador da sua instituição atualizou o email vinculado à sua conta no <strong>SanarFlix Academy</strong>.
          </p>
          <p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;color:#444;">
            <strong>Email anterior:</strong> ${emailAntigo}<br/>
            <strong>Novo email de acesso:</strong> ${emailNovo}
          </p>
          <p style="margin:16px 0 16px 0;font-size:15px;line-height:1.6;color:#444;">
            A partir de agora, use o <strong>novo email</strong> para fazer login. Por segurança, suas sessões ativas foram encerradas — você precisará entrar novamente.
          </p>
          <p style="margin:24px 0 8px 0;font-size:13px;line-height:1.5;color:#888;">
            Não reconhece esta mudança? Acesse <a href="https://academy.sanar.com.br/reset-password" style="color:#dc2626;">recuperação de senha</a> ou entre em contato com o suporte da sua IES imediatamente.
          </p>
          <p style="margin:24px 0 0 0;font-size:12px;color:#aaa;">© 2025 SanarFlix. Todos os direitos reservados.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function notifyUser(
  userId: string,
  nome: string,
  emailAntigo: string,
  emailNovo: string,
) {
  const nameParts = (nome || "").trim().split(/\s+/);
  const firstName = nameParts[0] || "Aluno";
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
  const html = buildNotificationHtml(emailAntigo, emailNovo);
  const result = await triggerNovuEvent({
    name: "workflow-email",
    payload: {
      name: nome || "Aluno",
      email: emailNovo,
      emailAntigo,
      emailNovo,
    },
    to: [{ subscriberId: userId, firstName, lastName, email: emailNovo }],
    disableTracking: true,
    overrides: {
      email: {
        from: "<atendimento@sanar.com.br>",
        replyTo: "atendimento@sanar.com.br",
        subject: "Seu email de acesso ao SanarFlix Academy foi atualizado",
        html,
      },
    },
  });
  if (!result.ok) {
    console.log(
      "[admin-bulk-update-email] Novu notification failed for",
      maskEmail(emailNovo),
      ":",
      result.error,
    );
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (origin !== null && !isAllowedOrigin(origin)) {
    return new Response("forbidden", { status: 403 });
  }
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limit destrutivo: 5/min/IP
  const rl = await checkRateLimit(req, {
    key: "admin-bulk-update-email",
    limitPerMin: 5,
  });
  if (!rl.allowed) {
    return jsonResponse(429, { success: false, error: "rate_limited" });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceKey || !anonKey) {
      return jsonResponse(500, { success: false, error: "server_misconfigured" });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      console.log("[admin-bulk-update-email] unauthorized: missing bearer token");
      return jsonResponse(401, { success: false, error: "unauthorized" });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const supabaseCaller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });

    const { data: { user: caller }, error: authErr } =
      await supabaseCaller.auth.getUser();
    if (authErr || !caller) {
      return jsonResponse(401, { success: false, error: "unauthorized" });
    }

    // Apenas admin. Esta função é destrutiva e bypassa o trigger
    // validate_user_update via service_role — restringir a admin é crítico.
    const { data: isAdmin, error: roleErr } = await supabaseAdmin.rpc("has_role", {
      _user_id: caller.id,
      _role: "admin",
    });
    if (roleErr || !isAdmin) {
      return jsonResponse(403, { success: false, error: "forbidden" });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { success: false, error: "invalid_json" });
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(400, {
        success: false,
        error: "validation_error",
        details: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
    }
    const rows = parsed.data.rows;

    // Dedupe + cadeia: rejeita lote inteiro em colisões internas para evitar
    // ordens não-determinísticas (A→B, B→C).
    const oldEmails = new Set<string>();
    const newEmails = new Set<string>();
    for (const r of rows) {
      if (r.email_antigo === r.email_novo) {
        return jsonResponse(400, {
          success: false,
          error: "validation_error",
          details: `email_antigo e email_novo iguais: ${r.email_antigo}`,
        });
      }
      if (oldEmails.has(r.email_antigo)) {
        return jsonResponse(400, {
          success: false,
          error: "validation_error",
          details: `email_antigo duplicado no lote: ${r.email_antigo}`,
        });
      }
      if (newEmails.has(r.email_novo)) {
        return jsonResponse(400, {
          success: false,
          error: "validation_error",
          details: `email_novo duplicado no lote: ${r.email_novo}`,
        });
      }
      oldEmails.add(r.email_antigo);
      newEmails.add(r.email_novo);
    }
    for (const r of rows) {
      if (oldEmails.has(r.email_novo)) {
        return jsonResponse(400, {
          success: false,
          error: "validation_error",
          details:
            `cadeia detectada: ${r.email_novo} aparece como email_antigo em outra linha`,
        });
      }
    }

    console.log(
      `[admin-bulk-update-email] admin=${maskEmail(caller.email ?? "")} processing ${rows.length} rows`,
    );

    const results: RowResult[] = [];

    for (const row of rows) {
      const { email_antigo, email_novo } = row;
      try {
        // 1) Lookup target user by email_antigo
        const { data: target, error: lookupErr } = await supabaseAdmin
          .from("users")
          .select("id, nome, email")
          .eq("email", email_antigo)
          .maybeSingle();
        if (lookupErr) {
          results.push({ email_antigo, email_novo, status: "failed", reason: "lookup_error" });
          continue;
        }
        if (!target) {
          results.push({ email_antigo, email_novo, status: "failed", reason: "user_not_found" });
          continue;
        }

        // 2) Bloqueia self-update
        if (target.id === caller.id) {
          results.push({ email_antigo, email_novo, status: "failed", reason: "cannot_update_self", user_id: target.id });
          continue;
        }

        // 3) Bloqueia roles protegidas
        const { data: roles, error: rolesErr } = await supabaseAdmin.rpc(
          "get_user_roles",
          { _user_id: target.id },
        );
        if (rolesErr) {
          results.push({ email_antigo, email_novo, status: "failed", reason: "role_check_error", user_id: target.id });
          continue;
        }
        const rolesList: string[] = Array.isArray(roles) ? roles as string[] : [];
        if (rolesList.some((r) => PROTECTED_ROLES.has(r))) {
          results.push({
            email_antigo,
            email_novo,
            status: "failed",
            reason: "protected_role",
            user_id: target.id,
          });
          continue;
        }

        // 4) Pré-check colisão em public.users
        const { data: collidePublic } = await supabaseAdmin
          .from("users")
          .select("id")
          .eq("email", email_novo)
          .maybeSingle();
        if (collidePublic && collidePublic.id !== target.id) {
          results.push({ email_antigo, email_novo, status: "failed", reason: "email_already_in_use", user_id: target.id });
          continue;
        }

        // 5) Atualiza auth.users (fonte de verdade). email_confirm: true
        // mantém o status confirmado para não exigir double opt-in.
        const { error: authUpdErr } = await supabaseAdmin.auth.admin.updateUserById(
          target.id,
          { email: email_novo, email_confirm: true },
        );
        if (authUpdErr) {
          const msg = (authUpdErr.message || "").toLowerCase();
          const reason = msg.includes("already") || msg.includes("registered") || msg.includes("duplicate")
            ? "email_already_in_use"
            : "auth_update_failed";
          results.push({ email_antigo, email_novo, status: "failed", reason, user_id: target.id });
          continue;
        }

        // 6) Atualiza public.users (passa pelo trigger via service_role)
        const { error: pubUpdErr } = await supabaseAdmin
          .from("users")
          .update({ email: email_novo })
          .eq("id", target.id);
        if (pubUpdErr) {
          // Tenta rollback em auth para manter consistência
          await supabaseAdmin.auth.admin.updateUserById(target.id, {
            email: email_antigo,
            email_confirm: true,
          }).catch(() => {});
          results.push({ email_antigo, email_novo, status: "failed", reason: "public_update_failed", user_id: target.id });
          continue;
        }

        // 7) Invalida todas as sessões (best-effort)
        await supabaseAdmin.auth.admin.signOut(target.id, "global").catch((e) => {
          console.warn(`[admin-bulk-update-email] signOut warn for ${target.id}:`, e?.message);
        });

        // 8) Audit log
        await supabaseAdmin.from("admin_audit_log").insert({
          admin_id: caller.id,
          action: "bulk_update_email",
          target_user_id: target.id,
          metadata: {
            email_antigo,
            email_novo,
            ip: req.headers.get("x-forwarded-for") ?? null,
            user_agent: req.headers.get("user-agent") ?? null,
          },
        }).then(({ error }) => {
          if (error) console.warn("[admin-bulk-update-email] audit insert warn:", error.message);
        });

        // 9) Notifica o novo email (fire-and-forget)
        notifyUser(target.id, target.nome ?? "", email_antigo, email_novo).catch((e) => {
          console.warn("[admin-bulk-update-email] notify warn:", e?.message);
        });

        results.push({ email_antigo, email_novo, status: "updated", user_id: target.id });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "unknown";
        console.error(`[admin-bulk-update-email] row error for ${maskEmail(email_antigo)}:`, msg);
        results.push({ email_antigo, email_novo, status: "failed", reason: "internal_error" });
      }
    }

    const summary = {
      total: results.length,
      updated: results.filter((r) => r.status === "updated").length,
      failed: results.filter((r) => r.status === "failed").length,
    };
    console.log(
      `[admin-bulk-update-email] done admin=${maskEmail(caller.email ?? "")} updated=${summary.updated} failed=${summary.failed}`,
    );

    return jsonResponse(200, { success: true, results, summary });
  } catch (err) {
    console.error("[admin-bulk-update-email] unexpected:", err);
    return jsonResponse(500, { success: false, error: "internal_error" });
  }
});
