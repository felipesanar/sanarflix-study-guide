-- Página do Mentor · Onda 3: desempenho da turma nos simulados B2C.
-- Lê só o espelho b2c_* (sem policy; acesso exclusivo por estas RPCs) e só dos
-- alunos com vínculo ATIVO do mentor logado: ex-alunos mantêm linhas no espelho
-- mas nunca aparecem. Métrica = % de acerto (0-100).
-- Regras: regrediu = queda >= 5 p.p. entre as 2 últimas; estagnado = (max-min) < 2 p.p.
-- nas 3 últimas; próximo do corte = até 3 p.p. abaixo do corte_mais_dificil.

create or replace function public.mentor_desempenho_turma(p_simulados uuid[] default null)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_mentor uuid := public.mentor_ativo_id();
BEGIN
  RETURN (
    WITH turma AS (
      SELECT v.email_normalizado AS email, v.nome
      FROM public.mentoria_vinculos v
      WHERE v.mentor_id = v_mentor AND v.fim IS NULL
    ),
    escopo AS (
      SELECT s.id, s.sequence_number, s.status, s.janela_fim
      FROM public.b2c_simulados s
      WHERE p_simulados IS NULL OR s.id = ANY(p_simulados)
    ),
    -- uma nota por aluno e simulado: a tentativa finalizada mais recente
    por_simulado AS (
      SELECT DISTINCT ON (t.email, t.simulado_id)
             t.email, t.simulado_id, e.sequence_number, t.finalizada_em, t.acerto_pct
      FROM public.b2c_tentativas t
      JOIN turma tu ON tu.email = t.email
      JOIN escopo e ON e.id = t.simulado_id
      ORDER BY t.email, t.simulado_id, t.finalizada_em DESC
    ),
    ranq AS (
      SELECT p.*, row_number() OVER (PARTITION BY p.email ORDER BY p.finalizada_em DESC) AS rn
      FROM por_simulado p
    ),
    resumo AS (
      SELECT r.email,
             max(r.acerto_pct) FILTER (WHERE r.rn = 1) AS ultimo,
             max(r.acerto_pct) FILTER (WHERE r.rn = 2) AS penultimo,
             count(*) FILTER (WHERE r.rn <= 3) AS n3,
             (max(r.acerto_pct) FILTER (WHERE r.rn <= 3) - min(r.acerto_pct) FILTER (WHERE r.rn <= 3)) AS amplitude3,
             jsonb_agg(jsonb_build_object(
               'simulado_id', r.simulado_id, 'sequence_number', r.sequence_number,
               'acerto_pct', round(r.acerto_pct, 1), 'finalizada_em', r.finalizada_em
             ) ORDER BY r.finalizada_em) AS notas
      FROM ranq r
      GROUP BY r.email
    ),
    -- simulado publicado mais recente, com janela encerrada, dentro do escopo
    ultimo_enc AS (
      SELECT e.id FROM escopo e
      WHERE e.status = 'published' AND e.janela_fim < now()
      ORDER BY e.janela_fim DESC
      LIMIT 1
    ),
    base AS (
      SELECT tu.email,
             coalesce(tu.nome, b.nome) AS nome,
             b.corte_mais_dificil AS corte,
             rs.ultimo, rs.penultimo, rs.n3, rs.amplitude3,
             (rs.ultimo - b.corte_mais_dificil) AS vs,
             coalesce(rs.notas, '[]'::jsonb) AS notas,
             EXISTS (SELECT 1 FROM por_simulado p JOIN ultimo_enc u ON u.id = p.simulado_id
                      WHERE p.email = tu.email) AS fez_ultimo
      FROM turma tu
      LEFT JOIN public.b2c_alunos b ON b.email = tu.email
      LEFT JOIN resumo rs ON rs.email = tu.email
    ),
    alunos AS (
      SELECT x.*,
             CASE WHEN x.ultimo IS NULL THEN 'sem_simulado'
                  WHEN x.corte IS NULL THEN 'sem_meta'
                  WHEN x.vs >= 0 THEN 'acima'
                  WHEN x.vs >= -3 THEN 'proximo'
                  ELSE 'longe' END AS situacao,
             (x.penultimo IS NOT NULL AND x.penultimo - x.ultimo >= 5) AS regrediu,
             (x.n3 = 3 AND x.amplitude3 < 2) AS estagnado
      FROM base x
    )
    SELECT jsonb_build_object(
      'alunos', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'email', a.email, 'nome', a.nome, 'notas', a.notas,
          'ultimo_acerto', round(a.ultimo, 1),
          'corte_mais_dificil', a.corte,
          'vs_corte_pp', round(a.vs, 1),
          'situacao', a.situacao,
          'regrediu', a.regrediu,
          'estagnado', a.estagnado,
          'fez_ultimo', CASE WHEN EXISTS (SELECT 1 FROM ultimo_enc) THEN a.fez_ultimo ELSE NULL END
        ) ORDER BY a.nome NULLS LAST, a.email) FROM alunos a), '[]'::jsonb),
      'possivel_aprovacao_pct', (
        SELECT round(100.0 * count(*) FILTER (WHERE a.situacao = 'acima') / nullif(count(*), 0), 1)
        FROM alunos a WHERE a.situacao IN ('acima', 'proximo', 'longe')),
      'acerto_medio_ultimo', (SELECT round(avg(a.ultimo), 1) FROM alunos a WHERE a.ultimo IS NOT NULL),
      'participacao_ultimo', jsonb_build_object(
        'simulado_id', (SELECT id FROM ultimo_enc),
        'fizeram', (SELECT count(*) FROM alunos a WHERE a.fez_ultimo AND EXISTS (SELECT 1 FROM ultimo_enc)),
        'total', (SELECT count(*) FROM alunos))
    )
  );
