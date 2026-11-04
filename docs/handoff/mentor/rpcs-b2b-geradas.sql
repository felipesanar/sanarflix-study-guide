-- Snapshot de produção do que a migration 20261104190000 (versão gravada 20261104185935) materializou. Só leitura; não é migration.
-- Fonte: pg_get_functiondef no projeto gvqvrmkizemwsasmupmo, capturado em 2026-11-04.
-- Funções: mentor_visao_geral_b2b, mentor_alunos_b2b, mentor_temas_turma_b2b, mentor_detalhamento_b2b, mentor_questoes_b2b, mentor_questao_respondentes_b2b, mentor_cronograma_b2b, mentor_aluno_b2b

-- ======================================================================
-- public.mentor_visao_geral_b2b(p_inicio date, p_fim date)
-- ======================================================================
CREATE OR REPLACE FUNCTION public.mentor_visao_geral_b2b(p_inicio date DEFAULT NULL::date, p_fim date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$-- Deriva de public.get_gestor_visao_geral(uuid,text); copia independente do Gestor.
 DECLARE v_uid uuid := auth.uid(); v_ies uuid; v_sems int[]; v_evid int[]; v_recorte text; v_criterio text; v_geral boolean := false; v_conceito_criterio text; v_result jsonb; 
    v_mentor uuid := public.mentor_ativo_id();
    v_alunos uuid[];
    v_membros jsonb;
    v_atividade jsonb;
  BEGIN
    SELECT m.ies_id INTO v_ies FROM public.mentores m
    WHERE m.user_id = v_mentor AND m.tipo = 'b2b';
    IF NOT FOUND OR v_ies IS NULL THEN
      RAISE EXCEPTION 'mentor_b2b_obrigatorio' USING ERRCODE = '42501';
    END IF;
    SELECT coalesce(array_agg(DISTINCT a.id) FILTER (WHERE a.id IS NOT NULL), '{}'::uuid[]),
           coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.email), '[]'::jsonb)
    INTO v_alunos, v_membros
    FROM (
      SELECT v.id AS ciclo_id, v.email_normalizado AS email,
             coalesce(v.academy_user_id, d.academy_user_id, ue.id) AS id,
             coalesce(v.nome, u.nome, d.nome, ue.nome) AS nome,
             coalesce(u.semestre, d.semestre_atual, ue.semestre) AS semestre
      FROM public.mentoria_vinculos v
      LEFT JOIN public.users u ON u.id = v.academy_user_id
      LEFT JOIN LATERAL (
        SELECT d0.* FROM public.dim_aluno_b2b d0
        WHERE d0.email_normalizado = v.email_normalizado
        ORDER BY (d0.status_atual = 'ativo') DESC NULLS LAST, d0.sanarflix_user_id
        LIMIT 1
      ) d ON true
      LEFT JOIN LATERAL (
        SELECT u0.* FROM public.users u0
        WHERE lower(btrim(u0.email)) = v.email_normalizado
        ORDER BY u0.id LIMIT 1
      ) ue ON true
      WHERE v.mentor_id = v_mentor AND v.fim IS NULL
    ) a;
  
    IF p_inicio > p_fim THEN
      RAISE EXCEPTION 'periodo_invalido' USING ERRCODE = '22023';
    END IF;
   v_sems := NULL; v_recorte := 'turma do mentor'; 
        v_evid := NULL; v_geral := false;
        v_criterio := 'Turma ativa; melhor TRI por aluno e simulado-pai; proficiente >= 60. Conceito projetado pelas faixas 90/75/60/40% de proficientes, nunca o conceito institucional.';
      WITH sims AS ( SELECT sa.id, sa.nome, COALESCE(sa.data_realizacao, sa.data_encerramento, sa.data_liberacao, sa.created_at) AS data_ref FROM (SELECT * FROM public.simulados_admin WHERE type = 'simulado_enamed' AND NOT prova_oficial) sa WHERE v_ies = ANY (sa.ies_ids)
    AND (p_inicio IS NULL OR
      (COALESCE(sa.data_realizacao, sa.data_encerramento, sa.data_liberacao, sa.created_at)
        AT TIME ZONE 'America/Sao_Paulo')::date >= p_inicio)
    AND (p_fim IS NULL OR
      (COALESCE(sa.data_realizacao, sa.data_encerramento, sa.data_liberacao, sa.created_at)
        AT TIME ZONE 'America/Sao_Paulo')::date <= p_fim)
   AND sa.simulado_pai_id IS NULL AND sa.status IN ('ativo','encerrado') AND ( sa.liberacao_desempenho = 'imediato' OR (sa.liberacao_desempenho = 'agendado' AND sa.data_liberacao_desempenho IS NOT NULL AND sa.data_liberacao_desempenho <= now()) OR (sa.liberacao_desempenho = 'ao_encerrar' AND (sa.status = 'encerrado' OR (sa.data_encerramento IS NOT NULL AND sa.data_encerramento <= now()))) ) ), sims_ord AS ( SELECT s.*, row_number() OVER (ORDER BY s.data_ref NULLS LAST, s.nome) AS ord FROM sims s ), ies_tri AS ( SELECT COALESCE(sa.simulado_pai_id, sa.id) AS pai_id, max(r.concept) AS concept FROM public.resultados_ies_tri r JOIN (SELECT * FROM public.simulados_admin WHERE type = 'simulado_enamed' AND NOT prova_oficial) sa ON sa.id = r.simulado_id WHERE r.college_id = v_ies AND COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims) GROUP BY 1 ), grupo AS ( SELECT sa.id AS simulado_id, COALESCE(sa.simulado_pai_id, sa.id) AS pai_id FROM (SELECT * FROM public.simulados_admin WHERE type = 'simulado_enamed' AND NOT prova_oficial) sa WHERE COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims) ), alunos AS ( SELECT u.id, u.semestre FROM (
    SELECT DISTINCT ON (u.id) u.id, coalesce(m.nome, u.nome) AS nome,
      coalesce(m.semestre, u.semestre) AS semestre
    FROM jsonb_to_recordset(v_membros) m(id uuid, nome text, semestre int, email text)
    JOIN public.users u ON u.id = m.id WHERE u.id = ANY(v_alunos)
    ORDER BY u.id, m.email
  ) u ), alunos_todos AS ( SELECT u.id, u.semestre FROM (
    SELECT DISTINCT ON (u.id) u.id, coalesce(m.nome, u.nome) AS nome,
      coalesce(m.semestre, u.semestre) AS semestre
    FROM jsonb_to_recordset(v_membros) m(id uuid, nome text, semestre int, email text)
    JOIN public.users u ON u.id = m.id WHERE u.id = ANY(v_alunos)
    ORDER BY u.id, m.email
  ) u ), sems_com_resultado AS ( SELECT DISTINCT a.semestre FROM public.resultados_alunos_tri r JOIN (SELECT * FROM public.simulados_admin WHERE type = 'simulado_enamed' AND NOT prova_oficial) sa ON sa.id = r.simulado_id JOIN alunos_todos a ON a.id = r.student_id WHERE r.college_id = v_ies AND COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims) AND r.score_proprio IS NOT NULL AND a.semestre IS NOT NULL ), ultima AS ( SELECT DISTINCT ON (sf.user_id, g.pai_id) sf.user_id, g.pai_id, sf.simulado_id FROM public.simulados_finalizados sf JOIN grupo g ON g.simulado_id = sf.simulado_id WHERE sf.user_id IN (SELECT id FROM alunos) ORDER BY sf.user_id, g.pai_id, sf.finalizado_em DESC NULLS LAST ), ultima_fb AS ( SELECT a.id AS user_id, gp.pai_id, x.simulado_id FROM alunos a CROSS JOIN (SELECT DISTINCT pai_id FROM grupo) gp CROSS JOIN LATERAL ( SELECT g2.simulado_id FROM grupo g2 JOIN public.simulados_admin sa_ord ON sa_ord.id = g2.simulado_id CROSS JOIN LATERAL (SELECT 1 FROM public.answer_progress ap WHERE ap.user_id = a.id AND ap.simulado = g2.simulado_id LIMIT 1) hit WHERE g2.pai_id = gp.pai_id ORDER BY sa_ord.created_at DESC NULLS LAST LIMIT 1 ) x WHERE NOT EXISTS (SELECT 1 FROM ultima u WHERE u.user_id = a.id AND u.pai_id = gp.pai_id) ), tentativas AS ( SELECT * FROM ultima UNION ALL SELECT * FROM ultima_fb ), respostas AS ( SELECT t.pai_id, t.user_id, ap.correct, q.grande_area FROM tentativas t JOIN public.answer_progress ap ON ap.user_id = t.user_id AND ap.simulado = t.simulado_id JOIN public.questoes_simulado q ON q.id = ap.question_id WHERE COALESCE(q.anulada,false) = false ), tri_raw AS ( SELECT COALESCE(sa.simulado_pai_id, sa.id) AS pai_id, r.student_id, a.semestre, r.score_proprio FROM public.resultados_alunos_tri r JOIN (SELECT * FROM public.simulados_admin WHERE type = 'simulado_enamed' AND NOT prova_oficial) sa ON sa.id = r.simulado_id JOIN alunos a ON a.id = r.student_id WHERE r.college_id = v_ies AND COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims) AND r.score_proprio IS NOT NULL ), tri AS ( SELECT DISTINCT ON (tr.student_id, tr.pai_id) tr.pai_id, tr.student_id, tr.semestre, tr.score_proprio FROM tri_raw tr ORDER BY tr.student_id, tr.pai_id, tr.score_proprio DESC ), resp_sim AS ( SELECT r.pai_id, count(DISTINCT r.user_id) AS n_resp, count(*) FILTER (WHERE r.correct) AS acertos, count(*) AS total FROM respostas r GROUP BY r.pai_id ), por_sim AS ( SELECT s.id, s.nome, s.data_ref, s.ord, (SELECT count(DISTINCT t.student_id) FROM tri t WHERE t.pai_id = s.id) AS n_tri, (SELECT avg(t.score_proprio) FROM tri t WHERE t.pai_id = s.id) AS prof_media, (SELECT count(DISTINCT t.student_id) FILTER (WHERE t.score_proprio >= 60) FROM tri t WHERE t.pai_id = s.id) AS n_prof, COALESCE((SELECT rs.n_resp FROM resp_sim rs WHERE rs.pai_id = s.id), 0) AS n_resp, COALESCE((SELECT rs.acertos FROM resp_sim rs WHERE rs.pai_id = s.id), 0) AS acertos, COALESCE((SELECT rs.total FROM resp_sim rs WHERE rs.pai_id = s.id), 0) AS total FROM sims_ord s ), metricas AS ( SELECT p.*, CASE WHEN p.n_tri > 0 THEN round(100.0 * p.n_prof / p.n_tri, 0) END AS prof_pct, CASE WHEN p.total > 0 THEN round(100.0 * p.acertos / p.total, 0) END AS acerto_pct, CASE WHEN p.n_tri = 0 THEN NULL
            WHEN 100.0 * p.n_prof / p.n_tri >= 90 THEN 5
            WHEN 100.0 * p.n_prof / p.n_tri >= 75 THEN 4
            WHEN 100.0 * p.n_prof / p.n_tri >= 60 THEN 3
            WHEN 100.0 * p.n_prof / p.n_tri >= 40 THEN 2
            ELSE 1 END AS concept, false AS concept_oficial FROM por_sim p ), realizados AS ( SELECT * FROM metricas WHERE n_resp > 0 OR n_tri > 0 ), regua AS ( SELECT r.*, row_number() OVER (ORDER BY r.ord) AS i, count(*) OVER () AS k FROM realizados r ), pontos AS ( SELECT g.*, CASE WHEN g.i = g.k THEN 'atual' WHEN g.i = g.k - 1 THEN 'anterior' WHEN g.i = 1 THEN 'primeiro' END AS rotulo FROM regua g WHERE g.i = g.k OR g.i = g.k - 1 OR g.i = 1 ), regua_tri AS ( SELECT r.*, row_number() OVER (ORDER BY r.ord) AS i, count(*) OVER () AS k FROM realizados r WHERE r.n_tri > 0 ), pontos_tri AS ( SELECT g.*, CASE WHEN g.i = g.k THEN 'atual' WHEN g.i = g.k - 1 THEN 'anterior' WHEN g.i = 1 THEN 'primeiro' END AS rotulo FROM regua_tri g WHERE g.i = g.k OR g.i = g.k - 1 OR g.i = 1 ), areas_sim AS ( SELECT r.grande_area AS area, r.pai_id, count(*) AS total, count(*) FILTER (WHERE r.correct) AS acertos FROM respostas r WHERE r.grande_area IS NOT NULL GROUP BY 1, 2 ), area_amostra AS ( SELECT r.grande_area AS area, count(DISTINCT r.user_id) AS n FROM respostas r WHERE r.grande_area IS NOT NULL GROUP BY r.grande_area ), areas_tot AS ( SELECT a.area, sum(a.total) AS total, sum(a.acertos) AS acertos, COALESCE((SELECT am.n FROM area_amostra am WHERE am.area = a.area), 0) AS amostra FROM areas_sim a GROUP BY a.area ), areas_pct AS ( SELECT t.area, t.amostra, t.total, round(100.0 * t.acertos / NULLIF(t.total,0), 0) AS acerto_pct FROM areas_tot t ), areas_nivel AS ( SELECT p.area, p.amostra, p.acerto_pct, CASE WHEN p.total = 0 THEN NULL WHEN p.acerto_pct < 50 THEN 'critico' WHEN p.acerto_pct >= 80 THEN 'excelente' ELSE 'mediano' END AS nivel FROM areas_pct p ), aluno_prof AS ( SELECT t.student_id, count(DISTINCT t.pai_id) AS n_sim, count(DISTINCT t.pai_id) FILTER (WHERE t.score_proprio >= 60) AS n_prof FROM tri t GROUP BY t.student_id ), aluno_grupo AS ( SELECT ap.student_id, CASE WHEN ap.n_prof = ap.n_sim THEN 'consistentemente_proficiente' WHEN ap.n_prof = 0 THEN 'consistentemente_nao_proficiente' ELSE 'em_variacao' END AS grupo FROM aluno_prof ap ), dispersao AS ( SELECT DISTINCT ON (t.student_id) t.student_id, t.semestre, t.score_proprio FROM tri t JOIN metricas m ON m.id = t.pai_id ORDER BY t.student_id, m.ord DESC ), kpi_contratos_vigentes AS ( SELECT c.id AS contrato_id, c.simulados_contratados FROM public.ies_contrato_simulados c WHERE c.ies_id = v_ies AND current_date BETWEEN c.vigencia_inicio AND c.vigencia_fim ), kpi_contrato_fallback AS ( SELECT c.id AS contrato_id, c.simulados_contratados FROM public.ies_contrato_simulados c WHERE c.ies_id = v_ies AND NOT EXISTS (SELECT 1 FROM kpi_contratos_vigentes) ORDER BY c.vigencia_fim DESC LIMIT 1 ), kpi_contrato AS ( SELECT * FROM kpi_contratos_vigentes UNION ALL SELECT * FROM kpi_contrato_fallback ), kpi_slots AS ( SELECT sp.simulado_id AS pai_id FROM public.ies_simulado_previsto sp JOIN kpi_contrato kc ON kc.contrato_id = sp.contrato_id WHERE sp.ies_id = v_ies AND sp.simulado_id IS NOT NULL ), kpi_alunos AS ( SELECT u.id FROM (
    SELECT DISTINCT ON (u.id) u.id, coalesce(m.nome, u.nome) AS nome,
      coalesce(m.semestre, u.semestre) AS semestre
    FROM jsonb_to_recordset(v_membros) m(id uuid, nome text, semestre int, email text)
    JOIN public.users u ON u.id = m.id WHERE u.id = ANY(v_alunos)
    ORDER BY u.id, m.email
  ) u ), kpi_grupo AS ( SELECT sa.id AS simulado_id, COALESCE(sa.simulado_pai_id, sa.id) AS pai_id FROM (SELECT * FROM public.simulados_admin WHERE type = 'simulado_enamed' AND NOT prova_oficial) sa WHERE COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT pai_id FROM kpi_slots) ), kpi_participacao AS ( SELECT p.pai_id, count(DISTINCT p.user_id) AS n FROM ( SELECT g.pai_id, sf.user_id FROM public.simulados_finalizados sf JOIN kpi_grupo g ON g.simulado_id = sf.simulado_id WHERE sf.user_id IN (SELECT id FROM kpi_alunos) UNION SELECT g.pai_id, a.id AS user_id FROM kpi_alunos a CROSS JOIN kpi_grupo g CROSS JOIN LATERAL (SELECT 1 FROM public.answer_progress ap WHERE ap.user_id = a.id AND ap.simulado = g.simulado_id LIMIT 1) hit ) p GROUP BY p.pai_id ), kpi_com_tri AS ( SELECT DISTINCT COALESCE(sa.simulado_pai_id, sa.id) AS pai_id FROM public.resultados_ies_tri r JOIN (SELECT * FROM public.simulados_admin WHERE type = 'simulado_enamed' AND NOT prova_oficial) sa ON sa.id = r.simulado_id WHERE r.college_id = v_ies ), kpi_realizados AS ( SELECT ks.pai_id FROM kpi_slots ks JOIN (SELECT * FROM public.simulados_admin WHERE type = 'simulado_enamed' AND NOT prova_oficial) sa ON sa.id = ks.pai_id AND lower(sa.status) NOT IN ('rascunho','draft','arquivado','cancelado') LEFT JOIN kpi_participacao p ON p.pai_id = ks.pai_id WHERE ( COALESCE(p.n,0) > 0 OR lower(sa.status) = 'encerrado' OR (sa.data_encerramento IS NOT NULL AND sa.data_encerramento < now()) ) AND EXISTS (SELECT 1 FROM kpi_com_tri c WHERE c.pai_id = ks.pai_id) ) SELECT jsonb_build_object( 'data', jsonb_build_object( 'kpis', jsonb_build_object( 'enamedProjetado', jsonb_build_object( 'valor', (SELECT p.concept FROM pontos_tri p WHERE p.rotulo = 'atual'), 'delta', ((SELECT p.concept FROM pontos_tri p WHERE p.rotulo = 'atual') - (SELECT p.concept FROM pontos_tri p WHERE p.rotulo = 'anterior')), 'serie', COALESCE((SELECT jsonb_agg(jsonb_build_object('rotulo', p.rotulo, 'valor', p.concept) ORDER BY p.i) FROM pontos p), '[]'::jsonb), 'origem', CASE WHEN (SELECT p.concept_oficial FROM pontos_tri p WHERE p.rotulo = 'atual') THEN 'oficial' ELSE 'estimado' END, 'criterio', CASE WHEN v_geral THEN 'Conceito 1–5 do simulado atual, como consolidado no resultado institucional da instituição. Nunca é média entre simulados.' ELSE 'Conceito 1–5 do simulado atual, derivado do % de alunos proficientes no recorte selecionado. Nunca é média entre simulados.' END ), 'proficientesPct', jsonb_build_object( 'valor', (SELECT p.prof_pct FROM pontos_tri p WHERE p.rotulo = 'atual'), 'delta', ((SELECT p.prof_pct FROM pontos_tri p WHERE p.rotulo = 'atual') - (SELECT p.prof_pct FROM pontos_tri p WHERE p.rotulo = 'anterior')), 'serie', COALESCE((SELECT jsonb_agg(jsonb_build_object('rotulo', p.rotulo, 'valor', p.prof_pct) ORDER BY p.i) FROM pontos p), '[]'::jsonb), 'criterio', 'Alunos com proficiência acima de 60 sobre o total de alunos com resultado no simulado.' ), 'acertoPct', jsonb_build_object( 'valor', (SELECT p.acerto_pct FROM pontos p WHERE p.rotulo = 'atual'), 'delta', ((SELECT p.acerto_pct FROM pontos p WHERE p.rotulo = 'atual') - (SELECT p.acerto_pct FROM pontos p WHERE p.rotulo = 'anterior')), 'serie', COALESCE((SELECT jsonb_agg(jsonb_build_object('rotulo', p.rotulo, 'valor', p.acerto_pct) ORDER BY p.i) FROM pontos p), '[]'::jsonb), 'criterio', 'Respostas corretas sobre respostas válidas (questão anulada fora), na última tentativa de cada aluno.' ), 'simulados', jsonb_build_object( 'realizados', COALESCE((SELECT count(*) FROM kpi_realizados), 0), 'contratados', (SELECT sum(kc.simulados_contratados) FROM kpi_contrato kc) ) ), 'alunosMatriculadosNoRecorte', (SELECT count(*) FROM alunos), 'semestresComResultado', COALESCE(( SELECT jsonb_agg(s.semestre ORDER BY s.semestre) FROM sems_com_resultado s), '[]'::jsonb), 'evolucao', COALESCE(( SELECT jsonb_agg(jsonb_build_object( 'simuladoId', m.id, 'nome', m.nome, 'data', to_char(m.data_ref AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'valor', CASE WHEN m.prof_media IS NULL THEN NULL ELSE round(m.prof_media::numeric, 1) END, 'proficientesPct', m.prof_pct, 'participantes', GREATEST(m.n_tri, m.n_resp),
            'n_tri', m.n_tri, 'n_prof', m.n_prof, 'proficientesPct', m.prof_pct,
            'conceito', m.concept ) ORDER BY m.ord) FROM realizados m), '[]'::jsonb), 'evolucaoPorArea', COALESCE(( SELECT jsonb_agg(jsonb_build_object( 'area', t.area, 'pontos', COALESCE(( SELECT jsonb_agg(jsonb_build_object( 'rotulo', m.nome, 'valor', round(100.0 * a.acertos / NULLIF(a.total,0), 0) ) ORDER BY m.ord) FROM areas_sim a JOIN metricas m ON m.id = a.pai_id WHERE a.area = t.area), '[]'::jsonb), 'critica', COALESCE(t.acerto_pct < 50, false) ) ORDER BY t.area) FROM areas_pct t), '[]'::jsonb), 'diagnosticoResumo', ( SELECT jsonb_agg(jsonb_build_object( 'nivel', n.nivel, 'areas', COALESCE(( SELECT jsonb_agg(jsonb_build_object('id', an.area, 'nome', an.area, 'acertoPct', an.acerto_pct) ORDER BY an.acerto_pct, an.area) FROM areas_nivel an WHERE an.nivel = n.nivel), '[]'::jsonb) ) ORDER BY n.pos) FROM (VALUES ('critico',1),('mediano',2),('excelente',3)) AS n(nivel,pos)), 'distribuicaoAlunos', ( SELECT jsonb_agg(jsonb_build_object( 'grupo', g.grupo, 'quantidade', COALESCE(c.q, 0), 'percentual', CASE WHEN (SELECT count(*) FROM aluno_grupo) > 0 THEN round(100.0 * COALESCE(c.q,0) / (SELECT count(*) FROM aluno_grupo), 0) END ) ORDER BY g.pos) FROM (VALUES ('consistentemente_proficiente',1), ('em_variacao',2), ('consistentemente_nao_proficiente',3)) AS g(grupo,pos) LEFT JOIN (SELECT grupo, count(*) AS q FROM aluno_grupo GROUP BY grupo) c ON c.grupo = g.grupo), 'dispersao', COALESCE(( SELECT jsonb_agg(jsonb_build_object( 'alunoId', d.student_id, 'semestre', d.semestre, 'nota', round(d.score_proprio::numeric, 1))) FROM dispersao d WHERE d.semestre IS NOT NULL), '[]'::jsonb), 'insights', jsonb_build_array( jsonb_build_object('escopo','area','texto', COALESCE(( SELECT format('%s é a grande área com o menor desempenho da instituição: %s%% de acerto no recorte analisado.', an.area, an.acerto_pct) FROM areas_nivel an WHERE an.acerto_pct IS NOT NULL ORDER BY an.acerto_pct, an.area LIMIT 1), 'Ainda não há respostas suficientes para gerar um insight por grande área.')), jsonb_build_object('escopo','aluno','texto', COALESCE(( SELECT format('%s de %s alunos com resultado estão consistentemente abaixo do limiar de proficiência (60).', x.nao_prof, x.tot) FROM (SELECT count(*) FILTER (WHERE grupo = 'consistentemente_nao_proficiente') AS nao_prof, count(*) AS tot FROM aluno_grupo) x WHERE x.tot > 0), 'Ainda não há resultado de proficiência para gerar um insight por aluno.')) ) ), 'meta', jsonb_build_object( 'periodo', COALESCE((SELECT to_char(min(m.data_ref),'DD/MM/YYYY') || ' — ' || to_char(max(m.data_ref),'DD/MM/YYYY') FROM realizados m), 'sem simulado com resultado'), 'fonte', 'resultados_alunos_tri · resultados_ies_tri · answer_progress · questoes_simulado · simulados_admin · simulados_finalizados · users · ies_contrato_simulados · ies_simulado_previsto', 'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'criterio', v_criterio, 'partial', (SELECT count(*) FROM realizados WHERE n_tri = 0) > 0, 'lowSample', COALESCE((SELECT GREATEST(p.n_tri, p.n_resp) FROM pontos p WHERE p.rotulo = 'atual'), 0) < 10 ) ) INTO v_result;
        WITH pontos AS (
          SELECT e.*, e.ord AS i FROM jsonb_array_elements(v_result->'data'->'evolucao')
            WITH ORDINALITY e(valor, ord)
        ), ultimo AS (
          SELECT p.valor, (p.valor->>'n_tri')::numeric AS n_tri,
            (p.valor->>'n_prof')::numeric AS n_prof,
            CASE (p.valor->>'conceito')::int
              WHEN 1 THEN 40 WHEN 2 THEN 60 WHEN 3 THEN 75 WHEN 4 THEN 90 END AS proximo_pct
          FROM pontos p ORDER BY p.i DESC LIMIT 1
        )
        SELECT jsonb_set(v_result, '{data}', (v_result->'data') || jsonb_build_object(
          'alunosMatriculadosNoRecorte', jsonb_array_length(v_membros),
          'n_tri', (SELECT p.n_tri FROM ultimo p),
          'n_prof', (SELECT p.n_prof FROM ultimo p),
          'faltam_para_proximo_conceito', (SELECT CASE WHEN p.n_tri = 0 OR p.proximo_pct IS NULL THEN NULL
            ELSE greatest(0, ceil(p.proximo_pct * p.n_tri / 100.0) - p.n_prof) END FROM ultimo p)
        )) INTO v_result;
        v_result := jsonb_set(v_result, '{data,kpis}', (v_result->'data'->'kpis') || jsonb_build_object(
          'triProjetado', jsonb_build_object(
            'valor', v_result #> '{data,evolucao,-1,valor}',
            'delta', (v_result #>> '{data,evolucao,-1,valor}')::numeric -
                     (v_result #>> '{data,evolucao,-2,valor}')::numeric,
            'serie', coalesce((SELECT jsonb_agg(jsonb_build_object(
              'simuladoId', e->'simuladoId', 'valor', e->'valor') ORDER BY ord)
              FROM jsonb_array_elements(v_result->'data'->'evolucao') WITH ORDINALITY p(e,ord)), '[]'::jsonb)
          )));
      
      v_result := jsonb_set(v_result, '{meta}', (v_result->'meta') || jsonb_build_object(
        'partial', coalesce((v_result->'meta'->>'partial')::boolean, false)
          OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_membros) e WHERE e->>'id' IS NULL),
        'alunosSemAcademy', (SELECT count(*) FROM jsonb_array_elements(v_membros) e WHERE e->>'id' IS NULL)
      ));
      RETURN v_result;
    END;
    $function$;

-- ======================================================================
-- public.mentor_alunos_b2b(p_inicio date, p_fim date)
-- ======================================================================
CREATE OR REPLACE FUNCTION public.mentor_alunos_b2b(p_inicio date DEFAULT NULL::date, p_fim date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$-- Deriva de public.get_gestor_alunos(uuid,text,integer,integer,text,text,text,text); copia independente do Gestor.
 DECLARE v_uid uuid := auth.uid(); v_ies uuid; v_sems int[]; v_recorte text; v_sort text; v_order text; v_page int; v_size int; v_q text; v_grupo text; v_result jsonb; 
    v_mentor uuid := public.mentor_ativo_id();
    v_alunos uuid[];
    v_membros jsonb;
    v_atividade jsonb;
  BEGIN
    SELECT m.ies_id INTO v_ies FROM public.mentores m
    WHERE m.user_id = v_mentor AND m.tipo = 'b2b';
    IF NOT FOUND OR v_ies IS NULL THEN
      RAISE EXCEPTION 'mentor_b2b_obrigatorio' USING ERRCODE = '42501';
    END IF;
    SELECT coalesce(array_agg(DISTINCT a.id) FILTER (WHERE a.id IS NOT NULL), '{}'::uuid[]),
           coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.email), '[]'::jsonb)
    INTO v_alunos, v_membros
    FROM (
      SELECT v.id AS ciclo_id, v.email_normalizado AS email,
             coalesce(v.academy_user_id, d.academy_user_id, ue.id) AS id,
             coalesce(v.nome, u.nome, d.nome, ue.nome) AS nome,
             coalesce(u.semestre, d.semestre_atual, ue.semestre) AS semestre
      FROM public.mentoria_vinculos v
      LEFT JOIN public.users u ON u.id = v.academy_user_id
      LEFT JOIN LATERAL (
        SELECT d0.* FROM public.dim_aluno_b2b d0
        WHERE d0.email_normalizado = v.email_normalizado
        ORDER BY (d0.status_atual = 'ativo') DESC NULLS LAST, d0.sanarflix_user_id
        LIMIT 1
      ) d ON true
      LEFT JOIN LATERAL (
        SELECT u0.* FROM public.users u0
        WHERE lower(btrim(u0.email)) = v.email_normalizado
        ORDER BY u0.id LIMIT 1
      ) ue ON true
      WHERE v.mentor_id = v_mentor AND v.fim IS NULL
    ) a;
  
    IF p_inicio > p_fim THEN
      RAISE EXCEPTION 'periodo_invalido' USING ERRCODE = '22023';
    END IF;
   v_sems := NULL; v_recorte := 'turma do mentor'; 
        v_sort := 'nome'; v_order := 'asc'; v_page := 1; v_size := 2147483647;
        v_q := NULL; v_grupo := NULL;
        v_atividade := public.mentor_turma();
      WITH sims AS ( SELECT sa.id, sa.nome, COALESCE(sa.data_realizacao, sa.data_encerramento, sa.data_liberacao, sa.created_at) AS data_ref FROM (SELECT * FROM public.simulados_admin WHERE type = 'simulado_enamed') sa WHERE v_ies = ANY (sa.ies_ids)
    AND (p_inicio IS NULL OR
      (COALESCE(sa.data_realizacao, sa.data_encerramento, sa.data_liberacao, sa.created_at)
        AT TIME ZONE 'America/Sao_Paulo')::date >= p_inicio)
    AND (p_fim IS NULL OR
      (COALESCE(sa.data_realizacao, sa.data_encerramento, sa.data_liberacao, sa.created_at)
        AT TIME ZONE 'America/Sao_Paulo')::date <= p_fim)
   AND sa.simulado_pai_id IS NULL AND sa.status IN ('ativo','encerrado') AND ( sa.liberacao_desempenho = 'imediato' OR (sa.liberacao_desempenho = 'agendado' AND sa.data_liberacao_desempenho IS NOT NULL AND sa.data_liberacao_desempenho <= now()) OR (sa.liberacao_desempenho = 'ao_encerrar' AND (sa.status = 'encerrado' OR (sa.data_encerramento IS NOT NULL AND sa.data_encerramento <= now()))) ) ), sims_ord AS ( SELECT s.*, row_number() OVER (ORDER BY s.data_ref NULLS LAST, s.nome) AS ord FROM sims s ), alunos AS ( SELECT u.id, u.nome, u.semestre FROM (
    SELECT DISTINCT ON (u.id) u.id, coalesce(m.nome, u.nome) AS nome,
      coalesce(m.semestre, u.semestre) AS semestre
    FROM jsonb_to_recordset(v_membros) m(id uuid, nome text, semestre int, email text)
    JOIN public.users u ON u.id = m.id WHERE u.id = ANY(v_alunos)
    ORDER BY u.id, m.email
  ) u ), tri_raw AS ( SELECT COALESCE(sa.simulado_pai_id, sa.id) AS pai_id, r.student_id, r.score_proprio FROM public.resultados_alunos_tri r JOIN (SELECT * FROM public.simulados_admin WHERE type = 'simulado_enamed') sa ON sa.id = r.simulado_id WHERE r.college_id = v_ies AND r.student_id = ANY(v_alunos) AND COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims) AND r.score_proprio IS NOT NULL ), tri AS ( SELECT DISTINCT ON (tr.student_id, tr.pai_id) tr.pai_id, tr.student_id, tr.score_proprio FROM tri_raw tr ORDER BY tr.student_id, tr.pai_id, tr.score_proprio DESC ), sims_com_tri AS ( SELECT s.* FROM sims_ord s WHERE EXISTS (SELECT 1 FROM tri t WHERE t.pai_id = s.id) ), aluno_sim AS ( SELECT a.id, s.id AS sim_id, s.ord, (SELECT avg(t.score_proprio) FROM tri t WHERE t.student_id = a.id AND t.pai_id = s.id) AS score FROM alunos a CROSS JOIN sims_com_tri s ), diffs AS ( SELECT d.id, d.diff FROM ( SELECT s.id, s.score - lag(s.score) OVER (PARTITION BY s.id ORDER BY s.ord) AS diff FROM aluno_sim s WHERE s.score IS NOT NULL ) d WHERE d.diff IS NOT NULL ), tend AS ( SELECT x.id, CASE WHEN x.subiu AND x.desceu THEN 'alternando' WHEN x.subiu THEN 'subindo' WHEN x.desceu THEN 'descendo' ELSE 'estavel' END AS tendencia FROM ( SELECT d.id, bool_or(d.diff > 0) AS subiu, bool_or(d.diff < 0) AS desceu FROM diffs d GROUP BY d.id ) x ), agg AS ( SELECT a.id, a.nome, a.semestre, COALESCE(( SELECT jsonb_agg( jsonb_build_object( 'simuladoId', s.sim_id, 'valor', CASE WHEN s.score IS NULL THEN NULL ELSE round(s.score::numeric, 1) END ) ORDER BY s.ord) FROM aluno_sim s WHERE s.id = a.id), '[]'::jsonb) AS proficiencias, (SELECT count(*) FROM aluno_sim s WHERE s.id = a.id AND s.score IS NOT NULL) AS n_com, (SELECT count(*) FROM aluno_sim s WHERE s.id = a.id AND s.score >= 60) AS n_prof, (SELECT s.score FROM aluno_sim s WHERE s.id = a.id AND s.score IS NOT NULL ORDER BY s.ord DESC LIMIT 1) AS prof_atual, COALESCE((SELECT t.tendencia FROM tend t WHERE t.id = a.id), 'estavel') AS tendencia FROM alunos a ), linhas AS ( SELECT g.*, CASE WHEN g.n_com = 0 THEN NULL WHEN g.n_prof = g.n_com THEN 'consistentemente_proficiente' WHEN g.n_prof = 0 THEN 'consistentemente_nao_proficiente' ELSE 'em_variacao' END AS grupo FROM agg g ), linhas_filtrado AS ( SELECT l.* FROM linhas l WHERE v_grupo IS NULL OR l.grupo = v_grupo ), ordenado AS ( SELECT l.*, row_number() OVER ( ORDER BY CASE WHEN v_sort='semestre' AND v_order='asc' THEN l.semestre END ASC NULLS LAST, CASE WHEN v_sort='semestre' AND v_order='desc' THEN l.semestre END DESC NULLS LAST, CASE WHEN v_sort='proficiencia' AND v_order='asc' THEN l.prof_atual END ASC NULLS LAST, CASE WHEN v_sort='proficiencia' AND v_order='desc' THEN l.prof_atual END DESC NULLS LAST, CASE WHEN v_sort='tendencia' AND v_order='asc' THEN CASE l.tendencia WHEN 'descendo' THEN 1 WHEN 'alternando' THEN 2 WHEN 'estavel' THEN 3 WHEN 'subindo' THEN 4 END END ASC, CASE WHEN v_sort='tendencia' AND v_order='desc' THEN CASE l.tendencia WHEN 'descendo' THEN 1 WHEN 'alternando' THEN 2 WHEN 'estavel' THEN 3 WHEN 'subindo' THEN 4 END END DESC, CASE WHEN v_sort='nome' AND v_order='desc' THEN l.nome END DESC, l.nome ASC ) AS rn FROM linhas_filtrado l ), totais AS (SELECT count(*) AS total FROM linhas_filtrado) SELECT jsonb_build_object( 'data', jsonb_build_object( 'data', COALESCE(( SELECT jsonb_agg(jsonb_build_object( 'id', o.id, 'nome', o.nome, 'semestre', o.semestre, 'grupo', o.grupo, 'proficiencias', o.proficiencias, 
          'tendencia', o.tendencia,
          'perfil', (SELECT array_remove(ARRAY[
            CASE WHEN atual BETWEEN 52 AND 59 THEN 'virada' END,
            CASE WHEN atual < 45 OR anterior - atual >= 5 THEN 'baixo' END,
            CASE WHEN atual >= 70 AND anterior >= 70 THEN 'bom' END
          ], NULL) FROM (
            SELECT
              (SELECT t.score_proprio FROM tri t WHERE t.student_id = o.id AND t.pai_id =
                (SELECT id FROM sims_ord ORDER BY ord DESC LIMIT 1)) AS atual,
              (SELECT t.score_proprio FROM tri t WHERE t.student_id = o.id AND t.pai_id =
                (SELECT id FROM sims_ord ORDER BY ord DESC LIMIT 1 OFFSET 1)) AS anterior
          ) notas)
         ) ORDER BY o.rn) FROM ordenado o WHERE o.rn > (v_page - 1) * v_size AND o.rn <= v_page * v_size), '[]'::jsonb), 'page', v_page, 'pageSize', v_size, 'total', (SELECT total FROM totais), 'totalPages', CASE WHEN (SELECT total FROM totais) = 0 THEN 0 ELSE ceil((SELECT total FROM totais)::numeric / v_size)::int END ), 'meta', jsonb_build_object( 'periodo', COALESCE((SELECT to_char(min(s.data_ref),'DD/MM/YYYY') || ' — ' || to_char(max(s.data_ref),'DD/MM/YYYY') FROM sims_com_tri s), 'sem simulado com resultado'), 'fonte', 'resultados_alunos_tri · simulados_admin · users', 'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'criterio', (format('Uma posição em proficiencias por simulado com TRI na janela, cada posição com o id do simulado (simuladoId) e o valor correspondente (número ou null onde o aluno não participou — nunca 0), em ordem cronológica. Quando o simulado tem 2+ "filhos" (simulados-irmãos) com resultado, considera a MELHOR tentativa do aluno por filho (maior score_proprio), a mesma linha que o detalhamento do aluno mostra. Grupo: sem nenhum resultado de TRI ainda = null (nota chega depois, por pipeline); todas proficientes (>= 60) = consistentemente_proficiente; nenhuma = consistentemente_nao_proficiente; misto = em_variacao. Tendência sobre a janela toda: existe alguma variação consecutiva positiva E alguma negativa = alternando; só positiva = subindo; só negativa = descendo; nenhuma variação diferente de zero (ou menos de dois pontos com resultado) = estável — sem banda morta, qualquer diferença de sinal conta. Ordenação: %s %s. Recorte: %s.', v_sort, v_order, v_recorte) || CASE WHEN v_grupo IS NOT NULL THEN format(' Filtrado ao grupo %s.', v_grupo) ELSE '' END), 'partial', (SELECT count(*) FROM sims_ord) > (SELECT count(*) FROM sims_com_tri), 'lowSample', (SELECT total FROM totais) < 10 ) ) INTO v_result;
        WITH membros AS (
          SELECT m.*, o.valor AS original, a.valor AS atividade
          FROM jsonb_to_recordset(v_membros) m(id uuid, email text, nome text, semestre int, ciclo_id uuid)
          LEFT JOIN LATERAL (
            SELECT e AS valor FROM jsonb_array_elements(v_result->'data'->'data') e
            WHERE (e->>'id')::uuid = m.id LIMIT 1
          ) o ON true
          LEFT JOIN LATERAL (
            SELECT e AS valor FROM jsonb_array_elements(v_atividade) e WHERE e->>'email' = m.email LIMIT 1
          ) a ON true
        )
        SELECT jsonb_set(v_result, '{data}', jsonb_build_object(
          'data', coalesce(jsonb_agg(
            coalesce(n.original, jsonb_build_object('id', n.id, 'nome', n.nome, 'semestre', n.semestre,
              'grupo', null, 'proficiencias', '[]'::jsonb, 'tendencia', 'estavel', 'perfil', '[]'::jsonb)) || jsonb_build_object(
              'email', n.email,
              'ultima_atividade', n.atividade->'ultima_atividade',
              'sinalizado_em', (SELECT max(s.criado_em) FROM public.mentoria_sinalizacoes s
                JOIN public.mentoria_vinculos v ON s.ciclo_id = v.id
                WHERE v.id = n.ciclo_id AND v.mentor_id = v_mentor AND v.fim IS NULL
                  AND s.mentor_id = v_mentor AND s.aluno_email = n.email)
            ) ORDER BY n.nome, n.email), '[]'::jsonb),
          'page', 1, 'pageSize', count(*), 'total', count(*),
          'totalPages', CASE WHEN count(*) = 0 THEN 0 ELSE 1 END
        )) INTO v_result FROM membros n;
      
      v_result := jsonb_set(v_result, '{meta}', (v_result->'meta') || jsonb_build_object(
        'partial', coalesce((v_result->'meta'->>'partial')::boolean, false)
          OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_membros) e WHERE e->>'id' IS NULL),
        'alunosSemAcademy', (SELECT count(*) FROM jsonb_array_elements(v_membros) e WHERE e->>'id' IS NULL)
      ));
      RETURN v_result;
    END;
    $function$;

-- ======================================================================
-- public.mentor_temas_turma_b2b(p_inicio date, p_fim date)
-- ======================================================================
CREATE OR REPLACE FUNCTION public.mentor_temas_turma_b2b(p_inicio date DEFAULT NULL::date, p_fim date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_mentor uuid := public.mentor_ativo_id();
  v_ies uuid;
BEGIN
  SELECT m.ies_id INTO v_ies FROM public.mentores m WHERE m.user_id = v_mentor AND m.tipo = 'b2b';
  IF NOT FOUND OR v_ies IS NULL THEN RAISE EXCEPTION 'mentor_b2b_obrigatorio' USING ERRCODE = '42501'; END IF;
  IF p_inicio > p_fim THEN RAISE EXCEPTION 'periodo_invalido' USING ERRCODE = '22023'; END IF;
  RETURN (
    WITH sims AS (
      SELECT sa.id FROM public.simulados_admin sa
      WHERE v_ies = ANY(sa.ies_ids) AND sa.simulado_pai_id IS NULL AND sa.status IN ('ativo','encerrado')
        AND (sa.liberacao_desempenho = 'imediato'
          OR (sa.liberacao_desempenho = 'agendado' AND sa.data_liberacao_desempenho IS NOT NULL
            AND sa.data_liberacao_desempenho <= now())
          OR (sa.liberacao_desempenho = 'ao_encerrar' AND (sa.status = 'encerrado' OR sa.data_encerramento <= now())))
        AND (p_inicio IS NULL OR (COALESCE(sa.data_realizacao, sa.data_encerramento, sa.data_liberacao, sa.created_at)
          AT TIME ZONE 'America/Sao_Paulo')::date >= p_inicio)
        AND (p_fim IS NULL OR (COALESCE(sa.data_realizacao, sa.data_encerramento, sa.data_liberacao, sa.created_at)
          AT TIME ZONE 'America/Sao_Paulo')::date <= p_fim)
    ), grupo AS (
      SELECT sa.id AS simulado_id, coalesce(sa.simulado_pai_id, sa.id) AS pai_id
      FROM public.simulados_admin sa WHERE coalesce(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims)
    ), alunos AS (
      SELECT DISTINCT u.id, u.nome, u.semestre
      FROM public.mentoria_vinculos v
      LEFT JOIN LATERAL (
        SELECT d0.academy_user_id FROM public.dim_aluno_b2b d0 WHERE d0.email_normalizado = v.email_normalizado
        ORDER BY (d0.status_atual = 'ativo') DESC NULLS LAST, d0.sanarflix_user_id LIMIT 1
      ) d ON true
      LEFT JOIN LATERAL (
        SELECT u0.id FROM public.users u0 WHERE lower(btrim(u0.email)) = v.email_normalizado ORDER BY u0.id LIMIT 1
      ) ue ON true
      JOIN public.users u ON u.id = coalesce(v.academy_user_id, d.academy_user_id, ue.id)
      WHERE v.mentor_id = v_mentor AND v.fim IS NULL
    ), ultima AS (
      SELECT DISTINCT ON (sf.user_id, g.pai_id) sf.user_id, g.pai_id, sf.simulado_id
      FROM public.simulados_finalizados sf JOIN grupo g ON g.simulado_id = sf.simulado_id
      WHERE sf.user_id IN (SELECT id FROM alunos)
      ORDER BY sf.user_id, g.pai_id, sf.finalizado_em DESC NULLS LAST
    ), ultima_fb AS (
      SELECT DISTINCT ON (ap.user_id, g.pai_id) ap.user_id, g.pai_id, ap.simulado AS simulado_id
      FROM public.answer_progress ap JOIN grupo g ON g.simulado_id = ap.simulado
      JOIN public.simulados_admin sa_ord ON sa_ord.id = ap.simulado
      WHERE ap.user_id IN (SELECT id FROM alunos)
        AND NOT EXISTS (SELECT 1 FROM ultima u WHERE u.user_id = ap.user_id AND u.pai_id = g.pai_id)
      ORDER BY ap.user_id, g.pai_id, sa_ord.created_at DESC NULLS LAST
    ), tentativas AS (SELECT * FROM ultima UNION ALL SELECT * FROM ultima_fb),
    temas AS (
      SELECT q.grande_area, q.especialidade, q.tema, count(*) AS respostas,
        count(DISTINCT t.user_id) AS amostra,
        round(100.0 * count(*) FILTER (WHERE ap.correct) / nullif(count(*), 0), 0) AS acerto_pct
      FROM tentativas t JOIN public.answer_progress ap ON ap.user_id = t.user_id AND ap.simulado = t.simulado_id
      JOIN public.questoes_simulado q ON q.id = ap.question_id
      WHERE COALESCE(q.anulada,false) = false AND q.tema IS NOT NULL
      GROUP BY q.grande_area, q.especialidade, q.tema
    ), referencia AS (
      SELECT t.*, t.respostas >= 30 AND t.acerto_pct < 50 AS critico, p.prevalencia,
        CASE p.prevalencia WHEN 'Alta' THEN 3 WHEN 'Média' THEN 2 WHEN 'Baixa' THEN 1 END AS peso
      FROM temas t LEFT JOIN public.enamed_prevalencia_tema p
        ON p.tema_norm = lower(btrim(regexp_replace(t.tema, '\s+', ' ', 'g')))
        AND (p.grande_area IS NULL OR p.grande_area = t.grande_area)
        AND (p.especialidade IS NULL OR p.especialidade = t.especialidade)
    )
    SELECT jsonb_build_object('data', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'grande_area', grande_area, 'especialidade', especialidade, 'tema', tema,
      'respostas', respostas, 'acerto_pct', acerto_pct, 'critico', critico,
      'prevalencia', prevalencia, 'impacto', peso * (100 - acerto_pct),
      'amostra', amostra, 'lowSample', amostra < 10
    ) ORDER BY peso * (100 - acerto_pct) DESC NULLS LAST, acerto_pct, grande_area, especialidade, tema)
      FROM referencia), '[]'::jsonb),
      'meta', jsonb_build_object('periodo', jsonb_build_object('inicio', p_inicio, 'fim', p_fim),
        'fonte', 'answer_progress / questoes_simulado / enamed_prevalencia_tema / mentoria_vinculos',
        'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'criterio', 'Ultima tentativa; anuladas excluidas. Critico: 30+ respostas e acerto < 50. Impacto desconhecido sem prevalencia.',
        'partial', EXISTS (SELECT 1 FROM referencia WHERE prevalencia IS NULL),
        'lowSample', coalesce((SELECT max(amostra) FROM referencia), 0) < 10))
  );
