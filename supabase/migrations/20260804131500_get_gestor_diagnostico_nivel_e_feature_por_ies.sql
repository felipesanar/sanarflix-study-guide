-- 20260804131000_get_gestor_diagnostico_nivel_e_feature_por_ies.sql
--
-- Corrige, em public.get_gestor_diagnostico, os achados 2 e 18 da revisão
-- adversarial de 03/08.
--
-- ACHADO 2 (card Ordem 101): a checagem de feature usava
-- public.user_has_feature('gestao.portal_v2'), que resolve por bool_or sobre
-- TODAS as IES acessíveis ao usuário (get_accessible_ies) quando
-- users.id_ies é null -- o caso normal de gestor_grupo. Isso libera o
-- diagnóstico do portal v2 para uma IES do grupo com a flag desligada,
-- contanto que outra IES irmã a tenha ligada.
--
-- ACHADO 18 (card 117): `desempenho` era derivado do %% de acerto NÃO
-- arredondado, enquanto `acertoPct` sai arredondado (`round(...,0)`). Caso de
-- fronteira real: 296 acertos em 1000 = 29,6%%. `acertoPct` = round(29,6) =
-- 30, mas `desempenho` comparava 29,6 (< 30) e virava 'critico' -- o payload
-- contradizia o próprio `meta.criterio` ("crítico < 30") e divergia de
-- `regras.ts::nivelDesempenho(30)`, que classifica 30 como 'mediano'.
-- Confirmado que só existe UM ponto de derivação de `desempenho` nesta
-- função (a CASE dentro de `nos`) -- não há segunda ocorrência a corrigir.
--
-- PARTIU de supabase/migrations/20260729210400_get_gestor_diagnostico.sql
-- (única migration desta função no repo; nasceu com o guard escrito direto
-- no corpo, então não está sujeita ao risco de guard-apagado-por-CREATE-OR-
-- REPLACE que existe nas 19 RPCs institucionais antigas). NENHUMA outra
-- lógica foi alterada: mesmo SECURITY DEFINER, SET search_path, STABLE,
-- guard de papel, chamada a user_can_access_ies, fallback de v_ies, parsing
-- de p_semestre, cascata grande_area/especialidade, grants e assinatura
-- (uuid, text, text) -> jsonb.
--
-- MUDANÇAS:
--  1) Troca public.user_has_feature('gestao.portal_v2') por
--     public.user_has_feature_for_ies('gestao.portal_v2', v_ies) -- a função
--     criada em 20260804120000_user_has_feature_for_ies.sql. O guard foi
--     movido para DEPOIS da resolução de v_ies (ver "AVISO CRÍTICO" na
--     migration do helper): antes disso p_ies_id pode ser NULL e a função
--     nova é fail-closed para NULL, o que faria toda chamada sem p_ies_id
--     explodir em 'feature_not_enabled' -- regressão que este reordenamento
--     evita. Ordem final do preâmbulo: papel (Access denied) ->
--     user_can_access_ies -> resolução de v_ies -> feature
--     (feature_not_enabled).
--  2) A CTE `agg` passa a calcular `acerto_pct` (arredondado) uma única vez;
--     `nos` reaproveita essa mesma coluna tanto para `acertoPct` quanto para
--     classificar `desempenho` -- uma base só, nunca duas.
--
-- EXIGÊNCIA ANTES DE APLICAR EM PRODUÇÃO (gvqv): rodar
--   SELECT pg_get_functiondef('public.get_gestor_diagnostico(uuid, text, text)'::regprocedure);
-- e comparar com o corpo de 20260729210400 assumido acima. Se divergir
-- (patch aplicado direto em prod fora do repo), ABORTAR e investigar antes
-- de rodar este arquivo -- não sobrescrever um corpo que não foi conferido.

