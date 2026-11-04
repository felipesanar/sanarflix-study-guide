-- Mentor B2C V2. Bases vigentes: turma (20261026184129), desempenho
-- (20261014180751), detalhamento e notas (20261015201557).
-- Nenhuma fonte de prevalencia foi fornecida: referencia deliberadamente vazia.
create table public.enamed_prevalencia_tema (
  id bigserial primary key,
  grande_area text,
  especialidade text,
  tema text,
  tema_norm text unique,
  prevalencia text check (prevalencia in ('Alta', 'Média', 'Baixa')),
  fonte text,
  atualizado_em timestamptz not null default now()
);
alter table public.enamed_prevalencia_tema enable row level security;
comment on column public.enamed_prevalencia_tema.tema_norm is
  'Chave do tema curto do espelho: lower, btrim e whitespace colapsado; sem remover acentos.';

create or replace function public.mentor_turma()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_mentor uuid := public.mentor_ativo_id();
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  RETURN coalesce((
    WITH alunos AS (
      SELECT v.email_normalizado AS email,
             coalesce(v.nome, u.nome, d.nome) AS nome,
             u.telefone,
             coalesce(u.semestre, d.semestre_atual) AS semestre,
             d.vigencia_fim AS acesso_ate,
             (d.sanarflix_user_id IS NOT NULL) AS b2b,
             coalesce(v.academy_user_id, d.academy_user_id) AS academy_user_id,
             coalesce(v.sanarflix_user_id, d.sanarflix_user_id) AS sanarflix_user_id,
             CASE WHEN alvo.valor IS NULL THEN NULL
                  ELSE jsonb_build_object('especialidade', b.especialidade_nome,
                    'instituicao', alvo.valor->>'nome', 'cortePct', b.corte_mais_dificil) END AS meta
      FROM public.mentoria_vinculos v
      LEFT JOIN public.users u ON u.id = v.academy_user_id
      LEFT JOIN LATERAL (
        SELECT * FROM public.dim_aluno_b2b d0
        WHERE d0.email_normalizado = v.email_normalizado
        ORDER BY (d0.status_atual = 'ativo') DESC NULLS LAST
        LIMIT 1
      ) d ON true
      LEFT JOIN public.b2c_alunos b ON b.email = v.email_normalizado
      LEFT JOIN LATERAL (
        SELECT alvo AS valor FROM jsonb_array_elements(b.alvos) alvo
        ORDER BY (alvo->>'corte_geral')::numeric DESC NULLS LAST,
                 alvo->>'nome', alvo->>'institution_id'
        LIMIT 1
      ) alvo ON true
      WHERE v.mentor_id = v_mentor AND v.fim IS NULL
    ),
    atividade AS (
      SELECT a.*,
             greatest(
               (SELECT max(f.event_timestamp) AT TIME ZONE 'UTC' FROM public.fato_consumo_conteudo_b2b f
                 WHERE a.sanarflix_user_id IS NOT NULL AND f.sanarflix_user_id = a.sanarflix_user_id),
               (SELECT max(s.started_at) FROM public.user_sessions s
                 WHERE a.academy_user_id IS NOT NULL AND s.user_id = a.academy_user_id),
               -- Mantem a busca da ultima data pelo indice (aluno, data).
               (SELECT max(fq.response_timestamp) AT TIME ZONE 'UTC' FROM public.fato_resolucao_questoes_b2b fq
                 WHERE a.sanarflix_user_id IS NOT NULL AND fq.sanarflix_user_id = a.sanarflix_user_id
                   AND fq.response_date = (SELECT max(fd.response_date) FROM public.fato_resolucao_questoes_b2b fd
                                            WHERE fd.sanarflix_user_id = a.sanarflix_user_id))
             ) AS ultima_atividade,
             (a.sanarflix_user_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM public.fato_consumo_conteudo_b2b fx
                 WHERE fx.sanarflix_user_id = a.sanarflix_user_id)) AS tem_dado_consumo,
             cons.v7, cons.d7, cons.v30, cons.d30,
             (a.sanarflix_user_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM public.fato_resolucao_questoes_b2b fx
                 WHERE fx.sanarflix_user_id = a.sanarflix_user_id)) AS tem_dado_questoes,
             quest.q7, quest.a7, quest.e7, quest.q30, quest.a30, quest.e30
      FROM alunos a
      LEFT JOIN LATERAL (
        SELECT
          CASE WHEN a.sanarflix_user_id IS NULL THEN NULL
               ELSE count(DISTINCT f.content_id) FILTER (WHERE f.content_type = 'video' AND f.event_date >= v_hoje - 6) END AS v7,
          CASE WHEN a.sanarflix_user_id IS NULL THEN NULL
               ELSE count(DISTINCT f.content_id) FILTER (WHERE f.content_type = 'document' AND f.event_date >= v_hoje - 6) END AS d7,
          CASE WHEN a.sanarflix_user_id IS NULL THEN NULL
               ELSE count(DISTINCT f.content_id) FILTER (WHERE f.content_type = 'video') END AS v30,
          CASE WHEN a.sanarflix_user_id IS NULL THEN NULL
               ELSE count(DISTINCT f.content_id) FILTER (WHERE f.content_type = 'document') END AS d30
        FROM public.fato_consumo_conteudo_b2b f
        WHERE a.sanarflix_user_id IS NOT NULL
          AND f.sanarflix_user_id = a.sanarflix_user_id
          AND f.event_date >= v_hoje - 29
      ) cons ON true
      LEFT JOIN LATERAL (
        SELECT
          CASE WHEN a.sanarflix_user_id IS NULL THEN NULL
               ELSE count(*) FILTER (WHERE f.response_date >= v_hoje - 6) END AS q7,
          CASE WHEN a.sanarflix_user_id IS NULL THEN NULL
               ELSE count(*) FILTER (WHERE f.response_date >= v_hoje - 6 AND f.acertou IS TRUE) END AS a7,
          CASE WHEN a.sanarflix_user_id IS NULL THEN NULL
               ELSE count(*) FILTER (WHERE f.response_date >= v_hoje - 6 AND f.acertou IS FALSE) END AS e7,
          CASE WHEN a.sanarflix_user_id IS NULL THEN NULL
               ELSE count(*) END AS q30,
          CASE WHEN a.sanarflix_user_id IS NULL THEN NULL
               ELSE count(*) FILTER (WHERE f.acertou IS TRUE) END AS a30,
          CASE WHEN a.sanarflix_user_id IS NULL THEN NULL
               ELSE count(*) FILTER (WHERE f.acertou IS FALSE) END AS e30
        FROM public.fato_resolucao_questoes_b2b f
        WHERE a.sanarflix_user_id IS NOT NULL
          AND f.sanarflix_user_id = a.sanarflix_user_id
          AND f.response_date >= v_hoje - 29
      ) quest ON true
    ),
    calculado AS (
      SELECT x.*, ((now() AT TIME ZONE 'America/Sao_Paulo')::date - (x.ultima_atividade AT TIME ZONE 'America/Sao_Paulo')::date) AS dias
      FROM atividade x
    )
    SELECT jsonb_agg(jsonb_build_object(
      'email', c.email, 'nome', c.nome, 'telefone', c.telefone, 'semestre', c.semestre,
      'acesso_ate', c.acesso_ate, 'b2b', c.b2b, 'academy_user_id', c.academy_user_id,
      'sanarflix_user_id', c.sanarflix_user_id, 'ultima_atividade', c.ultima_atividade,
      'dias_sem_atividade', c.dias,
      'segmento', CASE WHEN dias IS NULL THEN 'sem_dado'
                       WHEN dias >= 15 THEN 'sumido'
                       WHEN dias >= 8 THEN 'esfriando'
                       ELSE 'ativo' END,
      'meta', c.meta,
      'conteudos_7d', jsonb_build_object('videos', c.v7, 'documentos', c.d7, 'total', c.v7 + c.d7),
      'conteudos_30d', jsonb_build_object('videos', c.v30, 'documentos', c.d30, 'total', c.v30 + c.d30),
      'tem_dado_consumo', c.tem_dado_consumo,
      'questoes_7d', jsonb_build_object('respondidas', c.q7, 'acertos', c.a7, 'erros', c.e7,
        'pct_acerto', round(100.0 * c.a7 / nullif(c.a7 + c.e7, 0), 1)),
      'questoes_30d', jsonb_build_object('respondidas', c.q30, 'acertos', c.a30, 'erros', c.e30,
        'pct_acerto', round(100.0 * c.a30 / nullif(c.a30 + c.e30, 0), 1)),
      'tem_dado_questoes', c.tem_dado_questoes
    ) ORDER BY c.dias DESC NULLS LAST, c.nome)
    FROM calculado c
  ), '[]'::jsonb);