END;
$function$;

-- ======================================================================
-- public.mentor_detalhamento_b2b(p_simulados uuid[])
-- ======================================================================
CREATE OR REPLACE FUNCTION public.mentor_detalhamento_b2b(p_simulados uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$-- Deriva de public.get_gestor_detalhamento(uuid,text,uuid[]); copia independente do Gestor.
 DECLARE v_uid uuid := auth.uid(); v_ies uuid; v_sems int[]; v_evid int[]; v_recorte text; v_n int; v_aberta boolean; v_result jsonb; 
    v_mentor uuid := public.mentor_ativo_id();
    v_alunos uuid[];
    v_membros jsonb;
    v_atividade jsonb;
  BEGIN
    SELECT m.ies_id INTO v_ies FROM public.mentores m
    WHERE m.user_id = v_mentor AND m.tipo = 'b2b';
    IF NOT FOUND OR v_ies IS NULL THEN
      RAISE EXCEPTION 'mentor_b2b_obrigatorio' USING ERRCODE = '42501';
    END IF;
    SELECT coalesce(array_agg(DISTINCT a.id) FILTER (WHERE a.id IS NOT NULL), '{}'::uuid[]),
           coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.email), '[]'::jsonb)
    INTO v_alunos, v_membros
    FROM (
      SELECT v.id AS ciclo_id, v.email_normalizado AS email,
             coalesce(v.academy_user_id, d.academy_user_id, ue.id) AS id,
             coalesce(v.nome, u.nome, d.nome, ue.nome) AS nome,
             coalesce(u.semestre, d.semestre_atual, ue.semestre) AS semestre
      FROM public.mentoria_vinculos v
      LEFT JOIN public.users u ON u.id = v.academy_user_id
      LEFT JOIN LATERAL (
        SELECT d0.* FROM public.dim_aluno_b2b d0
        WHERE d0.email_normalizado = v.email_normalizado
        ORDER BY (d0.status_atual = 'ativo') DESC NULLS LAST, d0.sanarflix_user_id
        LIMIT 1
      ) d ON true
      LEFT JOIN LATERAL (
        SELECT u0.* FROM public.users u0
        WHERE lower(btrim(u0.email)) = v.email_normalizado
        ORDER BY u0.id LIMIT 1
      ) ue ON true
      WHERE v.mentor_id = v_mentor AND v.fim IS NULL
    ) a;
  
    IF p_simulados IS NULL OR cardinality(p_simulados) = 0 THEN
      RAISE EXCEPTION 'selecao_de_simulados_obrigatoria' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1 FROM unnest(p_simulados) pedido(id)
      WHERE NOT EXISTS (
        SELECT 1 FROM public.simulados_admin sa
        WHERE sa.id = pedido.id AND v_ies = ANY(sa.ies_ids)
          AND sa.simulado_pai_id IS NULL AND sa.status IN ('ativo','encerrado')
          AND (sa.liberacao_desempenho = 'imediato'
            OR (sa.liberacao_desempenho = 'agendado'
              AND sa.data_liberacao_desempenho IS NOT NULL AND sa.data_liberacao_desempenho <= now())
            OR (sa.liberacao_desempenho = 'ao_encerrar'
              AND (sa.status = 'encerrado' OR sa.data_encerramento <= now())))
      )
    ) THEN
      RAISE EXCEPTION 'simulado_fora_do_escopo' USING ERRCODE = '42501';
    END IF;
   v_sems := NULL; 
          v_evid := NULL; v_recorte := 'turma do mentor'; v_n := cardinality(p_simulados);
          SELECT cardinality(p_simulados) = 1 AND sa.status = 'ativo'
            AND (sa.data_liberacao IS NULL OR sa.data_liberacao <= now())
            AND (sa.data_encerramento IS NULL OR sa.data_encerramento >= now())
          INTO v_aberta FROM public.simulados_admin sa WHERE sa.id = p_simulados[1];
        WITH sims AS ( SELECT sa.id, sa.nome, COALESCE(sa.data_realizacao, sa.data_encerramento, sa.data_liberacao, sa.created_at) AS data_ref FROM (SELECT * FROM public.simulados_admin WHERE type = 'simulado_enamed') sa WHERE sa.id = ANY (p_simulados) ), sims_ord AS ( SELECT s.*, row_number() OVER (ORDER BY s.data_ref NULLS LAST, s.nome) AS ord FROM sims s ), grupo AS ( SELECT sa.id AS simulado_id, COALESCE(sa.simulado_pai_id, sa.id) AS pai_id FROM (SELECT * FROM public.simulados_admin WHERE type = 'simulado_enamed') sa WHERE COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims) ), alunos AS ( SELECT u.id, u.nome, u.semestre FROM (
    SELECT DISTINCT ON (u.id) u.id, coalesce(m.nome, u.nome) AS nome,
      coalesce(m.semestre, u.semestre) AS semestre
    FROM jsonb_to_recordset(v_membros) m(id uuid, nome text, semestre int, email text)
    JOIN public.users u ON u.id = m.id WHERE u.id = ANY(v_alunos)
    ORDER BY u.id, m.email
  ) u ), ultima AS ( SELECT DISTINCT ON (sf.user_id, g.pai_id) sf.user_id, g.pai_id, sf.simulado_id FROM public.simulados_finalizados sf JOIN grupo g ON g.simulado_id = sf.simulado_id WHERE sf.user_id IN (SELECT id FROM alunos) ORDER BY sf.user_id, g.pai_id, sf.finalizado_em DESC NULLS LAST ), ultima_fb AS ( SELECT DISTINCT ON (ap.user_id, g.pai_id) ap.user_id, g.pai_id, ap.simulado AS simulado_id FROM public.answer_progress ap JOIN grupo g ON g.simulado_id = ap.simulado JOIN (SELECT * FROM public.simulados_admin WHERE type = 'simulado_enamed') sa_ord ON sa_ord.id = ap.simulado WHERE ap.user_id IN (SELECT id FROM alunos) AND NOT EXISTS (SELECT 1 FROM ultima u WHERE u.user_id = ap.user_id AND u.pai_id = g.pai_id) ORDER BY ap.user_id, g.pai_id, sa_ord.created_at DESC NULLS LAST ), tentativas AS (SELECT * FROM ultima UNION ALL SELECT * FROM ultima_fb), respostas AS ( SELECT t.pai_id, t.user_id, a.semestre, ap.correct, ap.question_id, q.grande_area, q.tema FROM tentativas t JOIN alunos a ON a.id = t.user_id JOIN public.answer_progress ap ON ap.user_id = t.user_id AND ap.simulado = t.simulado_id JOIN public.questoes_simulado q ON q.id = ap.question_id WHERE COALESCE(q.anulada,false) = false ), tri_raw AS ( SELECT COALESCE(sa.simulado_pai_id, sa.id) AS pai_id, r.student_id, a.semestre, r.score_proprio, sa.id AS simulado_id, COALESCE(sa.data_realizacao, sa.data_encerramento, sa.data_liberacao, sa.created_at) AS data_ref FROM public.resultados_alunos_tri r JOIN (SELECT * FROM public.simulados_admin WHERE type = 'simulado_enamed') sa ON sa.id = r.simulado_id JOIN alunos a ON a.id = r.student_id WHERE r.college_id = v_ies AND COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims) AND r.score_proprio IS NOT NULL ), tri AS ( SELECT DISTINCT ON (t.student_id, t.pai_id) t.pai_id, t.student_id, t.semestre, t.score_proprio FROM tri_raw t ORDER BY t.student_id, t.pai_id, t.score_proprio DESC ), metricas AS ( SELECT s.id, s.nome, s.data_ref, s.ord, (SELECT count(DISTINCT r.user_id) FROM respostas r WHERE r.pai_id = s.id) AS n_resp, (SELECT count(*) FILTER (WHERE r.correct) FROM respostas r WHERE r.pai_id = s.id) AS acertos, (SELECT count(*) FROM respostas r WHERE r.pai_id = s.id) AS total, (SELECT count(DISTINCT t.student_id) FROM tri t WHERE t.pai_id = s.id) AS n_tri, (SELECT count(DISTINCT t.student_id) FILTER (WHERE t.score_proprio >= 60) FROM tri t WHERE t.pai_id = s.id) AS n_prof, (SELECT avg(t.score_proprio) FROM tri t WHERE t.pai_id = s.id) AS prof_media FROM sims_ord s ), areas AS ( SELECT r.grande_area AS area, count(*) AS total, count(*) FILTER (WHERE r.correct) AS acertos FROM respostas r WHERE r.grande_area IS NOT NULL GROUP BY r.grande_area ), areas_nivel AS ( SELECT a.area, round(100.0 * a.acertos / NULLIF(a.total,0), 0) AS acerto_pct FROM areas a ), semestres AS ( SELECT r.semestre, count(DISTINCT r.user_id) AS n_alunos, count(*) AS total, count(*) FILTER (WHERE r.correct) AS acertos FROM respostas r WHERE r.semestre IS NOT NULL GROUP BY r.semestre ), dispersao AS ( SELECT DISTINCT ON (t.student_id) t.student_id, t.semestre, t.score_proprio FROM tri t JOIN metricas m ON m.id = t.pai_id ORDER BY t.student_id, m.ord DESC ), alvo AS ( SELECT s.id, s.ord FROM sims_ord s ORDER BY s.ord DESC LIMIT 1 ), anterior AS ( SELECT s.id FROM sims_ord s, alvo a WHERE s.ord = a.ord - 1 ), aluno_linha AS ( SELECT a.id, a.nome, a.semestre, EXISTS (SELECT 1 FROM tentativas t, alvo v WHERE t.user_id = a.id AND t.pai_id = v.id) AS participou, (SELECT count(*) FILTER (WHERE r.correct) FROM respostas r, alvo v WHERE r.user_id = a.id AND r.pai_id = v.id) AS acertos_calc, (SELECT t.score_proprio FROM tri t, alvo v WHERE t.student_id = a.id AND t.pai_id = v.id) AS prof_atual, (SELECT t.score_proprio FROM tri t, anterior p WHERE t.student_id = a.id AND t.pai_id = p.id) AS prof_anterior FROM alunos a ), q_base AS ( SELECT q.id, COALESCE(q.numero_questao, q.ordem) AS numero, q.grande_area, q.especialidade, q.tema, q.enunciado, upper(q.correta) AS correta, q.alternativa_a, q.alternativa_b, q.alternativa_c, q.alternativa_d, q.alternativa_e FROM public.questoes_simulado q WHERE v_n = 1 AND q.simulado_id IN (SELECT g.simulado_id FROM grupo g) AND COALESCE(q.anulada,false) = false ), q_resp AS ( SELECT ap.question_id, count(*) AS total, count(*) FILTER (WHERE ap.correct) AS acertos, count(*) FILTER (WHERE upper(ap.resposta_usuario) IN ('A','B','C','D','E')) AS marcadas, count(*) FILTER (WHERE upper(ap.resposta_usuario) = 'A') AS m_a, count(*) FILTER (WHERE upper(ap.resposta_usuario) = 'B') AS m_b, count(*) FILTER (WHERE upper(ap.resposta_usuario) = 'C') AS m_c, count(*) FILTER (WHERE upper(ap.resposta_usuario) = 'D') AS m_d, count(*) FILTER (WHERE upper(ap.resposta_usuario) = 'E') AS m_e FROM tentativas t JOIN public.answer_progress ap ON ap.user_id = t.user_id AND ap.simulado = t.simulado_id GROUP BY ap.question_id ), q_full AS ( SELECT b.*, COALESCE(r.total,0) AS total, COALESCE(r.acertos,0) AS acertos, COALESCE(r.marcadas,0) AS marcadas, COALESCE(r.m_a,0) AS m_a, COALESCE(r.m_b,0) AS m_b, COALESCE(r.m_c,0) AS m_c, COALESCE(r.m_d,0) AS m_d, COALESCE(r.m_e,0) AS m_e, CASE WHEN COALESCE(r.total,0) > 0 THEN round(100.0 * r.acertos / r.total, 0) END AS acerto_pct FROM q_base b LEFT JOIN q_resp r ON r.question_id = b.id ), q_alts AS ( SELECT f.id, jsonb_agg(jsonb_build_object( 'letra', a.letra, 'texto', a.texto, 'correta', CASE WHEN v_aberta THEN NULL ELSE (a.letra = f.correta) END, 'marcadaPct', CASE WHEN f.marcadas > 0 THEN round(100.0 * a.n / f.marcadas, 0) END ) ORDER BY a.letra) AS alternativas, CASE WHEN v_aberta THEN NULL ELSE ( SELECT d.letra FROM (VALUES ('A',f.m_a),('B',f.m_b),('C',f.m_c),('D',f.m_d),('E',f.m_e)) AS d(letra,n) WHERE d.letra <> f.correta AND d.n > 0 ORDER BY d.n DESC, d.letra LIMIT 1 ) END AS distrator FROM q_full f CROSS JOIN LATERAL (VALUES ('A', f.alternativa_a, f.m_a), ('B', f.alternativa_b, f.m_b), ('C', f.alternativa_c, f.m_c), ('D', f.alternativa_d, f.m_d), ('E', f.alternativa_e, f.m_e) ) AS a(letra, texto, n) WHERE a.texto IS NOT NULL GROUP BY f.id, f.correta, f.marcadas, f.m_a, f.m_b, f.m_c, f.m_d, f.m_e ), q_page AS ( SELECT f.*, al.alternativas, al.distrator, row_number() OVER (ORDER BY f.numero) AS rn FROM q_full f JOIN q_alts al ON al.id = f.id ), temas_cmp AS ( SELECT r.tema, r.pai_id, count(*) AS total, count(*) FILTER (WHERE r.correct) AS acertos FROM respostas r WHERE v_n >= 2 AND r.tema IS NOT NULL GROUP BY r.tema, r.pai_id ) SELECT jsonb_build_object( 'data', jsonb_build_object( 'metricas', COALESCE(( SELECT jsonb_agg(jsonb_build_object( 'simuladoId', m.id, 'nome', m.nome, 'data', to_char(m.data_ref AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'participantes', GREATEST(m.n_resp, m.n_tri), 'proficientesPct', CASE WHEN m.n_tri > 0 THEN round(100.0 * m.n_prof / m.n_tri, 0) END, 'acertoMedioPct', CASE WHEN m.total > 0 THEN round(100.0 * m.acertos / m.total, 0) END, 'enamedProjetado', CASE WHEN m.n_tri = 0 THEN NULL WHEN 100.0 * m.n_prof / m.n_tri >= 90 THEN 5 WHEN 100.0 * m.n_prof / m.n_tri >= 75 THEN 4 WHEN 100.0 * m.n_prof / m.n_tri >= 60 THEN 3 WHEN 100.0 * m.n_prof / m.n_tri >= 40 THEN 2 ELSE 1 END, 'proficienciaMedia', CASE WHEN m.prof_media IS NULL THEN NULL ELSE round(m.prof_media::numeric, 1) END ) ORDER BY m.ord) FROM metricas m), '[]'::jsonb), 'alunos', COALESCE(( SELECT jsonb_agg(jsonb_build_object( 'id', l.id, 'nome', l.nome, 'semestre', l.semestre, 'participou', l.participou, 'acertos', CASE WHEN l.participou THEN l.acertos_calc END, 'proficiencia', CASE WHEN l.prof_atual IS NULL THEN NULL ELSE round(l.prof_atual::numeric, 1) END, 'situacao', CASE WHEN NOT l.participou THEN 'nao_participou' WHEN l.prof_atual IS NULL THEN 'aguardando_resultado' WHEN l.prof_atual >= 60 THEN 'proficiente' ELSE 'abaixo_do_limiar' END, 'variacao', CASE WHEN l.prof_atual IS NOT NULL AND l.prof_anterior IS NOT NULL THEN round((l.prof_atual - l.prof_anterior)::numeric, 1) END ) ORDER BY l.nome) FROM aluno_linha l ), '[]'::jsonb), 'acertoPorAreaESemestre', jsonb_build_object( 'areas', COALESCE(( SELECT jsonb_agg(jsonb_build_object( 'id', a.area, 'nome', a.area, 'acertoPct', a.acerto_pct, 'critica', COALESCE(a.acerto_pct < 30, false) ) ORDER BY a.area) FROM areas_nivel a), '[]'::jsonb), 'semestres', COALESCE(( SELECT jsonb_agg(jsonb_build_object( 'semestre', s.semestre, 'acertoPct', round(100.0 * s.acertos / NULLIF(s.total,0), 0), 'emEvidencia', COALESCE(s.semestre = ANY (v_evid), false), 'alunos', s.n_alunos ) ORDER BY s.semestre) FROM semestres s), '[]'::jsonb), 'matriz', COALESCE(( SELECT jsonb_agg(jsonb_build_object( 'areaId', m.grande_area, 'semestre', m.semestre, 'acertoPct', round(100.0 * m.acertos / NULLIF(m.total,0), 0), 'amostra', m.total ) ORDER BY m.grande_area, m.semestre) FROM ( SELECT r.grande_area, r.semestre, count(*) AS total, count(*) FILTER (WHERE r.correct) AS acertos FROM respostas r WHERE r.grande_area IS NOT NULL AND r.semestre IS NOT NULL GROUP BY r.grande_area, r.semestre ) m), '[]'::jsonb) ), 'dispersao', COALESCE(( SELECT jsonb_agg(jsonb_build_object( 'alunoId', d.student_id, 'semestre', d.semestre, 'nota', round(d.score_proprio::numeric, 1))) FROM dispersao d WHERE d.semestre IS NOT NULL), '[]'::jsonb), 'questoes', CASE WHEN v_n = 1 THEN jsonb_build_object( 'data', COALESCE(( SELECT jsonb_agg(jsonb_build_object( 'numero', p.numero, 'grandeArea', p.grande_area, 'especialidade',p.especialidade, 'tema', p.tema, 'acertoPct', p.acerto_pct, 'enunciado', p.enunciado, 'alternativas', p.alternativas, 'distratorDominante', p.distrator ) ORDER BY p.rn) FROM q_page p WHERE p.rn <= 20), '[]'::jsonb), 'page', 1, 'pageSize', 20, 'total', (SELECT count(*) FROM q_page), 'totalPages', CASE WHEN (SELECT count(*) FROM q_page) = 0 THEN 0 ELSE ceil((SELECT count(*) FROM q_page)::numeric / 20)::int END ) END, 'comparativoTemas', CASE WHEN v_n >= 2 THEN COALESCE(( SELECT jsonb_agg(jsonb_build_object( 'tema', t.tema, 'porSimulado', COALESCE(( SELECT jsonb_agg(jsonb_build_object( 'simuladoId', m.id, 'acertoPct', round(100.0 * c.acertos / NULLIF(c.total,0), 0) ) ORDER BY m.ord) FROM temas_cmp c JOIN metricas m ON m.id = c.pai_id WHERE c.tema = t.tema), '[]'::jsonb) ) ORDER BY t.tema) FROM (SELECT DISTINCT tema FROM temas_cmp) t), '[]'::jsonb) END ), 'meta', jsonb_build_object( 'periodo', COALESCE((SELECT to_char(min(m.data_ref),'DD/MM/YYYY') || ' — ' || to_char(max(m.data_ref),'DD/MM/YYYY') FROM metricas m), 'seleção sem data'), 'fonte', 'resultados_alunos_tri · answer_progress · questoes_simulado · simulados_admin · simulados_finalizados · users', 'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'criterio', format('Uma entrada em metricas por simulado selecionado; nenhuma média entre simulados. Conceito ENAMED por simulado, derivado do %% de proficientes (>= 60, alunos distintos, uma linha de TRI por aluno por simulado-pai, desempate pela tentativa mais recente). %% de acerto sobre a última tentativa de cada aluno, questão anulada ignorada. Questões só com 1 simulado selecionado; comparativo por tema só com 2 ou mais. Prova ainda aberta ao aluno (status ativo, dentro da janela de liberação/encerramento): %s — enquanto aberta, correta e distratorDominante vêm null, gabarito não é exposto. Simulados selecionados: %s. Recorte: %s.', v_aberta, v_n, v_recorte), 'partial', (SELECT count(*) FROM metricas WHERE n_tri = 0) > 0, 'lowSample', COALESCE((SELECT min(GREATEST(m.n_resp, m.n_tri)) FROM metricas m), 0) < 10 ) ) INTO v_result;
      v_result := jsonb_set(v_result, '{meta}', (v_result->'meta') || jsonb_build_object(
        'partial', coalesce((v_result->'meta'->>'partial')::boolean, false)
          OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_membros) e WHERE e->>'id' IS NULL),
        'alunosSemAcademy', (SELECT count(*) FROM jsonb_array_elements(v_membros) e WHERE e->>'id' IS NULL)
      ));
      RETURN v_result;
    END;
    $function$;

-- ======================================================================
-- public.mentor_questoes_b2b(p_simulados uuid[])
-- ======================================================================
CREATE OR REPLACE FUNCTION public.mentor_questoes_b2b(p_simulados uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$-- Deriva de public.get_gestor_questoes(uuid,uuid,integer,integer,text,text,text); copia independente do Gestor.
 DECLARE v_uid uuid := auth.uid(); v_ies uuid; v_sort text; v_page int; v_size int; v_aberta boolean; v_sems int[]; v_result jsonb; 
          p_simulado_id uuid; p_area text := NULL;
          v_itens jsonb := '[]'::jsonb; v_metas jsonb := '[]'::jsonb;
        
    v_mentor uuid := public.mentor_ativo_id();
    v_alunos uuid[];
    v_membros jsonb;
    v_atividade jsonb;
  BEGIN
    SELECT m.ies_id INTO v_ies FROM public.mentores m
    WHERE m.user_id = v_mentor AND m.tipo = 'b2b';
    IF NOT FOUND OR v_ies IS NULL THEN
      RAISE EXCEPTION 'mentor_b2b_obrigatorio' USING ERRCODE = '42501';
    END IF;
    SELECT coalesce(array_agg(DISTINCT a.id) FILTER (WHERE a.id IS NOT NULL), '{}'::uuid[]),
           coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.email), '[]'::jsonb)
    INTO v_alunos, v_membros
    FROM (
      SELECT v.id AS ciclo_id, v.email_normalizado AS email,
             coalesce(v.academy_user_id, d.academy_user_id, ue.id) AS id,
             coalesce(v.nome, u.nome, d.nome, ue.nome) AS nome,
             coalesce(u.semestre, d.semestre_atual, ue.semestre) AS semestre
      FROM public.mentoria_vinculos v
      LEFT JOIN public.users u ON u.id = v.academy_user_id
      LEFT JOIN LATERAL (
        SELECT d0.* FROM public.dim_aluno_b2b d0
        WHERE d0.email_normalizado = v.email_normalizado
        ORDER BY (d0.status_atual = 'ativo') DESC NULLS LAST, d0.sanarflix_user_id
        LIMIT 1
      ) d ON true
      LEFT JOIN LATERAL (
        SELECT u0.* FROM public.users u0
        WHERE lower(btrim(u0.email)) = v.email_normalizado
        ORDER BY u0.id LIMIT 1
      ) ue ON true
      WHERE v.mentor_id = v_mentor AND v.fim IS NULL
    ) a;
  
    IF p_simulados IS NULL OR cardinality(p_simulados) = 0 THEN
      RAISE EXCEPTION 'selecao_de_simulados_obrigatoria' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1 FROM unnest(p_simulados) pedido(id)
      WHERE NOT EXISTS (
        SELECT 1 FROM public.simulados_admin sa
        WHERE sa.id = pedido.id AND v_ies = ANY(sa.ies_ids)
          AND sa.simulado_pai_id IS NULL AND sa.status IN ('ativo','encerrado')
          AND (sa.liberacao_desempenho = 'imediato'
            OR (sa.liberacao_desempenho = 'agendado'
              AND sa.data_liberacao_desempenho IS NOT NULL AND sa.data_liberacao_desempenho <= now())
            OR (sa.liberacao_desempenho = 'ao_encerrar'
              AND (sa.status = 'encerrado' OR sa.data_encerramento <= now())))
      )
    ) THEN
      RAISE EXCEPTION 'simulado_fora_do_escopo' USING ERRCODE = '42501';
    END IF;
   v_sems := NULL; 
          v_sort := 'numero'; v_page := 1; v_size := 2147483647;
          FOR p_simulado_id IN SELECT DISTINCT unnest(p_simulados) LOOP
            SELECT sa.status = 'ativo'
              AND (sa.data_liberacao IS NULL OR sa.data_liberacao <= now())
              AND (sa.data_encerramento IS NULL OR sa.data_encerramento >= now())
            INTO v_aberta FROM public.simulados_admin sa WHERE sa.id = p_simulado_id;
        WITH grupo AS ( SELECT sa.id AS simulado_id FROM (SELECT * FROM public.simulados_admin WHERE type = 'simulado_enamed') sa WHERE sa.id = p_simulado_id OR sa.simulado_pai_id = p_simulado_id ), alunos AS ( SELECT u.id FROM (
    SELECT DISTINCT ON (u.id) u.id, coalesce(m.nome, u.nome) AS nome,
      coalesce(m.semestre, u.semestre) AS semestre
    FROM jsonb_to_recordset(v_membros) m(id uuid, nome text, semestre int, email text)
    JOIN public.users u ON u.id = m.id WHERE u.id = ANY(v_alunos)
    ORDER BY u.id, m.email
  ) u ), ultima AS ( SELECT DISTINCT ON (sf.user_id) sf.user_id, sf.simulado_id FROM public.simulados_finalizados sf WHERE sf.simulado_id IN (SELECT simulado_id FROM grupo) AND sf.user_id IN (SELECT id FROM alunos) ORDER BY sf.user_id, sf.finalizado_em DESC NULLS LAST ), ultima_fb AS ( SELECT DISTINCT ON (ap.user_id) ap.user_id, ap.simulado AS simulado_id FROM public.answer_progress ap JOIN (SELECT * FROM public.simulados_admin WHERE type = 'simulado_enamed') sa_ord ON sa_ord.id = ap.simulado WHERE ap.simulado IN (SELECT simulado_id FROM grupo) AND ap.user_id IN (SELECT id FROM alunos) AND ap.user_id NOT IN (SELECT user_id FROM ultima) ORDER BY ap.user_id, sa_ord.created_at DESC NULLS LAST ), tentativas AS (SELECT * FROM ultima UNION ALL SELECT * FROM ultima_fb), q_base AS ( SELECT q.id, COALESCE(q.numero_questao, q.ordem) AS numero, q.grande_area, q.especialidade, q.tema, q.enunciado, upper(q.correta) AS correta, q.alternativa_a, q.alternativa_b, q.alternativa_c, q.alternativa_d, q.alternativa_e, q.imagem AS imagem_enunciado, q.imagem_2 AS imagem_enunciado_2, q.imagem_comentario FROM public.questoes_simulado q WHERE q.simulado_id IN (SELECT simulado_id FROM grupo) AND COALESCE(q.anulada,false) = false AND (p_area IS NULL OR q.grande_area = p_area) ), q_resp AS ( SELECT ap.question_id, count(*) AS total, count(*) FILTER (WHERE ap.correct) AS acertos, count(*) FILTER (WHERE upper(ap.resposta_usuario) IN ('A','B','C','D','E')) AS marcadas, count(*) FILTER (WHERE upper(ap.resposta_usuario) = 'A') AS m_a, count(*) FILTER (WHERE upper(ap.resposta_usuario) = 'B') AS m_b, count(*) FILTER (WHERE upper(ap.resposta_usuario) = 'C') AS m_c, count(*) FILTER (WHERE upper(ap.resposta_usuario) = 'D') AS m_d, count(*) FILTER (WHERE upper(ap.resposta_usuario) = 'E') AS m_e FROM tentativas t JOIN public.answer_progress ap ON ap.user_id = t.user_id AND ap.simulado = t.simulado_id GROUP BY ap.question_id ), q_full AS ( SELECT b.*, COALESCE(r.total,0) AS total, COALESCE(r.acertos,0) AS acertos, COALESCE(r.marcadas,0) AS marcadas, COALESCE(r.m_a,0) AS m_a, COALESCE(r.m_b,0) AS m_b, COALESCE(r.m_c,0) AS m_c, COALESCE(r.m_d,0) AS m_d, COALESCE(r.m_e,0) AS m_e, CASE WHEN COALESCE(r.total,0) > 0 THEN round(100.0 * r.acertos / r.total, 0) END AS acerto_pct FROM q_base b LEFT JOIN q_resp r ON r.question_id = b.id ), q_alts AS ( SELECT f.id, jsonb_agg(jsonb_build_object( 'letra', a.letra, 'texto', a.texto, 'correta', CASE WHEN v_aberta THEN NULL ELSE (a.letra = f.correta) END, 'marcadaPct', CASE WHEN f.marcadas > 0 THEN round(100.0 * a.n / f.marcadas, 0) END ) ORDER BY a.letra) AS alternativas, CASE WHEN v_aberta THEN NULL ELSE ( SELECT d.letra FROM (VALUES ('A',f.m_a),('B',f.m_b),('C',f.m_c),('D',f.m_d),('E',f.m_e)) AS d(letra,n) WHERE d.letra <> f.correta AND d.n > 0 ORDER BY d.n DESC, d.letra LIMIT 1 ) END AS distrator FROM q_full f CROSS JOIN LATERAL (VALUES ('A', f.alternativa_a, f.m_a), ('B', f.alternativa_b, f.m_b), ('C', f.alternativa_c, f.m_c), ('D', f.alternativa_d, f.m_d), ('E', f.alternativa_e, f.m_e) ) AS a(letra, texto, n) WHERE a.texto IS NOT NULL GROUP BY f.id, f.correta, f.marcadas, f.m_a, f.m_b, f.m_c, f.m_d, f.m_e ), ordenado AS ( SELECT f.*, al.alternativas, al.distrator, row_number() OVER ( ORDER BY CASE WHEN v_sort = 'acerto' THEN f.acerto_pct END ASC NULLS LAST, CASE WHEN v_sort = 'acerto_desc' THEN f.acerto_pct END DESC NULLS LAST, f.numero ASC ) AS rn FROM q_full f JOIN q_alts al ON al.id = f.id ), totais AS (SELECT count(*) AS total FROM ordenado) SELECT jsonb_build_object( 'data', jsonb_build_object( 'data', COALESCE(( SELECT jsonb_agg(jsonb_build_object( 'id', o.id, 'numero', o.numero, 'grandeArea', o.grande_area, 'especialidade', o.especialidade, 'tema', o.tema, 'acertoPct', o.acerto_pct, 'enunciado', o.enunciado, 'imagemEnunciado', o.imagem_enunciado, 'imagemEnunciado2', o.imagem_enunciado_2, 'imagemComentario', CASE WHEN v_aberta THEN NULL ELSE o.imagem_comentario END, 'alternativas', o.alternativas, 'distratorDominante', o.distrator ) ORDER BY o.rn) FROM ordenado o WHERE o.rn > (v_page - 1) * v_size AND o.rn <= v_page * v_size), '[]'::jsonb), 'page', v_page, 'pageSize', v_size, 'total', (SELECT total FROM totais), 'totalPages', CASE WHEN (SELECT total FROM totais) = 0 THEN 0 ELSE ceil((SELECT total FROM totais)::numeric / v_size)::int END ), 'meta', jsonb_build_object( 'periodo', COALESCE((SELECT to_char(COALESCE(sa.data_realizacao, sa.data_encerramento, sa.data_liberacao, sa.created_at),'DD/MM/YYYY') FROM (SELECT * FROM public.simulados_admin WHERE type = 'simulado_enamed') sa WHERE sa.id = p_simulado_id), 'sem data'), 'fonte', 'answer_progress · questoes_simulado · simulados_admin · users', 'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'criterio', format('Índice de acerto da questão = respostas corretas / respostas na última tentativa de cada aluno da IES. marcadaPct = distribuição entre quem marcou alguma alternativa. Questão anulada não é listada. Distrator dominante = alternativa incorreta mais marcada. Ordenação: %s. Filtro de grande área: %s. Prova ainda aberta ao aluno (status ativo, dentro da janela de liberação/encerramento): %s — enquanto aberta, correta e distratorDominante vêm null, gabarito não é exposto.', v_sort, COALESCE(p_area, 'todas'), v_aberta), 'partial', (SELECT count(*) FROM q_full WHERE total = 0) > 0, 'lowSample', COALESCE((SELECT max(f.total) FROM q_full f), 0) < 10 ) ) INTO v_result;
            v_itens := v_itens || coalesce((SELECT jsonb_agg(e || jsonb_build_object('simuladoId', p_simulado_id))
              FROM jsonb_array_elements(v_result->'data'->'data') e), '[]'::jsonb);
            v_metas := v_metas || jsonb_build_array(v_result->'meta');
          END LOOP;
          v_result := jsonb_build_object('data', jsonb_build_object('data', v_itens,
            'page', 1, 'pageSize', jsonb_array_length(v_itens), 'total', jsonb_array_length(v_itens),
            'totalPages', CASE WHEN jsonb_array_length(v_itens) = 0 THEN 0 ELSE 1 END),
            'meta', (v_result->'meta') || jsonb_build_object('simulados', p_simulados,
              'periodo', 'simulados selecionados',
              'partial', (SELECT bool_or((e->>'partial')::boolean) FROM jsonb_array_elements(v_metas) e),
              'lowSample', (SELECT bool_and((e->>'lowSample')::boolean) FROM jsonb_array_elements(v_metas) e)));
        
      v_result := jsonb_set(v_result, '{meta}', (v_result->'meta') || jsonb_build_object(
        'partial', coalesce((v_result->'meta'->>'partial')::boolean, false)
          OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_membros) e WHERE e->>'id' IS NULL),
        'alunosSemAcademy', (SELECT count(*) FROM jsonb_array_elements(v_membros) e WHERE e->>'id' IS NULL)
      ));
      RETURN v_result;
    END;
    $function$;

