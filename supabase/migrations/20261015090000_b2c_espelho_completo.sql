-- Página do Mentor · Onda 3 (fase 2): espelho B2C completo.
-- Traz para o espelho o conteúdo das questões (enunciado, alternativas, explicação,
-- imagens, dificuldade), a liberação de resultado do simulado e a classificação do
-- aluno (posição/percentil), e usa isso em mentor_detalhamento, mentor_questao (nova)
-- e mentor_aluno_notas.
--
-- REGRA DE LIBERAÇÃO (produto): dado POR QUESTÃO / gabarito de um simulado só é visível
-- ao mentor quando  now() >= greatest(coalesce(resultado_liberado_em, janela_fim), janela_fim),
-- isto é: a janela já fechou E o resultado já foi liberado aos alunos. As notas
-- (acerto_pct) de simulados encerrados continuam visíveis em desempenho/notas.
-- A regra vale em mentor_detalhamento e mentor_questao.
--
-- ATENÇÃO ao aplicar: mentor_detalhamento e mentor_aluno_notas são recriadas a partir de
-- 20261014173149 (corpo versionado); conferir antes contra pg_get_functiondef em prod.

-- 1. Colunas novas (preenchidas pela edge sync-simulados-b2c; NULL até o primeiro sync).
alter table public.b2c_simulados
  add column if not exists resultado_liberado_em timestamptz;

alter table public.b2c_questoes
  add column if not exists enunciado text,
  add column if not exists explicacao text,
  add column if not exists imagem_url text,
  add column if not exists imagem_url_2 text,
  add column if not exists explicacao_imagem_url text,
  add column if not exists dificuldade text;

alter table public.b2c_tentativas
  add column if not exists dentro_janela boolean,
  add column if not exists posicao int,
  add column if not exists participantes int,
  add column if not exists percentil numeric;

-- 2. Alternativas das questões.
create table if not exists public.b2c_alternativas (
  id uuid primary key,
  questao_id uuid not null references public.b2c_questoes(id) on delete cascade,
  label text not null,
  texto text,
  correta boolean not null default false,
  unique (questao_id, label)
);

alter table public.b2c_alternativas enable row level security;
revoke all on table public.b2c_alternativas from anon, authenticated;

-- 3. Mapa de normalização das áreas (o campo `area` da plataforma é sujo).
create table if not exists public.b2c_area_mapa (
  area_origem text primary key,
  grande_area text not null,
  especialidade text
);

comment on table public.b2c_area_mapa is
  'Normaliza b2c_questoes.grande_area (valor bruto da plataforma) em GRANDE ÁREA. A especialidade vem do prefixo de b2c_questoes.tema ("Especialidade > Tema"); a coluna especialidade deste mapa só é o fallback quando o tema não tem ">". ESTE AGRUPAMENTO É UMA PROPOSTA, pendente de validação do produto (Felipe). Área sem linha aqui cai em btrim(area) como grande área e sem especialidade de fallback (área vazia: Sem área).';

alter table public.b2c_area_mapa enable row level security;
revoke all on table public.b2c_area_mapa from anon, authenticated;

insert into public.b2c_area_mapa (area_origem, grande_area, especialidade) values
  ('Clínica Médica', 'Clínica Médica', null),
  ('Clínica Médica / Preventiva', 'Clínica Médica', null),
  ('Pediatria', 'Pediatria', null),
  ('Ginecologia e Obstetrícia', 'Ginecologia e Obstetrícia', null),
  ('Obstetrícia', 'Ginecologia e Obstetrícia', 'Obstetrícia'),
  ('Ginecologia', 'Ginecologia e Obstetrícia', 'Ginecologia'),
  ('Cirurgia Geral', 'Cirurgia', 'Cirurgia Geral'),
  ('Cirurgia', 'Cirurgia', null),
  ('Cirurgia ', 'Cirurgia', null),
  ('Preventiva', 'Medicina Preventiva', null),
  ('Preventiva ', 'Medicina Preventiva', null),
  ('Saúde Coletiva / Preventiva', 'Medicina Preventiva', 'Saúde Coletiva'),
  ('Medicina de Família e Comunidade (MFC)', 'Medicina Preventiva', 'Medicina de Família e Comunidade'),
  ('Medicina da Família e Comunidade', 'Medicina Preventiva', 'Medicina de Família e Comunidade'),
  ('Medicina de Família e Comunidade', 'Medicina Preventiva', 'Medicina de Família e Comunidade'),
  ('Saúde Mental', 'Clínica Médica', 'Saúde Mental')
on conflict (area_origem) do update
  set grande_area = excluded.grande_area, especialidade = excluded.especialidade;