END;
$function$;

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
    por_simulado AS (
      SELECT DISTINCT ON (t.email, t.simulado_id)
             t.id, t.email, t.simulado_id, e.sequence_number, t.finalizada_em, t.acerto_pct
      FROM public.b2c_tentativas t
      JOIN turma tu ON tu.email = t.email
      JOIN escopo e ON e.id = t.simulado_id
      ORDER BY t.email, t.simulado_id, t.finalizada_em DESC, t.id DESC
    ),
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
      -- Denominador = participantes, nao alunos da turma nem notas de outros simulados.
      -- Sem nenhum corte conhecido, o indicador permanece desconhecido.
      'possivel_aprovacao_pct', (
        SELECT CASE WHEN count(b.corte_mais_dificil) = 0 THEN NULL
                    ELSE round(100.0 * count(*) FILTER (WHERE p.acerto_pct >= b.corte_mais_dificil)
                      / nullif(count(*), 0), 1) END
        FROM por_simulado p JOIN ultimo_enc u ON u.id = p.simulado_id
        LEFT JOIN public.b2c_alunos b ON b.email = p.email),
      'acerto_medio_ultimo', (
        SELECT round(avg(p.acerto_pct), 1)
        FROM por_simulado p JOIN ultimo_enc u ON u.id = p.simulado_id),
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

