-- eng_pipeline: pipeline de refresh da camada eng_* (classificação, agregados e orquestração)
-- Spec: docs/superpowers/specs/2026-10-22-engajamento-sanarflix-design.md (§6.2, §6.4)

-- ============================================================
-- 1. eng_refresh_classificacao (§6.2)
-- ============================================================
CREATE OR REPLACE FUNCTION public.eng_refresh_classificacao() RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, pg_temp
AS $$
DECLARE
  v_invalidas  integer;
  v_depara_inv integer;
  v_result     jsonb;
BEGIN
  -- 1. uma linha por questão (taxonomia é estável por questão; pega a resposta mais recente)
  DROP TABLE IF EXISTS tmp_eng_q;
  CREATE TEMP TABLE tmp_eng_q ON COMMIT DROP AS
    SELECT DISTINCT ON (f.question_id) f.question_id, f.taxonomias
    FROM public.fato_resolucao_questoes_b2b f
    ORDER BY f.question_id, f.response_timestamp DESC, f.response_id DESC;
  CREATE UNIQUE INDEX ON tmp_eng_q (question_id);

  -- 2. entradas explodidas
  DROP TABLE IF EXISTS tmp_eng_ent;
  CREATE TEMP TABLE tmp_eng_ent ON COMMIT DROP AS
    SELECT q.question_id,
           t.ord::smallint                                   AS ord,
           CASE t.v->>'ciclo'
             WHEN 'Questões Ciclo Clínico e Residência Médica' THEN 'clinico'
             WHEN 'Ciclo Básico'                              THEN 'basico'
           END                                               AS ciclo,
           t.v->>'especialidade_id'                          AS n1_id,
           btrim(t.v->>'especialidade')                      AS n1_nome,
           t.v->>'subespecialidade_id'                       AS n2_id,
           btrim(t.v->>'subespecialidade')                   AS n2_nome,
           t.v->>'tema_id'                                   AS tema_id,
           btrim(t.v->>'tema')                               AS tema_nome
    FROM tmp_eng_q q
    CROSS JOIN LATERAL jsonb_array_elements(q.taxonomias) WITH ORDINALITY AS t(v, ord);

  DELETE FROM tmp_eng_ent
  WHERE ciclo IS NULL OR n1_id IS NULL OR n2_id IS NULL
     OR coalesce(n1_nome, '') = '' OR coalesce(n2_nome, '') = '';
  GET DIAGNOSTICS v_invalidas = ROW_COUNT;
  CREATE INDEX ON tmp_eng_ent (question_id);
  ANALYZE tmp_eng_ent;

  -- 3. nós (upsert; nunca apaga). Ordem: nível 1, 2, 3 (FK de pai_id)
  INSERT INTO public.eng_no_taxonomia (no_id, nivel, ciclo, nome, pai_id, sintetico)
  SELECT DISTINCT ON (n1_id) n1_id, 1, ciclo, n1_nome, NULL, false
  FROM tmp_eng_ent ORDER BY n1_id
  ON CONFLICT (no_id) DO UPDATE SET nome = EXCLUDED.nome, atualizado_em = now();

  INSERT INTO public.eng_no_taxonomia (no_id, nivel, ciclo, nome, pai_id, sintetico)
  SELECT DISTINCT ON (n2_id) n2_id, 2, ciclo, n2_nome, n1_id, false
  FROM tmp_eng_ent ORDER BY n2_id
  ON CONFLICT (no_id) DO UPDATE SET nome = EXCLUDED.nome, pai_id = EXCLUDED.pai_id, atualizado_em = now();

  INSERT INTO public.eng_no_taxonomia (no_id, nivel, ciclo, nome, pai_id, sintetico)
  SELECT DISTINCT ON (tema_id) tema_id, 3, 'clinico', tema_nome, n2_id, false
  FROM tmp_eng_ent WHERE ciclo = 'clinico' AND tema_id IS NOT NULL AND coalesce(tema_nome, '') <> ''
  ORDER BY tema_id
  ON CONFLICT (no_id) DO UPDATE SET nome = EXCLUDED.nome, pai_id = EXCLUDED.pai_id, atualizado_em = now();

  -- tema sintético (D13): mesmo nome da especialidade
  INSERT INTO public.eng_no_taxonomia (no_id, nivel, ciclo, nome, pai_id, sintetico)
  SELECT DISTINCT ON (n2_id) 'herdado:' || n2_id, 3, 'clinico', n2_nome, n2_id, true
  FROM tmp_eng_ent WHERE ciclo = 'clinico' AND (tema_id IS NULL OR coalesce(tema_nome, '') = '')
  ORDER BY n2_id
  ON CONFLICT (no_id) DO UPDATE SET nome = EXCLUDED.nome, atualizado_em = now();

  -- 4. contextos por questão (lê o JSON uma vez; agrupa o jsonb antes de explodir)
  DROP TABLE IF EXISTS tmp_eng_ctx;
  CREATE TEMP TABLE tmp_eng_ctx ON COMMIT DROP AS
    SELECT b.question_id,
           public.eng_norm_rotulo(c.v->>'quiz_especialidade') AS quiz_norm,
           public.eng_norm_texto(c.v->>'conteudo_caminho')    AS caminho_norm,
           sum(b.respostas)::int                              AS respostas
    FROM (
      SELECT f.question_id, f.contextos_candidatos, count(*) AS respostas
      FROM public.fato_resolucao_questoes_b2b f
      WHERE f.contexto_status <> 'ausente'
      GROUP BY 1, 2
    ) b
    CROSS JOIN LATERAL jsonb_array_elements(b.contextos_candidatos) AS c(v)
    GROUP BY 1, 2, 3;
  DELETE FROM tmp_eng_ctx WHERE quiz_norm IS NULL;
  CREATE INDEX ON tmp_eng_ctx (question_id, quiz_norm);
  ANALYZE tmp_eng_ctx;

  -- 5. escolha pela regra
  DROP TABLE IF EXISTS tmp_eng_escolha;
  CREATE TEMP TABLE tmp_eng_escolha ON COMMIT DROP AS
  WITH cand AS (
    SELECT e.question_id, e.ord, e.ciclo, e.n1_id, e.n2_id,
           CASE WHEN e.ciclo = 'clinico'
                THEN CASE WHEN e.tema_id IS NOT NULL AND coalesce(e.tema_nome, '') <> '' THEN e.tema_id
                          ELSE 'herdado:' || e.n2_id END
           END                                                         AS n3_id,
           (e.ciclo = 'basico' OR (e.tema_id IS NOT NULL AND coalesce(e.tema_nome, '') <> '')) AS completa,
           bool_or(c.quiz_norm IS NOT NULL)                            AS casa_quiz
    FROM tmp_eng_ent e
    LEFT JOIN tmp_eng_ctx c
      ON c.question_id = e.question_id
     AND c.quiz_norm IN (public.eng_norm_rotulo(e.n1_nome), public.eng_norm_rotulo(e.n2_nome))
    GROUP BY e.question_id, e.ord, e.ciclo, e.n1_id, e.n2_id, e.tema_id, e.tema_nome
  ),
  rk AS (
    SELECT c.*,
      count(*) OVER (PARTITION BY c.question_id)                                       AS n_cand,
      count(*) FILTER (WHERE c.completa) OVER (PARTITION BY c.question_id)             AS n_comp,
      count(*) FILTER (WHERE c.casa_quiz) OVER (PARTITION BY c.question_id, c.completa) AS n_quiz_mesmo_nivel,
      row_number() OVER (PARTITION BY c.question_id ORDER BY c.completa DESC, c.casa_quiz DESC, c.ord) AS rn
    FROM cand c
  )
  SELECT question_id, ciclo, n1_id, n2_id, n3_id, ord AS posicao, n_cand,
         CASE WHEN n_cand = 1                           THEN 'unica'
              WHEN n_comp = 1                           THEN 'completa'
              WHEN casa_quiz AND n_quiz_mesmo_nivel = 1 THEN 'quiz'
              ELSE 'primeira' END AS motivo
  FROM rk WHERE rn = 1;
  CREATE UNIQUE INDEX ON tmp_eng_escolha (question_id);

  -- 6. de-para (§6.3) para quem ficou sem escolha
  SELECT count(*) INTO v_depara_inv
  FROM public.eng_depara_quiz_no dp
  JOIN public.eng_no_taxonomia n ON n.no_id = dp.folha_id
  WHERE NOT ((n.ciclo = 'clinico' AND n.nivel = 3) OR (n.ciclo = 'basico' AND n.nivel = 2));

  DROP TABLE IF EXISTS tmp_eng_depara;
  CREATE TEMP TABLE tmp_eng_depara ON COMMIT DROP AS
  WITH sem AS (
    SELECT q.question_id FROM tmp_eng_q q
    WHERE NOT EXISTS (SELECT 1 FROM tmp_eng_escolha e WHERE e.question_id = q.question_id)
  ),
  hit AS (
    SELECT c.question_id, c.quiz_norm, c.caminho_norm, c.respostas, d.folha_id
    FROM tmp_eng_ctx c
    JOIN sem ON sem.question_id = c.question_id
    JOIN LATERAL (
      SELECT dp.folha_id
      FROM public.eng_depara_quiz_no dp
      JOIN public.eng_no_taxonomia n ON n.no_id = dp.folha_id
       AND ((n.ciclo = 'clinico' AND n.nivel = 3) OR (n.ciclo = 'basico' AND n.nivel = 2))
      WHERE dp.quiz_especialidade_norm = c.quiz_norm
        AND (dp.conteudo_caminho_norm = c.caminho_norm OR dp.conteudo_caminho_norm IS NULL)
      ORDER BY (dp.conteudo_caminho_norm IS NULL)       -- caminho exato antes do genérico
      LIMIT 1
    ) d ON true
  )
  SELECT DISTINCT ON (question_id) question_id, folha_id
  FROM hit
  ORDER BY question_id, respostas DESC, quiz_norm, caminho_norm NULLS LAST;

  -- 7. grava (rebuild)
  DELETE FROM public.eng_questao_classificacao;

  INSERT INTO public.eng_questao_classificacao
    (question_id, ciclo, n1_id, n2_id, n3_id, folha_id, esp_id, origem, motivo, n_candidatas, posicao_escolhida)
  SELECT e.question_id, e.ciclo, e.n1_id, e.n2_id, e.n3_id,
         coalesce(e.n3_id, e.n2_id),
         CASE WHEN e.ciclo = 'clinico' THEN e.n2_id ELSE e.n1_id END,
         'taxonomia', e.motivo, e.n_cand, e.posicao
  FROM tmp_eng_escolha e;

  INSERT INTO public.eng_questao_classificacao
    (question_id, ciclo, n1_id, n2_id, n3_id, folha_id, esp_id, origem, motivo, n_candidatas, posicao_escolhida)
  SELECT d.question_id, f.ciclo,
         CASE WHEN f.ciclo = 'clinico' THEN p.pai_id ELSE f.pai_id END,   -- n1
         CASE WHEN f.ciclo = 'clinico' THEN f.pai_id ELSE f.no_id  END,   -- n2
         CASE WHEN f.ciclo = 'clinico' THEN f.no_id  END,                 -- n3
         f.no_id,                                                         -- folha
         f.pai_id,                                                        -- esp: o pai da folha nos dois ciclos (clínico: especialidade; básico: disciplina)
         'depara', 'depara', 0, NULL
  FROM tmp_eng_depara d
  JOIN public.eng_no_taxonomia f ON f.no_id = d.folha_id
  LEFT JOIN public.eng_no_taxonomia p ON p.no_id = f.pai_id;

  SELECT jsonb_build_object(
    'questoes_total',          (SELECT count(*) FROM tmp_eng_q),
    'entradas_invalidas',      v_invalidas,
    'classificadas_unica',     (SELECT count(*) FROM tmp_eng_escolha WHERE motivo = 'unica'),
    'classificadas_completa',  (SELECT count(*) FROM tmp_eng_escolha WHERE motivo = 'completa'),
    'classificadas_quiz',      (SELECT count(*) FROM tmp_eng_escolha WHERE motivo = 'quiz'),
    'classificadas_primeira',  (SELECT count(*) FROM tmp_eng_escolha WHERE motivo = 'primeira'),
    'classificadas_depara',    (SELECT count(*) FROM tmp_eng_depara),
    'sem_classificacao',       (SELECT count(*) FROM tmp_eng_q) - (SELECT count(*) FROM public.eng_questao_classificacao),
    'depara_linhas',           (SELECT count(*) FROM public.eng_depara_quiz_no),
    'depara_invalidos',        v_depara_inv,
    'nos_total',               (SELECT count(*) FROM public.eng_no_taxonomia)
  ) INTO v_result;
  RETURN v_result;
