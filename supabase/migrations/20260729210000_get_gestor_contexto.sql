-- 20260729210000_get_gestor_contexto.sql
-- Fase 1 / Task 14 do Portal do Gestor v2.
-- Guard de feature escrito no CORPO da funcao (nunca injetado depois), para que
-- recriar esta migration nao apague a protecao -- risco do §7.1 do spec.
CREATE OR REPLACE FUNCTION public.get_gestor_contexto()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid       uuid := auth.uid();
  v_papel     text;
  v_ies_list  uuid[];
  v_ies_atual uuid;
  v_result    jsonb;
BEGIN
  IF NOT public.user_has_feature('gestao.portal_v2') THEN
    RAISE EXCEPTION 'feature_not_enabled' USING ERRCODE = '42501';
  END IF;

  IF NOT (
       has_role(v_uid,'admin'::app_role)
    OR has_role(v_uid,'gestor'::app_role)
    OR has_role(v_uid,'gestor_grupo'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF has_role(v_uid,'admin'::app_role) THEN
    v_papel := 'admin';
  ELSIF has_role(v_uid,'gestor_grupo'::app_role) THEN
    v_papel := 'gestor_grupo';
  ELSE
    v_papel := 'gestor';
  END IF;

  IF v_papel = 'admin' THEN
    SELECT COALESCE(array_agg(i.id ORDER BY i.nome), ARRAY[]::uuid[])
      INTO v_ies_list
    FROM public.ies i;
  ELSE
    v_ies_list := COALESCE(public.get_accessible_ies(v_uid), ARRAY[]::uuid[]);
  END IF;

  SELECT u.id_ies INTO v_ies_atual FROM public.users u WHERE u.id = v_uid;
  IF v_ies_atual IS NULL THEN
    v_ies_atual := v_ies_list[1];
  END IF;
  IF v_ies_atual IS NULL THEN
    RAISE EXCEPTION 'IES not resolved';
  END IF;

  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'usuario', jsonb_build_object(
        'id',    v_uid,
        'nome',  COALESCE((SELECT u.nome FROM public.users u WHERE u.id = v_uid), 'Usuário'),
        'papel', v_papel
      ),
      'iesDisponiveis', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', i.id, 'nome', i.nome) ORDER BY i.nome)
        FROM public.ies i
        WHERE i.id = ANY (v_ies_list)
      ), '[]'::jsonb),
      'iesAtual', (
        SELECT jsonb_build_object('id', i.id, 'nome', i.nome)
        FROM public.ies i WHERE i.id = v_ies_atual
      ),
      'contrato', (
        SELECT jsonb_build_object(
                 'nome',                 c.nome_contrato,
                 'simuladosContratados', c.simulados_contratados,
                 'vigencia',             to_char(c.vigencia_inicio,'DD/MM/YYYY') || ' — ' || to_char(c.vigencia_fim,'DD/MM/YYYY')
               )
        FROM public.ies_contrato_simulados c
        WHERE c.ies_id = v_ies_atual
        ORDER BY (current_date BETWEEN c.vigencia_inicio AND c.vigencia_fim) DESC,
                 c.vigencia_fim DESC
        LIMIT 1
      ),
      'podeTrocarIes', (v_papel IN ('admin','gestor_grupo')),
      'podeExportar',  true
    ),
    'meta', jsonb_build_object(
      'periodo',     COALESCE((
                       SELECT to_char(c.vigencia_inicio,'DD/MM/YYYY') || ' — ' || to_char(c.vigencia_fim,'DD/MM/YYYY')
                       FROM public.ies_contrato_simulados c
                       WHERE c.ies_id = v_ies_atual
                       ORDER BY (current_date BETWEEN c.vigencia_inicio AND c.vigencia_fim) DESC, c.vigencia_fim DESC
                       LIMIT 1
                     ), 'sem contrato cadastrado'),
      'fonte',       'users · user_roles · ies · educational_groups · ies_contrato_simulados',
      'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'criterio',    'Papel derivado de user_roles (admin > gestor_grupo > gestor). IES acessíveis: todas para admin, get_accessible_ies para gestor_grupo, users.id_ies para gestor. Contrato: o vigente na data de hoje; se não houver vigente, o de vigência mais recente. podeExportar é true para os três papéis do portal.',
      'partial',     false,
      'lowSample',   false
    )
  ) INTO v_result;

  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_gestor_contexto() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_contexto() TO authenticated;
