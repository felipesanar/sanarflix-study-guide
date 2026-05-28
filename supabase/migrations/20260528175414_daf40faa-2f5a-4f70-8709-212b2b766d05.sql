DROP FUNCTION IF EXISTS public.get_questions_by_subspecialty(text, uuid, text, text);

CREATE OR REPLACE FUNCTION public.get_questions_by_subspecialty(sub_name text, p_simulado_id uuid DEFAULT NULL::uuid, area_name text DEFAULT NULL::text, specialty_name text DEFAULT NULL::text)
 RETURNS TABLE(id text, gabarito text, enunciado text, a text, b text, c text, d text, comentario text, imagem text, imagem_2 text, acertou boolean, user_answer text, anulada boolean)
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
    q.imagem_2,
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