END $$;

-- ============================================================
-- 2. eng_refresh_agregados e eng_refresh (§6.4)
-- ============================================================
CREATE OR REPLACE FUNCTION public.eng_refresh_agregados() RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, pg_temp
AS $$
DECLARE v_result jsonb;
BEGIN
  -- a) consumo: 1 linha por aluno × dia × conteúdo (D5); curso/módulo do 1º evento do dia
  DELETE FROM public.eng_consumo_aluno_dia_conteudo;
  INSERT INTO public.eng_consumo_aluno_dia_conteudo
    (sanarflix_user_id, dia, content_id, content_type, content_name, especialidade, modulo, aberturas, ultima_abertura)
  SELECT p.sanarflix_user_id, p.event_date, p.content_id, p.content_type,
         coalesce(nullif(btrim(p.content_name), ''), 'Conteúdo sem título'),
         coalesce(public.eng_rotulo_curso(p.course_name), 'Outros conteúdos'),
         coalesce(nullif(btrim(regexp_replace(coalesce(p.module_name, ''), '\s+', ' ', 'g')), ''), 'Materiais gerais'),
         g.aberturas, g.ultima
  FROM (
    SELECT DISTINCT ON (f.sanarflix_user_id, f.event_date, f.content_id)
           f.sanarflix_user_id, f.event_date, f.content_id, f.content_type, f.content_name, f.course_name, f.module_name
    FROM public.fato_consumo_conteudo_b2b f
    ORDER BY f.sanarflix_user_id, f.event_date, f.content_id, f.event_timestamp, f.event_key
  ) p
  JOIN (
    SELECT f.sanarflix_user_id, f.event_date, f.content_id, count(*)::int AS aberturas, max(f.event_timestamp) AS ultima
    FROM public.fato_consumo_conteudo_b2b f
    GROUP BY 1, 2, 3
  ) g USING (sanarflix_user_id, event_date, content_id);

  -- b) questões classificadas por aluno × dia × folha
  DELETE FROM public.eng_questoes_aluno_dia_no;
  INSERT INTO public.eng_questoes_aluno_dia_no
    (sanarflix_user_id, dia, folha_id, ciclo, n1_id, n2_id, n3_id, esp_id, questoes, acertos, erros)
  SELECT f.sanarflix_user_id, f.response_date, c.folha_id, c.ciclo, c.n1_id, c.n2_id, c.n3_id, c.esp_id,
         count(*)::int,
         count(*) FILTER (WHERE f.acertou IS TRUE)::int,
         count(*) FILTER (WHERE f.acertou IS FALSE)::int
  FROM public.fato_resolucao_questoes_b2b f
  JOIN public.eng_questao_classificacao c ON c.question_id = f.question_id
  GROUP BY 1, 2, 3, 4, 5, 6, 7, 8;

  -- c) atividade por aluno × dia (união das duas fontes, D4)
  DELETE FROM public.eng_atividade_aluno_dia;
  INSERT INTO public.eng_atividade_aluno_dia
    (sanarflix_user_id, dia, respostas_todas, questoes, acertos, erros, videos, documentos)
  SELECT u.sanarflix_user_id, u.dia,
         sum(u.rt)::int, sum(u.q)::int, sum(u.ac)::int, sum(u.er)::int, sum(u.vi)::int, sum(u.dc)::int
  FROM (
    SELECT f.sanarflix_user_id, f.response_date AS dia, count(*) AS rt, 0 AS q, 0 AS ac, 0 AS er, 0 AS vi, 0 AS dc
    FROM public.fato_resolucao_questoes_b2b f
    GROUP BY 1, 2
    UNION ALL
    SELECT x.sanarflix_user_id, x.dia, 0, sum(x.questoes), sum(x.acertos), sum(x.erros), 0, 0
    FROM public.eng_questoes_aluno_dia_no x
    GROUP BY 1, 2
    UNION ALL
    SELECT k.sanarflix_user_id, k.dia, 0, 0, 0, 0,
           count(*) FILTER (WHERE k.content_type = 'video'),
           count(*) FILTER (WHERE k.content_type = 'document')
    FROM public.eng_consumo_aluno_dia_conteudo k
    GROUP BY 1, 2
  ) u
  GROUP BY 1, 2;

  SELECT jsonb_build_object(
    'consumo_linhas',      (SELECT count(*) FROM public.eng_consumo_aluno_dia_conteudo),
    'questoes_no_linhas',  (SELECT count(*) FROM public.eng_questoes_aluno_dia_no),
    'atividade_linhas',    (SELECT count(*) FROM public.eng_atividade_aluno_dia),
    'fonte_max_resposta',  (SELECT max(response_date) FROM public.fato_resolucao_questoes_b2b),
    'fonte_max_consumo',   (SELECT max(event_date) FROM public.fato_consumo_conteudo_b2b),
    'dim_snapshot',        (SELECT max(snapshot_date) FROM public.dim_aluno_b2b)
  ) INTO v_result;
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.eng_refresh(p_disparo text DEFAULT 'manual') RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, pg_temp
AS $$
DECLARE
  v_log bigint;
  v_c   jsonb;
  v_a   jsonb;
