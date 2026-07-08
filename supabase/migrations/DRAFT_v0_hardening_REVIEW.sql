-- =============================================================================
-- DRAFT — SanarFlix Academy v0 — Backend cleanup + Security hardening
-- =============================================================================
-- !!! RASCUNHO / DRAFT — REVISAR ANTES DE APLICAR !!!
-- !!! DO NOT APPLY AS-IS. HUMAN REVIEW REQUIRED.    !!!
--
-- Projeto Supabase: gvqvrmkizemwsasmupmo
-- Gerado em: 2026-06-03  (artefato de revisão — NÃO é uma migration pronta)
--
-- Objetivo deste arquivo:
--   1. Revogar EXECUTE de `anon` (e `authenticated` quando aplicável) das
--      funções SECURITY DEFINER em `public` que não fazem sentido para um
--      usuário não autenticado / não administrador.
--   2. Fixar search_path nas 4 funções com search_path mutável.
--   3. Restringir listagem do bucket público `sanarclass-files`.
--   4. Restringir a MV `public.mv_evolucao_institucional_tri` (revogar SELECT
--      de anon/authenticated; acesso passa a ser via função SECURITY DEFINER).
--
-- METODOLOGIA / VEREDITOS (resumo):
--   - "REVOGAR de anon"            => não há caso de uso anônimo; mantém authenticated.
--   - "REVOGAR de anon E auth"     => só chamada internamente por service_role
--                                      (edge functions) ou por trigger; cliente nunca chama.
--   - "TRIGGER — revogar tudo"     => função de trigger; PostgreSQL a executa como
--                                      owner via trigger, NÃO precisa de grant a anon/auth.
--   - "MANTER"                     => chamada pelo front-end por usuário autenticado;
--                                      apenas garante revoke de anon.
--
-- IMPORTANTE: a sintaxe REVOKE ... FROM anon NÃO remove o grant implícito a
-- PUBLIC (cláusula "=X" no proacl de algumas funções). Por isso, para as
-- funções que mostram grant a PUBLIC, fazemos também REVOKE ... FROM PUBLIC.
-- Verifique cada proacl antes de aplicar.
-- =============================================================================

BEGIN;  -- Recomenda-se aplicar em transação e validar antes do COMMIT.

