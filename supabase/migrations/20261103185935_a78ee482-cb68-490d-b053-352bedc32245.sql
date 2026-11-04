DO $mig$
DECLARE d text; o text;
BEGIN
  d := pg_get_functiondef('public.get_gestor_visao_geral(uuid,text)'::regprocedure);
  o := d; d := replace(d, $o0$  ultima_fb AS (
    SELECT DISTINCT ON (ap.user_id, g.pai_id) ap.user_id, g.pai_id, ap.simulado AS simulado_id
    FROM public.answer_progress ap
    JOIN grupo g ON g.simulado_id = ap.simulado
    JOIN (SELECT * FROM public.simulados_admin WHERE type = 'simulado_enamed' AND NOT prova_oficial) sa_ord ON sa_ord.id = ap.simulado
    WHERE ap.user_id IN (SELECT id FROM alunos)
      AND NOT EXISTS (SELECT 1 FROM ultima u WHERE u.user_id = ap.user_id AND u.pai_id = g.pai_id)
    ORDER BY ap.user_id, g.pai_id, sa_ord.created_at DESC NULLS LAST
  ),
$o0$, $n0$  -- perf: uma sondagem por (aluno, simulado) no indice (user_id, simulado),
  -- em vez de ler/ordenar todas as respostas da IES.
  ultima_fb AS (
    SELECT a.id AS user_id, gp.pai_id, x.simulado_id
    FROM alunos a
    CROSS JOIN (SELECT DISTINCT pai_id FROM grupo) gp
    CROSS JOIN LATERAL (
      SELECT g2.simulado_id
      FROM grupo g2
      JOIN public.simulados_admin sa_ord ON sa_ord.id = g2.simulado_id
      CROSS JOIN LATERAL (SELECT 1 FROM public.answer_progress ap
                          WHERE ap.user_id = a.id AND ap.simulado = g2.simulado_id LIMIT 1) hit
      WHERE g2.pai_id = gp.pai_id
      ORDER BY sa_ord.created_at DESC NULLS LAST
      LIMIT 1
    ) x
    WHERE NOT EXISTS (SELECT 1 FROM ultima u WHERE u.user_id = a.id AND u.pai_id = gp.pai_id)
  ),
$n0$);
  IF d = o THEN RAISE EXCEPTION 'trecho % nao encontrado', 0; END IF;
  o := d; d := replace(d, $o1$      SELECT g.pai_id, ap.user_id
      FROM public.answer_progress ap
      JOIN kpi_grupo g ON g.simulado_id = ap.simulado
      WHERE ap.user_id IN (SELECT id FROM kpi_alunos)
$o1$, $n1$      SELECT g.pai_id, a.id AS user_id
      FROM kpi_alunos a
      CROSS JOIN kpi_grupo g
      CROSS JOIN LATERAL (SELECT 1 FROM public.answer_progress ap
                          WHERE ap.user_id = a.id AND ap.simulado = g.simulado_id LIMIT 1) hit
$n1$);
  IF d = o THEN RAISE EXCEPTION 'trecho % nao encontrado', 1; END IF;
  o := d; d := replace(d, $o2$           (SELECT count(DISTINCT r.user_id)    FROM respostas r WHERE r.pai_id = s.id)        AS n_resp,
           (SELECT count(*) FILTER (WHERE r.correct) FROM respostas r WHERE r.pai_id = s.id)   AS acertos,
           (SELECT count(*)                     FROM respostas r WHERE r.pai_id = s.id)        AS total
$o2$, $n2$           COALESCE((SELECT rs.n_resp  FROM resp_sim rs WHERE rs.pai_id = s.id), 0) AS n_resp,
           COALESCE((SELECT rs.acertos FROM resp_sim rs WHERE rs.pai_id = s.id), 0) AS acertos,
           COALESCE((SELECT rs.total   FROM resp_sim rs WHERE rs.pai_id = s.id), 0) AS total
$n2$);
  IF d = o THEN RAISE EXCEPTION 'trecho % nao encontrado', 2; END IF;
  o := d; d := replace(d, $o3$           (SELECT count(DISTINCT r2.user_id) FROM respostas r2 WHERE r2.grande_area = a.area) AS amostra
$o3$, $n3$           COALESCE((SELECT am.n FROM area_amostra am WHERE am.area = a.area), 0) AS amostra
$n3$);
  IF d = o THEN RAISE EXCEPTION 'trecho % nao encontrado', 3; END IF;
  o := d; d := replace(d, $o4$  por_sim AS ($o4$, $n4$  resp_sim AS (
    SELECT r.pai_id, count(DISTINCT r.user_id) AS n_resp,
           count(*) FILTER (WHERE r.correct) AS acertos, count(*) AS total
    FROM respostas r GROUP BY r.pai_id
  ),
  por_sim AS ($n4$);
  IF d = o THEN RAISE EXCEPTION 'trecho % nao encontrado', 4; END IF;
  o := d; d := replace(d, $o5$  areas_tot AS ($o5$, $n5$  area_amostra AS (
    SELECT r.grande_area AS area, count(DISTINCT r.user_id) AS n
    FROM respostas r WHERE r.grande_area IS NOT NULL GROUP BY r.grande_area
  ),
  areas_tot AS ($n5$);
  IF d = o THEN RAISE EXCEPTION 'trecho % nao encontrado', 5; END IF;
  EXECUTE d;
END
$mig$;