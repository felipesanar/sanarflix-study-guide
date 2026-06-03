-- =========================================================================
-- Recreate public.app_role enum without the 4 deprecated values
--   removed: user, moderator, b2b_partner, gestor_formal
--   kept:    admin, professor, gestor, gestor_grupo, atendimento
-- Strategy: column -> text, drop type cascade, recreate type, column back,
-- then recreate has_role / get_user_roles and all 50 dependent policies.
-- =========================================================================

-- 1) Drop now-redundant check constraint
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_not_deprecated;

-- 2) Detach the column from the enum
ALTER TABLE public.user_roles ALTER COLUMN role TYPE text;

-- 3) Cascade-drop the enum (kills has_role, get_user_roles and 50 policies)
DROP TYPE public.app_role CASCADE;

-- 4) Create the new enum with the 5 valid values only
CREATE TYPE public.app_role AS ENUM ('admin', 'professor', 'gestor', 'gestor_grupo', 'atendimento');

-- 5) Re-attach the column to the new enum
ALTER TABLE public.user_roles ALTER COLUMN role TYPE public.app_role USING role::public.app_role;

-- 6) Recreate the two functions that took / returned app_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id uuid)
RETURNS SETOF public.app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id;
$$;

-- 7) Recreate all 50 policies (identical semantics, just rebound to the new type)

-- admin_audit_log
CREATE POLICY "Admins can view audit log" ON public.admin_audit_log AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- admin_import_batches / records
CREATE POLICY "Admins manage import batches" ON public.admin_import_batches AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage import records" ON public.admin_import_records AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- analytics_events
CREATE POLICY "Admins can view all events" ON public.analytics_events AS PERMISSIVE FOR SELECT TO public USING (has_role(auth.uid(), 'admin'::app_role));

-- announcements
CREATE POLICY "Admins can manage announcements" ON public.announcements AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- answer_progress
CREATE POLICY "Admins can update answers for nullified questions" ON public.answer_progress AS PERMISSIVE FOR UPDATE TO public USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view all answer progress" ON public.answer_progress AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Gestor de grupo pode ver respostas do grupo" ON public.answer_progress AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'gestor_grupo'::app_role) AND (EXISTS (SELECT 1 FROM users u WHERE ((u.id = answer_progress.user_id) AND (u.id_ies = ANY (get_accessible_ies(auth.uid()))))))));
CREATE POLICY "Professors can view answers from their IES" ON public.answer_progress AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'professor'::app_role) AND (EXISTS (SELECT 1 FROM users u1 WHERE ((u1.id = answer_progress.user_id) AND (u1.id_ies = (SELECT u2.id_ies FROM users u2 WHERE (u2.id = auth.uid()))))))));

-- answer_progress_historico
CREATE POLICY "Admins can view all answer history" ON public.answer_progress_historico AS PERMISSIVE FOR SELECT TO public USING (has_role(auth.uid(), 'admin'::app_role));

-- conteudos
CREATE POLICY "Admins podem ver todos os conteúdos" ON public.conteudos AS PERMISSIVE FOR SELECT TO public USING (has_role(auth.uid(), 'admin'::app_role));

-- educational_groups
CREATE POLICY "Admins manage educational_groups" ON public.educational_groups AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- error_notebook_entries
CREATE POLICY "Admins can view all entries" ON public.error_notebook_entries AS PERMISSIVE FOR SELECT TO public USING (has_role(auth.uid(), 'admin'::app_role));

-- group_ies
CREATE POLICY "Admins manage group_ies" ON public.group_ies AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ies_branding
CREATE POLICY "Admins podem editar branding" ON public.ies_branding AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ies_features
CREATE POLICY "Apenas admins podem modificar features" ON public.ies_features AS PERMISSIVE FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));

-- page_views
CREATE POLICY "Admins can view all page views" ON public.page_views AS PERMISSIVE FOR SELECT TO public USING (has_role(auth.uid(), 'admin'::app_role));

-- questoes_simulado
CREATE POLICY "Admins podem gerenciar questões" ON public.questoes_simulado AS PERMISSIVE FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Gestor de grupo pode ver questoes do grupo" ON public.questoes_simulado AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'gestor_grupo'::app_role) AND (EXISTS (SELECT 1 FROM simulados_admin sa WHERE ((sa.id = questoes_simulado.simulado_id) AND (sa.ies_ids && get_accessible_ies(auth.uid())))))));
CREATE POLICY "Professors can view questoes from their IES simulados" ON public.questoes_simulado AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'professor'::app_role) AND (EXISTS (SELECT 1 FROM simulados_admin sa WHERE ((sa.id = questoes_simulado.simulado_id) AND (get_current_user_ies_id() = ANY (sa.ies_ids)))))));

