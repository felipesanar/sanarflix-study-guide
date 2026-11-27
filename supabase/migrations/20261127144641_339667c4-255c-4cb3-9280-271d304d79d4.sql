CREATE OR REPLACE FUNCTION public.user_has_caderno(_simulado_id uuid, _caderno smallint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.simulado_aluno_caderno
    WHERE user_id = auth.uid() AND simulado_id = _simulado_id AND caderno = _caderno);
$$;
GRANT EXECUTE ON FUNCTION public.user_has_caderno(uuid, smallint) TO authenticated;

DROP POLICY IF EXISTS "Usuários podem ver simulado_cadernos" ON public.simulado_cadernos;
CREATE POLICY "Alunos veem apenas o próprio caderno" ON public.simulado_cadernos
  FOR SELECT TO authenticated USING (public.user_has_caderno(simulado_id, caderno));

DROP POLICY IF EXISTS "Catalogo legivel por autenticados" ON public.feature_catalog;
CREATE POLICY "Catalogo legivel por admins" ON public.feature_catalog
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Usuários autenticados podem ver dados do semestre" ON public.dados_meu_semestre;
CREATE POLICY "Usuários veem dados da própria IES" ON public.dados_meu_semestre
  FOR SELECT TO authenticated USING (id_ies = public.get_current_user_ies_id() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Allow authenticated users to read intensivo USCS content" ON public.intensivouscs;
CREATE POLICY "Admins podem ler intensivo USCS" ON public.intensivouscs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));