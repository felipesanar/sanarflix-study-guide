-- eng_incremental_fase2_pipeline: pipeline da camada eng_* parametrizado e com aplicação de diff
-- Spec: docs/superpowers/specs/2026-10-28-engajamento-refresh-incremental-design.md (§5.2, Fase 2, P1–P4)
-- Substitui eng_refresh_classificacao(), eng_refresh_agregados() e eng_refresh(text) de 20261023181954_eng_pipeline.sql.
-- O resultado das tabelas eng_* não muda: o rebuild total chama as mesmas funções com parâmetro NULL.
--
-- O que muda em relação à versão anterior:
--   - a fonte é lida uma vez por execução, em temporárias estreitas (w_resp, w_cons);
--   - a gravação é por diff (DELETE das chaves que sumiram + upsert só das linhas diferentes), não DELETE de tudo;
--   - eng_refresh_classificacao aceita uma lista de questões (NULL = todas); eng_refresh_agregados, uma data (NULL = tudo);
--   - eng_refresh trava com pg_advisory_xact_lock + lock_timeout, grava o erro no log se o lock não vem
--     e limpa log incremental e histórico do cron com mais de 7 dias.

-- ============================================================
-- 0. As assinaturas () antigas saem ANTES das novas, senão eng_refresh_classificacao() fica ambígua
-- ============================================================
DROP FUNCTION IF EXISTS public.eng_refresh_classificacao();
DROP FUNCTION IF EXISTS public.eng_refresh_agregados();

