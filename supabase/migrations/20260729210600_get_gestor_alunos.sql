-- 20260729210600_get_gestor_alunos.sql
-- Fase 1 / Task 20 do Portal do Gestor v2.
-- Tabela de alunos paginada NO SERVIDOR (§5.1: "o front nunca soma base bruta").
-- Uma IES grande pode ter milhares de alunos; paginar no cliente desperdicaria
-- banda e exporia mais dado nominal do que a tela mostra. Tambem e o unico jeito
-- de ordenar por coluna calculada (tendencia).
--
-- `proficiencias` tem UM SLOT POR SIMULADO com TRI da janela, em ordem
-- cronologica, com null onde o aluno nao participou -- nunca 0 (§4.10). O teto
-- de 100 em p_page_size nao pode ser removido: sem ele a paginacao e burlavel.
CREATE OR REPLACE FUNCTION public.get_gestor_alunos(
  p_ies_id    uuid,
  p_semestre  text,
  p_page      int,
  p_page_size int,
  p_sort      text,
  p_order     text,
  p_q         text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid     uuid := auth.uid();
  v_ies     uuid;
  v_sems    int[];
  v_recorte text;
  v_sort    text;
  v_order   text;
  v_page    int;
  v_size    int;
  v_q       text;
  v_result  jsonb;
BEGIN
  IF NOT public.user_has_feature('gestao.portal_v2') THEN
    RAISE EXCEPTION 'feature_not_enabled' USING ERRCODE = '42501';
  END IF;

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

  IF p_semestre IS NULL OR p_semestre = 'geral' THEN
    v_sems := NULL; v_recorte := 'todos os semestres, sem evidência';
  ELSIF p_semestre = '6ano' THEN
    v_sems := NULL; v_recorte := 'todos os semestres, 11º e 12º em evidência';
  ELSIF p_semestre ~ '^(1[0-2]|[1-9])$' THEN
    v_sems := ARRAY[p_semestre::int]; v_recorte := format('somente o %sº semestre', p_semestre);
  ELSE
    RAISE EXCEPTION 'semestre_invalido' USING ERRCODE = '22023';
  END IF;

  v_sort  := lower(COALESCE(NULLIF(btrim(p_sort),''),  'nome'));
  v_order := lower(COALESCE(NULLIF(btrim(p_order),''), 'asc'));
  IF v_sort  NOT IN ('nome','semestre','proficiencia','tendencia') THEN
    RAISE EXCEPTION 'sort_invalido' USING ERRCODE = '22023';
  END IF;
  IF v_order NOT IN ('asc','desc') THEN
    RAISE EXCEPTION 'order_invalido' USING ERRCODE = '22023';
  END IF;
  v_page := GREATEST(COALESCE(p_page, 1), 1);
  v_size := LEAST(GREATEST(COALESCE(p_page_size, 25), 1), 100);
  v_q    := NULLIF(btrim(COALESCE(p_q,'')), '');

  WITH sims AS (
    SELECT sa.id, sa.nome,
           COALESCE(sa.data_realizacao, sa.data_encerramento, sa.data_liberacao, sa.created_at) AS data_ref
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
  sims_ord AS (
    SELECT s.*, row_number() OVER (ORDER BY s.data_ref NULLS LAST, s.nome) AS ord
    FROM sims s
  ),
  alunos AS (
    SELECT u.id, u.nome, u.semestre
    FROM public.users u
    WHERE u.id_ies = v_ies
      AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
      AND (v_sems IS NULL OR u.semestre = ANY (v_sems))
      AND (v_q IS NULL OR u.nome ILIKE '%' || v_q || '%')
  ),
  tri AS (
    SELECT COALESCE(sa.simulado_pai_id, sa.id) AS pai_id, r.student_id, r.score_proprio
    FROM public.resultados_alunos_tri r
    JOIN public.simulados_admin sa ON sa.id = r.simulado_id
    WHERE r.college_id = v_ies
      AND COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims)
      AND r.score_proprio IS NOT NULL
  ),
  sims_com_tri AS (
    SELECT s.* FROM sims_ord s WHERE EXISTS (SELECT 1 FROM tri t WHERE t.pai_id = s.id)
  ),
  aluno_sim AS (
    SELECT a.id, s.ord,
           (SELECT avg(t.score_proprio) FROM tri t WHERE t.student_id = a.id AND t.pai_id = s.id) AS score
    FROM alunos a
    CROSS JOIN sims_com_tri s
  ),
  diffs AS (
    SELECT d.id, d.diff
    FROM (
      SELECT s.id, s.score - lag(s.score) OVER (PARTITION BY s.id ORDER BY s.ord) AS diff
      FROM aluno_sim s WHERE s.score IS NOT NULL
    ) d
    WHERE d.diff IS NOT NULL
  ),
  tend AS (
    SELECT x.id,
           CASE WHEN x.max_d <  1 AND x.min_d > -1 THEN 'estavel'
                WHEN x.min_d >=  1                 THEN 'subindo'
                WHEN x.max_d <= -1                 THEN 'descendo'
                ELSE 'alternando' END AS tendencia
    FROM (SELECT d.id, min(d.diff) AS min_d, max(d.diff) AS max_d FROM diffs d GROUP BY d.id) x
  ),
  agg AS (
    SELECT a.id, a.nome, a.semestre,
           COALESCE((
             SELECT jsonb_agg(CASE WHEN s.score IS NULL THEN 'null'::jsonb
                                   ELSE to_jsonb(round(s.score::numeric, 1)) END ORDER BY s.ord)
             FROM aluno_sim s WHERE s.id = a.id), '[]'::jsonb) AS proficiencias,
           (SELECT count(*) FROM aluno_sim s WHERE s.id = a.id AND s.score IS NOT NULL) AS n_com,
           (SELECT count(*) FROM aluno_sim s WHERE s.id = a.id AND s.score >= 60)       AS n_prof,
           (SELECT s.score FROM aluno_sim s WHERE s.id = a.id AND s.score IS NOT NULL
             ORDER BY s.ord DESC LIMIT 1)                                               AS prof_atual,
           COALESCE((SELECT t.tendencia FROM tend t WHERE t.id = a.id), 'estavel')      AS tendencia
    FROM alunos a
  ),
  linhas AS (
    SELECT g.*,
           CASE WHEN g.n_com = 0                 THEN 'em_variacao'
                WHEN g.n_prof = g.n_com          THEN 'consistentemente_proficiente'
                WHEN g.n_prof = 0                THEN 'consistentemente_nao_proficiente'
                ELSE 'em_variacao' END AS grupo
    FROM agg g
  ),
  ordenado AS (
    SELECT l.*, row_number() OVER (
             ORDER BY
               CASE WHEN v_sort='semestre'     AND v_order='asc'  THEN l.semestre    END ASC  NULLS LAST,
               CASE WHEN v_sort='semestre'     AND v_order='desc' THEN l.semestre    END DESC NULLS LAST,
               CASE WHEN v_sort='proficiencia' AND v_order='asc'  THEN l.prof_atual  END ASC  NULLS LAST,
               CASE WHEN v_sort='proficiencia' AND v_order='desc' THEN l.prof_atual  END DESC NULLS LAST,
               CASE WHEN v_sort='tendencia'    AND v_order='asc'  THEN l.tendencia   END ASC,
               CASE WHEN v_sort='tendencia'    AND v_order='desc' THEN l.tendencia   END DESC,
               CASE WHEN v_sort='nome'         AND v_order='desc' THEN l.nome        END DESC,
               l.nome ASC
           ) AS rn
    FROM linhas l
  ),
  totais AS (SELECT count(*) AS total FROM linhas)
  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'data', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'id',            o.id,
                 'nome',          o.nome,
                 'semestre',      o.semestre,
                 'grupo',         o.grupo,
                 'proficiencias', o.proficiencias,
                 'tendencia',     o.tendencia
               ) ORDER BY o.rn)
        FROM ordenado o
        WHERE o.rn > (v_page - 1) * v_size AND o.rn <= v_page * v_size), '[]'::jsonb),
      'page',       v_page,
      'pageSize',   v_size,
      'total',      (SELECT total FROM totais),
      'totalPages', CASE WHEN (SELECT total FROM totais) = 0 THEN 0
                         ELSE ceil((SELECT total FROM totais)::numeric / v_size)::int END
    ),
    'meta', jsonb_build_object(
      'periodo',      COALESCE((SELECT to_char(min(s.data_ref),'DD/MM/YYYY') || ' — ' || to_char(max(s.data_ref),'DD/MM/YYYY')
                                FROM sims_com_tri s), 'sem simulado com resultado'),
      'fonte',        'resultados_alunos_tri · simulados_admin · users',
      'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'criterio',     format('Uma posição em proficiencias por simulado com TRI na janela, em ordem cronológica; null onde o aluno não participou (nunca 0). Grupo: todas proficientes (>= 60) = consistentemente_proficiente; nenhuma = consistentemente_nao_proficiente; misto ou sem resultado = em_variacao. Tendência sobre variações consecutivas: todas >= +1 subindo, todas <= -1 descendo, |variação| < 1 estável, senão alternando. Ordenação: %s %s. Recorte: %s.', v_sort, v_order, v_recorte),
      'partial',      (SELECT count(*) FROM sims_ord) > (SELECT count(*) FROM sims_com_tri),
      'lowSample',    (SELECT total FROM totais) < 10
    )
  ) INTO v_result;

  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_gestor_alunos(uuid, text, int, int, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_alunos(uuid, text, int, int, text, text, text) TO authenticated;
