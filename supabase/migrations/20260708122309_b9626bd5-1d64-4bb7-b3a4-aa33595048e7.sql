-- ============================================================
-- 20260708120000_announcements_prioridade_normalize.sql
-- ============================================================
BEGIN;

ALTER TABLE public.announcements
  DROP CONSTRAINT IF EXISTS announcements_prioridade_check;

DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT DISTINCT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN pg_attribute att
      ON att.attrelid = rel.oid
     AND att.attnum = ANY (con.conkey)
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'announcements'
      AND con.contype = 'c'
      AND att.attname = 'prioridade'
  LOOP
    EXECUTE format('ALTER TABLE public.announcements DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

UPDATE public.announcements SET prioridade = 'critica' WHERE prioridade = 'Muito Alta';
UPDATE public.announcements SET prioridade = 'alta'    WHERE prioridade = 'Alta';
UPDATE public.announcements SET prioridade = 'media'   WHERE prioridade IN ('Media', 'Média');
UPDATE public.announcements SET prioridade = 'baixa'   WHERE prioridade = 'Baixa';

UPDATE public.announcements
SET prioridade = 'media'
WHERE prioridade NOT IN ('baixa', 'media', 'alta', 'critica');

ALTER TABLE public.announcements
  ADD CONSTRAINT announcements_prioridade_check
  CHECK (prioridade IN ('baixa', 'media', 'alta', 'critica'));

COMMIT;

-- ============================================================
-- 20260708121000_feedback_storage_atendimento_e_indices.sql
-- ============================================================
DROP POLICY IF EXISTS "Atendimento read feedback screenshots" ON storage.objects;
CREATE POLICY "Atendimento read feedback screenshots" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'feedback-screenshots'
    AND public.has_role(auth.uid(), 'atendimento'::app_role)
  );

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at
  ON public.admin_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action_created_at
  ON public.admin_audit_log (action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_simulados_finalizados_finalizado_em
  ON public.simulados_finalizados (finalizado_em);

CREATE INDEX IF NOT EXISTS idx_answer_progress_question_id
  ON public.answer_progress (question_id);

-- ============================================================
-- 20260708122000_admin_command_center_v2.sql
-- ============================================================
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