create or replace function public.mentor_serie_turma(p_simulados uuid[] default null)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_mentor uuid := public.mentor_ativo_id();
BEGIN
  RETURN coalesce((
    WITH turma AS (
      SELECT v.email_normalizado AS email
      FROM public.mentoria_vinculos v
      WHERE v.mentor_id = v_mentor AND v.fim IS NULL
    ),
    escopo AS (
      SELECT s.* FROM public.b2c_simulados s
      WHERE s.status = 'published' AND (p_simulados IS NULL OR s.id = ANY(p_simulados))
    ),
    por_simulado AS (
      SELECT DISTINCT ON (t.email, t.simulado_id) t.*
      FROM public.b2c_tentativas t
      JOIN turma tu ON tu.email = t.email
      JOIN escopo e ON e.id = t.simulado_id
      ORDER BY t.email, t.simulado_id, t.finalizada_em DESC, t.id DESC
    )
    SELECT jsonb_agg(jsonb_build_object(
      'simulado_id', s.id, 'sequence_number', s.sequence_number, 'titulo', s.titulo,
      'fechado', (s.janela_fim IS NOT NULL AND s.janela_fim < now()),
      'participantes', m.participantes, 'acerto_medio', m.acerto_medio,
      'acima_corte_pct', m.acima_corte_pct
    ) ORDER BY s.sequence_number, s.id)
    FROM escopo s
    CROSS JOIN LATERAL (
      -- Cada participante pesa uma vez (media ponderada por participantes).
      SELECT count(*) AS participantes, round(avg(p.acerto_pct), 1) AS acerto_medio,
             CASE WHEN count(b.corte_mais_dificil) = 0 THEN NULL
                  ELSE round(100.0 * count(*) FILTER (WHERE p.acerto_pct >= b.corte_mais_dificil)
                    / nullif(count(*), 0), 1) END AS acima_corte_pct
      FROM por_simulado p
      LEFT JOIN public.b2c_alunos b ON b.email = p.email
      WHERE p.simulado_id = s.id
    ) m
  ), '[]'::jsonb);
END;
$function$;

create or replace function public.mentor_engajamento_turma(p_semanas int default 8)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_mentor uuid := public.mentor_ativo_id();
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_segunda date := date_trunc('week', v_hoje::timestamp)::date;
BEGIN
  IF p_semanas IS NULL OR p_semanas < 1 OR p_semanas > 52 THEN
    RAISE EXCEPTION 'p_semanas deve estar entre 1 e 52';
  END IF;
  RETURN coalesce((
    -- Reusa exatamente a identidade, as tres fontes de atividade e D3 de turma.
    WITH alunos AS (
      SELECT a.*
      FROM jsonb_to_recordset(public.mentor_turma()) AS a(
        email text, sanarflix_user_id text, ultima_atividade timestamptz,
        dias_sem_atividade int, segmento text, tem_dado_questoes boolean, tem_dado_consumo boolean)
      JOIN public.mentoria_vinculos v ON v.email_normalizado = a.email
      WHERE v.mentor_id = v_mentor AND v.fim IS NULL
    ),
    semanas AS (
      SELECT v_segunda - 7 * (p_semanas - 1 - g) AS semana
      FROM generate_series(0, p_semanas - 1) g
    )
    SELECT jsonb_agg(jsonb_build_object(
      'email', a.email, 'ultima_atividade', a.ultima_atividade,
      'dias_sem_atividade', a.dias_sem_atividade, 'segmento', a.segmento,
      'semanas', CASE WHEN a.ultima_atividade IS NULL THEN '[]'::jsonb ELSE (
        SELECT jsonb_agg(jsonb_build_object(
          'semana', w.semana,
          -- Zero so para fonte existente; fonte ausente continua NULL.
          'questoes', CASE WHEN a.tem_dado_questoes THEN q.questoes END,
          'acertos', CASE WHEN a.tem_dado_questoes THEN q.acertos END,
          'conteudos', CASE WHEN a.tem_dado_consumo THEN c.conteudos END
        ) ORDER BY w.semana)
        FROM semanas w
        CROSS JOIN LATERAL (
          SELECT count(*) AS questoes,
                 CASE WHEN count(*) > 0 AND count(f.acertou) = 0 THEN NULL
                      ELSE count(*) FILTER (WHERE f.acertou IS TRUE) END AS acertos
          FROM public.fato_resolucao_questoes_b2b f
          WHERE a.tem_dado_questoes AND f.sanarflix_user_id = a.sanarflix_user_id
            AND f.response_date >= w.semana AND f.response_date < w.semana + 7
            AND f.response_date <= v_hoje
        ) q
        CROSS JOIN LATERAL (
          SELECT count(DISTINCT f.content_id) AS conteudos
          FROM public.fato_consumo_conteudo_b2b f
          WHERE a.tem_dado_consumo AND f.sanarflix_user_id = a.sanarflix_user_id
            AND f.content_type IN ('video', 'document')
            AND f.event_date >= w.semana AND f.event_date < w.semana + 7
            AND f.event_date <= v_hoje
        ) c
      ) END
    ) ORDER BY a.email)
    FROM alunos a
  ), '[]'::jsonb);
END;
$function$;

