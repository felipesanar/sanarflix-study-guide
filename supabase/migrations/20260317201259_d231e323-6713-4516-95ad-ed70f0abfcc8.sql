
-- Allow users to view questions from simulados they have answered
-- This fixes the PDF generation issue where questoes_simulado RLS blocks 
-- access when simulado status is not 'ativo'
CREATE POLICY "Users can view questions they have answered"
ON public.questoes_simulado
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM answer_progress ap
    WHERE ap.question_id = questoes_simulado.id
      AND ap.user_id = auth.uid()
  )
);
