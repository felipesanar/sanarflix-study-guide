create or replace function public.get_ies_student_count(p_ies_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.users u
  where u.id_ies = p_ies_id
    and not exists (
      select 1 from public.user_roles ur where ur.user_id = u.id
    );
$$;

grant execute on function public.get_ies_student_count(uuid) to authenticated;