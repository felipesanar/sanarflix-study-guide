-- =========================================================================
-- 1) Tabelas de rastreabilidade (aditivas, sem tocar em nada existente)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.admin_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulado_id uuid NOT NULL,
  source_label text NOT NULL,
  conflict_mode text NOT NULL CHECK (conflict_mode IN ('skip','replace')),
  total_rows int NOT NULL DEFAULT 0,
  imported_count int NOT NULL DEFAULT 0,
  skipped_count int NOT NULL DEFAULT 0,
  replaced_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','failed')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS admin_import_batches_simulado_idx ON public.admin_import_batches(simulado_id);
CREATE INDEX IF NOT EXISTS admin_import_batches_created_by_idx ON public.admin_import_batches(created_by);

CREATE TABLE IF NOT EXISTS public.admin_import_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.admin_import_batches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  simulado_id uuid NOT NULL,
  finalizacao_id uuid,
  status text NOT NULL CHECK (status IN ('imported','skipped','replaced','failed')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, user_id, simulado_id)
);

CREATE INDEX IF NOT EXISTS admin_import_records_batch_idx ON public.admin_import_records(batch_id);
CREATE INDEX IF NOT EXISTS admin_import_records_user_sim_idx ON public.admin_import_records(user_id, simulado_id);

ALTER TABLE public.admin_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_import_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage import batches" ON public.admin_import_batches;
CREATE POLICY "Admins manage import batches"
  ON public.admin_import_batches
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage import records" ON public.admin_import_records;
CREATE POLICY "Admins manage import records"
  ON public.admin_import_records
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================================================
-- 2) Função: resolve e-mails para user_ids dentro da IES do simulado
-- =========================================================================
CREATE OR REPLACE FUNCTION public.admin_lookup_users_by_email_in_ies(
  p_ies_ids uuid[],
  p_emails text[]
)
RETURNS TABLE (email text, user_id uuid, semestre integer, in_ies boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY
  SELECT 
    lower(trim(u.email))::text AS email,
    u.id AS user_id,
    u.semestre,
    (u.id_ies = ANY(p_ies_ids)) AS in_ies
  FROM public.users u
  WHERE lower(trim(u.email)) = ANY(SELECT lower(trim(unnest(p_emails))));
END;
$$;

-- =========================================================================
-- 3) Função: mapeia numero_questao -> { id, correta, anulada } de um simulado
-- =========================================================================
CREATE OR REPLACE FUNCTION public.admin_simulado_question_map(
  p_simulado_id uuid
)
RETURNS TABLE (
  numero_questao integer,
  ordem integer,
  question_id uuid,
  correta text,
  anulada boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY
  SELECT 
    COALESCE(q.numero_questao, q.ordem) AS numero_questao,
    q.ordem,
    q.id AS question_id,
    q.correta,
    COALESCE(q.anulada, false) AS anulada
  FROM public.questoes_simulado q
  WHERE q.simulado_id = p_simulado_id
  ORDER BY q.ordem;
END;
$$;

-- =========================================================================
-- 4) Função atômica: importa as respostas de UM aluno
--    (initia + responde + finaliza, com tratamento de conflito)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.admin_import_one_response(
  p_batch_id uuid,
  p_simulado_id uuid,
  p_user_id uuid,
  p_answers jsonb,            -- [{question_id, resposta, correct}, ...]
  p_tempo_segundos integer,
  p_saidas_aba integer,
  p_finalizado_em timestamptz,
  p_conflict_mode text        -- 'skip' | 'replace'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_finalizacao record;
  v_proxima_tentativa integer := 1;
  v_status text;
  v_finalizacao_id uuid;
  v_started_at timestamptz;
  v_replaced boolean := false;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  -- Idempotência: se este aluno já foi processado neste lote, retornar
  IF EXISTS (
    SELECT 1 FROM public.admin_import_records 
    WHERE batch_id = p_batch_id AND user_id = p_user_id AND simulado_id = p_simulado_id
  ) THEN
    RETURN jsonb_build_object('status', 'already_in_batch', 'message', 'Já processado neste lote');
  END IF;

  -- Lock advisory para evitar race com finalização real do aluno
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text || ':' || p_simulado_id::text));

  -- Buscar finalização mais recente
  SELECT id, tentativa_numero, liberado_novamente
  INTO v_existing_finalizacao
  FROM public.simulados_finalizados
  WHERE user_id = p_user_id AND simulado_id = p_simulado_id
  ORDER BY tentativa_numero DESC
  LIMIT 1;

  IF FOUND THEN
    IF p_conflict_mode = 'skip' THEN
      INSERT INTO public.admin_import_records (batch_id, user_id, simulado_id, status, reason)
      VALUES (p_batch_id, p_user_id, p_simulado_id, 'skipped', 'Aluno já possui finalização e modo é "skip"');
      RETURN jsonb_build_object('status', 'skipped', 'reason', 'already_finalized');
    END IF;

    -- conflict_mode = 'replace'
    v_replaced := true;
    v_proxima_tentativa := COALESCE(v_existing_finalizacao.tentativa_numero, 1) + 1;

    -- Mover respostas atuais para histórico
    INSERT INTO public.answer_progress_historico (
      answer_id, user_id, simulado, question_id, resposta_usuario, correct,
      "respondida?", finalizacao_original_id, substituida_em
    )
    SELECT 
      ap.answer_id::text, ap.user_id, ap.simulado, ap.question_id,
      ap.resposta_usuario, ap.correct, ap."respondida?",
      v_existing_finalizacao.id, now()
    FROM public.answer_progress ap
    WHERE ap.user_id = p_user_id AND ap.simulado = p_simulado_id;

    DELETE FROM public.answer_progress
    WHERE user_id = p_user_id AND simulado = p_simulado_id;

    UPDATE public.simulados_finalizados
    SET liberado_novamente = false
    WHERE id = v_existing_finalizacao.id;
  END IF;

  -- Calcular started_at (finalizado_em - tempo gasto)
  v_started_at := COALESCE(p_finalizado_em, now()) - make_interval(secs => COALESCE(p_tempo_segundos, 0));

  -- Inserir simulados_iniciados
  INSERT INTO public.simulados_iniciados (user_id, simulado_id, started_at)
  VALUES (p_user_id, p_simulado_id, v_started_at);

  -- Inserir respostas (1 por questão)
  INSERT INTO public.answer_progress (
    answer_id, user_id, simulado, question_id, resposta_usuario, correct, "respondida?"
  )
  SELECT 
    gen_random_uuid(),
    p_user_id,
    p_simulado_id,
    (a->>'question_id')::uuid,
    NULLIF(a->>'resposta', ''),
    (a->>'correct')::boolean,
    (a->>'resposta') IS NOT NULL AND (a->>'resposta') <> ''
  FROM jsonb_array_elements(p_answers) AS a;

  -- Inserir simulados_finalizados
  INSERT INTO public.simulados_finalizados (
    user_id, simulado_id, tentativa_numero, tempo_total_segundos,
    saidas_de_aba, saidas_de_fullscreen, finalizado_em, liberado_novamente
  )
  VALUES (
    p_user_id,
    p_simulado_id,
    v_proxima_tentativa,
    COALESCE(p_tempo_segundos, 0),
    COALESCE(p_saidas_aba, 0),
    0,
    COALESCE(p_finalizado_em, now()),
    false
  )
  RETURNING id INTO v_finalizacao_id;

  v_status := CASE WHEN v_replaced THEN 'replaced' ELSE 'imported' END;

  INSERT INTO public.admin_import_records (
    batch_id, user_id, simulado_id, finalizacao_id, status, reason
  )
  VALUES (p_batch_id, p_user_id, p_simulado_id, v_finalizacao_id, v_status, NULL);

  RETURN jsonb_build_object(
    'status', v_status,
    'finalizacao_id', v_finalizacao_id,
    'tentativa', v_proxima_tentativa
  );
EXCEPTION WHEN OTHERS THEN
  -- Em caso de erro, registrar como falha (em transação separada via savepoint não é trivial,
  -- mas o INSERT abaixo só roda se a exceção for capturada antes do rollback automático;
  -- como estamos dentro da função, o RAISE re-lança e o caller registra o failure)
  RAISE;
END;
$$;