-- eng_incremental_fase3_leitura_unica: o incremental lê a janela de respostas uma vez só
-- Spec: docs/superpowers/specs/2026-10-28-engajamento-refresh-incremental-design.md (§5.2: "montar w_resp antes do passo 4
-- e passar uma flag para agregados não recriá-la"; P1 e P2 continuam valendo).
--
-- Medido na Fase 3: cada execução do incremental lia a janela de fato_resolucao_questoes_b2b duas vezes
-- (a busca de questões novas e o w_resp dos agregados), ~7,2 mil blocos por varredura. Agora:
--   - eng_monta_w_resp(p_desde) monta w_resp (a mesma leitura estreita de antes);
--   - eng_refresh_incremental monta w_resp, tira as questões novas dele e deixa eng_refresh_agregados reaproveitar;
--   - eng_refresh_agregados reaproveita só se a janela bate (eng.w_resp_desde) e consome a marca, então o
--     rebuild total e qualquer outra chamada continuam lendo a fonte do zero.

-- ============================================================
-- 1. eng_monta_w_resp: a leitura estreita da fonte de respostas (P2)
-- ============================================================
CREATE OR REPLACE FUNCTION public.eng_monta_w_resp(p_desde date DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SET search_path = public, pg_temp
AS $$
BEGIN
  DROP TABLE IF EXISTS w_resp;
  CREATE TEMP TABLE w_resp ON COMMIT DROP AS
    SELECT sanarflix_user_id, response_date, question_id, acertou, taxonomia_status, carregado_em
    FROM public.fato_resolucao_questoes_b2b
    WHERE p_desde IS NULL OR response_date >= p_desde;
  ANALYZE w_resp;
  PERFORM set_config('eng.w_resp_desde', coalesce(p_desde::text, 'tudo'), true);
END $$;

-- ============================================================
-- 2. eng_refresh_agregados: reaproveita o w_resp montado para a mesma janela
-- ============================================================
CREATE OR REPLACE FUNCTION public.eng_refresh_agregados(p_desde date DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, pg_temp
AS $$
DECLARE
  v_corte   date := public.eng_hoje() - 3;      -- fronteira da janela quente: o que muda antes dela é deriva
  v_n_cons  integer;
  v_n_qn    integer;
  v_n_ativ  integer;
  v_c_ins integer; v_c_upd integer; v_c_del integer; v_c_der integer;
  v_q_ins integer; v_q_upd integer; v_q_del integer; v_q_der integer;
  v_a_ins integer; v_a_upd integer; v_a_del integer; v_a_der integer;
  v_dim     date;
  v_result  jsonb;
BEGIN
  -- 1. leitura única da fonte (todos os agregados veem o mesmo snapshot)
  -- w_resp: o incremental já monta (eng_monta_w_resp) para ler a janela uma vez só; sem isso, monta aqui
  IF to_regclass('pg_temp.w_resp') IS NULL
     OR current_setting('eng.w_resp_desde', true) IS DISTINCT FROM coalesce(p_desde::text, 'tudo') THEN
    PERFORM public.eng_monta_w_resp(p_desde);
  END IF;
  PERFORM set_config('eng.w_resp_desde', '', true);   -- consumido: outra chamada na mesma transação lê de novo

  DROP TABLE IF EXISTS w_cons;
  CREATE TEMP TABLE w_cons ON COMMIT DROP AS
    SELECT sanarflix_user_id, event_date, content_id, content_type, content_name, course_name, module_name,
           event_timestamp, event_key, carregado_em
    FROM public.fato_consumo_conteudo_b2b
    WHERE p_desde IS NULL OR event_date >= p_desde;
  ANALYZE w_cons;

  -- 2a. consumo: 1 linha por aluno × dia × conteúdo (D5); curso/módulo do 1º evento do dia
  DROP TABLE IF EXISTS tmp_novo_cons;
  CREATE TEMP TABLE tmp_novo_cons ON COMMIT DROP AS
    SELECT DISTINCT ON (c.sanarflix_user_id, c.event_date, c.content_id)
           c.sanarflix_user_id, c.event_date AS dia, c.content_id, c.content_type,
           coalesce(nullif(btrim(c.content_name), ''), 'Conteúdo sem título')                                    AS content_name,
           coalesce(public.eng_rotulo_curso(c.course_name), 'Outros conteúdos')                                  AS especialidade,
           coalesce(nullif(btrim(regexp_replace(coalesce(c.module_name, ''), '\s+', ' ', 'g')), ''), 'Materiais gerais') AS modulo,
           (count(*) OVER w)::int                                                                                AS aberturas,
           max(c.event_timestamp) OVER w                                                                         AS ultima_abertura
    FROM w_cons c
    WINDOW w AS (PARTITION BY c.sanarflix_user_id, c.event_date, c.content_id)
    ORDER BY c.sanarflix_user_id, c.event_date, c.content_id, c.event_timestamp, c.event_key;
  GET DIAGNOSTICS v_n_cons = ROW_COUNT;
  CREATE UNIQUE INDEX ON tmp_novo_cons (sanarflix_user_id, dia, content_id);

  WITH d AS (
    DELETE FROM public.eng_consumo_aluno_dia_conteudo t
    WHERE (p_desde IS NULL OR t.dia >= p_desde)
      AND NOT EXISTS (SELECT 1 FROM tmp_novo_cons n
                      WHERE (n.sanarflix_user_id, n.dia, n.content_id) = (t.sanarflix_user_id, t.dia, t.content_id))
    RETURNING t.dia
  )
  SELECT count(*), count(*) FILTER (WHERE dia < v_corte) INTO v_c_del, v_c_der FROM d;

  WITH i AS (
    INSERT INTO public.eng_consumo_aluno_dia_conteudo AS t
      (sanarflix_user_id, dia, content_id, content_type, content_name, especialidade, modulo, aberturas, ultima_abertura)
    SELECT n.sanarflix_user_id, n.dia, n.content_id, n.content_type, n.content_name, n.especialidade, n.modulo,
           n.aberturas, n.ultima_abertura
    FROM tmp_novo_cons n
    ON CONFLICT (sanarflix_user_id, dia, content_id) DO UPDATE
       SET content_type = EXCLUDED.content_type, content_name = EXCLUDED.content_name,
           especialidade = EXCLUDED.especialidade, modulo = EXCLUDED.modulo,
           aberturas = EXCLUDED.aberturas, ultima_abertura = EXCLUDED.ultima_abertura
     WHERE (t.content_type, t.content_name, t.especialidade, t.modulo, t.aberturas, t.ultima_abertura)
           IS DISTINCT FROM (EXCLUDED.content_type, EXCLUDED.content_name, EXCLUDED.especialidade,
                             EXCLUDED.modulo, EXCLUDED.aberturas, EXCLUDED.ultima_abertura)
    RETURNING t.dia, (xmax = 0) AS inserida
  )
  SELECT count(*) FILTER (WHERE inserida), count(*) FILTER (WHERE NOT inserida),
         v_c_der + count(*) FILTER (WHERE dia < v_corte)
    INTO v_c_ins, v_c_upd, v_c_der FROM i;

  -- 2b. questões classificadas por aluno × dia × folha
  DROP TABLE IF EXISTS tmp_novo_qn;
  CREATE TEMP TABLE tmp_novo_qn ON COMMIT DROP AS
    SELECT f.sanarflix_user_id, f.response_date AS dia, c.folha_id, c.ciclo, c.n1_id, c.n2_id, c.n3_id, c.esp_id,
           count(*)::int                                  AS questoes,
           (count(*) FILTER (WHERE f.acertou IS TRUE))::int  AS acertos,
           (count(*) FILTER (WHERE f.acertou IS FALSE))::int AS erros
    FROM w_resp f
    JOIN public.eng_questao_classificacao c ON c.question_id = f.question_id
    GROUP BY 1, 2, 3, 4, 5, 6, 7, 8;
  GET DIAGNOSTICS v_n_qn = ROW_COUNT;
  CREATE UNIQUE INDEX ON tmp_novo_qn (sanarflix_user_id, dia, folha_id);

  WITH d AS (
    DELETE FROM public.eng_questoes_aluno_dia_no t
    WHERE (p_desde IS NULL OR t.dia >= p_desde)
      AND NOT EXISTS (SELECT 1 FROM tmp_novo_qn n
                      WHERE (n.sanarflix_user_id, n.dia, n.folha_id) = (t.sanarflix_user_id, t.dia, t.folha_id))
    RETURNING t.dia
  )
  SELECT count(*), count(*) FILTER (WHERE dia < v_corte) INTO v_q_del, v_q_der FROM d;

  WITH i AS (
    INSERT INTO public.eng_questoes_aluno_dia_no AS t
      (sanarflix_user_id, dia, folha_id, ciclo, n1_id, n2_id, n3_id, esp_id, questoes, acertos, erros)
    SELECT n.sanarflix_user_id, n.dia, n.folha_id, n.ciclo, n.n1_id, n.n2_id, n.n3_id, n.esp_id,
           n.questoes, n.acertos, n.erros
    FROM tmp_novo_qn n
    ON CONFLICT (sanarflix_user_id, dia, folha_id) DO UPDATE
       SET ciclo = EXCLUDED.ciclo, n1_id = EXCLUDED.n1_id, n2_id = EXCLUDED.n2_id, n3_id = EXCLUDED.n3_id,
           esp_id = EXCLUDED.esp_id, questoes = EXCLUDED.questoes, acertos = EXCLUDED.acertos, erros = EXCLUDED.erros
     WHERE (t.ciclo, t.n1_id, t.n2_id, t.n3_id, t.esp_id, t.questoes, t.acertos, t.erros)
           IS DISTINCT FROM (EXCLUDED.ciclo, EXCLUDED.n1_id, EXCLUDED.n2_id, EXCLUDED.n3_id, EXCLUDED.esp_id,
                             EXCLUDED.questoes, EXCLUDED.acertos, EXCLUDED.erros)
    RETURNING t.dia, (xmax = 0) AS inserida
  )
  SELECT count(*) FILTER (WHERE inserida), count(*) FILTER (WHERE NOT inserida),
         v_q_der + count(*) FILTER (WHERE dia < v_corte)
    INTO v_q_ins, v_q_upd, v_q_der FROM i;

  -- 2c. atividade por aluno × dia (união das duas fontes, D4). Por último: lê w_resp e as duas tabelas já gravadas.
  DROP TABLE IF EXISTS tmp_novo_ativ;
  CREATE TEMP TABLE tmp_novo_ativ ON COMMIT DROP AS
    SELECT u.sanarflix_user_id, u.dia,
           sum(u.rt)::int AS respostas_todas, sum(u.q)::int AS questoes, sum(u.ac)::int AS acertos,
           sum(u.er)::int AS erros, sum(u.vi)::int AS videos, sum(u.dc)::int AS documentos
    FROM (
      SELECT r.sanarflix_user_id, r.response_date AS dia, count(*) AS rt, 0 AS q, 0 AS ac, 0 AS er, 0 AS vi, 0 AS dc
      FROM w_resp r
      GROUP BY 1, 2
      UNION ALL
      SELECT x.sanarflix_user_id, x.dia, 0, sum(x.questoes), sum(x.acertos), sum(x.erros), 0, 0
      FROM public.eng_questoes_aluno_dia_no x
      WHERE p_desde IS NULL OR x.dia >= p_desde
      GROUP BY 1, 2
      UNION ALL
      SELECT k.sanarflix_user_id, k.dia, 0, 0, 0, 0,
             count(*) FILTER (WHERE k.content_type = 'video'),
             count(*) FILTER (WHERE k.content_type = 'document')
      FROM public.eng_consumo_aluno_dia_conteudo k
      WHERE p_desde IS NULL OR k.dia >= p_desde
      GROUP BY 1, 2
    ) u
    GROUP BY 1, 2;
  GET DIAGNOSTICS v_n_ativ = ROW_COUNT;
  CREATE UNIQUE INDEX ON tmp_novo_ativ (sanarflix_user_id, dia);

  WITH d AS (
    DELETE FROM public.eng_atividade_aluno_dia t
    WHERE (p_desde IS NULL OR t.dia >= p_desde)
      AND NOT EXISTS (SELECT 1 FROM tmp_novo_ativ n
                      WHERE (n.sanarflix_user_id, n.dia) = (t.sanarflix_user_id, t.dia))
    RETURNING t.dia
  )
  SELECT count(*), count(*) FILTER (WHERE dia < v_corte) INTO v_a_del, v_a_der FROM d;

  WITH i AS (
    INSERT INTO public.eng_atividade_aluno_dia AS t
      (sanarflix_user_id, dia, respostas_todas, questoes, acertos, erros, videos, documentos)
    SELECT n.sanarflix_user_id, n.dia, n.respostas_todas, n.questoes, n.acertos, n.erros, n.videos, n.documentos
    FROM tmp_novo_ativ n
    ON CONFLICT (sanarflix_user_id, dia) DO UPDATE
       SET respostas_todas = EXCLUDED.respostas_todas, questoes = EXCLUDED.questoes, acertos = EXCLUDED.acertos,
           erros = EXCLUDED.erros, videos = EXCLUDED.videos, documentos = EXCLUDED.documentos
     WHERE (t.respostas_todas, t.questoes, t.acertos, t.erros, t.videos, t.documentos)
           IS DISTINCT FROM (EXCLUDED.respostas_todas, EXCLUDED.questoes, EXCLUDED.acertos, EXCLUDED.erros,
                             EXCLUDED.videos, EXCLUDED.documentos)
    RETURNING t.dia, (xmax = 0) AS inserida
  )
  SELECT count(*) FILTER (WHERE inserida), count(*) FILTER (WHERE NOT inserida),
         v_a_der + count(*) FILTER (WHERE dia < v_corte)
    INTO v_a_ins, v_a_upd, v_a_der FROM i;

  -- P6: dim_aluno_b2b só é lida no rebuild total. Fica num IF (e não num CASE dentro do SELECT abaixo)
  -- porque o plpgsql só planeja, e portanto só trava a relação, o ramo que executa.
  IF p_desde IS NULL THEN
    SELECT max(snapshot_date) INTO v_dim FROM public.dim_aluno_b2b;
  END IF;

  SELECT jsonb_build_object(
    'consumo_linhas',       v_n_cons,
    'questoes_no_linhas',   v_n_qn,
    'atividade_linhas',     v_n_ativ,
    'consumo_inseridas',    v_c_ins, 'consumo_atualizadas',    v_c_upd, 'consumo_removidas',    v_c_del, 'consumo_deriva',    v_c_der,
    'questoes_no_inseridas', v_q_ins, 'questoes_no_atualizadas', v_q_upd, 'questoes_no_removidas', v_q_del, 'questoes_no_deriva', v_q_der,
    'atividade_inseridas',  v_a_ins, 'atividade_atualizadas',  v_a_upd, 'atividade_removidas',  v_a_del, 'atividade_deriva',  v_a_der,
    'fonte_max_resposta',   (SELECT max(response_date) FROM w_resp),
    'fonte_max_consumo',    (SELECT max(event_date) FROM w_cons),
    'fonte_carregado_resp', (SELECT max(carregado_em) FROM w_resp),
    'fonte_carregado_cons', (SELECT max(carregado_em) FROM w_cons),
    'dim_snapshot',         v_dim
  ) INTO v_result;
  RETURN v_result;
END $$;

-- ============================================================
-- 3. eng_refresh_incremental: busca as questões novas no w_resp
-- ============================================================
CREATE OR REPLACE FUNCTION public.eng_refresh_incremental() RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, pg_temp
AS $$
DECLARE
  v_log           bigint;
  v_disparo       text;
  v_desde         date;
  v_ult_ini       timestamptz;
  v_novas         text[];
  v_classificadas text[];
  v_c             jsonb := '{}'::jsonb;
  v_d             jsonb := '{}'::jsonb;
  v_a             jsonb;
BEGIN
  v_disparo := CASE WHEN current_setting('application_name', true) = 'pg_cron' THEN 'cron' ELSE 'manual' END;

  -- P4: o rebuild total segura o lock por minutos; o incremental não espera, registra e sai
  IF NOT pg_try_advisory_xact_lock(hashtext('eng_refresh')) THEN
    INSERT INTO public.eng_refresh_log (status, disparo, tipo, terminado_em)
    VALUES ('pulado', v_disparo, 'incremental', clock_timestamp())
    RETURNING id INTO v_log;
    RETURN (SELECT to_jsonb(l) FROM public.eng_refresh_log l WHERE l.id = v_log);
  END IF;

  INSERT INTO public.eng_refresh_log (status, disparo, tipo) VALUES ('rodando', v_disparo, 'incremental') RETURNING id INTO v_log;

  BEGIN
    v_desde := public.eng_hoje() - 3;

    SELECT max(iniciado_em) INTO v_ult_ini
    FROM public.eng_refresh_log WHERE tipo = 'incremental' AND status = 'ok';

    -- questões da janela sem classificação que têm como serem classificadas agora:
    -- taxonomia presente, ou de-para existente e resposta carregada desde o último incremental ok
    -- a janela é lida uma vez (w_resp); as questões novas e os agregados saem dela
    PERFORM public.eng_monta_w_resp(v_desde);

    SELECT array_agg(DISTINCT r.question_id) INTO v_novas
    FROM w_resp r
    WHERE NOT EXISTS (SELECT 1 FROM public.eng_questao_classificacao c WHERE c.question_id = r.question_id)
      AND (r.taxonomia_status <> 'ausente'
           OR (EXISTS (SELECT 1 FROM public.eng_depara_quiz_no)
               AND r.carregado_em > coalesce(v_ult_ini, '-infinity'::timestamptz) - interval '1 hour'));

    IF v_novas IS NOT NULL THEN
      v_c := public.eng_refresh_classificacao(v_novas);

      SELECT array_agg(c.question_id) INTO v_classificadas
      FROM public.eng_questao_classificacao c WHERE c.question_id = ANY (v_novas);

      IF v_classificadas IS NOT NULL THEN
        v_d := public.eng_delta_questoes(v_classificadas, v_desde, 1::smallint);
      END IF;
    END IF;

    v_a := public.eng_refresh_agregados(v_desde);

    UPDATE public.eng_refresh_log
       SET status = 'ok', terminado_em = clock_timestamp(),
           contagens = v_c || v_d || v_a || jsonb_build_object(
             'janela_desde',        v_desde,
             'questoes_novas',      coalesce(cardinality(v_novas), 0),
             'questoes_classificadas_agora', coalesce(cardinality(v_classificadas), 0))
     WHERE id = v_log;
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.eng_refresh_log
       SET status = 'erro', terminado_em = clock_timestamp(), erro = SQLSTATE || ': ' || SQLERRM
     WHERE id = v_log;
  END;

  RETURN (SELECT to_jsonb(l) FROM public.eng_refresh_log l WHERE l.id = v_log);
END $$;

REVOKE ALL ON FUNCTION public.eng_monta_w_resp(date), public.eng_refresh_agregados(date), public.eng_refresh_incremental()
  FROM PUBLIC, anon, authenticated;
