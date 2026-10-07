-- Task 1b: student-visibility column + two new student RPCs for ENAMED prova oficial

ALTER TABLE public.simulados_admin
  ADD COLUMN IF NOT EXISTS prova_oficial_liberada_aluno boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.simulados_admin.prova_oficial_liberada_aluno IS
  'Prova oficial: resultado visível ao aluno. Liberação separada do gestor; só vale com prova_oficial = true.';

CREATE OR REPLACE FUNCTION public.get_aluno_provas_oficiais()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'simuladoId', x.id, 'nome', x.nome, 'dataRealizacao', x.data_realizacao,
    'caderno', x.caderno, 'acertos', x.acertos, 'totalValidas', x.total
  ) ORDER BY x.data_realizacao DESC NULLS LAST), '[]'::jsonb)
  FROM (
    SELECT s.id, s.nome, s.data_realizacao, sac.caderno,
           count(*) FILTER (WHERE a.correct AND NOT coalesce(q.anulada,false)) AS acertos,
           count(*) FILTER (WHERE NOT coalesce(q.anulada,false))                AS total
    FROM public.simulados_admin s
    JOIN public.answer_progress a ON a.simulado = s.id AND a.user_id = auth.uid()
    JOIN public.questoes_simulado q ON q.id = a.question_id
    LEFT JOIN public.simulado_aluno_caderno sac ON sac.simulado_id = s.id AND sac.user_id = auth.uid()
    WHERE s.prova_oficial AND s.prova_oficial_liberada_aluno AND (
      s.liberacao_desempenho = 'imediato'
      OR (s.liberacao_desempenho = 'agendado' AND s.data_liberacao_desempenho IS NOT NULL AND s.data_liberacao_desempenho <= NOW())
      OR (s.liberacao_desempenho = 'ao_encerrar' AND (s.status = 'encerrado' OR (s.data_encerramento IS NOT NULL AND s.data_encerramento <= NOW())))
    )
    GROUP BY s.id, s.nome, s.data_realizacao, sac.caderno
  ) x;
$$;

