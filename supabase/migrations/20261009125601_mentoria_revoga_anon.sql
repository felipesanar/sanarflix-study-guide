-- Página do Mentor · Onda 1. O Supabase concede EXECUTE ao papel anon por
-- privilégio padrão em toda função nova do schema public; o REVOKE FROM PUBLIC
-- das migrations anteriores não remove esse grant explícito. Nenhuma destas
-- funções deve ser chamável sem login (o advisor 0028 apontou as seis).
revoke execute on function public.mentor_pode_ver_aluno(text) from anon;
revoke execute on function public.admin_upsert_mentor(uuid, text, text, uuid, text, text, text, boolean) from anon;
revoke execute on function public.admin_list_mentores() from anon;
revoke execute on function public.admin_importar_vinculos(uuid, jsonb, boolean, boolean) from anon;
revoke execute on function public.admin_encerrar_vinculo(uuid) from anon;
revoke execute on function public.get_mentor_contexto() from anon;
