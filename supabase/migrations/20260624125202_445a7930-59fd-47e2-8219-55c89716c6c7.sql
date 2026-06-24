CREATE POLICY "Gestor pode ver simulados da sua IES"
ON public.simulados_admin
FOR SELECT
USING (
  has_role(auth.uid(), 'gestor'::app_role)
  AND (ies_ids && get_accessible_ies(auth.uid()))
);

CREATE POLICY "Gestor pode ver questoes da sua IES"
ON public.questoes_simulado
FOR SELECT
USING (
  has_role(auth.uid(), 'gestor'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.simulados_admin sa
    WHERE sa.id = questoes_simulado.simulado_id
      AND (sa.ies_ids && get_accessible_ies(auth.uid()))
  )
);

CREATE POLICY "Gestor de grupo pode ver questoes da sua IES"
ON public.questoes_simulado
FOR SELECT
USING (
  has_role(auth.uid(), 'gestor_grupo'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.simulados_admin sa
    WHERE sa.id = questoes_simulado.simulado_id
      AND (sa.ies_ids && get_accessible_ies(auth.uid()))
  )
);