create or replace function public.mentor_temas_turma(p_simulados uuid[] default null)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_mentor uuid := public.mentor_ativo_id();
BEGIN
  RETURN coalesce((
    WITH turma AS (
      SELECT v.email_normalizado AS email FROM public.mentoria_vinculos v
      WHERE v.mentor_id = v_mentor AND v.fim IS NULL
    ),
    liberados AS (
      SELECT s.id FROM public.b2c_simulados s
      WHERE s.status = 'published' AND (p_simulados IS NULL OR s.id = ANY(p_simulados))
        AND s.janela_fim IS NOT NULL
        AND now() >= greatest(coalesce(s.resultado_liberado_em, s.janela_fim), s.janela_fim)
    ),
    tent AS (
      SELECT DISTINCT ON (t.email, t.simulado_id) t.id, t.email, t.simulado_id
      FROM public.b2c_tentativas t
      JOIN turma tu ON tu.email = t.email
      JOIN liberados l ON l.id = t.simulado_id
      ORDER BY t.email, t.simulado_id, t.finalizada_em DESC, t.id DESC
    ),
    resp AS (
      SELECT t.email, t.simulado_id, s.sequence_number,
             coalesce(m.grande_area, nullif(btrim(q.grande_area), ''), 'Sem área') AS area,
             p.esp_label, k.esp_key, p.tema_label, k.tema_key, r.correta
      FROM tent t
      JOIN public.b2c_respostas r ON r.tentativa_id = t.id AND r.correta IS NOT NULL
      JOIN public.b2c_questoes q ON q.id = r.questao_id
      JOIN public.b2c_simulados s ON s.id = t.simulado_id
      LEFT JOIN public.b2c_area_mapa m ON m.area_origem = q.grande_area
      CROSS JOIN LATERAL (
        SELECT btrim(regexp_replace(coalesce(q.tema, ''), '\s+', ' ', 'g')) AS tc
      ) c
      CROSS JOIN LATERAL (
        SELECT coalesce(
                 nullif(btrim(CASE WHEN position('>' IN c.tc) > 0 THEN left(c.tc, position('>' IN c.tc) - 1) END), ''),
                 nullif(btrim(regexp_replace(coalesce(m.especialidade, ''), '\s+', ' ', 'g')), '')) AS esp_label,
               coalesce(
                 nullif(btrim(CASE WHEN position('>' IN c.tc) > 0 THEN substr(c.tc, position('>' IN c.tc) + 1) ELSE c.tc END), ''),
                 'Sem tema') AS tema_label
      ) p
      CROSS JOIN LATERAL (
        SELECT lower(regexp_replace(btrim(p.esp_label), '\s+', ' ', 'g')) AS esp_key,
               lower(regexp_replace(btrim(p.tema_label), '\s+', ' ', 'g')) AS tema_key
      ) k
    ),
    esp_lbl AS (
      SELECT DISTINCT ON (esp_key) esp_key, esp_label
      FROM (SELECT esp_key, esp_label, count(*) AS n FROM resp WHERE esp_key IS NOT NULL GROUP BY esp_key, esp_label) x
      ORDER BY esp_key, n DESC, esp_label
    ),
    tema_lbl AS (
      SELECT DISTINCT ON (area, esp_key, tema_key) area, esp_key, tema_key, tema_label
      FROM (SELECT area, esp_key, tema_key, tema_label, count(*) AS n FROM resp GROUP BY area, esp_key, tema_key, tema_label) x
      ORDER BY area, esp_key, tema_key, n DESC, tema_label
    ),
    agregado AS (
      SELECT area, esp_key, tema_key, count(*) AS respostas,
             round(100.0 * count(*) FILTER (WHERE correta) / count(*), 1) AS acerto_pct
      FROM resp GROUP BY area, esp_key, tema_key
    ),
    abaixo AS (
      SELECT area, esp_key, tema_key, email
      FROM resp GROUP BY area, esp_key, tema_key, email
      HAVING 100.0 * count(*) FILTER (WHERE correta) / count(*) < 50
    ),
    serie AS (
      SELECT area, esp_key, tema_key, simulado_id, sequence_number,
             round(100.0 * count(*) FILTER (WHERE correta) / count(*), 1) AS acerto_pct
      FROM resp GROUP BY area, esp_key, tema_key, simulado_id, sequence_number
    )
    SELECT jsonb_agg(jsonb_build_object(
      'grande_area', g.area, 'especialidade', el.esp_label, 'tema', tl.tema_label,
      'prevalencia', pr.prevalencia,
      'peso', CASE pr.prevalencia WHEN 'Alta' THEN 3 WHEN 'Média' THEN 2 WHEN 'Baixa' THEN 1 END,
      'respostas', g.respostas, 'acerto_pct', g.acerto_pct,
      'alunos_abaixo_50', coalesce((
        SELECT jsonb_agg(a.email ORDER BY a.email) FROM abaixo a
        WHERE a.area = g.area AND a.esp_key IS NOT DISTINCT FROM g.esp_key AND a.tema_key = g.tema_key
      ), '[]'::jsonb),
      'critico', g.respostas >= 30,
      'serie', coalesce((
        SELECT jsonb_agg(jsonb_build_object('simulado_id', s.simulado_id, 'acerto_pct', s.acerto_pct)
                         ORDER BY s.sequence_number, s.simulado_id)
        FROM serie s
        WHERE s.area = g.area AND s.esp_key IS NOT DISTINCT FROM g.esp_key AND s.tema_key = g.tema_key
      ), '[]'::jsonb)
    ) ORDER BY g.acerto_pct, g.area, el.esp_label NULLS LAST, tl.tema_label)
    FROM agregado g
    LEFT JOIN esp_lbl el ON el.esp_key = g.esp_key
    JOIN tema_lbl tl ON tl.area = g.area AND tl.esp_key IS NOT DISTINCT FROM g.esp_key AND tl.tema_key = g.tema_key
    LEFT JOIN public.enamed_prevalencia_tema pr ON pr.tema_norm = g.tema_key
  ), '[]'::jsonb);
