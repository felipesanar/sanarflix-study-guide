BEGIN;
REVOKE ALL ON FUNCTION public.get_gestor_alunos(uuid, text, integer, integer, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_gestor_alunos(uuid, text, integer, integer, text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_alunos(uuid, text, integer, integer, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_gestor_alunos(uuid, text, integer, integer, text, text, text, text) TO service_role;
COMMIT;