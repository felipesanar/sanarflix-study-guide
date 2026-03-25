-- Performance indexes for institutional dashboard RPCs
-- These optimize the JOINs in get_institutional_performance, get_institutional_student_scores, and get_institutional_evolution

CREATE INDEX IF NOT EXISTS idx_answer_progress_simulado_user 
  ON public.answer_progress (simulado, user_id);

CREATE INDEX IF NOT EXISTS idx_questoes_simulado_simulado_area 
  ON public.questoes_simulado (simulado_id, grande_area);

CREATE INDEX IF NOT EXISTS idx_questoes_simulado_simulado_especialidade 
  ON public.questoes_simulado (simulado_id, especialidade);

CREATE INDEX IF NOT EXISTS idx_questoes_simulado_simulado_tema 
  ON public.questoes_simulado (simulado_id, tema);

CREATE INDEX IF NOT EXISTS idx_users_id_ies 
  ON public.users (id_ies);

CREATE INDEX IF NOT EXISTS idx_simulados_admin_status 
  ON public.simulados_admin (status) WHERE status IN ('ativo', 'encerrado');