END;
$function$;

-- Sem overload: chamadas antigas por p_simulados continuam validas pelo default.
drop function public.mentor_detalhamento(uuid[]);
create or replace function public.mentor_detalhamento(p_simulados uuid[], p_emails text[] default null)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_mentor uuid := public.mentor_ativo_id();
  v_emails text[];
BEGIN
  IF p_emails IS NOT NULL THEN
    v_emails := public.mentor_exige_alunos(v_mentor, p_emails);
  END IF;
  IF p_simulados IS NULL OR cardinality(p_simulados) = 0 THEN
    RAISE EXCEPTION 'escolha ao menos um simulado';
  END IF;
  RETURN (
    WITH turma AS (
      SELECT v.email_normalizado AS email
      FROM public.mentoria_vinculos v
      WHERE v.mentor_id = v_mentor AND v.fim IS NULL
        AND (v_emails IS NULL OR v.email_normalizado = ANY(v_emails))
    ),
    sim AS (
      SELECT s.id, s.sequence_number,
             greatest(coalesce(s.resultado_liberado_em, s.janela_fim), s.janela_fim) AS libera_em
      FROM public.b2c_simulados s
      WHERE s.status = 'published' AND s.id = ANY(p_simulados)
    ),
    liberados AS (
      SELECT sm.id FROM sim sm WHERE now() >= sm.libera_em
    ),
    bloqueados AS (
      SELECT sm.id, sm.sequence_number, sm.libera_em
      FROM sim sm WHERE sm.libera_em IS NULL OR now() < sm.libera_em
    ),
    tent AS (
      SELECT DISTINCT ON (t.email, t.simulado_id) t.id, t.email, t.simulado_id
      FROM public.b2c_tentativas t
      JOIN turma tu ON tu.email = t.email
      JOIN liberados l ON l.id = t.simulado_id
      WHERE t.simulado_id = ANY(p_simulados)
      ORDER BY t.email, t.simulado_id, t.finalizada_em DESC, t.id DESC
    ),
    resp AS (
      SELECT t.email, q.id AS questao_id, q.numero, s.sequence_number,
             coalesce(m.grande_area, nullif(btrim(q.grande_area), ''), 'Sem área') AS area,
             p.esp_label, k.esp_key, p.tema_label, k.tema_key, k.full_key,
             coalesce(nullif(c.tc, ''), 'Sem tema') AS tema_full,
             q.correta_label,
             CASE WHEN r.respondida THEN coalesce(r.marcada_label, 'branco') ELSE 'branco' END AS label,
             r.correta
      FROM tent t
      JOIN public.b2c_respostas r ON r.tentativa_id = t.id AND r.correta IS NOT NULL
      JOIN public.b2c_questoes q ON q.id = r.questao_id
      JOIN public.b2c_simulados s ON s.id = q.simulado_id
      LEFT JOIN public.b2c_area_mapa m ON m.area_origem = q.grande_area
      CROSS JOIN LATERAL (
        SELECT btrim(regexp_replace(coalesce(q.tema, ''), '\s+', ' ', 'g')) AS tc
      ) c
      CROSS JOIN LATERAL (
        SELECT coalesce(
                 nullif(btrim(CASE WHEN position('>' IN c.tc) > 0 THEN left(c.tc, position('>' IN c.tc) - 1) END), ''),
                 nullif(btrim(regexp_replace(coalesce(m.especialidade, ''), '\s+', ' ', 'g')), '')) AS esp_label,
               coalesce(
                 nullif(btrim(CASE WHEN position('>' IN c.tc) > 0 THEN substr(c.tc, position('>' IN c.tc) + 1) ELSE c.tc END), ''),
                 'Sem tema') AS tema_label
      ) p
      CROSS JOIN LATERAL (
        SELECT lower(regexp_replace(btrim(p.esp_label), '\s+', ' ', 'g')) AS esp_key,
               lower(regexp_replace(btrim(p.tema_label), '\s+', ' ', 'g')) AS tema_key,
               lower(regexp_replace(btrim(coalesce(nullif(c.tc, ''), 'Sem tema')), '\s+', ' ', 'g')) AS full_key
      ) k
    ),
    esp_lbl AS (
      SELECT DISTINCT ON (esp_key) esp_key, esp_label
      FROM (SELECT esp_key, esp_label, count(*) AS n FROM resp WHERE esp_key IS NOT NULL GROUP BY esp_key, esp_label) x
      ORDER BY esp_key, n DESC, esp_label
    ),
    tema_lbl AS (
      SELECT DISTINCT ON (area, esp_key, tema_key) area, esp_key, tema_key, tema_label
      FROM (SELECT area, esp_key, tema_key, tema_label, count(*) AS n FROM resp GROUP BY area, esp_key, tema_key, tema_label) x
      ORDER BY area, esp_key, tema_key, n DESC, tema_label
    ),
    full_lbl AS (
      SELECT DISTINCT ON (area, full_key) area, full_key, tema_full
      FROM (SELECT area, full_key, tema_full, count(*) AS n FROM resp GROUP BY area, full_key, tema_full) x
      ORDER BY area, full_key, n DESC, tema_full
    ),
    por_tema AS (
      SELECT g.area, fl.tema_full AS tema, g.acerto_pct, g.respostas
      FROM (SELECT area, full_key,
                   round(100.0 * count(*) FILTER (WHERE correta) / count(*), 1) AS acerto_pct,
                   count(*) AS respostas
            FROM resp GROUP BY area, full_key) g
      JOIN full_lbl fl ON fl.area = g.area AND fl.full_key = g.full_key
    ),
    por_esp AS (
      SELECT g.area, g.esp_key, el.esp_label AS especialidade, g.acerto_pct, g.respostas
      FROM (SELECT area, esp_key,
                   round(100.0 * count(*) FILTER (WHERE correta) / count(*), 1) AS acerto_pct,
                   count(*) AS respostas
            FROM resp GROUP BY area, esp_key) g
      LEFT JOIN esp_lbl el ON el.esp_key = g.esp_key
    ),
    por_tema_esp AS (
      SELECT g.area, g.esp_key, tl.tema_label AS tema, g.acerto_pct, g.respostas
      FROM (SELECT area, esp_key, tema_key,
                   round(100.0 * count(*) FILTER (WHERE correta) / count(*), 1) AS acerto_pct,
                   count(*) AS respostas
            FROM resp GROUP BY area, esp_key, tema_key) g
      JOIN tema_lbl tl ON tl.area = g.area AND tl.esp_key IS NOT DISTINCT FROM g.esp_key AND tl.tema_key = g.tema_key
    ),
    por_area AS (
      SELECT area,
             round(100.0 * count(*) FILTER (WHERE correta) / count(*), 1) AS acerto_pct,
             count(*) AS respostas
      FROM resp GROUP BY area
    ),
    por_questao AS (
      SELECT g.questao_id, g.numero, g.sequence_number, g.area,
             el.esp_label AS especialidade, tl.tema_label AS tema_curto, g.tema_full AS tema,
             g.correta_label, g.acerto_pct, g.respostas
      FROM (SELECT questao_id, numero, sequence_number, area, esp_key, tema_key, tema_full, correta_label,
                   round(100.0 * count(*) FILTER (WHERE correta) / count(*), 1) AS acerto_pct,
                   count(*) AS respostas
            FROM resp
            GROUP BY questao_id, numero, sequence_number, area, esp_key, tema_key, tema_full, correta_label) g
      LEFT JOIN esp_lbl el ON el.esp_key = g.esp_key
      LEFT JOIN tema_lbl tl ON tl.area = g.area AND tl.esp_key IS NOT DISTINCT FROM g.esp_key AND tl.tema_key = g.tema_key
    ),
    por_alt AS (
      SELECT questao_id, label, count(*) AS n,
             CASE WHEN label IS NOT DISTINCT FROM correta_label THEN NULL
                  ELSE jsonb_agg(email ORDER BY email) END AS emails
      FROM resp GROUP BY questao_id, label, correta_label
    ),
    alt_agg AS (
      SELECT questao_id,
             jsonb_object_agg(label, n) AS distribuicao,
             jsonb_object_agg(label, emails) FILTER (WHERE emails IS NOT NULL) AS emails
      FROM por_alt GROUP BY questao_id
    )
    SELECT jsonb_build_object(
      'areas', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'grande_area', a.area, 'acerto_pct', a.acerto_pct, 'respostas', a.respostas,
          'especialidades', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
              'especialidade', e.especialidade, 'acerto_pct', e.acerto_pct, 'respostas', e.respostas,
              'temas', coalesce((
                SELECT jsonb_agg(jsonb_build_object('tema', te.tema, 'acerto_pct', te.acerto_pct, 'respostas', te.respostas)
                                 ORDER BY te.acerto_pct, te.tema)
                FROM por_tema_esp te
                WHERE te.area = a.area AND te.esp_key IS NOT DISTINCT FROM e.esp_key), '[]'::jsonb)
            ) ORDER BY e.acerto_pct, e.especialidade NULLS LAST)
            FROM por_esp e WHERE e.area = a.area), '[]'::jsonb),
          'temas', coalesce((
            SELECT jsonb_agg(jsonb_build_object('tema', t.tema, 'acerto_pct', t.acerto_pct, 'respostas', t.respostas)
                             ORDER BY t.acerto_pct, t.tema)
            FROM por_tema t WHERE t.area = a.area), '[]'::jsonb)
        ) ORDER BY a.acerto_pct, a.area) FROM por_area a), '[]'::jsonb),
      'questoes', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'questao_id', q.questao_id, 'numero', q.numero, 'sequence_number', q.sequence_number,
          'grande_area', q.area, 'especialidade', q.especialidade, 'tema', q.tema, 'tema_curto', q.tema_curto,
          'dificuldade', qq.dificuldade,
          'enunciado_inicio', left(nullif(regexp_replace(btrim(coalesce(qq.enunciado, '')), '\s+', ' ', 'g'), ''), 140),
          'tem_imagem', (nullif(btrim(qq.imagem_url), '') IS NOT NULL OR nullif(btrim(qq.imagem_url_2), '') IS NOT NULL),
          'correta_label', q.correta_label,
          'acerto_pct', q.acerto_pct, 'respostas', q.respostas,
          'distribuicao', coalesce(g.distribuicao, '{}'::jsonb),
          'emails', coalesce(g.emails, '{}'::jsonb)
        ) ORDER BY q.sequence_number, q.numero)
        FROM por_questao q
        JOIN public.b2c_questoes qq ON qq.id = q.questao_id
        LEFT JOIN alt_agg g ON g.questao_id = q.questao_id), '[]'::jsonb),
      'bloqueados', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'simulado_id', b.id, 'sequence_number', b.sequence_number, 'libera_em', b.libera_em
        ) ORDER BY b.sequence_number) FROM bloqueados b), '[]'::jsonb)
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
  v_email text;
