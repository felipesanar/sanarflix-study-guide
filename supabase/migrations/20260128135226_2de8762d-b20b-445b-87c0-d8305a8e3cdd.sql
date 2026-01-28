-- 1. Adicionar coluna 'anulada' na tabela questoes_simulado
ALTER TABLE questoes_simulado 
ADD COLUMN IF NOT EXISTS anulada boolean NOT NULL DEFAULT false;

-- 2. Dropar a função existente para poder alterar o tipo de retorno
DROP FUNCTION IF EXISTS public.get_questions_by_subspecialty(text, uuid, text, text);

-- 3. Recriar a função com o campo anulada no retorno
CREATE OR REPLACE FUNCTION public.get_questions_by_subspecialty(
  sub_name text, 
  p_simulado_id uuid DEFAULT NULL::uuid, 
  area_name text DEFAULT NULL::text, 
  specialty_name text DEFAULT NULL::text
)
RETURNS TABLE(
  id text, 
  gabarito text, 
  enunciado text, 
  a text, 
  b text, 
  c text, 
  d text, 
  comentario text, 
  imagem text, 
  dificuldade text, 
  acertou boolean, 
  user_answer text,
  anulada boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    coalesce(q.grau_dificuldade, 'Médio'),
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
$$;

-- 4. Criar política RLS para permitir UPDATE em answer_progress por admins
-- (necessário para correção retroativa quando questão é anulada)
CREATE POLICY "Admins can update answers for nullified questions"
ON public.answer_progress
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
);