REVOKE ALL ON FUNCTION public.get_aluno_provas_oficiais() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_aluno_provas_oficiais() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_aluno_prova_oficial(p_simulado_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_simulado record;
  v_eff_caderno int;
  v_questoes jsonb;
  v_areas jsonb;
  v_trajetoria jsonb;
  v_acertos int;
  v_total int;
  v_em_branco int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT s.* INTO v_simulado
  FROM public.simulados_admin s
  WHERE s.id = p_simulado_id
    AND s.prova_oficial
    AND s.prova_oficial_liberada_aluno
    AND (
      s.liberacao_desempenho = 'imediato'
      OR (s.liberacao_desempenho = 'agendado' AND s.data_liberacao_desempenho IS NOT NULL AND s.data_liberacao_desempenho <= NOW())
      OR (s.liberacao_desempenho = 'ao_encerrar' AND (s.status = 'encerrado' OR (s.data_encerramento IS NOT NULL AND s.data_encerramento <= NOW())))
    );

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.answer_progress a
    WHERE a.simulado = p_simulado_id AND a.user_id = v_uid
  ) THEN
    RETURN NULL;
  END IF;

  v_eff_caderno := coalesce(
    (SELECT sac.caderno FROM public.simulado_aluno_caderno sac
     WHERE sac.simulado_id = p_simulado_id AND sac.user_id = v_uid),
    1
  );

  SELECT jsonb_agg(jsonb_build_object(
      'questionId', y.question_id,
      'posicao', y.posicao,
      'numeroCaderno1', y.numero_questao,
      'grandeArea', y.grande_area,
      'especialidade', y.especialidade,
      'enunciado', y.enunciado,
      'alternativas', jsonb_build_object('A', y.alternativa_a, 'B', y.alternativa_b, 'C', y.alternativa_c, 'D', y.alternativa_d),
      'imagem', y.imagem,
      'imagem2', y.imagem_2,
      'imagemComentario', y.imagem_comentario,
      'correta', y.correta,
      'resposta', y.resposta,
      'acertou', y.acertou,
      'anulada', y.anulada,
      'comentario', y.comentario
    ) ORDER BY y.posicao),
    count(*) FILTER (WHERE NOT y.anulada),
    count(*) FILTER (WHERE y.acertou),
    count(*) FILTER (WHERE NOT y.anulada AND y.resposta IS NULL)
  INTO v_questoes, v_total, v_acertos, v_em_branco
  FROM (
    SELECT
      q.id AS question_id,
      coalesce(c.posicao, q.numero_questao) AS posicao,
      q.numero_questao,
      q.grande_area,
      q.especialidade,
      q.enunciado,
      q.alternativa_a, q.alternativa_b, q.alternativa_c, q.alternativa_d,
      q.imagem, q.imagem_2, q.imagem_comentario,
      q.correta,
      a.resposta_usuario AS resposta,
      (coalesce(a.correct,false) AND NOT q.anulada) AS acertou,
      q.anulada,
      q.comentario
    FROM public.questoes_simulado q
    LEFT JOIN public.simulado_cadernos c
      ON c.simulado_id = q.simulado_id AND c.question_id = q.id AND c.caderno = v_eff_caderno
    LEFT JOIN public.answer_progress a
      ON a.simulado = q.simulado_id AND a.question_id = q.id AND a.user_id = v_uid
    WHERE q.simulado_id = p_simulado_id
  ) y;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'area', z.area, 'acertos', z.acertos, 'total', z.total
    ) ORDER BY z.total DESC, z.area ASC), '[]'::jsonb)
  INTO v_areas
  FROM (
    SELECT coalesce(q.grande_area,'Sem área') AS area,
           count(*) FILTER (WHERE coalesce(a.correct,false) AND NOT q.anulada) AS acertos,
           count(*) AS total
    FROM public.questoes_simulado q
    LEFT JOIN public.answer_progress a
      ON a.simulado = q.simulado_id AND a.question_id = q.id AND a.user_id = v_uid
    WHERE q.simulado_id = p_simulado_id AND NOT q.anulada
    GROUP BY coalesce(q.grande_area,'Sem área')
  ) z;

  SELECT jsonb_agg(t.item ORDER BY t.data ASC)
  INTO v_trajetoria
  FROM (
    SELECT jsonb_build_object(
      'simuladoId', w.id, 'nome', w.nome, 'data', w.data,
      'acertoPct', w.acerto_pct, 'provaOficial', false
    ) AS item, w.data
    FROM (
      SELECT s2.id, s2.nome,
             coalesce(s2.data_realizacao, s2.data_liberacao, s2.created_at) AS data,
             round(100.0 * count(*) FILTER (WHERE a2.correct AND NOT q2.anulada) / nullif(count(*) FILTER (WHERE NOT q2.anulada),0)) AS acerto_pct
      FROM public.simulados_admin s2
      JOIN public.answer_progress a2 ON a2.simulado = s2.id AND a2.user_id = v_uid
      JOIN public.questoes_simulado q2 ON q2.id = a2.question_id
      WHERE s2.type = 'simulado_enamed' AND NOT s2.prova_oficial
        AND (
          s2.liberacao_desempenho = 'imediato'
          OR (s2.liberacao_desempenho = 'agendado' AND s2.data_liberacao_desempenho IS NOT NULL AND s2.data_liberacao_desempenho <= NOW())
          OR (s2.liberacao_desempenho = 'ao_encerrar' AND (s2.status = 'encerrado' OR (s2.data_encerramento IS NOT NULL AND s2.data_encerramento <= NOW())))
        )
      GROUP BY s2.id, s2.nome, coalesce(s2.data_realizacao, s2.data_liberacao, s2.created_at)
      HAVING coalesce(s2.data_realizacao, s2.data_liberacao, s2.created_at) <= coalesce(v_simulado.data_realizacao, now())
      ORDER BY coalesce(s2.data_realizacao, s2.data_liberacao, s2.created_at) DESC
      LIMIT 6
    ) w
  ) t;

  v_trajetoria := coalesce(v_trajetoria, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
    'simuladoId', v_simulado.id, 'nome', v_simulado.nome, 'data', v_simulado.data_realizacao,
    'acertoPct', CASE WHEN v_total > 0 THEN round(100.0 * v_acertos / v_total) ELSE NULL END,
    'provaOficial', true
  ));

  RETURN jsonb_build_object(
    'simuladoId', v_simulado.id,
    'nome', v_simulado.nome,
    'dataRealizacao', v_simulado.data_realizacao,
    'caderno', v_eff_caderno,
    'acertos', v_acertos,
    'totalValidas', v_total,
    'emBranco', v_em_branco,
    'areas', v_areas,
    'trajetoria', v_trajetoria,
    'questoes', coalesce(v_questoes, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_aluno_prova_oficial(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_aluno_prova_oficial(uuid) TO authenticated;
