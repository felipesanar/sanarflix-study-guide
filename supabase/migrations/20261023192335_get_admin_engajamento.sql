-- get_admin_engajamento: RPC da tela Admin › Engajamento SanarFlix
-- Spec: docs/superpowers/specs/2026-10-22-engajamento-sanarflix-design.md (§7.2, §7.4, §8.10)
-- Guarda de papel igual à de admin_monitor_summary. Não devolve dado individual de aluno.

CREATE OR REPLACE FUNCTION public.get_admin_engajamento(
  p_inicio    date,
  p_fim       date,
  p_semestre  smallint DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_n               integer;
  v_ini_ant         date;
  v_criterio_admin  text := 'Base ativa: alunos com perfil de aluno e acesso ativo hoje, do 1º ao 12º semestre. Engajado: ao menos um dia com questão respondida ou conteúdo aberto no período. Questões contam só quando a questão tem classificação principal; acerto = corretas ÷ (corretas + erradas). Conteúdo consumido = aluno × conteúdo × dia. Tempo sem atividade é contado até hoje. Proficiência: % de alunos com 60 pontos ou mais no simulado ENAMED mais recente da IES (melhor tentativa por aluno).';
  v_r               jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin role required';
  END IF;
  PERFORM public.eng_validar_periodo(p_inicio, p_fim);
  IF p_semestre IS NOT NULL AND p_semestre NOT BETWEEN 1 AND 12 THEN
    RAISE EXCEPTION 'semestre_invalido' USING ERRCODE = '22023';
  END IF;
  v_n := p_fim - p_inicio + 1;
  v_ini_ant := p_inicio - v_n;

  WITH
  rede AS MATERIALIZED (SELECT * FROM public.eng_alunos_recorte(NULL, p_inicio, p_fim)),
  r AS MATERIALIZED (SELECT * FROM rede WHERE p_semestre IS NULL OR semestre = p_semestre),
  por_ies AS (
    SELECT r.id_ies, count(*) AS base,
      count(*) FILTER (WHERE dias_ativos_periodo > 0) AS eng,
      count(*) FILTER (WHERE dias_ativos_ant > 0)     AS eng_ant,
      count(*) FILTER (WHERE faixa_recencia IN ('sumidos30a59', 'sumidos60')) AS sem30,
      sum(questoes) AS q, sum(acertos) AS ac, sum(erros) AS er, sum(videos) AS vi, sum(documentos) AS dc
    FROM r GROUP BY r.id_ies
  ),
  k AS (
    SELECT count(DISTINCT id_ies) AS n_ies, count(*) AS base,
      count(*) FILTER (WHERE dias_ativos_periodo > 0) AS eng,
      count(*) FILTER (WHERE faixa_recencia IN ('sumidos30a59', 'sumidos60')) AS sem30,
      coalesce(sum(questoes), 0) AS q, coalesce(sum(acertos), 0) AS ac, coalesce(sum(erros), 0) AS er
    FROM r
  ),
  krede AS (SELECT count(*) AS base, count(*) FILTER (WHERE dias_ativos_periodo > 0) AS eng FROM rede),
  mediana AS (
    SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY 100.0 * eng / base) AS med FROM por_ies WHERE base > 0
  ),
  sims AS (
    SELECT p.id_ies, sa.id, sa.nome,
           COALESCE(sa.data_realizacao, sa.data_encerramento, sa.data_liberacao, sa.created_at) AS data_ref
    FROM por_ies p
    JOIN public.simulados_admin sa ON p.id_ies = ANY (sa.ies_ids)
    WHERE sa.type = 'simulado_enamed' AND NOT sa.prova_oficial AND sa.simulado_pai_id IS NULL
      AND sa.status IN ('ativo', 'encerrado')
      AND (sa.liberacao_desempenho = 'imediato'
        OR (sa.liberacao_desempenho = 'agendado' AND sa.data_liberacao_desempenho IS NOT NULL AND sa.data_liberacao_desempenho <= now())
        OR (sa.liberacao_desempenho = 'ao_encerrar' AND (sa.status = 'encerrado'
             OR (sa.data_encerramento IS NOT NULL AND sa.data_encerramento <= now()))))
  ),
  tri AS (
    SELECT DISTINCT ON (s.id_ies, s.id, rt.student_id) s.id_ies, s.id AS pai_id, rt.student_id, rt.score_proprio
    FROM sims s
    JOIN public.simulados_admin sa2 ON COALESCE(sa2.simulado_pai_id, sa2.id) = s.id
     AND sa2.type = 'simulado_enamed' AND NOT sa2.prova_oficial
    JOIN public.resultados_alunos_tri rt ON rt.simulado_id = sa2.id AND rt.college_id = s.id_ies AND rt.score_proprio IS NOT NULL
    JOIN public.users u ON u.id = rt.student_id AND u.id_ies = s.id_ies
    WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
    ORDER BY s.id_ies, s.id, rt.student_id, rt.score_proprio DESC
  ),
  por_sim AS (
    SELECT id_ies, pai_id, count(*) AS n, count(*) FILTER (WHERE score_proprio >= 60) AS n_prof FROM tri GROUP BY 1, 2
  ),
  prof AS (
    SELECT DISTINCT ON (s.id_ies) s.id_ies, s.id, s.nome, s.data_ref, ps.n, ps.n_prof
    FROM sims s JOIN por_sim ps ON ps.id_ies = s.id_ies AND ps.pai_id = s.id
    ORDER BY s.id_ies, s.data_ref DESC NULLS LAST, s.nome
  ),
  meses AS (
    SELECT m.mes::date AS mes,
           (m.mes::date < p_inicio OR (m.mes + interval '1 month - 1 day')::date > p_fim) AS parcial,
           coalesce(sum(a.questoes), 0) AS q, coalesce(sum(a.acertos), 0) AS ac, coalesce(sum(a.erros), 0) AS er,
           coalesce(sum(a.videos), 0) AS vi, coalesce(sum(a.documentos), 0) AS dc
    FROM generate_series(date_trunc('month', p_inicio), date_trunc('month', p_fim), interval '1 month') AS m(mes)
    LEFT JOIN (public.eng_atividade_aluno_dia a JOIN r ON r.sanarflix_user_id = a.sanarflix_user_id)
      ON a.dia BETWEEN p_inicio AND p_fim AND date_trunc('month', a.dia) = m.mes
    GROUP BY m.mes
  ),
  sem AS (   -- ignora p_semestre (P8)
    SELECT s.n AS semestre, coalesce(sum(x.questoes), 0) AS q, coalesce(sum(x.acertos), 0) AS ac, coalesce(sum(x.erros), 0) AS er,
           coalesce(sum(x.videos), 0) AS vi, coalesce(sum(x.documentos), 0) AS dc
    FROM generate_series(1, 12) AS s(n) LEFT JOIN rede x ON x.semestre = s.n
    GROUP BY s.n
  )
  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'periodo', jsonb_build_object('inicio', p_inicio, 'fim', p_fim, 'dias', v_n, 'hoje', public.eng_hoje(),
                   'anterior', jsonb_build_object('inicio', v_ini_ant, 'fim', p_inicio - 1,
                                 'comparavelConteudos', v_ini_ant >= DATE '2026-01-01')),
      'recorte', jsonb_build_object('semestre', p_semestre),
      'rede', jsonb_build_object(
        'ies', k.n_ies, 'baseAtiva', k.base, 'engajados', k.eng, 'engajadosPct', public.eng_pct(k.eng, k.base),
        'engajadosPctRede', CASE WHEN p_semestre IS NOT NULL THEN public.eng_pct(krede.eng, krede.base) END,
        'medianaEngajadosPctIes', (SELECT round(med::numeric, 1) FROM mediana),
        'semRetorno30', k.sem30, 'semRetorno30Pct', public.eng_pct(k.sem30, k.base),
        'questoes', k.q, 'acertoPct', public.eng_pct(k.ac, k.ac + k.er)),
      'ranking', coalesce((SELECT jsonb_agg(jsonb_build_object(
          'iesId', p.id_ies, 'nome', i.nome, 'base', p.base, 'engajados', p.eng,
          'engajadosPct', public.eng_pct(p.eng, p.base),
          'engajadosPctAnterior', CASE WHEN v_ini_ant >= DATE '2026-01-01' THEN public.eng_pct(p.eng_ant, p.base) END,
          'semRetorno30Pct', public.eng_pct(p.sem30, p.base),
          'videosPorEngajado', public.eng_razao(p.vi, p.eng),
          'questoesPorEngajado', CASE WHEN p.eng > 0 THEN round(p.q::numeric / p.eng) END,
          'acertoPct', public.eng_pct(p.ac, p.ac + p.er),
          'proficiencia', CASE WHEN pf.id_ies IS NULL THEN NULL ELSE jsonb_build_object(
              'pct', public.eng_pct(pf.n_prof, pf.n), 'alunos', pf.n, 'proficientes', pf.n_prof,
              'simuladoId', pf.id, 'simuladoNome', pf.nome,
              'dataReferencia', (pf.data_ref AT TIME ZONE 'America/Sao_Paulo')::date) END)
        ORDER BY i.nome)
        FROM por_ies p JOIN public.ies i ON i.id = p.id_ies LEFT JOIN prof pf ON pf.id_ies = p.id_ies), '[]'::jsonb),
      'meses', (SELECT jsonb_agg(jsonb_build_object('mes', to_char(m.mes, 'YYYY-MM'), 'parcial', m.parcial,
                 'questoes', m.q, 'acertoPct', public.eng_pct(m.ac, m.ac + m.er),
                 'videos', m.vi, 'documentos', m.dc, 'conteudos', m.vi + m.dc) ORDER BY m.mes) FROM meses m),
      'semestres', (SELECT jsonb_agg(jsonb_build_object('semestre', s.semestre,
                 'questoes', s.q, 'acertoPct', public.eng_pct(s.ac, s.ac + s.er),
                 'videos', s.vi, 'documentos', s.dc, 'conteudos', s.vi + s.dc) ORDER BY s.semestre) FROM sem s)
    ),
    'meta', public.eng_meta(p_inicio, p_fim, k.base < 10, v_criterio_admin)
  ) INTO v_r
  FROM k CROSS JOIN krede;

  RETURN v_r;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_admin_engajamento(date, date, smallint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_engajamento(date, date, smallint) TO authenticated;