-- ======================================================================
-- public.mentor_questao_respondentes_b2b(p_questao_id uuid, p_simulados uuid[])
-- ======================================================================
CREATE OR REPLACE FUNCTION public.mentor_questao_respondentes_b2b(p_questao_id uuid, p_simulados uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_mentor uuid := public.mentor_ativo_id();
  v_ies uuid;
BEGIN
  SELECT m.ies_id INTO v_ies FROM public.mentores m WHERE m.user_id = v_mentor AND m.tipo = 'b2b';
  IF NOT FOUND OR v_ies IS NULL THEN RAISE EXCEPTION 'mentor_b2b_obrigatorio' USING ERRCODE = '42501'; END IF;
  IF p_questao_id IS NULL THEN RAISE EXCEPTION 'question_id_obrigatorio' USING ERRCODE = '22023'; END IF;
  IF p_simulados IS NULL OR cardinality(p_simulados) = 0 THEN
    RAISE EXCEPTION 'selecao_de_simulados_obrigatoria' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_simulados) pedido(id) WHERE NOT EXISTS (
    SELECT 1 FROM public.simulados_admin sa WHERE sa.id = pedido.id AND v_ies = ANY(sa.ies_ids)
      AND sa.simulado_pai_id IS NULL AND sa.status IN ('ativo','encerrado')
      AND (sa.liberacao_desempenho = 'imediato'
        OR (sa.liberacao_desempenho = 'agendado' AND sa.data_liberacao_desempenho IS NOT NULL
          AND sa.data_liberacao_desempenho <= now())
        OR (sa.liberacao_desempenho = 'ao_encerrar' AND (sa.status = 'encerrado' OR sa.data_encerramento <= now())))
  )) THEN RAISE EXCEPTION 'simulado_fora_do_escopo' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.questoes_simulado q JOIN public.simulados_admin sa ON sa.id = q.simulado_id
    WHERE q.id = p_questao_id AND coalesce(sa.simulado_pai_id, sa.id) = ANY(p_simulados)
      AND COALESCE(q.anulada,false) = false) THEN
    RAISE EXCEPTION 'questao_fora_do_escopo' USING ERRCODE = '42501';
  END IF;
  RETURN (
    WITH alunos AS (
      SELECT DISTINCT u.id, u.nome, v.email_normalizado AS email
      FROM public.mentoria_vinculos v
      LEFT JOIN LATERAL (
        SELECT d0.academy_user_id FROM public.dim_aluno_b2b d0 WHERE d0.email_normalizado = v.email_normalizado
        ORDER BY (d0.status_atual = 'ativo') DESC NULLS LAST, d0.sanarflix_user_id LIMIT 1
      ) d ON true
      LEFT JOIN LATERAL (
        SELECT u0.id FROM public.users u0 WHERE lower(btrim(u0.email)) = v.email_normalizado ORDER BY u0.id LIMIT 1
      ) ue ON true
      JOIN public.users u ON u.id = coalesce(v.academy_user_id, d.academy_user_id, ue.id)
      WHERE v.mentor_id = v_mentor AND v.fim IS NULL
    ), grupo AS (
      SELECT sa.id AS simulado_id, coalesce(sa.simulado_pai_id, sa.id) AS pai_id
      FROM public.simulados_admin sa WHERE coalesce(sa.simulado_pai_id, sa.id) = ANY(p_simulados)
    ), ultima AS (
      SELECT DISTINCT ON (sf.user_id, g.pai_id) sf.user_id, g.pai_id, sf.simulado_id
      FROM public.simulados_finalizados sf JOIN grupo g ON g.simulado_id = sf.simulado_id
      WHERE sf.user_id IN (SELECT id FROM alunos)
      ORDER BY sf.user_id, g.pai_id, sf.finalizado_em DESC NULLS LAST
    ), ultima_fb AS (
      SELECT DISTINCT ON (ap.user_id, g.pai_id) ap.user_id, g.pai_id, ap.simulado AS simulado_id
      FROM public.answer_progress ap JOIN grupo g ON g.simulado_id = ap.simulado
      JOIN public.simulados_admin sa_ord ON sa_ord.id = ap.simulado
      WHERE ap.user_id IN (SELECT id FROM alunos)
        AND NOT EXISTS (SELECT 1 FROM ultima u WHERE u.user_id = ap.user_id AND u.pai_id = g.pai_id)
      ORDER BY ap.user_id, g.pai_id, sa_ord.created_at DESC NULLS LAST
    ), tentativas AS (SELECT * FROM ultima UNION ALL SELECT * FROM ultima_fb),
    respondentes AS (
      SELECT DISTINCT a.id, a.nome, a.email, upper(ap.resposta_usuario) AS alternativa
      FROM tentativas t JOIN alunos a ON a.id = t.user_id
      JOIN public.answer_progress ap ON ap.user_id = t.user_id AND ap.simulado = t.simulado_id
      WHERE ap.question_id = p_questao_id AND upper(ap.resposta_usuario) IN ('A','B','C','D','E')
    )
    SELECT jsonb_build_object('data', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'alunoId', ap.id, 'nome', ap.nome, 'email', ap.email, 'alternativa', upper(ap.resposta_usuario)
    ) ORDER BY ap.nome, ap.id, ap.resposta_usuario)
      FROM (SELECT r.*, r.alternativa AS resposta_usuario FROM respondentes r) ap), '[]'::jsonb),
      'meta', jsonb_build_object('fonte', 'answer_progress / users / mentoria_vinculos',
        'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"')))
  );