-- resultados_alunos_tri
CREATE POLICY "Admins manage resultados_alunos_tri" ON public.resultados_alunos_tri AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Gestor de grupo pode ver TRI alunos do grupo" ON public.resultados_alunos_tri AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'gestor_grupo'::app_role) AND (college_id = ANY (get_accessible_ies(auth.uid())))));
CREATE POLICY "Gestor/Professor view IES students TRI" ON public.resultados_alunos_tri AS PERMISSIVE FOR SELECT TO authenticated USING (((has_role(auth.uid(), 'gestor'::app_role) OR has_role(auth.uid(), 'professor'::app_role)) AND (college_id = get_current_user_ies_id())));

-- resultados_ies_tri
CREATE POLICY "Admins manage resultados_ies_tri" ON public.resultados_ies_tri AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Gestor de grupo pode ver resultados IES do grupo" ON public.resultados_ies_tri AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'gestor_grupo'::app_role) AND (college_id = ANY (get_accessible_ies(auth.uid())))));
CREATE POLICY "Gestor/Professor view own IES results" ON public.resultados_ies_tri AS PERMISSIVE FOR SELECT TO authenticated USING (((has_role(auth.uid(), 'gestor'::app_role) OR has_role(auth.uid(), 'professor'::app_role)) AND (college_id = get_current_user_ies_id())));

-- sanarclass_lessons / views
CREATE POLICY "Admins podem gerenciar todas as aulas" ON public.sanarclass_lessons AS PERMISSIVE FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view all views" ON public.sanarclass_views AS PERMISSIVE FOR SELECT TO public USING (has_role(auth.uid(), 'admin'::app_role));

-- simulados_admin
CREATE POLICY "Admins podem gerenciar simulados" ON public.simulados_admin AS PERMISSIVE FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Gestor de grupo pode ver simulados do grupo" ON public.simulados_admin AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'gestor_grupo'::app_role) AND (ies_ids && get_accessible_ies(auth.uid()))));
CREATE POLICY "Professors can view simulados for their IES" ON public.simulados_admin AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'professor'::app_role) AND (get_current_user_ies_id() = ANY (ies_ids))));

-- simulados_finalizados
CREATE POLICY "Admins podem gerenciar simulados finalizados" ON public.simulados_finalizados AS PERMISSIVE FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Gestor de grupo pode ver finalizados do grupo" ON public.simulados_finalizados AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'gestor_grupo'::app_role) AND (EXISTS (SELECT 1 FROM users u WHERE ((u.id = simulados_finalizados.user_id) AND (u.id_ies = ANY (get_accessible_ies(auth.uid()))))))));

-- simulados_iniciados
CREATE POLICY "Admins can view all started simulados" ON public.simulados_iniciados AS PERMISSIVE FOR SELECT TO public USING (has_role(auth.uid(), 'admin'::app_role));

-- user_feedback
CREATE POLICY "Admins update feedback" ON public.user_feedback AS PERMISSIVE FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins view all feedback" ON public.user_feedback AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- user_groups
CREATE POLICY "Admins manage user_groups" ON public.user_groups AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- user_progress_nodes
CREATE POLICY "Admins can view all progress nodes" ON public.user_progress_nodes AS PERMISSIVE FOR SELECT TO public USING (has_role(auth.uid(), 'admin'::app_role));

-- user_roles
CREATE POLICY "Admins can manage all user roles" ON public.user_roles AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Atendimento can view all user roles" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'atendimento'::app_role));

-- user_sessions
CREATE POLICY "Admins can view all sessions" ON public.user_sessions AS PERMISSIVE FOR SELECT TO public USING (has_role(auth.uid(), 'admin'::app_role));

-- users
CREATE POLICY "Atendimento can update all users" ON public.users AS PERMISSIVE FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'atendimento'::app_role)) WITH CHECK (has_role(auth.uid(), 'atendimento'::app_role));
CREATE POLICY "Atendimento can view all users" ON public.users AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'atendimento'::app_role));
CREATE POLICY "Professors can view users from their IES" ON public.users AS PERMISSIVE FOR SELECT TO public USING ((has_role(auth.uid(), 'professor'::app_role) AND (id_ies = get_current_user_ies_id())));
CREATE POLICY "Usuarios podem ver seus dados e admins podem ver todos" ON public.users AS PERMISSIVE FOR SELECT TO authenticated USING (((auth.uid() = id) OR has_role(auth.uid(), 'admin'::app_role)));

-- storage.objects (SanarClass + feedback screenshots)
CREATE POLICY "Admins can delete SanarClass files" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'sanarclass-files'::text) AND (SELECT has_role(auth.uid(), 'admin'::app_role) AS has_role)));
CREATE POLICY "Admins can upload SanarClass files" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'sanarclass-files'::text) AND (SELECT has_role(auth.uid(), 'admin'::app_role) AS has_role)));
CREATE POLICY "Admins delete feedback screenshots" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'feedback-screenshots'::text) AND has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Admins read all feedback screenshots" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'feedback-screenshots'::text) AND has_role(auth.uid(), 'admin'::app_role)));