-- 4. mentor_detalhamento: respeita a liberação, usa o mapa de áreas e devolve mais por questão.
--    Chaves NOVAS: bloqueados[], areas[].especialidades[], questoes[].{especialidade, tema_curto,
--    dificuldade, enunciado_inicio, tem_imagem}. Todas as chaves anteriores permanecem
--    (areas[].temas inclusive).
--    Hierarquia: grande área vem do mapa (b2c_area_mapa); ESPECIALIDADE e TEMA vêm do campo
--    `tema` da plataforma, formatado "Especialidade > Tema" (split no PRIMEIRO '>'). Sem '>',
--    a especialidade cai na do mapa e o tema é o texto inteiro. Agrupamento insensível a caixa e
--    espaços (lower + whitespace colapsado); cada chave exibe UM rótulo: a grafia mais frequente
--    (empate: menor em ordem alfabética). questoes[].tema é a string completa (colapsada);
--    questoes[].tema_curto é o tema sem a especialidade. areas[].temas (lista plana, compat.)
--    usa a string completa "Esp > Tema" com a mesma regra de chave/rótulo.
--    areas[].especialidades[].especialidade é NULL quando a área não tem especialidade
--    (o front rotula, ex.: 'Geral').
create or replace function public.mentor_detalhamento(p_simulados uuid[])
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_mentor uuid := public.mentor_ativo_id();
BEGIN
  IF p_simulados IS NULL OR cardinality(p_simulados) = 0 THEN
    RAISE EXCEPTION 'escolha ao menos um simulado';
  END IF;
  RETURN (
    WITH turma AS (
      SELECT v.email_normalizado AS email
      FROM public.mentoria_vinculos v
      WHERE v.mentor_id = v_mentor AND v.fim IS NULL
    ),
    -- liberação: janela fechada E resultado liberado aos alunos
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
    -- só a tentativa mais recente de cada aluno por simulado, como na nota
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
      JOIN public.b2c_respostas r ON r.tentativa_id = t.id
      JOIN public.b2c_questoes q ON q.id = r.questao_id
      JOIN public.b2c_simulados s ON s.id = q.simulado_id
      LEFT JOIN public.b2c_area_mapa m ON m.area_origem = q.grande_area
      CROSS JOIN LATERAL (
        -- tema com whitespace colapsado e aparado (a plataforma traz espaços duplos/finais)
        SELECT btrim(regexp_replace(coalesce(q.tema, ''), '\s+', ' ', 'g')) AS tc
      ) c
      CROSS JOIN LATERAL (
        -- "Especialidade > Tema": especialidade = antes do PRIMEIRO '>'; sem '>' (ou prefixo
        -- vazio) cai na especialidade do mapa. Tema = depois do primeiro '>' (ou o tema inteiro).
        SELECT coalesce(
                 nullif(btrim(CASE WHEN position('>' IN c.tc) > 0 THEN left(c.tc, position('>' IN c.tc) - 1) END), ''),
                 nullif(btrim(regexp_replace(coalesce(m.especialidade, ''), '\s+', ' ', 'g')), '')) AS esp_label,
               coalesce(
                 nullif(btrim(CASE WHEN position('>' IN c.tc) > 0 THEN substr(c.tc, position('>' IN c.tc) + 1) ELSE c.tc END), ''),
                 'Sem tema') AS tema_label
      ) p
      CROSS JOIN LATERAL (
        -- chaves de agrupamento: insensíveis a caixa e a espaços
        SELECT lower(regexp_replace(btrim(p.esp_label), '\s+', ' ', 'g')) AS esp_key,
               lower(regexp_replace(btrim(p.tema_label), '\s+', ' ', 'g')) AS tema_key,
               lower(regexp_replace(btrim(coalesce(nullif(c.tc, ''), 'Sem tema')), '\s+', ' ', 'g')) AS full_key
      ) k
    ),
    -- um rótulo de exibição por chave: a grafia mais frequente; empate -> menor (min) em ordem alfabética
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
      -- e-mails da alternativa correta ficam de fora (payload menor; a ação é sobre quem errou)
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

-- 5. mentor_questao: uma questão em detalhe (enunciado, gabarito, distribuição, quem errou).
--    Só para simulado liberado. Calculada sobre a tentativa mais recente de cada aluno ATIVO
--    do mentor. p_simulados (opcional) restringe as tentativas consideradas: como a questão
--    pertence a um único simulado, uma seleção que não o contém resulta em 0 respostas.
--    Retorno:
--    { questao_id, simulado_id, sequence_number, numero, grande_area, especialidade, tema, tema_curto,
--      dificuldade, enunciado, imagens: [url], explicacao, explicacao_imagem_url,
--      respostas, acerto_pct,
--      alternativas: [{label, texto, correta, n, pct, emails}],  -- emails só nas ERRADAS (null na correta)
--      branco: {n, emails} }
create or replace function public.mentor_questao(p_questao_id uuid, p_simulados uuid[] default null)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
  v_mentor uuid := public.mentor_ativo_id();
  v_q record;
