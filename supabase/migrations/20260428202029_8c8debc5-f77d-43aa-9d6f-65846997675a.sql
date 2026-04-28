DO $$
DECLARE
  v_user_id uuid := 'a2b29342-5c5b-4557-a018-81ef7ffca5f0';
  v_simulado uuid;
  v_simulados uuid[] := ARRAY[
    '7abd436c-4ff3-44d1-b2ca-d4952ccd0ad7'::uuid,
    '9e0216dc-550f-490e-ab73-1b133671d1c7'::uuid
  ];
  v_duracao int;
  v_tempo_total int;
  v_finalizado timestamptz := now();
BEGIN
  FOREACH v_simulado IN ARRAY v_simulados LOOP
    -- Skip se já houver respostas para esse usuário+simulado
    IF EXISTS (
      SELECT 1 FROM public.answer_progress
      WHERE user_id = v_user_id AND simulado = v_simulado
    ) THEN
      RAISE NOTICE 'Simulado % já possui respostas para o usuário, pulando', v_simulado;
      CONTINUE;
    END IF;

    SELECT duracao_minutos INTO v_duracao FROM public.simulados_admin WHERE id = v_simulado;
    v_tempo_total := COALESCE(v_duracao, 240) * 60 * 70 / 100; -- ~70% da duração

    -- 1) Registro de início (retroativo)
    INSERT INTO public.simulados_iniciados (user_id, simulado_id, started_at)
    SELECT v_user_id, v_simulado, v_finalizado - make_interval(secs => v_tempo_total)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.simulados_iniciados
      WHERE user_id = v_user_id AND simulado_id = v_simulado
    );

    -- 2) Respostas (100 questões)
    WITH base AS (
      SELECT
        q.id AS question_id,
        q.simulado_id,
        upper(q.correta) AS correta,
        q.anulada,
        (('x' || substr(md5(q.id::text || q.simulado_id::text), 1, 8))::bit(32)::bigint % 100 + 100) % 100 AS bucket
      FROM public.questoes_simulado q
      WHERE q.simulado_id = v_simulado
    ),
    decided AS (
      SELECT
        question_id,
        simulado_id,
        correta,
        anulada,
        bucket,
        CASE
          WHEN bucket < 5 THEN NULL                 -- 5% em branco
          WHEN bucket < 75 THEN correta             -- 70% certas
          ELSE                                      -- 25% erradas: alternativa diferente da correta
            (ARRAY(
              SELECT x FROM unnest(ARRAY['A','B','C','D']) AS x
              WHERE x <> correta
            ))[1 + (bucket % 3)]
        END AS resposta
      FROM base
    )
    INSERT INTO public.answer_progress
      (answer_id, user_id, simulado, question_id, resposta_usuario, correct, "respondida?")
    SELECT
      gen_random_uuid(),
      v_user_id,
      simulado_id,
      question_id,
      resposta,
      CASE
        WHEN anulada THEN true
        WHEN resposta IS NULL THEN false
        ELSE resposta = correta
      END,
      resposta IS NOT NULL
    FROM decided;

    -- 3) Finalização
    INSERT INTO public.simulados_finalizados (
      user_id, simulado_id, tempo_total_segundos, saidas_de_aba, saidas_de_fullscreen,
      finalizado_em, liberado_novamente, tentativa_numero
    )
    SELECT v_user_id, v_simulado, v_tempo_total, 0, 0, v_finalizado, false, 1
    WHERE NOT EXISTS (
      SELECT 1 FROM public.simulados_finalizados
      WHERE user_id = v_user_id AND simulado_id = v_simulado
    );
  END LOOP;
END $$;