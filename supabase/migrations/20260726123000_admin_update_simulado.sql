-- Fase 0b · Task 10 (escopo extra, decidido pelo Felipe em 28/07) —
-- alarga a escrita de `simulados_admin` para UM só caminho, auditado.
--
-- Substitui `admin_set_simulado_agenda`, que cobria apenas 4 das 9 colunas que
-- o SimuladoConfigDialog escreve e não aceitava `status` — a assinatura dela
-- tornava a migração dos call sites impossível sem perda de dado.
--
-- Duas funções, responsabilidades disjuntas nos CALL SITES mas não nas colunas:
--   * admin_update_simulado   — o save do dialog de edição (9 colunas) + a
--                               derivação de data_agendada_original, porque
--                               `data_liberacao` (que o dialog escreve) entra
--                               no cálculo da "data efetiva" do §6.4.
--   * admin_encerrar_simulado — o "encerrar" do ProvasTab, que escreve só status.
--
-- VALIDAÇÕES DELIBERADAMENTE AUSENTES, e o motivo — conferido contra as 44
-- linhas de produção antes de escrever:
--   * NÃO exige data_encerramento >= data_liberacao: 2 linhas já violam isso
--     hoje. Validar tornaria essas 2 provas impossíveis de editar.
--   * NÃO exige data_liberacao para modalidade 'online': 25 das 44 linhas têm
--     data_liberacao nula.
--   Ambas estavam na admin_set_simulado_agenda e são exatamente o motivo pelo
--   qual migrar os call sites para ela quebraria a edição.
--
-- `status` continua sendo DERIVADO NO CLIENT (`calcularStatusSalvar`) e chega
-- como parâmetro. Decisão consciente: essa função carrega os achados de
-- auditoria P1 (nunca reabrir prova encerrada manualmente) e P2 (não reescrever
-- data_liberacao quando o admin não mexeu no agendamento), ambos sem cobertura
-- até os testes de caracterização deste commit. Reimplementá-los em PL/pgSQL
-- agora seria risco sem necessidade. Mover `status` para o banco é task própria.

