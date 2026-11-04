-- Página do Mentor · Onda 3: prova explícita de service_role para a edge sync-simulados-b2c.
-- O cron manda a service_role legada (JWT do Vault) e o env da edge traz outro formato
-- de chave; em vez de inferir privilégio de um SELECT (que depende de grants), a edge
-- chama esta RPC e exige `true`. Executável só por service_role.
create or replace function public.b2c_sync_sou_servico()
 returns boolean
 language sql
 stable
 set search_path to ''
as $function$
  select coalesce(auth.role(), '') = 'service_role';
$function$;

revoke all on function public.b2c_sync_sou_servico() from public;
revoke execute on function public.b2c_sync_sou_servico() from anon, authenticated;
grant execute on function public.b2c_sync_sou_servico() to service_role;