-- ============================================================
-- 1. eng_refresh_classificacao(p_questoes text[]) (§6.2 da spec mãe, com diff)
-- ============================================================
CREATE OR REPLACE FUNCTION public.eng_refresh_classificacao(p_questoes text[] DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, pg_temp
AS $$
DECLARE
  v_invalidas  integer;
  v_depara_inv integer;
  v_trocaram   integer;
  v_ins        integer;
  v_upd        integer;
  v_del        integer;
  v_result     jsonb;
BEGIN
  -- 1. uma linha por questão (taxonomia é estável por questão; pega a resposta mais recente).
  -- A ordenação lê só colunas estreitas; as taxonomias vêm depois, por response_id (PK).
  DROP TABLE IF EXISTS tmp_eng_q;
  CREATE TEMP TABLE tmp_eng_q ON COMMIT DROP AS
    SELECT u.question_id, f.taxonomias
    FROM (
      SELECT DISTINCT ON (g.question_id) g.question_id, g.response_id
      FROM public.fato_resolucao_questoes_b2b g
      WHERE p_questoes IS NULL OR g.question_id = ANY (p_questoes)
      ORDER BY g.question_id, g.response_timestamp DESC, g.response_id DESC
    ) u
    JOIN public.fato_resolucao_questoes_b2b f ON f.response_id = u.response_id;
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

  -- 3. nós (upsert só do que mudou; nunca apaga). Ordem: nível 1, 2, 3 (FK de pai_id).
  -- O desempate por nome/pai deixa a escolha determinística quando o mesmo id aparece com dados diferentes.
  INSERT INTO public.eng_no_taxonomia AS t (no_id, nivel, ciclo, nome, pai_id, sintetico)
  SELECT DISTINCT ON (n1_id) n1_id, 1, ciclo, n1_nome, NULL, false
  FROM tmp_eng_ent ORDER BY n1_id, n1_nome, ciclo
  ON CONFLICT (no_id) DO UPDATE SET nome = EXCLUDED.nome, atualizado_em = now()
  WHERE t.nome IS DISTINCT FROM EXCLUDED.nome;

  INSERT INTO public.eng_no_taxonomia AS t (no_id, nivel, ciclo, nome, pai_id, sintetico)
  SELECT DISTINCT ON (n2_id) n2_id, 2, ciclo, n2_nome, n1_id, false
  FROM tmp_eng_ent ORDER BY n2_id, n2_nome, n1_id, ciclo
  ON CONFLICT (no_id) DO UPDATE SET nome = EXCLUDED.nome, pai_id = EXCLUDED.pai_id, atualizado_em = now()
  WHERE (t.nome, t.pai_id) IS DISTINCT FROM (EXCLUDED.nome, EXCLUDED.pai_id);

  INSERT INTO public.eng_no_taxonomia AS t (no_id, nivel, ciclo, nome, pai_id, sintetico)
  SELECT DISTINCT ON (tema_id) tema_id, 3, 'clinico', tema_nome, n2_id, false
  FROM tmp_eng_ent WHERE ciclo = 'clinico' AND tema_id IS NOT NULL AND coalesce(tema_nome, '') <> ''
  ORDER BY tema_id, tema_nome, n2_id
  ON CONFLICT (no_id) DO UPDATE SET nome = EXCLUDED.nome, pai_id = EXCLUDED.pai_id, atualizado_em = now()
  WHERE (t.nome, t.pai_id) IS DISTINCT FROM (EXCLUDED.nome, EXCLUDED.pai_id);

  -- tema sintético (D13): mesmo nome da especialidade
  INSERT INTO public.eng_no_taxonomia AS t (no_id, nivel, ciclo, nome, pai_id, sintetico)
  SELECT DISTINCT ON (n2_id) 'herdado:' || n2_id, 3, 'clinico', n2_nome, n2_id, true
  FROM tmp_eng_ent WHERE ciclo = 'clinico' AND (tema_id IS NULL OR coalesce(tema_nome, '') = '')
  ORDER BY n2_id, n2_nome
  ON CONFLICT (no_id) DO UPDATE SET nome = EXCLUDED.nome, atualizado_em = now()
  WHERE t.nome IS DISTINCT FROM EXCLUDED.nome;

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
        AND (p_questoes IS NULL OR f.question_id = ANY (p_questoes))
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

  -- 7. estado novo (uma linha por questão classificada) e aplicação do diff
  DROP TABLE IF EXISTS tmp_eng_novo;
  CREATE TEMP TABLE tmp_eng_novo ON COMMIT DROP AS
    SELECT e.question_id, e.ciclo, e.n1_id, e.n2_id, e.n3_id,
           coalesce(e.n3_id, e.n2_id)                                AS folha_id,
           CASE WHEN e.ciclo = 'clinico' THEN e.n2_id ELSE e.n1_id END AS esp_id,
           'taxonomia'::text                                          AS origem,
           e.motivo,
           e.n_cand::smallint                                         AS n_candidatas,
           e.posicao::smallint                                        AS posicao_escolhida
    FROM tmp_eng_escolha e
    UNION ALL
    SELECT d.question_id, f.ciclo,
           CASE WHEN f.ciclo = 'clinico' THEN p.pai_id ELSE f.pai_id END,   -- n1
           CASE WHEN f.ciclo = 'clinico' THEN f.pai_id ELSE f.no_id  END,   -- n2
           CASE WHEN f.ciclo = 'clinico' THEN f.no_id  END,                 -- n3
           f.no_id,                                                         -- folha
           f.pai_id,                                                        -- esp: o pai da folha nos dois ciclos (clínico: especialidade; básico: disciplina)
           'depara', 'depara', 0::smallint, NULL::smallint
    FROM tmp_eng_depara d
    JOIN public.eng_no_taxonomia f ON f.no_id = d.folha_id
    LEFT JOIN public.eng_no_taxonomia p ON p.no_id = f.pai_id;
  CREATE UNIQUE INDEX ON tmp_eng_novo (question_id);

  -- quantas questões já classificadas trocam de folha (só o rebuild total muda isso; I5)
  SELECT count(*) INTO v_trocaram
  FROM tmp_eng_novo n
  JOIN public.eng_questao_classificacao t ON t.question_id = n.question_id
  WHERE t.folha_id IS DISTINCT FROM n.folha_id;

  WITH d AS (
    DELETE FROM public.eng_questao_classificacao t
    WHERE (p_questoes IS NULL OR t.question_id = ANY (p_questoes))
      AND NOT EXISTS (SELECT 1 FROM tmp_eng_novo n WHERE n.question_id = t.question_id)
    RETURNING 1
  )
  SELECT count(*) INTO v_del FROM d;

  WITH i AS (
    INSERT INTO public.eng_questao_classificacao AS t
      (question_id, ciclo, n1_id, n2_id, n3_id, folha_id, esp_id, origem, motivo, n_candidatas, posicao_escolhida)
    SELECT n.question_id, n.ciclo, n.n1_id, n.n2_id, n.n3_id, n.folha_id, n.esp_id, n.origem, n.motivo,
           n.n_candidatas, n.posicao_escolhida
    FROM tmp_eng_novo n
    ON CONFLICT (question_id) DO UPDATE
       SET ciclo = EXCLUDED.ciclo, n1_id = EXCLUDED.n1_id, n2_id = EXCLUDED.n2_id, n3_id = EXCLUDED.n3_id,
           folha_id = EXCLUDED.folha_id, esp_id = EXCLUDED.esp_id, origem = EXCLUDED.origem,
           motivo = EXCLUDED.motivo, n_candidatas = EXCLUDED.n_candidatas,
           posicao_escolhida = EXCLUDED.posicao_escolhida, classificado_em = now()
     WHERE (t.ciclo, t.n1_id, t.n2_id, t.n3_id, t.folha_id, t.esp_id, t.origem, t.motivo, t.n_candidatas, t.posicao_escolhida)
           IS DISTINCT FROM (EXCLUDED.ciclo, EXCLUDED.n1_id, EXCLUDED.n2_id, EXCLUDED.n3_id, EXCLUDED.folha_id,
                             EXCLUDED.esp_id, EXCLUDED.origem, EXCLUDED.motivo, EXCLUDED.n_candidatas,
                             EXCLUDED.posicao_escolhida)
    RETURNING (xmax = 0) AS inserida
  )
  SELECT count(*) FILTER (WHERE inserida), count(*) FILTER (WHERE NOT inserida) INTO v_ins, v_upd FROM i;

  SELECT jsonb_build_object(
    'questoes_total',          (SELECT count(*) FROM tmp_eng_q),
    'entradas_invalidas',      v_invalidas,
    'classificadas_unica',     (SELECT count(*) FROM tmp_eng_escolha WHERE motivo = 'unica'),
    'classificadas_completa',  (SELECT count(*) FROM tmp_eng_escolha WHERE motivo = 'completa'),
    'classificadas_quiz',      (SELECT count(*) FROM tmp_eng_escolha WHERE motivo = 'quiz'),
    'classificadas_primeira',  (SELECT count(*) FROM tmp_eng_escolha WHERE motivo = 'primeira'),
    'classificadas_depara',    (SELECT count(*) FROM tmp_eng_depara),
    'sem_classificacao',       (SELECT count(*) FROM tmp_eng_q) - (SELECT count(*) FROM tmp_eng_novo),
    'depara_linhas',           (SELECT count(*) FROM public.eng_depara_quiz_no),
    'depara_invalidos',        v_depara_inv,
    'nos_total',               (SELECT count(*) FROM public.eng_no_taxonomia),
    'classif_inseridas',       v_ins,
    'classif_atualizadas',     v_upd,
    'classif_removidas',       v_del,
    'questoes_trocaram_folha', v_trocaram
  ) INTO v_result;
  RETURN v_result;
END $$;

-- ============================================================
-- 2. eng_refresh_agregados(p_desde date) (§6.4 da spec mãe, com leitura única e diff)
-- p_desde NULL = recalcula tudo; com data, recalcula só dia >= p_desde.
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
  v_result  jsonb;
BEGIN
  -- 1. leitura única da fonte (todos os agregados veem o mesmo snapshot)
  DROP TABLE IF EXISTS w_resp;
  CREATE TEMP TABLE w_resp ON COMMIT DROP AS
    SELECT sanarflix_user_id, response_date, question_id, acertou, taxonomia_status, carregado_em
    FROM public.fato_resolucao_questoes_b2b
    WHERE p_desde IS NULL OR response_date >= p_desde;
  ANALYZE w_resp;

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
    'dim_snapshot',         CASE WHEN p_desde IS NULL THEN (SELECT max(snapshot_date) FROM public.dim_aluno_b2b) END
  ) INTO v_result;
  RETURN v_result;
