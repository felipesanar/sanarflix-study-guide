
CREATE OR REPLACE FUNCTION public.get_access()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_roles text[] := '{}';
  v_experiences text[] := ARRAY['aluno'];
  v_caps text[] := '{}';
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('roles', '[]'::jsonb, 'experiences', '[]'::jsonb, 'capabilities', '[]'::jsonb);
  END IF;

  SELECT COALESCE(array_agg(role::text), '{}') INTO v_roles
  FROM public.user_roles WHERE user_id = v_uid;

  IF 'admin' = ANY(v_roles) THEN
    v_experiences := v_experiences || ARRAY['admin','gestao'];
    v_caps := v_caps || ARRAY['users.manage','users.edit','avisos.manage','ies.manage','guia.manage','sanarclass.manage','simulados.manage','feedbacks.moderate','analytics.view','impersonate','admin.tools','institutional.view','alunos.view'];
  END IF;

  IF 'gestor' = ANY(v_roles) OR 'gestor_grupo' = ANY(v_roles) THEN
    v_experiences := v_experiences || ARRAY['gestao'];
    v_caps := v_caps || ARRAY['institutional.view','alunos.view'];
  END IF;

  IF 'atendimento' = ANY(v_roles) THEN
    v_experiences := v_experiences || ARRAY['atendimento'];
    v_caps := v_caps || ARRAY['users.support','users.edit','feedbacks.support'];
  END IF;

  RETURN jsonb_build_object(
    'roles', to_jsonb(v_roles),
    'experiences', (SELECT to_jsonb(array_agg(DISTINCT e)) FROM unnest(v_experiences) e),
    'capabilities', COALESCE((SELECT to_jsonb(array_agg(DISTINCT c)) FROM unnest(v_caps) c), '[]'::jsonb)
  );
END;
$function$;
