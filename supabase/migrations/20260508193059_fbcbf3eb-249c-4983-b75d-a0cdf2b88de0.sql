
-- Fase 1: TRI architecture consolidation

-- 1) resultados_ies_tri: ensure simulado_id NOT NULL, replace PK with composite
ALTER TABLE public.resultados_ies_tri ALTER COLUMN college_id SET NOT NULL;
ALTER TABLE public.resultados_ies_tri ALTER COLUMN simulado_id SET NOT NULL;

-- Drop dependent FK from resultados_alunos_tri (redundant + blocks PK change)
ALTER TABLE public.resultados_alunos_tri DROP CONSTRAINT IF EXISTS resultados_alunos_tri_college_id_fkey;

ALTER TABLE public.resultados_ies_tri DROP CONSTRAINT IF EXISTS resultados_ies_tri_pkey;
ALTER TABLE public.resultados_ies_tri ADD CONSTRAINT resultados_ies_tri_pkey PRIMARY KEY (college_id, simulado_id);

-- 2) resultados_alunos_tri: composite PK (student_id, simulado_id), college_id NOT NULL
ALTER TABLE public.resultados_alunos_tri ALTER COLUMN student_id SET NOT NULL;
ALTER TABLE public.resultados_alunos_tri ALTER COLUMN simulado_id SET NOT NULL;
ALTER TABLE public.resultados_alunos_tri ALTER COLUMN college_id SET NOT NULL;

ALTER TABLE public.resultados_alunos_tri DROP CONSTRAINT IF EXISTS resultados_alunos_tri_pkey;
ALTER TABLE public.resultados_alunos_tri ADD CONSTRAINT resultados_alunos_tri_pkey PRIMARY KEY (student_id, simulado_id);

-- 3) Indexes for analytical queries
CREATE INDEX IF NOT EXISTS idx_resultados_alunos_tri_college_simulado ON public.resultados_alunos_tri (college_id, simulado_id);
CREATE INDEX IF NOT EXISTS idx_resultados_alunos_tri_simulado ON public.resultados_alunos_tri (simulado_id);
CREATE INDEX IF NOT EXISTS idx_resultados_ies_tri_simulado ON public.resultados_ies_tri (simulado_id);
CREATE INDEX IF NOT EXISTS idx_dim_questoes_tri_difficulty ON public.dim_questoes_tri (difficulty_b);

-- 4) Enable RLS
ALTER TABLE public.dim_questoes_tri ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resultados_ies_tri ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resultados_alunos_tri ENABLE ROW LEVEL SECURITY;

-- Policies: dim_questoes_tri (item-level params, readable by authenticated for review/audit; admin/manager scope)
CREATE POLICY "Admins manage dim_questoes_tri"
  ON public.dim_questoes_tri FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read dim_questoes_tri"
  ON public.dim_questoes_tri FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gestor'::app_role)
    OR has_role(auth.uid(), 'professor'::app_role)
    OR has_role(auth.uid(), 'b2b_partner'::app_role)
  );

-- Policies: resultados_ies_tri
CREATE POLICY "Admins manage resultados_ies_tri"
  ON public.resultados_ies_tri FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gestor/Professor view own IES results"
  ON public.resultados_ies_tri FOR SELECT
  TO authenticated
  USING (
    (has_role(auth.uid(), 'gestor'::app_role) OR has_role(auth.uid(), 'professor'::app_role))
    AND college_id = get_current_user_ies_id()
  );

CREATE POLICY "B2B partners view all IES results"
  ON public.resultados_ies_tri FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'b2b_partner'::app_role));

-- Policies: resultados_alunos_tri
CREATE POLICY "Admins manage resultados_alunos_tri"
  ON public.resultados_alunos_tri FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Students view their own TRI results"
  ON public.resultados_alunos_tri FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Gestor/Professor view IES students TRI"
  ON public.resultados_alunos_tri FOR SELECT
  TO authenticated
  USING (
    (has_role(auth.uid(), 'gestor'::app_role) OR has_role(auth.uid(), 'professor'::app_role))
    AND college_id = get_current_user_ies_id()
  );

CREATE POLICY "B2B partners view all student TRI"
  ON public.resultados_alunos_tri FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'b2b_partner'::app_role));