END;
$function$;

create or replace function public.mentor_detalhamento(p_simulados uuid[])
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_mentor uuid := public.mentor_ativo_id();
BEGIN
  RETURN (
    WITH turma AS (
      SELECT v.email_normalizado AS email
      FROM public.mentoria_vinculos v
      WHERE v.mentor_id = v_mentor AND v.fim IS NULL
    ),
    -- só a tentativa mais recente de cada aluno por simulado, como na nota
    tent AS (
      SELECT DISTINCT ON (t.email, t.simulado_id) t.id, t.email, t.simulado_id
      FROM public.b2c_tentativas t
      JOIN turma tu ON tu.email = t.email
      WHERE p_simulados IS NULL OR t.simulado_id = ANY(p_simulados)
      ORDER BY t.email, t.simulado_id, t.finalizada_em DESC
    ),
    resp AS (
      SELECT t.email, q.id AS questao_id, q.numero, s.sequence_number,
             coalesce(q.grande_area, 'Sem área') AS area, coalesce(q.tema, 'Sem tema') AS tema,
             q.correta_label,
             CASE WHEN r.respondida THEN coalesce(r.marcada_label, 'branco') ELSE 'branco' END AS label,
             r.correta
      FROM tent t
      JOIN public.b2c_respostas r ON r.tentativa_id = t.id
      JOIN public.b2c_questoes q ON q.id = r.questao_id
      JOIN public.b2c_simulados s ON s.id = q.simulado_id
    ),
    por_tema AS (
      SELECT area, tema,
             round(100.0 * count(*) FILTER (WHERE correta) / count(*), 1) AS acerto_pct,
             count(*) AS respostas
      FROM resp GROUP BY area, tema
    ),
    por_area AS (
      SELECT area,
             round(100.0 * count(*) FILTER (WHERE correta) / count(*), 1) AS acerto_pct,
             count(*) AS respostas
      FROM resp GROUP BY area
    ),
    por_questao AS (
      SELECT questao_id, numero, sequence_number, area, tema, correta_label,
             round(100.0 * count(*) FILTER (WHERE correta) / count(*), 1) AS acerto_pct,
             count(*) AS respostas
      FROM resp GROUP BY questao_id, numero, sequence_number, area, tema, correta_label
    ),
    por_alt AS (
      SELECT questao_id, label, count(*) AS n, jsonb_agg(email ORDER BY email) AS emails
      FROM resp GROUP BY questao_id, label
    ),
    alt_agg AS (
      SELECT questao_id,
             jsonb_object_agg(label, n) AS distribuicao,
             jsonb_object_agg(label, emails) AS emails
      FROM por_alt GROUP BY questao_id
    )
    SELECT jsonb_build_object(
      'areas', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'grande_area', a.area, 'acerto_pct', a.acerto_pct, 'respostas', a.respostas,
          'temas', coalesce((
            SELECT jsonb_agg(jsonb_build_object('tema', t.tema, 'acerto_pct', t.acerto_pct, 'respostas', t.respostas)
                             ORDER BY t.acerto_pct, t.tema)
            FROM por_tema t WHERE t.area = a.area), '[]'::jsonb)
        ) ORDER BY a.acerto_pct, a.area) FROM por_area a), '[]'::jsonb),
      'questoes', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'questao_id', q.questao_id, 'numero', q.numero, 'sequence_number', q.sequence_number,
          'grande_area', q.area, 'tema', q.tema, 'correta_label', q.correta_label,
          'acerto_pct', q.acerto_pct, 'respostas', q.respostas,
          'distribuicao', coalesce(g.distribuicao, '{}'::jsonb),
          'emails', coalesce(g.emails, '{}'::jsonb)
        ) ORDER BY q.sequence_number, q.numero)
        FROM por_questao q LEFT JOIN alt_agg g ON g.questao_id = q.questao_id), '[]'::jsonb)
    )
  );
