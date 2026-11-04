-- Página do Mentor · Onda 3: mentor_desempenho_turma passa a devolver `simulados`
-- (todos os simulados B2C publicados, com sequence_number, título, janela e se já
-- encerrou). Antes o front derivava a lista das notas dos alunos, e um simulado
-- encerrado que ninguém da turma fez nunca entrava no recorte nem no alerta
-- "não fizeram". Corpo idêntico ao de 20261014173149, só com a chave nova.

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
      WHERE s.status = 'published' AND (p_simulados IS NULL OR s.id = ANY(p_simulados))
    ),
    -- uma nota por aluno e simulado: a tentativa finalizada mais recente
    por_simulado AS (
      SELECT DISTINCT ON (t.email, t.simulado_id)
             t.id, t.email, t.simulado_id, e.sequence_number, t.finalizada_em, t.acerto_pct
      FROM public.b2c_tentativas t
      JOIN turma tu ON tu.email = t.email
      JOIN escopo e ON e.id = t.simulado_id
      ORDER BY t.email, t.simulado_id, t.finalizada_em DESC, t.id DESC
    ),
    -- "último", "2 últimos", "3 últimos" seguem a ORDEM DO SIMULADO, não a data de envio
    ranq AS (
      SELECT p.*, row_number() OVER (PARTITION BY p.email ORDER BY p.sequence_number DESC, p.finalizada_em DESC, p.id DESC) AS rn
      FROM por_simulado p
    ),
    resumo AS (
      SELECT r.email,
             max(r.acerto_pct) FILTER (WHERE r.rn = 1) AS ultimo,
             max(r.acerto_pct) FILTER (WHERE r.rn = 2) AS penultimo,
             count(*) FILTER (WHERE r.rn <= 3) AS n3,
             round(max(r.acerto_pct) FILTER (WHERE r.rn <= 3) - min(r.acerto_pct) FILTER (WHERE r.rn <= 3), 1) AS amplitude3,
             jsonb_agg(jsonb_build_object(
               'simulado_id', r.simulado_id, 'sequence_number', r.sequence_number,
               'acerto_pct', round(r.acerto_pct, 1), 'finalizada_em', r.finalizada_em
             ) ORDER BY r.sequence_number, r.finalizada_em, r.id) AS notas
      FROM ranq r
      GROUP BY r.email
    ),
    -- simulado publicado mais recente, com janela encerrada, dentro do escopo
    ultimo_enc AS (
      SELECT e.id FROM escopo e
      WHERE e.status = 'published' AND e.janela_fim < now()
      ORDER BY e.janela_fim DESC, e.sequence_number DESC
      LIMIT 1
    ),
    base AS (
      SELECT tu.email,
             coalesce(tu.nome, b.nome) AS nome,
             b.corte_mais_dificil AS corte,
             rs.ultimo, rs.penultimo, rs.n3, rs.amplitude3,
             round(rs.ultimo - b.corte_mais_dificil, 1) AS vs,
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
             (x.penultimo IS NOT NULL AND round(x.penultimo - x.ultimo, 1) >= 5) AS regrediu,
             (x.n3 = 3 AND x.amplitude3 < 2) AS estagnado
      FROM base x
    )
    SELECT jsonb_build_object(
      'alunos', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'email', a.email, 'nome', a.nome, 'notas', a.notas,
          'ultimo_acerto', round(a.ultimo, 1),
          'corte_mais_dificil', a.corte,
          'vs_corte_pp', a.vs,
          'situacao', a.situacao,
          'regrediu', a.regrediu,
          'estagnado', a.estagnado,
          'fez_ultimo', CASE WHEN EXISTS (SELECT 1 FROM ultimo_enc) THEN a.fez_ultimo ELSE NULL END
        ) ORDER BY a.nome NULLS LAST, a.email) FROM alunos a), '[]'::jsonb),
      'possivel_aprovacao_pct', (
        SELECT round(100.0 * count(*) FILTER (WHERE a.situacao = 'acima') / nullif(count(*), 0), 1)
        FROM alunos a WHERE a.situacao IN ('acima', 'proximo', 'longe')),
      'acerto_medio_ultimo', (
        SELECT round(avg(p.acerto_pct), 1)
        FROM por_simulado p JOIN ultimo_enc u ON u.id = p.simulado_id),
      -- lista de simulados publicados (TODOS, não só o recorte): opções dos chips e
      -- referência do "último encerrado" mesmo quando ninguém da turma o fez
      'simulados', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', s.id, 'sequence_number', s.sequence_number, 'titulo', s.titulo,
          'janela_fim', s.janela_fim,
          'encerrado', (s.janela_fim IS NOT NULL AND s.janela_fim < now())
        ) ORDER BY s.sequence_number)
        FROM public.b2c_simulados s WHERE s.status = 'published'), '[]'::jsonb),
      'participacao_ultimo', jsonb_build_object(
        'simulado_id', (SELECT id FROM ultimo_enc),
        'fizeram', (SELECT count(*) FROM alunos a WHERE a.fez_ultimo AND EXISTS (SELECT 1 FROM ultimo_enc)),
        'total', (SELECT count(*) FROM alunos))
    )
  );
END;
$function$;

revoke all on function public.mentor_desempenho_turma(uuid[]) from public;
revoke execute on function public.mentor_desempenho_turma(uuid[]) from anon;
grant execute on function public.mentor_desempenho_turma(uuid[]) to authenticated;