BEGIN
  IF p_questao_id IS NULL THEN
    RAISE EXCEPTION 'questão obrigatória';
  END IF;

  SELECT q.id, q.simulado_id, q.numero, q.tema, q.correta_label, q.enunciado, q.explicacao,
         q.imagem_url, q.imagem_url_2, q.explicacao_imagem_url, q.dificuldade,
         s.sequence_number,
         greatest(coalesce(s.resultado_liberado_em, s.janela_fim), s.janela_fim) AS libera_em,
         coalesce(m.grande_area, nullif(btrim(q.grande_area), ''), 'Sem área') AS area,
         p.esp_label AS especialidade,
         coalesce(nullif(c.tc, ''), 'Sem tema') AS tema_full,
         p.tema_label AS tema_curto
    INTO v_q
  FROM public.b2c_questoes q
  JOIN public.b2c_simulados s ON s.id = q.simulado_id AND s.status = 'published'
  LEFT JOIN public.b2c_area_mapa m ON m.area_origem = q.grande_area
  CROSS JOIN LATERAL (
    SELECT btrim(regexp_replace(coalesce(q.tema, ''), '\s+', ' ', 'g')) AS tc
  ) c
  CROSS JOIN LATERAL (
    -- especialidade = antes do PRIMEIRO '>' do tema (fallback: a do mapa); tema = depois dele
    SELECT coalesce(
             nullif(btrim(CASE WHEN position('>' IN c.tc) > 0 THEN left(c.tc, position('>' IN c.tc) - 1) END), ''),
             nullif(btrim(regexp_replace(coalesce(m.especialidade, ''), '\s+', ' ', 'g')), '')) AS esp_label,
           coalesce(
             nullif(btrim(CASE WHEN position('>' IN c.tc) > 0 THEN substr(c.tc, position('>' IN c.tc) + 1) ELSE c.tc END), ''),
             'Sem tema') AS tema_label
  ) p
  WHERE q.id = p_questao_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'questão não encontrada';
  END IF;
  IF v_q.libera_em IS NULL OR now() < v_q.libera_em THEN
    RAISE EXCEPTION 'resultado deste simulado ainda não foi liberado';
  END IF;

  RETURN (
    WITH turma AS (
      SELECT v.email_normalizado AS email
      FROM public.mentoria_vinculos v
      WHERE v.mentor_id = v_mentor AND v.fim IS NULL
    ),
    -- mesma regra de mentor_detalhamento: tentativa mais recente de cada aluno no simulado
    tent AS (
      SELECT DISTINCT ON (t.email) t.id, t.email
      FROM public.b2c_tentativas t
      JOIN turma tu ON tu.email = t.email
      WHERE t.simulado_id = v_q.simulado_id
        AND (p_simulados IS NULL OR t.simulado_id = ANY(p_simulados))
      ORDER BY t.email, t.finalizada_em DESC, t.id DESC
    ),
    resp AS (
      SELECT t.email,
             CASE WHEN r.respondida THEN coalesce(r.marcada_label, 'branco') ELSE 'branco' END AS label,
             r.correta
      FROM tent t
      JOIN public.b2c_respostas r ON r.tentativa_id = t.id AND r.questao_id = p_questao_id
    ),
    total AS (
      SELECT count(*) AS n,
             round(100.0 * count(*) FILTER (WHERE correta) / nullif(count(*), 0), 1) AS acerto_pct
      FROM resp
    ),
    cont AS (
      SELECT label, count(*) AS n, jsonb_agg(email ORDER BY email) AS emails
      FROM resp GROUP BY label
    ),
    -- alternativas do espelho; marcações fora delas (dado inconsistente / payload antigo
    -- sem opções) entram mesmo assim, com texto NULL
    alts AS (
      SELECT a.label, a.texto,
             (a.correta OR a.label IS NOT DISTINCT FROM v_q.correta_label) AS correta
      FROM public.b2c_alternativas a
      WHERE a.questao_id = p_questao_id
      UNION ALL
      SELECT c.label, NULL::text, (c.label IS NOT DISTINCT FROM v_q.correta_label)
      FROM cont c
      WHERE c.label <> 'branco'
        AND NOT EXISTS (SELECT 1 FROM public.b2c_alternativas a
                         WHERE a.questao_id = p_questao_id AND a.label = c.label)
    )
    SELECT jsonb_build_object(
      'questao_id', v_q.id,
      'simulado_id', v_q.simulado_id,
      'sequence_number', v_q.sequence_number,
      'numero', v_q.numero,
      'grande_area', v_q.area,
      'especialidade', v_q.especialidade,
      'tema', v_q.tema_full,
      'tema_curto', v_q.tema_curto,
      'dificuldade', v_q.dificuldade,
      'enunciado', v_q.enunciado,
      'imagens', to_jsonb(array_remove(array[nullif(btrim(v_q.imagem_url), ''), nullif(btrim(v_q.imagem_url_2), '')], NULL)),
      'explicacao', v_q.explicacao,
      'explicacao_imagem_url', nullif(btrim(v_q.explicacao_imagem_url), ''),
      'respostas', (SELECT n FROM total),
      'acerto_pct', (SELECT acerto_pct FROM total),
      'alternativas', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'label', x.label, 'texto', x.texto, 'correta', x.correta,
          'n', coalesce(c.n, 0),
          'pct', coalesce(round(100.0 * c.n / nullif((SELECT n FROM total), 0), 1), 0),
          -- e-mails só de quem marcou alternativa ERRADA; na correta, NULL
          'emails', CASE WHEN x.correta THEN NULL ELSE coalesce(c.emails, '[]'::jsonb) END
        ) ORDER BY x.label)
        FROM alts x LEFT JOIN cont c ON c.label = x.label), '[]'::jsonb),
      'branco', jsonb_build_object(
        'n', coalesce((SELECT c.n FROM cont c WHERE c.label = 'branco'), 0),
        'emails', coalesce((SELECT c.emails FROM cont c WHERE c.label = 'branco'), '[]'::jsonb))
    )
  );
