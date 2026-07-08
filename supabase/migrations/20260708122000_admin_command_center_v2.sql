-- ATENÇÃO: este arquivo é SÓ a migration em disco. Este agente não tem
-- acesso ao MCP do Supabase e NÃO aplicou nada em prod — precisa ser
-- aplicado manualmente depois (Lovable/SQL editor no projeto `gvqv`, que é o
-- projeto que o app usa de fato — ver nota "Dois projetos Supabase").
--
-- Corrige 2 achados de auditoria da experiência do admin (item §7 do
-- relatório "Command Center v2"), ambos em `admin_command_center()`
-- (definição anterior: 20260707172740_5974477f-84b9-4f8e-8370-3476953fc389.sql):
--
--   1) `alunos_total` contava TODO MUNDO em `public.users`, incluindo staff
--      (admin/atendimento/gestor/gestor_grupo) — o KPI "Alunos" do Command
--      Center divergia do "Total de usuários" do Analytics (que já exclui
--      admins). Fix: exclui usuários com qualquer uma dessas roles.
--
--   2) `import_batches_falha_7d` só devolvia o array cru, já capado em
--      `LIMIT 10` dentro da própria RPC — o badge "Importações com falha"
--      da fila de atenção subcontava sempre que havia mais de 10 falhas na
--      semana (badge dizia "10" quando o real podia ser 30). Fix: devolve
--      `{ total, rows }` — `total` é a contagem REAL (sem LIMIT) e `rows`
--      continua com as 10 primeiras (para os exemplos "IES X, IES Y e mais
--      N" da fila).
--
-- Compatibilidade: o client (`src/services/admin/useAdminAttention.ts`) já
-- tem fallback retrocompatível (`normalizeImportBatchesFalha`) que entende
-- tanto o array cru antigo quanto o `{ total, rows }` novo — é seguro fazer
-- deploy do front ANTES desta migration rodar em prod.

CREATE OR REPLACE FUNCTION public.admin_command_center()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      -- P2: exclui staff (admin/atendimento/gestor/gestor_grupo) — antes
      -- contava todo mundo em public.users, divergindo do "Alunos" do
      -- Analytics (que já filtra admins via user_roles).
      'alunos_total', (
        SELECT count(*)
        FROM public.users u
        WHERE NOT EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = u.id
            AND ur.role IN ('admin', 'atendimento', 'gestor', 'gestor_grupo')
        )
      ),
      'alunos_ativos_30d', (SELECT count(DISTINCT user_id) FROM public.user_sessions WHERE started_at > now() - interval '30 days'),
      'ies_parceiras', (SELECT count(*) FROM public.ies),
      'simulados_publicados', (SELECT count(*) FROM public.simulados_admin),
      'finalizacoes_7d', (SELECT count(*) FROM public.simulados_finalizados WHERE finalizado_em > now() - interval '7 days')
    ),
    'attention', jsonb_build_object(
      'simulados_encerrando_hoje', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'data_encerramento', data_encerramento) ORDER BY data_encerramento)
        FROM public.simulados_admin
        WHERE status <> 'encerrado'
          AND data_encerramento IS NOT NULL
          AND (data_encerramento AT TIME ZONE 'America/Sao_Paulo')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date
      ), '[]'::jsonb),
      -- P2: antes era só o array capado em LIMIT 10 (badge subcontava com
      -- mais de 10 falhas/7d). Agora: total real (sem LIMIT) + rows = as 10
      -- primeiras, para os exemplos da fila.
      'import_batches_falha_7d', jsonb_build_object(
        'total', (
          SELECT count(*)
          FROM public.admin_import_batches b
          WHERE b.created_at > now() - interval '7 days'
            AND (b.failed_count > 0 OR b.status IN ('failed','error','falha','erro'))
        ),
        'rows', COALESCE((
          SELECT jsonb_agg(row_to_json(t) ORDER BY t.created_at DESC)
          FROM (
            SELECT b.id, sa.nome AS simulado_nome, b.source_label, b.failed_count, b.total_rows, b.status, b.created_at
            FROM public.admin_import_batches b
            LEFT JOIN public.simulados_admin sa ON sa.id = b.simulado_id
            WHERE b.created_at > now() - interval '7 days'
              AND (b.failed_count > 0 OR b.status IN ('failed','error','falha','erro'))
            ORDER BY b.created_at DESC
            LIMIT 10
          ) t
        ), '[]'::jsonb)
      ),
      'feedbacks_pendentes', jsonb_build_object(
        'total', (SELECT count(*) FROM public.user_feedback WHERE status='received'),
        'by_category', jsonb_build_object(
          'bug', (SELECT count(*) FROM public.user_feedback WHERE status='received' AND category='bug'),
          'suggestion', (SELECT count(*) FROM public.user_feedback WHERE status='received' AND category='suggestion'),
          'feature_request', (SELECT count(*) FROM public.user_feedback WHERE status='received' AND category='feature_request'),
          'praise', (SELECT count(*) FROM public.user_feedback WHERE status='received' AND category='praise')
        )
      ),
      'ies_sem_simulado_ativo', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', i.id, 'nome', i.nome) ORDER BY i.nome)
        FROM public.ies i
        WHERE NOT EXISTS (
          SELECT 1 FROM public.simulados_admin sa
          WHERE sa.status <> 'encerrado'
            AND (sa.data_encerramento IS NULL OR sa.data_encerramento > now())
            AND i.id = ANY(sa.ies_ids)
        )
      ), '[]'::jsonb)
    ),
    'audit_recentes', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.created_at DESC)
      FROM (
        SELECT al.id, al.created_at, al.action,
               ua.nome AS admin_nome, ut.email AS target_email, al.metadata
        FROM public.admin_audit_log al
        LEFT JOIN public.users ua ON ua.id = al.admin_id
        LEFT JOIN public.users ut ON ut.id = al.target_user_id
        WHERE al.action NOT LIKE 'view_%'
        ORDER BY al.created_at DESC
        LIMIT 10
      ) t
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_command_center() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_command_center() TO authenticated, service_role;