END;
$function$;

create or replace function public.mentor_aluno_notas(p_email text)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_mentor uuid := public.mentor_ativo_id();
  v_email text := (public.mentor_exige_alunos(v_mentor, array[p_email]))[1];
BEGIN
  RETURN (
    WITH turma AS (
      SELECT v.email_normalizado AS email
      FROM public.mentoria_vinculos v
      WHERE v.mentor_id = v_mentor AND v.fim IS NULL AND v.email_normalizado = v_email
    ),
    tent AS (
      SELECT DISTINCT ON (t.simulado_id) t.id, t.simulado_id, t.finalizada_em, t.acerto_pct
      FROM public.b2c_tentativas t
      JOIN turma tu ON tu.email = t.email
      ORDER BY t.simulado_id, t.finalizada_em DESC
    ),
    resp AS (
      SELECT coalesce(q.grande_area, 'Sem área') AS area, coalesce(q.tema, 'Sem tema') AS tema, r.correta
      FROM tent t
      JOIN public.b2c_respostas r ON r.tentativa_id = t.id
      JOIN public.b2c_questoes q ON q.id = r.questao_id
    ),
    por_tema AS (
      SELECT area, tema,
             round(100.0 * count(*) FILTER (WHERE correta) / count(*), 1) AS acerto_pct,
             count(*) AS respostas
      FROM resp GROUP BY area, tema
    ),
    por_area AS (
      SELECT area,
             round(100.0 * count(*) FILTER (WHERE correta) / count(*), 1) AS acerto_pct,
             count(*) AS respostas
      FROM resp GROUP BY area
    )
    SELECT jsonb_build_object(
      'email', v_email,
      'notas', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'simulado_id', t.simulado_id, 'sequence_number', s.sequence_number, 'titulo', s.titulo,
          'acerto_pct', round(t.acerto_pct, 1), 'finalizada_em', t.finalizada_em
        ) ORDER BY s.sequence_number)
        FROM tent t JOIN public.b2c_simulados s ON s.id = t.simulado_id), '[]'::jsonb),
      'areas', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'grande_area', a.area, 'acerto_pct', a.acerto_pct, 'respostas', a.respostas,
          'temas', coalesce((
            SELECT jsonb_agg(jsonb_build_object('tema', t.tema, 'acerto_pct', t.acerto_pct, 'respostas', t.respostas)
                             ORDER BY t.acerto_pct, t.tema)
            FROM por_tema t WHERE t.area = a.area), '[]'::jsonb)
        ) ORDER BY a.acerto_pct, a.area) FROM por_area a), '[]'::jsonb)
    )
  );
END;
$function$;

revoke all on function public.mentor_desempenho_turma(uuid[]) from public;
revoke execute on function public.mentor_desempenho_turma(uuid[]) from anon;
grant execute on function public.mentor_desempenho_turma(uuid[]) to authenticated;
revoke all on function public.mentor_detalhamento(uuid[]) from public;
revoke execute on function public.mentor_detalhamento(uuid[]) from anon;
grant execute on function public.mentor_detalhamento(uuid[]) to authenticated;
revoke all on function public.mentor_aluno_notas(text) from public;
revoke execute on function public.mentor_aluno_notas(text) from anon;
grant execute on function public.mentor_aluno_notas(text) to authenticated;