END;
$function$;

-- 6. mentor_aluno_notas: notas ganham classificação; áreas ganham a árvore de especialidades.
--    notas[] novas chaves: posicao, participantes, percentil, dentro_janela (NULL se ainda não sincronizado).
--    areas[] nova chave: especialidades[] (mesmo formato de mentor_detalhamento); areas[].temas continua.
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
      JOIN public.b2c_respostas r ON r.tentativa_id = t.id
      JOIN public.b2c_questoes q ON q.id = r.questao_id
      LEFT JOIN public.b2c_area_mapa m ON m.area_origem = q.grande_area
      CROSS JOIN LATERAL (
        -- tema com whitespace colapsado e aparado (a plataforma traz espaços duplos/finais)
        SELECT btrim(regexp_replace(coalesce(q.tema, ''), '\s+', ' ', 'g')) AS tc
      ) c
      CROSS JOIN LATERAL (
        -- "Especialidade > Tema": especialidade = antes do PRIMEIRO '>'; sem '>' (ou prefixo
        -- vazio) cai na especialidade do mapa. Tema = depois do primeiro '>' (ou o tema inteiro).
        SELECT coalesce(
                 nullif(btrim(CASE WHEN position('>' IN c.tc) > 0 THEN left(c.tc, position('>' IN c.tc) - 1) END), ''),
                 nullif(btrim(regexp_replace(coalesce(m.especialidade, ''), '\s+', ' ', 'g')), '')) AS esp_label,
               coalesce(
                 nullif(btrim(CASE WHEN position('>' IN c.tc) > 0 THEN substr(c.tc, position('>' IN c.tc) + 1) ELSE c.tc END), ''),
                 'Sem tema') AS tema_label
      ) p
      CROSS JOIN LATERAL (
        -- chaves de agrupamento: insensíveis a caixa e a espaços
        SELECT lower(regexp_replace(btrim(p.esp_label), '\s+', ' ', 'g')) AS esp_key,
               lower(regexp_replace(btrim(p.tema_label), '\s+', ' ', 'g')) AS tema_key,
               lower(regexp_replace(btrim(coalesce(nullif(c.tc, ''), 'Sem tema')), '\s+', ' ', 'g')) AS full_key
      ) k
    ),
    -- um rótulo de exibição por chave: a grafia mais frequente; empate -> menor (min) em ordem alfabética
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

-- 7. Grants (iguais aos anteriores; mentor_questao segue o mesmo padrão).
revoke all on function public.mentor_detalhamento(uuid[]) from public;
revoke execute on function public.mentor_detalhamento(uuid[]) from anon;
grant execute on function public.mentor_detalhamento(uuid[]) to authenticated;
revoke all on function public.mentor_questao(uuid, uuid[]) from public;
revoke execute on function public.mentor_questao(uuid, uuid[]) from anon;
grant execute on function public.mentor_questao(uuid, uuid[]) to authenticated;
revoke all on function public.mentor_aluno_notas(text) from public;
revoke execute on function public.mentor_aluno_notas(text) from anon;
grant execute on function public.mentor_aluno_notas(text) to authenticated;