BEGIN
  IF p_disparo NOT IN ('cron', 'manual') THEN
    RAISE EXCEPTION 'disparo_invalido' USING ERRCODE = '22023';
  END IF;
  IF NOT pg_try_advisory_xact_lock(hashtext('eng_refresh')) THEN
    RAISE EXCEPTION 'eng_refresh_ja_em_execucao';
  END IF;

  INSERT INTO public.eng_refresh_log (status, disparo) VALUES ('rodando', p_disparo) RETURNING id INTO v_log;

  BEGIN
    v_c := public.eng_refresh_classificacao();
    v_a := public.eng_refresh_agregados();
    UPDATE public.eng_refresh_log
       SET status = 'ok', terminado_em = clock_timestamp(), contagens = v_c || v_a
     WHERE id = v_log;
  EXCEPTION WHEN OTHERS THEN
    -- desfaz só o bloco (as tabelas eng_* voltam ao estado anterior); o log registra o erro
    UPDATE public.eng_refresh_log
       SET status = 'erro', terminado_em = clock_timestamp(), erro = SQLSTATE || ': ' || SQLERRM
     WHERE id = v_log;
  END;

  RETURN (SELECT to_jsonb(l) FROM public.eng_refresh_log l WHERE l.id = v_log);
END $$;

-- ============================================================
-- 3. Grants: só o dono (postgres), o cron e o SQL Editor/MCP executam
-- ============================================================
REVOKE ALL ON FUNCTION public.eng_refresh_classificacao(), public.eng_refresh_agregados(), public.eng_refresh(text) FROM PUBLIC, anon, authenticated;
