import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Validate caller identity
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminId = claimsData.claims.sub as string;

    // Service role client for data access
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Verify admin role
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: adminId,
      _role: "admin",
    });

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { userId, section } = body;

    if (!userId || !section) {
      return new Response(JSON.stringify({ error: "userId and section required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log the action
    await admin.from("admin_audit_log").insert({
      admin_id: adminId,
      action: `view_${section}`,
      target_user_id: userId,
      metadata: { section },
    });

    let result: unknown = null;

    switch (section) {
      case "profile": {
        const { data: user } = await admin
          .from("users")
          .select("id, email, nome, id_ies, semestre, semestre_updated_at, ies:id_ies(nome)")
          .eq("id", userId)
          .maybeSingle();

        const { data: roles } = await admin.rpc("get_user_roles", { _user_id: userId });

        // Check if target is admin - cannot impersonate admins
        const targetIsAdmin = (roles || []).includes("admin");

        result = { ...user, roles: roles || [], is_admin: targetIsAdmin };
        break;
      }

      case "progress": {
        const [progressRes, nodesRes, viewsRes, studyProgressRes] = await Promise.all([
          admin
            .from("user_progress")
            .select("content_id, completed_at")
            .eq("user_id", userId)
            .order("completed_at", { ascending: false })
            .limit(200),
          admin
            .from("user_progress_nodes")
            .select("node_type, node_id, source, completed_at, metadata")
            .eq("user_id", userId)
            .order("completed_at", { ascending: false })
            .limit(200),
          admin
            .from("aula_views")
            .select("conteudo_id, viewed_at")
            .eq("user_id", userId)
            .order("viewed_at", { ascending: false })
            .limit(100),
          admin
            .from("study_progress")
            .select("content_id, content_type, materia_id, semestre, completed, completed_at, ies_nome")
            .eq("user_id", userId)
            .eq("completed", true)
            .order("completed_at", { ascending: false })
            .limit(500),
        ]);

        result = {
          user_progress: progressRes.data || [],
          progress_nodes: nodesRes.data || [],
          aula_views: viewsRes.data || [],
          study_progress: studyProgressRes.data || [],
        };
        break;
      }

      case "simulados": {
        const [finalizadosRes, answersRes] = await Promise.all([
          admin
            .from("simulados_finalizados")
            .select("id, simulado_id, finalizado_em, tempo_total_segundos, tentativa_numero, saidas_de_aba, saidas_de_fullscreen, simulados_admin:simulado_id(nome)")
            .eq("user_id", userId)
            .order("finalizado_em", { ascending: false })
            .limit(50),
          admin
            .from("answer_progress")
            .select("simulado, correct, resposta_usuario, question_id")
            .eq("user_id", userId)
            .limit(1000),
        ]);

        // Aggregate scores per simulado
        const scoreMap: Record<string, { total: number; correct: number }> = {};
        (answersRes.data || []).forEach((a: { simulado: string; correct: boolean }) => {
          if (!scoreMap[a.simulado]) scoreMap[a.simulado] = { total: 0, correct: 0 };
          scoreMap[a.simulado].total++;
          if (a.correct) scoreMap[a.simulado].correct++;
        });

        result = {
          finalizados: finalizadosRes.data || [],
          scores: scoreMap,
        };
        break;
      }

      case "sessions": {
        const [sessionsRes, pageViewsRes] = await Promise.all([
          admin
            .from("user_sessions")
            .select("session_id, started_at, ended_at, duration_seconds, pages_visited, is_mobile, user_agent")
            .eq("user_id", userId)
            .order("started_at", { ascending: false })
            .limit(50),
          admin
            .from("page_views")
            .select("page_path, page_title, created_at, time_on_page_seconds")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(100),
        ]);

        result = {
          sessions: sessionsRes.data || [],
          page_views: pageViewsRes.data || [],
        };
        break;
      }

      case "activity": {
        const { data: events } = await admin
          .from("analytics_events")
          .select("event_name, event_category, event_data, page_path, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(100);

        result = { events: events || [] };
        break;
      }

      case "impersonate": {
        // Return full profile for impersonation - block if target is admin
        const { data: user } = await admin
          .from("users")
          .select("id, email, nome, id_ies, semestre, ies:id_ies(nome)")
          .eq("id", userId)
          .maybeSingle();

        const { data: roles } = await admin.rpc("get_user_roles", { _user_id: userId });
        const targetIsAdmin = (roles || []).includes("admin");

        if (targetIsAdmin) {
          return new Response(JSON.stringify({ error: "Cannot impersonate admin users" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Log impersonation specifically
        await admin.from("admin_audit_log").insert({
          admin_id: adminId,
          action: "impersonate_start",
          target_user_id: userId,
          metadata: { target_email: user?.email, target_nome: user?.nome },
        });

        const iesNome = (user as any)?.ies?.nome ?? "";
        result = {
          id: user?.id,
          email: user?.email,
          nome: user?.nome,
          id_ies: user?.id_ies ?? "",
          ies_nome: iesNome,
          semestre: user?.semestre,
          roles: roles || [],
        };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown section: ${section}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("admin-user-support error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