CREATE OR REPLACE FUNCTION public.get_gestor_diagnostico(p_ies_id uuid, p_semestre text, p_node text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid      uuid := auth.uid();
  v_ies      uuid;
  v_sems     int[];
  v_recorte  text;
  v_nivel    text;
  v_result   jsonb;
BEGIN
  IF NOT (
       has_role(v_uid,'admin'::app_role)
    OR has_role(v_uid,'gestor'::app_role)
    OR has_role(v_uid,'gestor_grupo'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_ies_id IS NOT NULL THEN
    IF NOT public.user_can_access_ies(v_uid, p_ies_id) THEN
      RAISE EXCEPTION 'Permission denied: cannot access this IES';
    END IF;
    v_ies := p_ies_id;
  ELSE
    SELECT u.id_ies INTO v_ies FROM public.users u WHERE u.id = v_uid;
    IF v_ies IS NULL THEN
      v_ies := (public.get_accessible_ies(v_uid))[1];
    END IF;
  END IF;
  IF v_ies IS NULL THEN
    RAISE EXCEPTION 'IES not resolved';
  END IF;

  IF NOT public.user_has_feature_for_ies('gestao.portal_v2', v_ies) THEN
    RAISE EXCEPTION 'feature_not_enabled' USING ERRCODE = '42501';
  END IF;

  IF p_semestre IS NULL OR p_semestre = 'geral' THEN
    v_sems := NULL; v_recorte := 'todos os semestres, sem evidência';
  ELSIF p_semestre = '6ano' THEN
    v_sems := NULL; v_recorte := 'todos os semestres, 11º e 12º em evidência';
  ELSIF p_semestre ~ '^(1[0-2]|[1-9])$' THEN
    v_sems := ARRAY[p_semestre::int]; v_recorte := format('somente o %sº semestre', p_semestre);
  ELSE
    RAISE EXCEPTION 'semestre_invalido' USING ERRCODE = '22023';
  END IF;

  v_nivel := CASE WHEN p_node IS NULL THEN 'grande_area' ELSE 'especialidade' END;

  WITH sims AS (
    SELECT sa.id
    FROM public.simulados_admin sa
    WHERE v_ies = ANY (sa.ies_ids)
      AND sa.simulado_pai_id IS NULL
      AND sa.status IN ('ativo','encerrado')
      AND (
        sa.liberacao_desempenho = 'imediato'
        OR (sa.liberacao_desempenho = 'agendado'
            AND sa.data_liberacao_desempenho IS NOT NULL
            AND sa.data_liberacao_desempenho <= now())
        OR (sa.liberacao_desempenho = 'ao_encerrar'
            AND (sa.status = 'encerrado'
                 OR (sa.data_encerramento IS NOT NULL AND sa.data_encerramento <= now())))
      )
  ),
  grupo AS (
    SELECT sa.id AS simulado_id, COALESCE(sa.simulado_pai_id, sa.id) AS pai_id
    FROM public.simulados_admin sa
    WHERE COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims)
  ),
  alunos AS (
    SELECT u.id
    FROM public.users u
    WHERE u.id_ies = v_ies
      AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
      AND (v_sems IS NULL OR u.semestre = ANY (v_sems))
  ),
  ultima AS (
    SELECT DISTINCT ON (sf.user_id, g.pai_id) sf.user_id, g.pai_id, sf.simulado_id
    FROM public.simulados_finalizados sf
    JOIN grupo g ON g.simulado_id = sf.simulado_id
    WHERE sf.user_id IN (SELECT id FROM alunos)
    ORDER BY sf.user_id, g.pai_id, sf.finalizado_em DESC NULLS LAST
  ),
  ultima_fb AS (
    SELECT DISTINCT ON (ap.user_id, g.pai_id) ap.user_id, g.pai_id, ap.simulado AS simulado_id
    FROM public.answer_progress ap
    JOIN grupo g ON g.simulado_id = ap.simulado
    JOIN public.simulados_admin sa_ord ON sa_ord.id = ap.simulado
    WHERE ap.user_id IN (SELECT id FROM alunos)
      AND NOT EXISTS (SELECT 1 FROM ultima u WHERE u.user_id = ap.user_id AND u.pai_id = g.pai_id)
    ORDER BY ap.user_id, g.pai_id, sa_ord.created_at DESC NULLS LAST
  ),
  tentativas AS (
    SELECT * FROM ultima UNION ALL SELECT * FROM ultima_fb
  ),
  respostas AS (
    SELECT t.user_id, ap.correct, q.grande_area, q.especialidade, q.tema
    FROM tentativas t
    JOIN public.answer_progress ap ON ap.user_id = t.user_id AND ap.simulado = t.simulado_id
    JOIN public.questoes_simulado q ON q.id = ap.question_id
    WHERE COALESCE(q.anulada,false) = false
  ),
  base AS (
    SELECT CASE WHEN p_node IS NULL THEN r.grande_area ELSE r.especialidade END AS nome,
           r.user_id, r.correct
    FROM respostas r
    WHERE (p_node IS NULL AND r.grande_area IS NOT NULL)
       OR (p_node IS NOT NULL AND r.grande_area = p_node AND r.especialidade IS NOT NULL)
  ),
  agg AS (
    SELECT b.nome,
           count(*) AS total,
           count(*) FILTER (WHERE b.correct) AS acertos,
           count(DISTINCT b.user_id) AS amostra,
           round(100.0 * count(*) FILTER (WHERE b.correct) / NULLIF(count(*),0), 0) AS acerto_pct
    FROM base b GROUP BY b.nome
  ),
  nos AS (
    SELECT a.nome,
           a.acerto_pct,
           a.amostra,
           -- achado 18: classifica sobre a MESMA base arredondada que sai em
           -- `acertoPct` -- nunca sobre a razão bruta (100.0 * acertos / total).
           CASE WHEN a.total = 0 THEN NULL
                WHEN a.acerto_pct <  30 THEN 'critico'
                WHEN a.acerto_pct >= 80 THEN 'excelente'
                ELSE 'mediano' END AS desempenho,
           CASE
             WHEN p_node IS NULL THEN EXISTS (
               SELECT 1 FROM respostas r2 WHERE r2.grande_area = a.nome AND r2.especialidade IS NOT NULL)
             ELSE EXISTS (
               SELECT 1 FROM respostas r3 WHERE r3.especialidade = a.nome AND r3.tema IS NOT NULL)
           END AS tem_filhos
    FROM agg a
  )
  SELECT jsonb_build_object(
    'data', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id',         n.nome,
               'nome',       n.nome,
               'nivel',      v_nivel,
               'acertoPct',  n.acerto_pct,
               'desempenho', n.desempenho,
               'amostra',    n.amostra,
               'lowSample',  (n.amostra < 10),
               'temFilhos',  n.tem_filhos
             ) ORDER BY n.acerto_pct NULLS LAST, n.nome)
      FROM nos n), '[]'::jsonb),
    'meta', jsonb_build_object(
      'periodo',      'todos os simulados com desempenho liberado para a IES',
      'fonte',        'answer_progress · questoes_simulado · simulados_admin · users',
      'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'criterio',     format('Desempenho em %% de acerto (crítico < 30, mediano 30–80, excelente >= 80) sobre o mesmo valor arredondado exposto em acertoPct, calculado a partir da última tentativa de cada aluno, questão anulada ignorada. Nível retornado: %s. Amostra = alunos distintos com resposta no nó; lowSample quando < 10. Recorte: %s.', v_nivel, v_recorte),
      'partial',      (SELECT count(*) FROM respostas r WHERE r.grande_area IS NULL) > 0,
      'lowSample',    COALESCE((SELECT max(n.amostra) FROM nos n), 0) < 10
    )
  ) INTO v_result;

  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_gestor_diagnostico(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_diagnostico(uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- VERIFICAÇÃO (rodar manualmente em gvqv, autenticado como o usuário gestor
-- de teste -- não como service_role, senão auth.uid()/has_role não valem)
-- ---------------------------------------------------------------------------
-- 1) Readback do corpo aplicado:
--    SELECT pg_get_functiondef('public.get_gestor_diagnostico(uuid, text, text)'::regprocedure);
--
-- 2) Achado 2, em transação revertida (:ies_b = IES do grupo do gestor com
--    'gestao.portal_v2' DESLIGADA; :ies_a = IES irmã com a flag LIGADA):
--
--    BEGIN;
--      SELECT public.get_gestor_diagnostico(:ies_b::uuid, 'geral', NULL);  -- esperado: RAISE 'feature_not_enabled'
--      SELECT public.get_gestor_diagnostico(:ies_a::uuid, 'geral', NULL);  -- esperado: retorna jsonb normalmente
--    ROLLBACK;
--
-- 3) Achado 18, caso de fronteira (296 acertos em 1000 numa grande área):
--    monte, em transação revertida, um cenário com exatamente 296 acertos em
--    1000 respostas válidas de uma única grande área e confira que o nó
--    volta 'acertoPct': 30 e 'desempenho': 'mediano' -- nunca 'critico'.
--    Compare com src/features/gestor/lib/regras.ts::nivelDesempenho(30),
--    que também classifica 30 como 'mediano'.