END;
$function$;

-- ======================================================================
-- public.mentor_cronograma_b2b()
-- ======================================================================
CREATE OR REPLACE FUNCTION public.mentor_cronograma_b2b()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$-- Deriva de public.get_gestor_cronograma(uuid); copia independente do Gestor.
 DECLARE v_uid uuid := auth.uid(); v_ies uuid; v_result jsonb; 
    v_mentor uuid := public.mentor_ativo_id();
    v_alunos uuid[];
    v_membros jsonb;
    v_atividade jsonb;
  BEGIN
    SELECT m.ies_id INTO v_ies FROM public.mentores m
    WHERE m.user_id = v_mentor AND m.tipo = 'b2b';
    IF NOT FOUND OR v_ies IS NULL THEN
      RAISE EXCEPTION 'mentor_b2b_obrigatorio' USING ERRCODE = '42501';
    END IF;
    SELECT coalesce(array_agg(DISTINCT a.id) FILTER (WHERE a.id IS NOT NULL), '{}'::uuid[]),
           coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.email), '[]'::jsonb)
    INTO v_alunos, v_membros
    FROM (
      SELECT v.id AS ciclo_id, v.email_normalizado AS email,
             coalesce(v.academy_user_id, d.academy_user_id, ue.id) AS id,
             coalesce(v.nome, u.nome, d.nome, ue.nome) AS nome,
             coalesce(u.semestre, d.semestre_atual, ue.semestre) AS semestre
      FROM public.mentoria_vinculos v
      LEFT JOIN public.users u ON u.id = v.academy_user_id
      LEFT JOIN LATERAL (
        SELECT d0.* FROM public.dim_aluno_b2b d0
        WHERE d0.email_normalizado = v.email_normalizado
        ORDER BY (d0.status_atual = 'ativo') DESC NULLS LAST, d0.sanarflix_user_id
        LIMIT 1
      ) d ON true
      LEFT JOIN LATERAL (
        SELECT u0.* FROM public.users u0
        WHERE lower(btrim(u0.email)) = v.email_normalizado
        ORDER BY u0.id LIMIT 1
      ) ue ON true
      WHERE v.mentor_id = v_mentor AND v.fim IS NULL
    ) a;
  WITH alunos AS ( SELECT u.id FROM (
    SELECT DISTINCT ON (u.id) u.id, coalesce(m.nome, u.nome) AS nome,
      coalesce(m.semestre, u.semestre) AS semestre
    FROM jsonb_to_recordset(v_membros) m(id uuid, nome text, semestre int, email text)
    JOIN public.users u ON u.id = m.id WHERE u.id = ANY(v_alunos)
    ORDER BY u.id, m.email
  ) u ), sims AS ( SELECT sa.id, sa.nome, sa.modalidade, sa.status, sa.data_encerramento, COALESCE(sa.data_realizacao, sa.data_liberacao) AS data_efetiva, sa.data_agendada_original FROM (SELECT * FROM public.simulados_admin WHERE type = 'simulado_enamed') sa WHERE v_ies = ANY (sa.ies_ids) AND sa.simulado_pai_id IS NULL AND lower(sa.status) NOT IN ('rascunho','draft','arquivado','cancelado') ), grupo AS ( SELECT sa.id AS simulado_id, COALESCE(sa.simulado_pai_id, sa.id) AS pai_id FROM (SELECT * FROM public.simulados_admin WHERE type = 'simulado_enamed') sa WHERE COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims) ), participacao AS ( SELECT p.pai_id, count(DISTINCT p.user_id) AS n FROM ( SELECT g.pai_id, sf.user_id FROM public.simulados_finalizados sf JOIN grupo g ON g.simulado_id = sf.simulado_id WHERE sf.user_id IN (SELECT id FROM alunos) UNION SELECT g.pai_id, ap.user_id FROM public.answer_progress ap JOIN grupo g ON g.simulado_id = ap.simulado WHERE ap.user_id IN (SELECT id FROM alunos) ) p GROUP BY p.pai_id ), com_tri AS ( SELECT DISTINCT COALESCE(sa.simulado_pai_id, sa.id) AS pai_id FROM public.resultados_ies_tri r JOIN (SELECT * FROM public.simulados_admin WHERE type = 'simulado_enamed') sa ON sa.id = r.simulado_id WHERE r.college_id = v_ies ), sim_status AS ( SELECT s.id, s.nome, s.modalidade, s.data_efetiva, COALESCE(p.n, 0) AS participantes, CASE WHEN (lower(s.status) = 'encerrado' OR (s.data_encerramento IS NOT NULL AND s.data_encerramento < now())) AND (EXISTS (SELECT 1 FROM com_tri c WHERE c.pai_id = s.id) OR COALESCE(p.n, 0) > 0) THEN 'realizado' WHEN lower(s.status) = 'encerrado' OR (s.data_encerramento IS NOT NULL AND s.data_encerramento < now()) THEN 'processing' WHEN s.data_efetiva IS NULL THEN 'previsto' WHEN s.data_agendada_original IS NOT NULL AND s.data_agendada_original <> s.data_efetiva THEN 'reagendado' ELSE 'agendado' END AS status FROM sims s LEFT JOIN participacao p ON p.pai_id = s.id ), slots AS ( SELECT sp.id AS slot_id, sp.ordem AS ordem, sp.nome_previsto, sp.simulado_id FROM public.ies_simulado_previsto sp WHERE sp.ies_id = v_ies ), itens AS ( SELECT COALESCE(ss.id, sl.slot_id) AS id, COALESCE(ss.nome, sl.nome_previsto, 'A definir') AS nome, ss.data_efetiva AS data, COALESCE(ss.status, 'previsto') AS status, ss.modalidade AS modalidade, CASE WHEN ss.participantes > 0 THEN ss.participantes END AS participantes, sl.ordem AS ordem FROM slots sl LEFT JOIN sim_status ss ON ss.id = sl.simulado_id UNION ALL SELECT ss.id, ss.nome, ss.data_efetiva, ss.status, ss.modalidade, CASE WHEN ss.participantes > 0 THEN ss.participantes END, NULL::int FROM sim_status ss WHERE NOT EXISTS (SELECT 1 FROM slots sl WHERE sl.simulado_id = ss.id) ) SELECT jsonb_build_object( 'data', COALESCE(( SELECT jsonb_agg(jsonb_build_object( 'id', i.id, 'nome', i.nome, 'data', CASE WHEN i.data IS NULL THEN NULL ELSE to_char(i.data AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') END, 'status', i.status, 'modalidade', i.modalidade, 'participantes', i.participantes, 'indisponivelPorque', CASE WHEN i.status = 'previsto' THEN 'Data a definir pela Sanar' WHEN i.status = 'processing' THEN 'Gabarito em processamento' ELSE NULL END ) ORDER BY i.data NULLS LAST, i.ordem NULLS LAST, i.nome) FROM itens i ), '[]'::jsonb), 'meta', jsonb_build_object( 'periodo', COALESCE(( SELECT to_char(c.vigencia_inicio,'DD/MM/YYYY') || ' — ' || to_char(c.vigencia_fim,'DD/MM/YYYY') FROM public.ies_contrato_simulados c WHERE c.ies_id = v_ies ORDER BY (current_date BETWEEN c.vigencia_inicio AND c.vigencia_fim) DESC, c.vigencia_fim DESC LIMIT 1 ), 'sem contrato cadastrado'), 'fonte', 'ies_contrato_simulados · ies_simulado_previsto · simulados_admin · simulados_finalizados · answer_progress · resultados_ies_tri', 'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'criterio', 'Encerramento decidido só por status=encerrado ou data_encerramento passada (nunca por participação: uma prova aberta sendo respondida não é uma prova encerrada). realizado = encerrado E (tem linha em resultados_ies_tri OU tem participação de aluno); processing = encerrado sem TRI e sem participação; reagendado = data futura cuja data_agendada_original difere da data efetiva; agendado = data futura sem reagendamento (ou dentro da janela, sem sinal de encerramento); previsto = slot sem simulado ou simulado sem data. Data efetiva = data_realizacao (presencial) ou data_liberacao (online). Participantes = alunos distintos da IES (sem role em user_roles) com registro em simulados_finalizados ou em answer_progress, exibido em qualquer status havendo pelo menos um registro -- inclui prova aberta ainda sendo respondida, não só a realizada; null quando não há nenhum registro, nunca 0.', 'partial', (SELECT count(*) FROM itens WHERE status IN ('previsto','processing')) > 0, 'lowSample', false ) ) INTO v_result;
      v_result := jsonb_set(v_result, '{meta}', (v_result->'meta') || jsonb_build_object(
        'partial', coalesce((v_result->'meta'->>'partial')::boolean, false)
          OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_membros) e WHERE e->>'id' IS NULL),
        'alunosSemAcademy', (SELECT count(*) FROM jsonb_array_elements(v_membros) e WHERE e->>'id' IS NULL)
      ));
      RETURN v_result;
    END;
    $function$;

-- ======================================================================
-- public.mentor_aluno_b2b(p_email text)
-- ======================================================================
CREATE OR REPLACE FUNCTION public.mentor_aluno_b2b(p_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$-- Deriva de public.get_gestor_aluno(uuid,uuid,uuid[]); copia independente do Gestor.
 DECLARE v_uid uuid := auth.uid(); v_ies uuid; v_result jsonb; p_aluno_id uuid; p_simulados uuid[] := NULL;
    v_mentor uuid := public.mentor_ativo_id();
    v_alunos uuid[];
    v_membros jsonb;
    v_atividade jsonb;
  BEGIN
    SELECT m.ies_id INTO v_ies FROM public.mentores m
    WHERE m.user_id = v_mentor AND m.tipo = 'b2b';
    IF NOT FOUND OR v_ies IS NULL THEN
      RAISE EXCEPTION 'mentor_b2b_obrigatorio' USING ERRCODE = '42501';
    END IF;
    SELECT coalesce(array_agg(DISTINCT a.id) FILTER (WHERE a.id IS NOT NULL), '{}'::uuid[]),
           coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.email), '[]'::jsonb)
    INTO v_alunos, v_membros
    FROM (
      SELECT v.id AS ciclo_id, v.email_normalizado AS email,
             coalesce(v.academy_user_id, d.academy_user_id, ue.id) AS id,
             coalesce(v.nome, u.nome, d.nome, ue.nome) AS nome,
             coalesce(u.semestre, d.semestre_atual, ue.semestre) AS semestre
      FROM public.mentoria_vinculos v
      LEFT JOIN public.users u ON u.id = v.academy_user_id
      LEFT JOIN LATERAL (
        SELECT d0.* FROM public.dim_aluno_b2b d0
        WHERE d0.email_normalizado = v.email_normalizado
        ORDER BY (d0.status_atual = 'ativo') DESC NULLS LAST, d0.sanarflix_user_id
        LIMIT 1
      ) d ON true
      LEFT JOIN LATERAL (
        SELECT u0.* FROM public.users u0
        WHERE lower(btrim(u0.email)) = v.email_normalizado
        ORDER BY u0.id LIMIT 1
      ) ue ON true
      WHERE v.mentor_id = v_mentor AND v.fim IS NULL
    ) a;
  
        IF coalesce(btrim(p_email), '') = '' THEN
          RAISE EXCEPTION 'aluno_obrigatorio' USING ERRCODE = '22023';
        END IF;
        PERFORM public.mentor_exige_alunos(v_mentor, ARRAY[lower(btrim(p_email))]);
        SELECT (e->>'id')::uuid INTO p_aluno_id FROM jsonb_array_elements(v_membros) e
        WHERE e->>'email' = lower(btrim(p_email));
        IF p_aluno_id IS NULL THEN
          RETURN jsonb_build_object('data', '[]'::jsonb, 'meta', jsonb_build_object(
            'partial', true, 'motivo', 'academy_nao_resolvido',
            'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"')));
        END IF;
      WITH sims AS ( SELECT sa.id, sa.nome, COALESCE(sa.data_realizacao, sa.data_encerramento, sa.data_liberacao, sa.created_at) AS data_ref FROM (SELECT * FROM public.simulados_admin WHERE type = 'simulado_enamed') sa WHERE v_ies = ANY (sa.ies_ids) AND sa.simulado_pai_id IS NULL AND sa.status IN ('ativo','encerrado') AND ( sa.liberacao_desempenho = 'imediato' OR (sa.liberacao_desempenho = 'agendado' AND sa.data_liberacao_desempenho IS NOT NULL AND sa.data_liberacao_desempenho <= now()) OR (sa.liberacao_desempenho = 'ao_encerrar' AND (sa.status = 'encerrado' OR (sa.data_encerramento IS NOT NULL AND sa.data_encerramento <= now()))) ) AND (p_simulados IS NULL OR array_length(p_simulados,1) IS NULL OR sa.id = ANY (p_simulados)) ), sims_ord AS ( SELECT s.*, row_number() OVER (ORDER BY s.data_ref NULLS LAST, s.nome) AS ord FROM sims s ), grupo AS ( SELECT sa.id AS simulado_id, COALESCE(sa.simulado_pai_id, sa.id) AS pai_id FROM (SELECT * FROM public.simulados_admin WHERE type = 'simulado_enamed') sa WHERE COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims) ), alunos AS ( SELECT u.id, u.nome, u.semestre FROM (
    SELECT DISTINCT ON (u.id) u.id, coalesce(m.nome, u.nome) AS nome,
      coalesce(m.semestre, u.semestre) AS semestre
    FROM jsonb_to_recordset(v_membros) m(id uuid, nome text, semestre int, email text)
    JOIN public.users u ON u.id = m.id WHERE u.id = ANY(v_alunos)
    ORDER BY u.id, m.email
  ) u ), ultima AS ( SELECT DISTINCT ON (sf.user_id, g.pai_id) sf.user_id, g.pai_id, sf.simulado_id FROM public.simulados_finalizados sf JOIN grupo g ON g.simulado_id = sf.simulado_id WHERE sf.user_id IN (SELECT id FROM alunos) ORDER BY sf.user_id, g.pai_id, sf.finalizado_em DESC NULLS LAST ), ultima_fb AS ( SELECT DISTINCT ON (ap.user_id, g.pai_id) ap.user_id, g.pai_id, ap.simulado AS simulado_id FROM public.answer_progress ap JOIN grupo g ON g.simulado_id = ap.simulado JOIN (SELECT * FROM public.simulados_admin WHERE type = 'simulado_enamed') sa_ord ON sa_ord.id = ap.simulado WHERE ap.user_id IN (SELECT id FROM alunos) AND NOT EXISTS (SELECT 1 FROM ultima u WHERE u.user_id = ap.user_id AND u.pai_id = g.pai_id) ORDER BY ap.user_id, g.pai_id, sa_ord.created_at DESC NULLS LAST ), tentativas AS (SELECT * FROM ultima UNION ALL SELECT * FROM ultima_fb), tri_raw AS ( SELECT COALESCE(sa.simulado_pai_id, sa.id) AS pai_id, r.student_id, r.score_proprio, r.num_correct FROM public.resultados_alunos_tri r JOIN (SELECT * FROM public.simulados_admin WHERE type = 'simulado_enamed') sa ON sa.id = r.simulado_id WHERE r.college_id = v_ies AND r.student_id = ANY(v_alunos) AND COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims) ), tri AS ( SELECT DISTINCT ON (tr.student_id, tr.pai_id) tr.pai_id, tr.student_id, tr.score_proprio, tr.num_correct FROM tri_raw tr ORDER BY tr.student_id, tr.pai_id, tr.score_proprio DESC NULLS LAST ), areas_ies AS ( SELECT q.grande_area AS area, count(*) AS total, count(*) FILTER (WHERE ap.correct) AS acertos FROM tentativas t JOIN public.answer_progress ap ON ap.user_id = t.user_id AND ap.simulado = t.simulado_id JOIN public.questoes_simulado q ON q.id = ap.question_id WHERE COALESCE(q.anulada,false) = false AND q.grande_area IS NOT NULL GROUP BY q.grande_area ), linha AS ( SELECT s.id AS pai_id, s.nome, s.data_ref, s.ord, EXISTS (SELECT 1 FROM tentativas t WHERE t.user_id = p_aluno_id AND t.pai_id = s.id) AS participou, (SELECT count(*) FILTER (WHERE ap.correct) FROM tentativas t JOIN public.answer_progress ap ON ap.user_id = t.user_id AND ap.simulado = t.simulado_id JOIN public.questoes_simulado q ON q.id = ap.question_id WHERE t.user_id = p_aluno_id AND t.pai_id = s.id AND COALESCE(q.anulada,false) = false) AS acertos_calc, (SELECT max(tr.score_proprio) FROM tri tr WHERE tr.student_id = p_aluno_id AND tr.pai_id = s.id) AS proficiencia, (SELECT count(*) FROM tri tr WHERE tr.pai_id = s.id AND tr.score_proprio IS NOT NULL) AS n_total, (SELECT count(*) FROM tri tr WHERE tr.pai_id = s.id AND tr.score_proprio > COALESCE((SELECT max(t2.score_proprio) FROM tri t2 WHERE t2.student_id = p_aluno_id AND t2.pai_id = s.id), -1)) AS n_acima FROM sims_ord s ), linha_var AS ( SELECT l.*, l.proficiencia - lag(l.proficiencia) OVER (ORDER BY l.ord) AS variacao FROM linha l ) SELECT jsonb_build_object( 'data', COALESCE(( SELECT jsonb_agg(jsonb_build_object( 'id', p_aluno_id, 'nome', (SELECT a.nome FROM alunos a WHERE a.id = p_aluno_id), 'semestre', (SELECT a.semestre FROM alunos a WHERE a.id = p_aluno_id), 'simuladoId', lv.pai_id, 'simuladoNome', lv.nome, 'simuladoData', to_char(lv.data_ref AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'participou', lv.participou, 'acertos', CASE WHEN lv.participou THEN lv.acertos_calc END, 'proficiencia', CASE WHEN lv.proficiencia IS NULL THEN NULL ELSE round(lv.proficiencia::numeric, 1) END, 'situacao', CASE WHEN NOT lv.participou THEN 'nao_participou' WHEN lv.proficiencia IS NULL THEN 'aguardando_resultado' WHEN lv.proficiencia >= 60 THEN 'proficiente' ELSE 'abaixo_do_limiar' END, 'posicao', CASE WHEN lv.proficiencia IS NOT NULL AND lv.n_total > 0 THEN jsonb_build_object( 'lugar', lv.n_acima + 1, 'total', lv.n_total, 'percentil', round(100.0 * (lv.n_total - lv.n_acima) / lv.n_total, 0)) END, 'acertoPorArea', CASE WHEN lv.participou THEN COALESCE(( SELECT jsonb_agg(jsonb_build_object( 'area', x.area, 'acertoPct', round(100.0 * x.acertos / NULLIF(x.total,0), 0), 'critica', COALESCE((SELECT (100.0 * ai.acertos / NULLIF(ai.total,0)) < 30 FROM areas_ies ai WHERE ai.area = x.area), false) ) ORDER BY x.area) FROM ( SELECT q.grande_area AS area, count(*) AS total, count(*) FILTER (WHERE ap.correct) AS acertos FROM tentativas t JOIN public.answer_progress ap ON ap.user_id = t.user_id AND ap.simulado = t.simulado_id JOIN public.questoes_simulado q ON q.id = ap.question_id WHERE t.user_id = p_aluno_id AND t.pai_id = lv.pai_id AND COALESCE(q.anulada,false) = false AND q.grande_area IS NOT NULL GROUP BY q.grande_area ) x), '[]'::jsonb) END, 'variacao', CASE WHEN lv.variacao IS NULL THEN NULL ELSE round(lv.variacao::numeric, 1) END ) ORDER BY lv.ord) FROM linha_var lv), '[]'::jsonb), 'meta', jsonb_build_object( 'periodo', COALESCE((SELECT to_char(min(s.data_ref),'DD/MM/YYYY') || ' — ' || to_char(max(s.data_ref),'DD/MM/YYYY') FROM sims_ord s), 'sem simulado na seleção'), 'fonte', 'resultados_alunos_tri · answer_progress · questoes_simulado · simulados_admin · users', 'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'criterio', 'Proficiência = score_proprio (0–100); proficiente >= 60. Quando o simulado tem 2+ "filhos" (simulados-irmãos) com resultado, considera a MELHOR tentativa do aluno por filho (maior score_proprio), a mesma linha que a tabela de alunos mostra. Aluno que não participou: participou=false e todas as métricas null, nunca 0. Aluno que participou e ainda não tem nota TRI processada: situacao=aguardando_resultado e proficiencia null (não é abaixo do limiar). Posição calculada só entre alunos com proficiência no mesmo simulado. Variação = diferença de proficiência em relação ao simulado imediatamente anterior da seleção; null quando falta um dos dois valores. acertoPorArea em % de acerto, questão anulada ignorada.', 'partial', (SELECT count(*) FROM linha_var WHERE participou AND proficiencia IS NULL) > 0, 'lowSample', COALESCE((SELECT max(lv.n_total) FROM linha_var lv), 0) < 10 ) ) INTO v_result;
      v_result := jsonb_set(v_result, '{meta}', (v_result->'meta') || jsonb_build_object(
        'partial', coalesce((v_result->'meta'->>'partial')::boolean, false)
          OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_membros) e WHERE e->>'id' IS NULL),
        'alunosSemAcademy', (SELECT count(*) FROM jsonb_array_elements(v_membros) e WHERE e->>'id' IS NULL)
      ));
      RETURN v_result;
    END;
    $function$;
