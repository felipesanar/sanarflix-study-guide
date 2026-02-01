-- Adicionar política RLS para permitir INSERT pelos próprios usuários
CREATE POLICY "Usuarios podem inserir seus proprios simulados finalizados"
  ON simulados_finalizados
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);