END $$;

-- ============================================================
-- 3. eng_refresh(p_disparo): rebuild total (P4)
-- O log entra antes do lock: se o lock não vem em 10 min, o EXCEPTION grava 'erro' e o log sobrevive.
-- ============================================================
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

  SET LOCAL lock_timeout = '10min';
  SET LOCAL work_mem = '64MB';

  INSERT INTO public.eng_refresh_log (status, disparo, tipo) VALUES ('rodando', p_disparo, 'completo') RETURNING id INTO v_log;

  BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('eng_refresh'));
    v_c := public.eng_refresh_classificacao(NULL);
    v_a := public.eng_refresh_agregados(NULL);
    UPDATE public.eng_refresh_log
       SET status = 'ok', terminado_em = clock_timestamp(), contagens = v_c || v_a
     WHERE id = v_log;
  EXCEPTION WHEN OTHERS THEN
    -- desfaz só o bloco (as tabelas eng_* voltam ao estado anterior); o log registra o erro
    UPDATE public.eng_refresh_log
       SET status = 'erro', terminado_em = clock_timestamp(), erro = SQLSTATE || ': ' || SQLERRM
     WHERE id = v_log;
  END;

  -- manutenção: log incremental e histórico do cron dos jobs eng-* só guardam 7 dias.
  -- Falha aqui (permissão no schema cron, por exemplo) não pode derrubar o rebuild.
  BEGIN
    DELETE FROM public.eng_refresh_log WHERE tipo = 'incremental' AND iniciado_em < now() - interval '7 days';
    DELETE FROM cron.job_run_details
     WHERE end_time < now() - interval '7 days'
       AND jobid IN (SELECT j.jobid FROM cron.job j WHERE j.jobname LIKE 'eng-%');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN (SELECT to_jsonb(l) FROM public.eng_refresh_log l WHERE l.id = v_log);
END $$;

-- ============================================================
-- 4. Grants: só o dono (postgres), o cron e o SQL Editor/MCP executam (o default ACL do Supabase dá EXECUTE a anon/authenticated)
-- ============================================================
REVOKE ALL ON FUNCTION public.eng_refresh_classificacao(text[]), public.eng_refresh_agregados(date), public.eng_refresh(text)
  FROM PUBLIC, anon, authenticated;