-- =============================================================================
-- SEÇÃO 1 — Funções ADMIN (RPC). Só fazem sentido para admin autenticado.
--   Veredito: REVOGAR de anon. Lógica de admin é validada DENTRO da função
--   (has_role/is_admin) e/ou só é chamada por edge functions com service_role,
--   então também revogamos de authenticated por segurança em profundidade.
--   * As edge functions admin-* chamam essas RPCs com service_role (mantém acesso).
-- =============================================================================
-- ATENÇÃO (auditoria 08/07): admin_get_batch_records e admin_list_import_batches são
-- chamadas DIRETO pelo front logado (ImportarHistoricoLotes.tsx:72,90) — a premissa
-- "só edge functions chamam" é FALSA para essas duas. Mantemos `authenticated` (o gate
-- admin é interno via has_role, GRANT intencional na 20260429170721); revogamos só
-- anon/PUBLIC. Revogar de authenticated quebraria o histórico "Últimos lotes".
REVOKE EXECUTE ON FUNCTION public.admin_get_batch_records(uuid)                                            FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_import_one_response(uuid, uuid, uuid, jsonb, integer, integer, timestamptz, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_import_responses_batch(uuid, uuid, jsonb, text)                    FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_list_import_batches(integer)                                       FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_lookup_users_by_email_in_ies(uuid[], text[])                       FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_simulado_question_map(uuid)                                        FROM anon, authenticated, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_get_batch_records(uuid)                                            TO service_role;
GRANT  EXECUTE ON FUNCTION public.admin_import_one_response(uuid, uuid, uuid, jsonb, integer, integer, timestamptz, text) TO service_role;
GRANT  EXECUTE ON FUNCTION public.admin_import_responses_batch(uuid, uuid, jsonb, text)                    TO service_role;
GRANT  EXECUTE ON FUNCTION public.admin_list_import_batches(integer)                                       TO service_role;
GRANT  EXECUTE ON FUNCTION public.admin_lookup_users_by_email_in_ies(uuid[], text[])                       TO service_role;
GRANT  EXECUTE ON FUNCTION public.admin_simulado_question_map(uuid)                                        TO service_role;

-- =============================================================================
-- SEÇÃO 2 — Painel institucional (B2B). Dados agregados de TODA a IES.
--   Veredito: REVOGAR de anon. Manter `authenticated` — o front (services/
--   institutional.ts, pages/DesempenhoInstitucional.tsx) chama estas RPCs como
--   usuário logado (coordenador/admin). A função internamente deveria checar
--   user_can_access_ies; revisar se isso está implementado em cada uma.
--   >> NÃO revogar de authenticated: quebraria o painel institucional. <<
-- =============================================================================
REVOKE EXECUTE ON FUNCTION public.get_institutional_evolution(uuid)                       FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_institutional_evolution_tri(uuid)                   FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_institutional_longitudinal_tri(uuid)                FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_institutional_performance(uuid, uuid)               FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_institutional_question_details(uuid, text, text, text, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_institutional_simulados(uuid)                       FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_institutional_student_scores(uuid, uuid)            FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_institutional_tri(uuid, uuid)                       FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_student_growth_tri(uuid)                            FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_theme_evolution(text, uuid)                         FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_distinct_semestres(uuid)                            FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_ies_student_count(uuid)                             FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_cohort_consumo_ranking()                            FROM anon, PUBLIC;

-- =============================================================================
-- SEÇÃO 3 — Funções de contexto/identidade e helpers de role.
--   Veredito: REVOGAR de anon. Mantêm `authenticated` pois o front usa o
--   contexto do usuário logado (AuthContext, useHomeData, etc.).
-- =============================================================================
REVOKE EXECUTE ON FUNCTION public.get_user_roles(uuid)              FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_accessible_ies(uuid)         FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_current_user_ies_id()        FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_current_user_semester()      FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_current_user_faculty()       FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_ies_id()                FROM anon, PUBLIC;
-- get_user_roles / get_accessible_ies também são chamadas por auth-login (service_role) — mantém via service_role:
GRANT  EXECUTE ON FUNCTION public.get_user_roles(uuid)             TO service_role;
GRANT  EXECUTE ON FUNCTION public.get_accessible_ies(uuid)        TO service_role;

-- =============================================================================
-- SEÇÃO 4 — Performance / dados do PRÓPRIO usuário (RPC pelo front logado).
--   Veredito: REVOGAR de anon. Manter authenticated (filtram por auth.uid()).
-- =============================================================================
REVOKE EXECUTE ON FUNCTION public.get_user_simulados()                       FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_performance_aggregates(uuid)      FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_rankings(uuid)                    FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_ranking_in_ies()                  FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_all_user_performance_by_area()         FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_simulado_performance()                 FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_progress_hub_summary()                 FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.complete_theme(text, text, text)           FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.uncomplete_theme(text, text, text)         FROM anon, PUBLIC;
-- get_progress_hub_summary / get_user_performance_aggregates também via edge (ai-study-recommendation, service_role):
GRANT  EXECUTE ON FUNCTION public.get_progress_hub_summary()                 TO service_role;
GRANT  EXECUTE ON FUNCTION public.get_user_performance_aggregates(uuid)      TO service_role;

-- =============================================================================
-- SEÇÃO 5 — Banco de questões / simulados (conteúdo).
--   Veredito: REVOGAR de anon. Manter authenticated (uso no front logado).
--   ATENÇÃO: existem DUAS get_question_by_subspecialty (overload). Revisar se
--   ambas devem perder anon. A versão (text) é SECURITY INVOKER (não-SECDEF).
-- =============================================================================
REVOKE EXECUTE ON FUNCTION public.get_questions_by_subspecialty(text, uuid, text, text)  FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_question_by_subspecialty(text, integer)            FROM anon, PUBLIC;  -- overload SECURITY DEFINER
REVOKE EXECUTE ON FUNCTION public.get_simulados_questoes_count(uuid[])                   FROM anon, PUBLIC;

-- =============================================================================
-- SEÇÃO 6 — Helpers de autorização e features. Só fazem sentido autenticado.
--   Veredito: REVOGAR de anon. has_role/is_admin também são chamadas por edge
--   functions (service_role) e dentro de policies (executam como definer, sem
--   precisar de grant). Mantém authenticated (usadas em RLS / no app).
-- =============================================================================
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role)         FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin()                       FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_authenticated()               FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ies_has_feature(uuid, text)      FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_ies_features(uuid)           FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_can_access_ies(uuid, uuid)  FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_group_ies(uuid)         FROM anon, PUBLIC;
-- has_role / get_user_roles são usadas por várias edge functions com service_role:
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, app_role)         TO service_role;

-- =============================================================================
-- SEÇÃO 7 — Funções de manutenção / KV / refresh. NÃO devem ser chamadas pelo
--   cliente. Só service_role (cron / edge / rate-limit).
--   Veredito: REVOGAR de anon E authenticated.
--   - kv_incr é chamada por _shared/rateLimit.ts (edge, service_role).
--   - refresh_mv_* é manutenção (cron/admin).
--   - kv_cleanup é manutenção.
-- =============================================================================
REVOKE EXECUTE ON FUNCTION public.kv_incr(text, integer, integer)            FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.kv_cleanup()                               FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refresh_mv_evolucao_institucional_tri()    FROM anon, authenticated, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.kv_incr(text, integer, integer)            TO service_role;
GRANT  EXECUTE ON FUNCTION public.kv_cleanup()                               TO service_role;
GRANT  EXECUTE ON FUNCTION public.refresh_mv_evolucao_institucional_tri()    TO service_role;

