-- STEP 1: helper
create or replace function public.user_has_feature(p_feature text)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_ies uuid;
  v_ies_list uuid[];
  v_master boolean;
  v_enabled boolean;
begin
  if v_uid is null then return false; end if;
  if public.has_role(v_uid,'admin'::app_role) or public.has_role(v_uid,'atendimento'::app_role) then
    return true;
  end if;
  select id_ies into v_ies from public.users where id = v_uid;
  if v_ies is not null then
    v_ies_list := array[v_ies];
  else
    v_ies_list := public.get_accessible_ies(v_uid);
  end if;
  if v_ies_list is null or array_length(v_ies_list,1) is null then return false; end if;
  if p_feature like 'gestao.%' and p_feature <> 'gestao.enabled' then
    select coalesce(bool_or(enabled), false) into v_master
    from public.ies_features where feature_key = 'gestao.enabled' and ies_id = any(v_ies_list);
    if not v_master then return false; end if;
  end if;
  select coalesce(bool_or(enabled), false) into v_enabled
  from public.ies_features where feature_key = p_feature and ies_id = any(v_ies_list);
  return v_enabled;
end;
$fn$;
revoke all on function public.user_has_feature(text) from public, anon;
grant execute on function public.user_has_feature(text) to authenticated, service_role;

-- SQL functions rewritten as plpgsql wrappers
create or replace function public.get_simulado_tem_tri(p_simulado_id uuid, p_ies_id uuid default null)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
declare v_result boolean;
begin
  if not (public.user_has_feature('gestao.enabled')) then
    raise exception 'feature_not_enabled' using errcode = '42501';
  end if;
  select exists (
    select 1 from public.resultados_ies_tri r
    where r.simulado_id = p_simulado_id
      and (p_ies_id is null or r.college_id = p_ies_id)
  ) into v_result;
  return v_result;
end;
$fn$;

create or replace function public.get_cohort_consumo_ranking()
returns table(supabase_user_id uuid, user_id_metabase text, videos_assistidos bigint, questoes_respondidas bigint, rank_videos integer, rank_questoes integer, total integer)
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
begin
  if not (public.user_has_feature('aluno.home')) then
    raise exception 'feature_not_enabled' using errcode = '42501';
  end if;
  return query
  with cohort as (
    select u.id
    from public.users u
    where u.id_ies = public.get_current_user_ies_id()
      and u.semestre = public.get_current_user_semester()
  ),
  consumo as (
    select
      c.id as supabase_user_id,
      coalesce(stm.user_id_metabase, '') as user_id_metabase,
      coalesce(cm.videos_assistidos, 0)::bigint as videos_assistidos,
      coalesce(cm.questoes_respondidas, 0)::bigint as questoes_respondidas
    from cohort c
    left join public.supabase_to_metabase stm on stm.id = c.id
    left join public.consumo_metabase cm on cm.id = stm.user_id_metabase
  ),
  totals as (
    select count(*)::integer as total from consumo
  )
  select
    co.supabase_user_id,
    co.user_id_metabase,
    co.videos_assistidos,
    co.questoes_respondidas,
    case
      when (select count(*) from consumo where videos_assistidos > 0) = 0
      then (select total from totals)
      else (rank() over (order by co.videos_assistidos desc))::integer
    end as rank_videos,
    case
      when (select count(*) from consumo where questoes_respondidas > 0) = 0
      then (select total from totals)
      else (rank() over (order by co.questoes_respondidas desc))::integer
    end as rank_questoes,
    (select total from totals) as total
  from consumo co;
end;
$fn$;

-- Patch remaining plpgsql RPCs (case-insensitive BEGIN match)
do $patch$
declare
  r record;
  guard text;
  new_def text;
  cond text;
  mapping jsonb := jsonb_build_object(
    'get_user_performance_aggregates',   $$public.user_has_feature('aluno.desempenho_simulados')$$,
    'get_all_user_performance_by_area',  $$public.user_has_feature('aluno.desempenho_simulados')$$,
    'get_questions_by_subspecialty',     $$public.user_has_feature('aluno.desempenho_simulados')$$,
    'record_review_attempt_guarded',     $$public.user_has_feature('aluno.caderno_erros')$$,
    'schedule_next_review_guarded',      $$public.user_has_feature('aluno.caderno_erros')$$,
    'reset_leech_guarded',               $$public.user_has_feature('aluno.caderno_erros')$$,
    'add_to_notebook_bulk_guarded',      $$public.user_has_feature('aluno.caderno_erros')$$,
    'get_user_simulados',                $$public.user_has_feature('aluno.simulados') or public.user_has_feature('aluno.desempenho_simulados') or public.user_has_feature('aluno.caderno_erros')$$,
    'get_user_rankings',                 $$public.user_has_feature('aluno.home') or public.user_has_feature('aluno.desempenho_simulados')$$,
    'complete_theme',                    $$public.user_has_feature('aluno.dashboard') or public.user_has_feature('aluno.home')$$,
    'uncomplete_theme',                  $$public.user_has_feature('aluno.dashboard') or public.user_has_feature('aluno.home')$$,
    'get_theme_evolution',               $$public.user_has_feature('gestao.diagnostico_curricular')$$,
    'get_institutional_simulados',       $$public.user_has_feature('gestao.enabled')$$,
    'get_institutional_performance',     $$public.user_has_feature('gestao.enabled')$$,
    'get_institutional_student_scores',  $$public.user_has_feature('gestao.enabled')$$,
    'get_institutional_evolution',       $$public.user_has_feature('gestao.enabled')$$,
    'get_institutional_tri',             $$public.user_has_feature('gestao.enabled')$$,
    'get_institutional_evolution_tri',   $$public.user_has_feature('gestao.enabled')$$,
    'get_ies_student_count',             $$public.user_has_feature('gestao.enabled')$$
  );
begin
  for r in
    select p.oid, p.proname, pg_get_functiondef(p.oid) as def, l.lanname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_language l on l.oid = p.prolang
    where n.nspname = 'public' and mapping ? p.proname
  loop
    cond := mapping ->> r.proname;
    if r.lanname <> 'plpgsql' then
      raise exception 'unexpected non-plpgsql function: % (%)', r.proname, r.lanname;
    end if;
    if position('feature_not_enabled' in r.def) > 0 then
      raise notice 'skip (already guarded): %', r.proname;
      continue;
    end if;
    guard := format(E'\nBEGIN\n  IF NOT (%s) THEN RAISE EXCEPTION ''feature_not_enabled'' USING ERRCODE = ''42501''; END IF;\n', cond);
    -- case-insensitive match of a standalone BEGIN on its own line
    new_def := regexp_replace(r.def, E'\\n[Bb][Ee][Gg][Ii][Nn]\\n', guard);
    if new_def = r.def then
      raise exception 'guard insertion failed for %', r.proname;
    end if;
    execute new_def;
    raise notice 'patched: %', r.proname;
  end loop;
end;
$patch$;