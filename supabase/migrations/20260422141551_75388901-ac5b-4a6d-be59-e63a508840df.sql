-- Recreate RPCs without grau_dificuldade
DROP FUNCTION IF EXISTS public.get_questions_by_subspecialty(text, uuid, text, text);

CREATE OR REPLACE FUNCTION public.get_questions_by_subspecialty(sub_name text, p_simulado_id uuid DEFAULT NULL::uuid, area_name text DEFAULT NULL::text, specialty_name text DEFAULT NULL::text)
 RETURNS TABLE(id text, gabarito text, enunciado text, a text, b text, c text, d text, comentario text, imagem text, acertou boolean, user_answer text, anulada boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return query
  select
    q.id::text,
    q.correta,
    q.enunciado,
    q.alternativa_a,
    q.alternativa_b,
    q.alternativa_c,
    q.alternativa_d,
    q.comentario,
    q.imagem,
    ap.correct,
    upper(ap.resposta_usuario),
    q.anulada
  from public.questoes_simulado q
  INNER JOIN public.answer_progress ap
    on q.id = ap.question_id
   and ap.user_id = auth.uid()
   and (p_simulado_id is null or ap.simulado = p_simulado_id)
  where q.tema = sub_name
    and (area_name is null or q.grande_area = area_name)
    and (specialty_name is null or q.especialidade = specialty_name)
    and (p_simulado_id is null or q.simulado_id = p_simulado_id)
  limit 10;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_institutional_question_details(p_simulado_id uuid, p_tema text, p_area text DEFAULT NULL::text, p_specialty text DEFAULT NULL::text, p_ies_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_ies_id uuid;
  result json;
BEGIN
  v_user_id := auth.uid();
  IF NOT (has_role(v_user_id, 'admin') OR has_role(v_user_id, 'professor') OR has_role(v_user_id, 'b2b_partner') OR has_role(v_user_id, 'gestor')) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF p_ies_id IS NOT NULL AND (has_role(v_user_id, 'admin') OR has_role(v_user_id, 'b2b_partner')) THEN
    v_ies_id := p_ies_id;
  ELSE
    SELECT u.id_ies INTO v_ies_id FROM users u WHERE u.id = v_user_id;
  END IF;
  SELECT json_build_object(
    'questions', (
      SELECT COALESCE(json_agg(row_to_json(qq)), '[]'::json)
      FROM (
        SELECT q.id, q.enunciado, q.alternativa_a as a, q.alternativa_b as b, q.alternativa_c as c, q.alternativa_d as d,
          q.correta as gabarito, q.comentario, q.imagem, q.anulada,
          (SELECT COALESCE(json_agg(row_to_json(sd)), '[]'::json) FROM (
            SELECT u2.semestre, COUNT(*) as total, COUNT(*) FILTER (WHERE ap2.correct) as acertos
            FROM answer_progress ap2 JOIN users u2 ON ap2.user_id = u2.id
            WHERE ap2.question_id = q.id AND ap2.simulado = p_simulado_id AND u2.id_ies = v_ies_id AND u2.semestre IS NOT NULL
            GROUP BY u2.semestre ORDER BY u2.semestre
          ) sd) as semester_distribution,
          (SELECT COALESCE(json_agg(row_to_json(sl) ORDER BY sl.nome), '[]'::json) FROM (
            SELECT u3.nome, u3.semestre, ap3.correct as acertou, UPPER(ap3.resposta_usuario) as resposta
            FROM answer_progress ap3 JOIN users u3 ON ap3.user_id = u3.id
            WHERE ap3.question_id = q.id AND ap3.simulado = p_simulado_id AND u3.id_ies = v_ies_id
          ) sl) as students
        FROM questoes_simulado q
        WHERE q.simulado_id = p_simulado_id AND q.tema = p_tema
          AND (p_area IS NULL OR q.grande_area = p_area)
          AND (p_specialty IS NULL OR q.especialidade = p_specialty)
        ORDER BY q.ordem LIMIT 20
      ) qq
    )
  ) INTO result;
  RETURN result;
END;
$function$;

-- Drop the column last (destructive, explicitly authorized by user)
ALTER TABLE public.questoes_simulado DROP COLUMN IF EXISTS grau_dificuldade;