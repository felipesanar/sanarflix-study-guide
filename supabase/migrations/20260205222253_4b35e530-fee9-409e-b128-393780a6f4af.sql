-- Adicionar política de UPDATE para permitir upserts em simulados_iniciados
CREATE POLICY "Users can update their own started simulados"
ON simulados_iniciados FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);