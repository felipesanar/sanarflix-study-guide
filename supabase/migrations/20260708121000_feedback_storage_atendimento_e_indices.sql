-- =========================================================================
-- ATENÇÃO: esta migration é só um ARQUIVO neste momento — NÃO foi aplicada
-- via MCP/CLI do Supabase. Precisa ser aplicada manualmente em produção
-- depois (mesmo fluxo já usado para outras migrations de hardening desta
-- onda: enviar o SQL para o agente responsável aplicar).
-- =========================================================================
--
-- Achados da auditoria da Auditoria/Feedbacks (onda "experiência admin"):
--
-- 1) [P1] Atendimento nunca vê prints de feedback: as únicas policies de
--    SELECT em storage.objects para o bucket `feedback-screenshots` são
--    "own" (o próprio aluno) e "admin" — ver migrations
--    20260526034906_892f64b8-2831-4399-8a99-d1a4c02b8533.sql:78-92 e
--    20260603181804_55d993ec-c841-48d6-ae01-aa9fc4834115.sql:149. O role
--    `atendimento` responde feedbacks (RLS de UPDATE em user_feedback já
--    libera isso) mas não consegue abrir o print anexado. Corrigido abaixo
--    com uma policy no mesmo formato exato das policies de admin já
--    existentes nessas duas migrations.
--
-- 2) [P3] Índices ausentes em tabelas consultadas com frequência crescente
--    pelo console admin (trilha de auditoria, liberações de simulado,
--    progresso de questão).

-- -------------------------------------------------------------------------
-- 1) storage.objects: atendimento lê prints de feedback
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "Atendimento read feedback screenshots" ON storage.objects;
CREATE POLICY "Atendimento read feedback screenshots" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'feedback-screenshots'
    AND public.has_role(auth.uid(), 'atendimento'::app_role)
  );

-- -------------------------------------------------------------------------
-- 2) Índices ausentes
-- -------------------------------------------------------------------------

-- Trilha de auditoria: /admin/auditoria ordena por created_at desc (com e sem
-- filtro de ação) em toda consulta via admin_get_audit_log.
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at
  ON public.admin_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action_created_at
  ON public.admin_audit_log (action, created_at DESC);

-- Liberações (LiberacoesTab): lista finalizações ordenadas por finalizado_em desc.
CREATE INDEX IF NOT EXISTS idx_simulados_finalizados_finalizado_em
  ON public.simulados_finalizados (finalizado_em);

-- Taxa de erro por questão (admin_question_error_rates) filtra/agrega por question_id.
CREATE INDEX IF NOT EXISTS idx_answer_progress_question_id
  ON public.answer_progress (question_id);