BEGIN
  IF p_email IS NULL OR btrim(p_email) = '' THEN
    RAISE EXCEPTION 'e-mail obrigatório';
  END IF;
  v_email := (public.mentor_exige_alunos(v_mentor, array[p_email]))[1];
  RETURN (
    WITH turma AS (
      SELECT v.email_normalizado AS email
      FROM public.mentoria_vinculos v
      WHERE v.mentor_id = v_mentor AND v.fim IS NULL AND v.email_normalizado = v_email
    ),
    tent AS (
      SELECT DISTINCT ON (t.simulado_id) t.id, t.simulado_id, t.finalizada_em, t.acerto_pct,
             t.acertos, t.respondidas,
             t.posicao, t.participantes, t.percentil, t.dentro_janela
      FROM public.b2c_tentativas t
      JOIN turma tu ON tu.email = t.email
      JOIN public.b2c_simulados sp ON sp.id = t.simulado_id AND sp.status = 'published'
      ORDER BY t.simulado_id, t.finalizada_em DESC, t.id DESC
    ),
    resp AS (
      SELECT coalesce(m.grande_area, nullif(btrim(q.grande_area), ''), 'Sem área') AS area,
             p.esp_label, k.esp_key, p.tema_label, k.tema_key, k.full_key,
             coalesce(nullif(c.tc, ''), 'Sem tema') AS tema_full,
             r.correta
      FROM tent t
      JOIN public.b2c_simulados sr ON sr.id = t.simulado_id
                                  AND sr.janela_fim IS NOT NULL
                                  AND now() >= greatest(coalesce(sr.resultado_liberado_em, sr.janela_fim), sr.janela_fim)
      JOIN public.b2c_respostas r ON r.tentativa_id = t.id AND r.correta IS NOT NULL
      JOIN public.b2c_questoes q ON q.id = r.questao_id
      LEFT JOIN public.b2c_area_mapa m ON m.area_origem = q.grande_area
      CROSS JOIN LATERAL (
        SELECT btrim(regexp_replace(coalesce(q.tema, ''), '\s+', ' ', 'g')) AS tc
      ) c
      CROSS JOIN LATERAL (
        SELECT coalesce(
                 nullif(btrim(CASE WHEN position('>' IN c.tc) > 0 THEN left(c.tc, position('>' IN c.tc) - 1) END), ''),
                 nullif(btrim(regexp_replace(coalesce(m.especialidade, ''), '\s+', ' ', 'g')), '')) AS esp_label,
               coalesce(
                 nullif(btrim(CASE WHEN position('>' IN c.tc) > 0 THEN substr(c.tc, position('>' IN c.tc) + 1) ELSE c.tc END), ''),
                 'Sem tema') AS tema_label
      ) p
      CROSS JOIN LATERAL (
        SELECT lower(regexp_replace(btrim(p.esp_label), '\s+', ' ', 'g')) AS esp_key,
               lower(regexp_replace(btrim(p.tema_label), '\s+', ' ', 'g')) AS tema_key,
               lower(regexp_replace(btrim(coalesce(nullif(c.tc, ''), 'Sem tema')), '\s+', ' ', 'g')) AS full_key
      ) k
    ),
    esp_lbl AS (
      SELECT DISTINCT ON (esp_key) esp_key, esp_label
      FROM (SELECT esp_key, esp_label, count(*) AS n FROM resp WHERE esp_key IS NOT NULL GROUP BY esp_key, esp_label) x
      ORDER BY esp_key, n DESC, esp_label
    ),
    tema_lbl AS (
      SELECT DISTINCT ON (area, esp_key, tema_key) area, esp_key, tema_key, tema_label
      FROM (SELECT area, esp_key, tema_key, tema_label, count(*) AS n FROM resp GROUP BY area, esp_key, tema_key, tema_label) x
      ORDER BY area, esp_key, tema_key, n DESC, tema_label
    ),
    full_lbl AS (
      SELECT DISTINCT ON (area, full_key) area, full_key, tema_full
      FROM (SELECT area, full_key, tema_full, count(*) AS n FROM resp GROUP BY area, full_key, tema_full) x
      ORDER BY area, full_key, n DESC, tema_full
    ),
    por_tema AS (
      SELECT g.area, fl.tema_full AS tema, g.acerto_pct, g.respostas
      FROM (SELECT area, full_key,
                   round(100.0 * count(*) FILTER (WHERE correta) / count(*), 1) AS acerto_pct,
                   count(*) AS respostas
            FROM resp GROUP BY area, full_key) g
      JOIN full_lbl fl ON fl.area = g.area AND fl.full_key = g.full_key
    ),
    por_esp AS (
      SELECT g.area, g.esp_key, el.esp_label AS especialidade, g.acerto_pct, g.respostas
      FROM (SELECT area, esp_key,
                   round(100.0 * count(*) FILTER (WHERE correta) / count(*), 1) AS acerto_pct,
                   count(*) AS respostas
            FROM resp GROUP BY area, esp_key) g
      LEFT JOIN esp_lbl el ON el.esp_key = g.esp_key
    ),
    por_tema_esp AS (
      SELECT g.area, g.esp_key, tl.tema_label AS tema, g.acerto_pct, g.respostas
      FROM (SELECT area, esp_key, tema_key,
                   round(100.0 * count(*) FILTER (WHERE correta) / count(*), 1) AS acerto_pct,
                   count(*) AS respostas
            FROM resp GROUP BY area, esp_key, tema_key) g
      JOIN tema_lbl tl ON tl.area = g.area AND tl.esp_key IS NOT DISTINCT FROM g.esp_key AND tl.tema_key = g.tema_key
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
          'acerto_pct', round(t.acerto_pct, 1), 'finalizada_em', t.finalizada_em,
          'acertos', t.acertos, 'respondidas', t.respondidas,
          'posicao', t.posicao, 'participantes', t.participantes,
          'percentil', t.percentil, 'dentro_janela', t.dentro_janela
        ) ORDER BY s.sequence_number)
        FROM tent t JOIN public.b2c_simulados s ON s.id = t.simulado_id), '[]'::jsonb),
      'areas', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'grande_area', a.area, 'acerto_pct', a.acerto_pct, 'respostas', a.respostas,
          'especialidades', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
              'especialidade', e.especialidade, 'acerto_pct', e.acerto_pct, 'respostas', e.respostas,
              'temas', coalesce((
                SELECT jsonb_agg(jsonb_build_object('tema', te.tema, 'acerto_pct', te.acerto_pct, 'respostas', te.respostas)
                                 ORDER BY te.acerto_pct, te.tema)
                FROM por_tema_esp te
                WHERE te.area = a.area AND te.esp_key IS NOT DISTINCT FROM e.esp_key), '[]'::jsonb)
            ) ORDER BY e.acerto_pct, e.especialidade NULLS LAST)
            FROM por_esp e WHERE e.area = a.area), '[]'::jsonb),
          'temas', coalesce((
            SELECT jsonb_agg(jsonb_build_object('tema', t.tema, 'acerto_pct', t.acerto_pct, 'respostas', t.respostas)
                             ORDER BY t.acerto_pct, t.tema)
            FROM por_tema t WHERE t.area = a.area), '[]'::jsonb)
        ) ORDER BY a.acerto_pct, a.area) FROM por_area a), '[]'::jsonb)
    )
  );
