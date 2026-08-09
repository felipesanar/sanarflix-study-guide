-- Reconstruído a partir de supabase_migrations.schema_migrations em produção
-- (gvqvrmkizemwsasmupmo) em 2026-08-08, durante sincronização de drift banco↔repo.
-- Este arquivo nunca existiu no working tree local; a migration foi aplicada
-- direto em produção (provavelmente via Lovable) sem passar pelo Git.
-- Trava os grants da nova assinatura de get_gestor_alunos (com p_grupo),
-- imediatamente após a migration 20260808205250 que a criou.

BEGIN;
REVOKE ALL ON FUNCTION public.get_gestor_alunos(uuid, text, integer, integer, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_gestor_alunos(uuid, text, integer, integer, text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_alunos(uuid, text, integer, integer, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_gestor_alunos(uuid, text, integer, integer, text, text, text, text) TO service_role;
COMMIT;
