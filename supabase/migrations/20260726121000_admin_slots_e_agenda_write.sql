-- Fase 0b · Task 10 — sync dos slots do contrato + agenda do simulado (spec §6.2/§6.3/§6.4).

-- Índice único que torna o sync por (contrato_id, ordem) idempotente.
-- ADIÇÃO ao modelo do spec §6.2, que não define unicidade nessa tabela.
-- NOTA: já criado na Fase 0a (20260726105000_ies_contrato_simulados.sql:45); mantido
-- aqui por auto-suficiência da migration — o IF NOT EXISTS faz dele um no-op.
CREATE UNIQUE INDEX IF NOT EXISTS ies_simulado_previsto_contrato_ordem_uidx
  ON public.ies_simulado_previsto (contrato_id, ordem);

-- 1) admin_set_ies_simulados_previstos — sincroniza a lista COMPLETA de slots
--    do contrato: cria o que falta, atualiza o que mudou, remove o que saiu.
CREATE OR REPLACE FUNCTION public.admin_set_ies_simulados_previstos(
  p_contrato_id uuid,
  p_slots jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_contrato record;
  v_qtd int;
  v_ordens int[];
  v_simulado_invalido uuid;
  v_criados int := 0;
  v_atualizados int := 0;
  v_removidos int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  IF p_slots IS NULL OR jsonb_typeof(p_slots) <> 'array' THEN
    RAISE EXCEPTION 'p_slots deve ser um array jsonb';
  END IF;

  SELECT id, ies_id, nome_contrato, simulados_contratados
    INTO v_contrato
  FROM public.ies_contrato_simulados
  WHERE id = p_contrato_id;

  IF v_contrato.id IS NULL THEN
    RAISE EXCEPTION 'contrato % não encontrado', p_contrato_id;
  END IF;

  v_qtd := jsonb_array_length(p_slots);

  -- Regra do spec §6.2: o contrato declara QUANTOS simulados a IES tem direito.
  -- Mais slots que isso quebraria o KPI "3 de 7".
  IF v_qtd > v_contrato.simulados_contratados THEN
    RAISE EXCEPTION
      '% slot(s) excedem os % simulado(s) contratado(s)',
      v_qtd, v_contrato.simulados_contratados;
  END IF;

  -- Normaliza o payload uma única vez.
  --
  -- Tabela DECLARADA + TRUNCATE, em vez de `CREATE TEMP TABLE ... AS`: se esta
  -- função for chamada duas vezes na MESMA transação, o `CREATE ... AS` morreria
  -- com 'relation "_slots_in" already exists'. Cada RPC do Supabase é a sua
  -- própria transação, então no uso normal não acontecia — mas a função fica
  -- reentrante de graça, e a verificação de idempotência do plano (mesma chamada
  -- duas vezes) deixa de depender de como o cliente agrupa as transações.
  --
  -- As referências são qualificadas com `pg_temp.` de propósito: o
  -- `search_path = public, pg_temp` desta função busca `public` PRIMEIRO, então
  -- sem a qualificação uma futura tabela `public._slots_in` sombrearia a
  -- temporária e a função passaria a ler dado de outra pessoa.
  CREATE TEMP TABLE IF NOT EXISTS _slots_in (
    ordem         int,
    nome_previsto text,
    simulado_id   uuid
  ) ON COMMIT DROP;
  TRUNCATE pg_temp._slots_in;

  INSERT INTO pg_temp._slots_in (ordem, nome_previsto, simulado_id)
  SELECT (s->>'ordem')::int,
         NULLIF(btrim(COALESCE(s->>'nome_previsto', '')), ''),
         NULLIF(s->>'simulado_id', '')::uuid
  FROM jsonb_array_elements(COALESCE(p_slots, '[]'::jsonb)) s;

  IF EXISTS (SELECT 1 FROM pg_temp._slots_in WHERE ordem IS NULL OR ordem < 1) THEN
    RAISE EXCEPTION 'cada slot precisa de "ordem" inteira maior ou igual a 1';
  END IF;

  SELECT array_agg(ordem ORDER BY ordem) INTO v_ordens FROM pg_temp._slots_in;
  IF (SELECT count(DISTINCT ordem) FROM pg_temp._slots_in) <> v_qtd THEN
    RAISE EXCEPTION '"ordem" duplicada em p_slots: %', v_ordens;
  END IF;

  -- Um slot só pode apontar para simulado que existe E pertence à IES do contrato.
  SELECT si.simulado_id INTO v_simulado_invalido
  FROM pg_temp._slots_in si
  WHERE si.simulado_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.simulados_admin sa
      WHERE sa.id = si.simulado_id
        AND v_contrato.ies_id = ANY(sa.ies_ids)
    )
  LIMIT 1;

  IF v_simulado_invalido IS NOT NULL THEN
    RAISE EXCEPTION
      'simulado % não existe ou não está liberado para a IES % do contrato',
      v_simulado_invalido, v_contrato.ies_id;
  END IF;

  IF (SELECT count(DISTINCT simulado_id) FROM pg_temp._slots_in WHERE simulado_id IS NOT NULL)
     <> (SELECT count(simulado_id) FROM pg_temp._slots_in) THEN
    RAISE EXCEPTION 'o mesmo simulado foi vinculado a mais de um slot do contrato';
  END IF;

  -- Remove os slots que saíram do payload.
  WITH del AS (
    DELETE FROM public.ies_simulado_previsto p
    WHERE p.contrato_id = p_contrato_id
      AND NOT EXISTS (SELECT 1 FROM pg_temp._slots_in si WHERE si.ordem = p.ordem)
    RETURNING 1
  )
  SELECT count(*) INTO v_removidos FROM del;

  -- Cria/atualiza pela chave (contrato_id, ordem).
  WITH ups AS (
    INSERT INTO public.ies_simulado_previsto (contrato_id, ies_id, ordem, nome_previsto, simulado_id)
    SELECT p_contrato_id, v_contrato.ies_id, si.ordem, si.nome_previsto, si.simulado_id
    FROM pg_temp._slots_in si
    ON CONFLICT (contrato_id, ordem) DO UPDATE
      SET nome_previsto = EXCLUDED.nome_previsto,
          simulado_id   = EXCLUDED.simulado_id
    RETURNING (xmax = 0) AS inserido
  )
  SELECT count(*) FILTER (WHERE inserido),
         count(*) FILTER (WHERE NOT inserido)
    INTO v_criados, v_atualizados
  FROM ups;

  INSERT INTO public.admin_audit_log(admin_id, action, metadata)
  VALUES (
    auth.uid(),
    'ies_simulados_previstos_set',
    jsonb_build_object(
      'contrato_id', p_contrato_id,
      'ies_id', v_contrato.ies_id,
      'nome_contrato', v_contrato.nome_contrato,
      'simulados_contratados', v_contrato.simulados_contratados,
      'slots_enviados', v_qtd,
      'criados', v_criados,
      'atualizados', v_atualizados,
      'removidos', v_removidos,
      'payload', p_slots
    )
  );

  RETURN jsonb_build_object(
    'contrato_id', p_contrato_id,
    'slots', v_qtd,
    'criados', v_criados,
    'atualizados', v_atualizados,
    'removidos', v_removidos
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_ies_simulados_previstos(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_ies_simulados_previstos(uuid,jsonb) TO authenticated, service_role;

-- 2) admin_set_simulado_agenda — modalidade + datas do simulado, com a
--    derivação de data_agendada_original do spec §6.4.
--
--    Datas por modalidade (§6.4): ONLINE tem data de início (quando aparece
--    pro aluno = data_liberacao) + encerramento; PRESENCIAL tem só a data de
--    realização (data_realizacao).
--
--    data_agendada_original guarda a 1ª data marcada, e é o que permite
--    derivar "reagendado" (§6.4: agendado = original nula ou igual à atual;
--    reagendado = original difere da atual). O spec diz que "a tag Reagendado
--    some automaticamente quando a data é alterada para uma NOVA DATA
--    DEFINITIVA — o campo data_agendada_original é atualizado junto".
--    "Definitiva" é uma decisão do operador, não algo derivável do banco:
--    por isso p_definitiva. Com p_definitiva=false, mudar a data mantém a
--    original e o cronograma mostra "Reagendado"; com true, a original é
--    sincronizada com a nova data e a tag some.
CREATE OR REPLACE FUNCTION public.admin_set_simulado_agenda(
  p_simulado_id uuid,
  p_modalidade text DEFAULT NULL,
  p_data_realizacao timestamptz DEFAULT NULL,
  p_data_liberacao timestamptz DEFAULT NULL,
  p_data_encerramento timestamptz DEFAULT NULL,
  p_definitiva boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_antes record;
  v_modalidade text := NULLIF(btrim(COALESCE(p_modalidade, '')), '');
  v_data_efetiva_antes timestamptz;
  v_data_efetiva_depois timestamptz;
  v_original timestamptz;
  v_depois record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  SELECT id, nome, modalidade, data_realizacao, data_liberacao,
         data_encerramento, data_agendada_original
    INTO v_antes
  FROM public.simulados_admin
  WHERE id = p_simulado_id;

  IF v_antes.id IS NULL THEN
    RAISE EXCEPTION 'simulado % não encontrado', p_simulado_id;
  END IF;

  IF v_modalidade IS NOT NULL AND v_modalidade NOT IN ('online', 'presencial') THEN
    RAISE EXCEPTION 'modalidade inválida: % (esperado online ou presencial)', v_modalidade;
  END IF;

  IF v_modalidade = 'presencial' AND p_data_realizacao IS NULL THEN
    RAISE EXCEPTION 'simulado presencial exige data_realizacao';
  END IF;
  IF v_modalidade = 'online' AND p_data_liberacao IS NULL THEN
    RAISE EXCEPTION 'simulado online exige data_liberacao (data de início)';
  END IF;
  IF p_data_encerramento IS NOT NULL AND p_data_liberacao IS NOT NULL
     AND p_data_encerramento < p_data_liberacao THEN
    RAISE EXCEPTION 'data_encerramento é anterior a data_liberacao';
  END IF;

  -- "Data do simulado" no cronograma = realização (presencial) ou início (online).
  v_data_efetiva_antes  := COALESCE(v_antes.data_realizacao, v_antes.data_liberacao);
  v_data_efetiva_depois := COALESCE(p_data_realizacao, p_data_liberacao);

  IF v_data_efetiva_depois IS NULL THEN
    -- Sem data nenhuma o slot é "previsto"/"A definir" (§6.4) — zera a original
    -- para não deixar resíduo que faria o cronograma dizer "reagendado".
    v_original := NULL;
  ELSIF v_antes.data_agendada_original IS NULL THEN
    v_original := v_data_efetiva_depois;                 -- 1º agendamento
  ELSIF p_definitiva THEN
    v_original := v_data_efetiva_depois;                 -- nova data definitiva → tag some
  ELSE
    v_original := v_antes.data_agendada_original;        -- remarcação → "Reagendado"
  END IF;

  UPDATE public.simulados_admin
     SET modalidade             = v_modalidade,
         data_realizacao        = p_data_realizacao,
         data_liberacao         = p_data_liberacao,
         data_encerramento      = p_data_encerramento,
         data_agendada_original = v_original,
         updated_at             = now()
   WHERE id = p_simulado_id
  RETURNING id, nome, modalidade, data_realizacao, data_liberacao,
            data_encerramento, data_agendada_original
    INTO v_depois;

  INSERT INTO public.admin_audit_log(admin_id, action, metadata)
  VALUES (
    auth.uid(),
    'simulado_agenda_set',
    jsonb_build_object(
      'simulado_id', p_simulado_id,
      'simulado_nome', v_antes.nome,
      'definitiva', p_definitiva,
      'antes', jsonb_build_object(
        'modalidade', v_antes.modalidade,
        'data_realizacao', v_antes.data_realizacao,
        'data_liberacao', v_antes.data_liberacao,
        'data_encerramento', v_antes.data_encerramento,
        'data_agendada_original', v_antes.data_agendada_original
      ),
      'depois', jsonb_build_object(
        'modalidade', v_depois.modalidade,
        'data_realizacao', v_depois.data_realizacao,
        'data_liberacao', v_depois.data_liberacao,
        'data_encerramento', v_depois.data_encerramento,
        'data_agendada_original', v_depois.data_agendada_original
      ),
      'reagendado', v_depois.data_agendada_original IS NOT NULL
                    AND v_data_efetiva_depois IS NOT NULL
                    AND v_depois.data_agendada_original <> v_data_efetiva_depois
    )
  );

  RETURN jsonb_build_object(
    'simulado_id', v_depois.id,
    'nome', v_depois.nome,
    'modalidade', v_depois.modalidade,
    'data_realizacao', v_depois.data_realizacao,
    'data_liberacao', v_depois.data_liberacao,
    'data_encerramento', v_depois.data_encerramento,
    'data_agendada_original', v_depois.data_agendada_original,
    'reagendado', v_depois.data_agendada_original IS NOT NULL
                  AND v_data_efetiva_depois IS NOT NULL
                  AND v_depois.data_agendada_original <> v_data_efetiva_depois
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_simulado_agenda(uuid,text,timestamptz,timestamptz,timestamptz,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_simulado_agenda(uuid,text,timestamptz,timestamptz,timestamptz,boolean) TO authenticated, service_role;