END;
$function$;

revoke all on function public.mentor_turma() from public;
revoke execute on function public.mentor_turma() from anon;
grant execute on function public.mentor_turma() to authenticated;
revoke all on function public.mentor_desempenho_turma(uuid[]) from public;
revoke execute on function public.mentor_desempenho_turma(uuid[]) from anon;
grant execute on function public.mentor_desempenho_turma(uuid[]) to authenticated;
revoke all on function public.mentor_serie_turma(uuid[]) from public;
revoke execute on function public.mentor_serie_turma(uuid[]) from anon;
grant execute on function public.mentor_serie_turma(uuid[]) to authenticated;
revoke all on function public.mentor_engajamento_turma(integer) from public;
revoke execute on function public.mentor_engajamento_turma(integer) from anon;
grant execute on function public.mentor_engajamento_turma(integer) to authenticated;
revoke all on function public.mentor_temas_turma(uuid[]) from public;
revoke execute on function public.mentor_temas_turma(uuid[]) from anon;
grant execute on function public.mentor_temas_turma(uuid[]) to authenticated;
revoke all on function public.mentor_detalhamento(uuid[], text[]) from public;
revoke execute on function public.mentor_detalhamento(uuid[], text[]) from anon;
grant execute on function public.mentor_detalhamento(uuid[], text[]) to authenticated;
revoke all on function public.mentor_aluno_notas(text) from public;
revoke execute on function public.mentor_aluno_notas(text) from anon;
grant execute on function public.mentor_aluno_notas(text) to authenticated;