-- =============================================================================
-- SEÇÃO 8 — Funções de TRIGGER (SECURITY DEFINER acionadas por trigger).
--   Veredito: REVOGAR de anon E authenticated (e PUBLIC). O PostgreSQL invoca
--   funções de trigger automaticamente; elas NÃO precisam de privilégio EXECUTE
--   concedido a roles de cliente. Nenhum cliente as chama via RPC.
--   Confirmado via pg_trigger (used_by_triggers != null).
-- =============================================================================
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                          FROM anon, authenticated, PUBLIC;  -- trigger on_auth_user_created
REVOKE EXECUTE ON FUNCTION public.log_sensitive_user_changes()               FROM anon, authenticated, PUBLIC;  -- trigger log_user_changes_trigger
REVOKE EXECUTE ON FUNCTION public.validate_user_update()                     FROM anon, authenticated, PUBLIC;  -- trigger validate_user_update_trigger
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column()                 FROM anon, authenticated, PUBLIC;  -- vários triggers updated_at
REVOKE EXECUTE ON FUNCTION public.update_updated_at_users()                  FROM anon, authenticated, PUBLIC;  -- (sem trigger ativo atualmente)
REVOKE EXECUTE ON FUNCTION public.update_calendar_subjects_updated_at()      FROM anon, authenticated, PUBLIC;  -- trigger calendar_subjects
REVOKE EXECUTE ON FUNCTION public.update_simulados_updated_at()              FROM anon, authenticated, PUBLIC;  -- triggers simulados/questoes

-- =============================================================================
-- SEÇÃO 9 — search_path mutável (lint function_search_path_mutable).
--   As 4 funções abaixo têm proconfig NULL. Fixar search_path.
--   Para funções de TRIGGER (update_*), usar '' é seguro (referenciam só NEW/OLD).
--   Para funções que tocam tabelas em `public`, usar 'public, pg_temp'
--   (ou qualificar tudo com schema). Revisar corpo de cada uma antes.
-- =============================================================================
ALTER FUNCTION public.update_calendar_subjects_updated_at()  SET search_path = '';            -- trigger: só NEW
ALTER FUNCTION public.update_simulados_updated_at()          SET search_path = '';            -- trigger: só NEW
ALTER FUNCTION public.get_all_user_performance_by_area()     SET search_path = 'public, pg_temp'; -- toca tabelas em public
ALTER FUNCTION public.get_user_simulados()                   SET search_path = 'public, pg_temp'; -- toca tabelas em public

-- =============================================================================
-- SEÇÃO 10 — Bucket público `sanarclass-files`: restringir LISTAGEM.
--   Estado atual: policy "Public can view SanarClass files" => SELECT para role
--   PUBLIC (roles {-}) com qual `bucket_id = 'sanarclass-files'`. Isso permite
--   LISTAR todo o bucket (storage.objects) por qualquer um, anônimo inclusive.
--   Como o bucket é `public=true`, os ARQUIVOS continuam acessíveis por URL
--   pública mesmo sem policy de SELECT — então podemos remover a listagem geral
--   e (se quiser) restringir SELECT a authenticated, sem quebrar o download por
--   URL pública (que passa pelo CDN, não pela policy).
--
--   OPÇÃO A (recomendada p/ v0): remover a policy ampla e exigir autenticação
--   para LISTAR via API; download por URL pública continua funcionando.
DROP POLICY IF EXISTS "Public can view SanarClass files" ON storage.objects;
CREATE POLICY "Authenticated can read SanarClass files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'sanarclass-files');

--   OPÇÃO B (mais restritiva): tornar o bucket privado e servir via URL assinada.
--   Requer mudar bucket.public=false e ajustar o front para createSignedUrl.
--   NÃO incluído aqui — decisão de produto. Ver checklist item C/D.

-- =============================================================================
-- SEÇÃO 11 — MV `public.mv_evolucao_institucional_tri` exposta a anon/auth.
--   Estado atual: relacl concede arwdDxtm a anon E authenticated => qualquer
--   cliente pode SELECT direto na MV (dados institucionais agregados de toda IES),
--   contornando qualquer checagem de role.
--   Veredito: revogar SELECT de anon e authenticated. O acesso legítimo já é
--   feito via funções SECURITY DEFINER (get_institutional_*_tri), que leem a MV
--   como owner — logo continuam funcionando após o revoke.
-- =============================================================================
REVOKE ALL ON public.mv_evolucao_institucional_tri FROM anon, authenticated;
-- (service_role mantém acesso; as funções SECDEF executam como owner=postgres)

COMMIT;

-- =============================================================================
-- VALIDAÇÃO PÓS-APLICAÇÃO (rodar como SELECT, fora da transação):
--   SELECT p.proname, p.proacl FROM pg_proc p JOIN pg_namespace n
--     ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY 1;
--   -- Confirmar que anon não tem mais '=X' nem 'anon=X' nas funções acima.
--   SELECT has_function_privilege('authenticated','public.get_user_roles(uuid)','execute'); -- deve ser true
--   SELECT has_function_privilege('anon','public.get_user_roles(uuid)','execute');          -- deve ser false
-- =============================================================================