CREATE OR REPLACE FUNCTION public.admin_update_simulado(
  p_simulado_id uuid,
  p_nome text,
  p_descricao text,
  p_data_liberacao timestamptz,
  p_data_encerramento timestamptz,
  p_duracao_minutos int,
  p_status text,
  p_ies_ids uuid[],
  p_liberacao_desempenho text,
  p_data_liberacao_desempenho timestamptz,
  -- Bloco de agenda (§6.4). Só é aplicado quando p_atualizar_agenda = true.
  -- O dialog de edição NÃO conhece modalidade/data_realizacao (não estão no
  -- tipo `Simulado` nem no form), então ele chama com false e os valores atuais
  -- do banco são PRESERVADOS. Sem esse flag, todo save do dialog zeraria as
  -- duas colunas — era a falha central da RPC anterior.
  p_atualizar_agenda boolean DEFAULT false,
  p_modalidade text DEFAULT NULL,
  p_data_realizacao timestamptz DEFAULT NULL,
  p_definitiva boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_antes record;
  v_depois record;
  v_nome text := btrim(COALESCE(p_nome, ''));
  v_modalidade text;
  v_data_realizacao timestamptz;
  v_data_efetiva timestamptz;
  v_original timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  SELECT id, nome, descricao, data_liberacao, data_encerramento, duracao_minutos,
         status, ies_ids, liberacao_desempenho, data_liberacao_desempenho,
         modalidade, data_realizacao, data_agendada_original
    INTO v_antes
  FROM public.simulados_admin
  WHERE id = p_simulado_id;

  IF v_antes.id IS NULL THEN
    RAISE EXCEPTION 'simulado % não encontrado', p_simulado_id;
  END IF;

  IF length(v_nome) = 0 THEN
    RAISE EXCEPTION 'nome é obrigatório';
  END IF;
  IF p_duracao_minutos IS NULL OR p_duracao_minutos <= 0 THEN
    RAISE EXCEPTION 'duracao_minutos deve ser maior que zero';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('aguardando', 'ativo', 'encerrado') THEN
    RAISE EXCEPTION 'status inválido: % (esperado aguardando, ativo ou encerrado)', p_status;
  END IF;
  IF p_liberacao_desempenho IS NULL
     OR p_liberacao_desempenho NOT IN ('imediato', 'agendado', 'ao_encerrar') THEN
    RAISE EXCEPTION 'liberacao_desempenho inválido: %', p_liberacao_desempenho;
  END IF;
  IF p_ies_ids IS NULL OR COALESCE(array_length(p_ies_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'ies_ids não pode ser vazio';
  END IF;

  -- Preserva a agenda quando o chamador não está mexendo nela.
  IF p_atualizar_agenda THEN
    v_modalidade      := NULLIF(btrim(COALESCE(p_modalidade, '')), '');
    v_data_realizacao := p_data_realizacao;

    IF v_modalidade IS NOT NULL AND v_modalidade NOT IN ('online', 'presencial') THEN
      RAISE EXCEPTION 'modalidade inválida: % (esperado online ou presencial)', v_modalidade;
    END IF;
    IF v_modalidade = 'presencial' AND v_data_realizacao IS NULL THEN
      RAISE EXCEPTION 'simulado presencial exige data_realizacao';
    END IF;
  ELSE
    v_modalidade      := v_antes.modalidade;
    v_data_realizacao := v_antes.data_realizacao;
  END IF;

  -- "Data do simulado" no cronograma (§6.4) = realização (presencial) ou
  -- liberação (online). Muda quando o dialog edita data_liberacao, e é por isso
  -- que a derivação tem de rodar aqui e não só num setter de agenda.
  v_data_efetiva := COALESCE(v_data_realizacao, p_data_liberacao);

  IF v_data_efetiva IS NULL THEN
    -- Sem data nenhuma o slot é "previsto"/"A definir" — zera a original para
    -- não deixar resíduo que faria o cronograma dizer "Reagendado".
    v_original := NULL;
  ELSIF v_antes.data_agendada_original IS NULL THEN
    v_original := v_data_efetiva;                    -- 1º agendamento
  ELSIF p_definitiva THEN
    v_original := v_data_efetiva;                    -- nova data definitiva → a tag some
  ELSE
    v_original := v_antes.data_agendada_original;    -- remarcação → "Reagendado"
  END IF;

  UPDATE public.simulados_admin
     SET nome                      = v_nome,
         descricao                 = p_descricao,
         data_liberacao            = p_data_liberacao,
         data_encerramento         = p_data_encerramento,
         duracao_minutos           = p_duracao_minutos,
         status                    = p_status,
         ies_ids                   = p_ies_ids,
         liberacao_desempenho      = p_liberacao_desempenho,
         data_liberacao_desempenho = p_data_liberacao_desempenho,
         modalidade                = v_modalidade,
         data_realizacao           = v_data_realizacao,
         data_agendada_original    = v_original,
         updated_at                = now()
   WHERE id = p_simulado_id
  RETURNING id, nome, descricao, data_liberacao, data_encerramento, duracao_minutos,
            status, ies_ids, liberacao_desempenho, data_liberacao_desempenho,
            modalidade, data_realizacao, data_agendada_original
    INTO v_depois;

  INSERT INTO public.admin_audit_log(admin_id, action, metadata)
  VALUES (
    auth.uid(),
    'editar_simulado',
    jsonb_build_object(
      'simulado_id', p_simulado_id,
      'nome', v_depois.nome,
      'atualizou_agenda', p_atualizar_agenda,
      'definitiva', p_definitiva,
      'antes', jsonb_build_object(
        'nome', v_antes.nome,
        'descricao', v_antes.descricao,
        'data_liberacao', v_antes.data_liberacao,
        'data_encerramento', v_antes.data_encerramento,
        'duracao_minutos', v_antes.duracao_minutos,
        'status', v_antes.status,
        'ies_ids', to_jsonb(v_antes.ies_ids),
        'liberacao_desempenho', v_antes.liberacao_desempenho,
        'data_liberacao_desempenho', v_antes.data_liberacao_desempenho,
        'modalidade', v_antes.modalidade,
        'data_realizacao', v_antes.data_realizacao,
        'data_agendada_original', v_antes.data_agendada_original
      ),
      'depois', jsonb_build_object(
        'nome', v_depois.nome,
        'descricao', v_depois.descricao,
        'data_liberacao', v_depois.data_liberacao,
        'data_encerramento', v_depois.data_encerramento,
        'duracao_minutos', v_depois.duracao_minutos,
        'status', v_depois.status,
        'ies_ids', to_jsonb(v_depois.ies_ids),
        'liberacao_desempenho', v_depois.liberacao_desempenho,
        'data_liberacao_desempenho', v_depois.data_liberacao_desempenho,
        'modalidade', v_depois.modalidade,
        'data_realizacao', v_depois.data_realizacao,
        'data_agendada_original', v_depois.data_agendada_original
      ),
      'reagendado', v_depois.data_agendada_original IS NOT NULL
                    AND v_data_efetiva IS NOT NULL
                    AND v_depois.data_agendada_original <> v_data_efetiva
    )
  );

  RETURN jsonb_build_object(
    'simulado_id', v_depois.id,
    'nome', v_depois.nome,
    'status', v_depois.status,
    'modalidade', v_depois.modalidade,
    'data_realizacao', v_depois.data_realizacao,
    'data_liberacao', v_depois.data_liberacao,
    'data_encerramento', v_depois.data_encerramento,
    'data_agendada_original', v_depois.data_agendada_original,
    'reagendado', v_depois.data_agendada_original IS NOT NULL
                  AND v_data_efetiva IS NOT NULL
                  AND v_depois.data_agendada_original <> v_data_efetiva
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_simulado(uuid,text,text,timestamptz,timestamptz,int,text,uuid[],text,timestamptz,boolean,text,timestamptz,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_simulado(uuid,text,text,timestamptz,timestamptz,int,text,uuid[],text,timestamptz,boolean,text,timestamptz,boolean) TO authenticated, service_role;

-- admin_encerrar_simulado — o "encerrar" do ProvasTab (escreve SÓ status).
-- Não pertencia a admin_set_simulado_agenda: aquela RPC não aceitava status, e
-- roteá-lo por ela deixaria a prova 'ativo' no banco e zeraria modalidade + as
-- 3 datas. Idempotente de propósito — encerrar duas vezes não é erro.
CREATE OR REPLACE FUNCTION public.admin_encerrar_simulado(
  p_simulado_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_antes record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  SELECT id, nome, status INTO v_antes
  FROM public.simulados_admin WHERE id = p_simulado_id;

  IF v_antes.id IS NULL THEN
    RAISE EXCEPTION 'simulado % não encontrado', p_simulado_id;
  END IF;

  UPDATE public.simulados_admin
     SET status = 'encerrado', updated_at = now()
   WHERE id = p_simulado_id;

  INSERT INTO public.admin_audit_log(admin_id, action, metadata)
  VALUES (
    auth.uid(),
    'encerrar_simulado',
    jsonb_build_object(
      'simulado_id', p_simulado_id,
      'nome', v_antes.nome,
      'status_antes', v_antes.status,
      'status_depois', 'encerrado'
    )
  );

  RETURN jsonb_build_object(
    'simulado_id', p_simulado_id,
    'nome', v_antes.nome,
    'status_antes', v_antes.status,
    'status', 'encerrado'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_encerrar_simulado(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_encerrar_simulado(uuid) TO authenticated, service_role;

-- A admin_set_simulado_agenda fica órfã: a admin_update_simulado cobre tudo que
-- ela fazia, mais as 5 colunas que faltavam. Deixá-la viva recriaria os dois
-- caminhos de escrita que motivaram esta mudança. Zero chamadores (nunca houve
-- tela nem wrapper importado por componente). DROP aprovado pelo Nader.
DROP FUNCTION IF EXISTS public.admin_set_simulado_agenda(uuid,text,timestamptz,timestamptz,timestamptz,boolean);
