# Caderno de Erros — SQL da Fase 1 (DRAFT, revisar antes de aplicar)

> Companion de [`caderno-de-erros-port-plan.md`](./caderno-de-erros-port-plan.md). Port 1:1 do motor SM-2-lite do `enamed-arena`, adaptado às 4 causas do academy.
> **NÃO aplicar sem revisão.** Migração em projeto Supabase compartilhado é difícil de reverter. Validar em branch/preview do Supabase primeiro.

## Mapeamento causa → ease inicial (adaptação academy)

| Causa (academy) | Análogo enamed | ease inicial | trilha de intervalo |
|---|---|---|---|
| `did_not_know` (Não sabia) | lacuna | 2.1 | padrão |
| `did_not_remember` (Não lembrei) | memória | 2.5 | padrão |
| `did_not_understand_statement` (Não entendi o enunciado) | reading/atenção | 2.8 | atenção (2/6) |
| `answered_without_confidence` (Acertei sem certeza) | chute | 2.1 | padrão |

---

## Migração 1 — schema (`<ts>_caderno_srs_schema.sql`)

```sql
-- 1. Colunas SRS em error_notebook_entries
ALTER TABLE public.error_notebook_entries
  ADD COLUMN IF NOT EXISTS srs_ease             float8      NOT NULL DEFAULT 2.5,
  ADD COLUMN IF NOT EXISTS srs_interval         int4        NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS srs_reps             int4        NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS srs_lapses           int4        NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS srs_due_at           timestamptz,
  ADD COLUMN IF NOT EXISTS confidence_at_answer text CHECK (confidence_at_answer IN ('baixa','media','alta')),
  ADD COLUMN IF NOT EXISTS last_review_outcome  text CHECK (last_review_outcome IN ('errei','dificil','bom','facil','snoozed','awaiting_lesson','leech_blocked')),
  ADD COLUMN IF NOT EXISTS mastered_at          timestamptz;

-- 2. Backfill: itens vivos entram na fila como "devidos agora"
UPDATE public.error_notebook_entries
   SET srs_due_at = COALESCE(srs_due_at, now())
 WHERE deleted_at IS NULL AND srs_due_at IS NULL;

-- 3. Índices parciais
CREATE INDEX IF NOT EXISTS idx_en_srs_due
  ON public.error_notebook_entries (user_id, srs_due_at)
  WHERE deleted_at IS NULL AND mastered_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_en_leech
  ON public.error_notebook_entries (user_id)
  WHERE srs_lapses >= 4;

-- 4. FK opcional para garantir integridade question_id -> questoes_simulado
--    (validar antes: pode haver question_id órfão; rodar SELECT de checagem primeiro)
-- ALTER TABLE public.error_notebook_entries
--   ADD CONSTRAINT fk_en_question FOREIGN KEY (question_id)
--   REFERENCES public.questoes_simulado(id) ON DELETE SET NULL;

-- 5. Log imutável de revisões
CREATE TABLE IF NOT EXISTS public.review_attempts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id    uuid NOT NULL REFERENCES public.error_notebook_entries(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  was_correct boolean NOT NULL,
  confidence  text NOT NULL CHECK (confidence IN ('baixa','media','alta')),
  self_grade  text NOT NULL CHECK (self_grade IN ('errei','dificil','bom','facil')),
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ra_entry ON public.review_attempts (entry_id, reviewed_at DESC);

ALTER TABLE public.review_attempts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='ra_select_own' AND tablename='review_attempts') THEN
    CREATE POLICY ra_select_own ON public.review_attempts FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='ra_no_insert' AND tablename='review_attempts') THEN
    CREATE POLICY ra_no_insert ON public.review_attempts FOR INSERT WITH CHECK (false); -- só via RPC SECURITY DEFINER
  END IF;
END $$;
```

> **Atenção (bug do enamed):** ao revisar as policies de UPDATE de `error_notebook_entries`, **não** incluir `deleted_at IS NULL` na cláusula da policy de UPDATE — isso bloqueia o próprio soft-delete. A policy atual do academy já usa `auth.uid() = user_id` (ok); só não regredir.

---

## Migração 2 — RPCs (`<ts>_caderno_srs_rpcs.sql`)

```sql
-- log de revisão (único caminho de INSERT em review_attempts)
CREATE OR REPLACE FUNCTION public.record_review_attempt_guarded(
  p_entry_id    uuid,
  p_was_correct boolean,
  p_confidence  text,
  p_self_grade  text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM error_notebook_entries
                 WHERE id = p_entry_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'entry_not_found';
  END IF;
  INSERT INTO review_attempts (entry_id, user_id, was_correct, confidence, self_grade)
  VALUES (p_entry_id, auth.uid(), p_was_correct, p_confidence, p_self_grade)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
GRANT EXECUTE ON FUNCTION public.record_review_attempt_guarded(uuid,boolean,text,text) TO authenticated;


-- motor SM-2-lite completo
CREATE OR REPLACE FUNCTION public.schedule_next_review_guarded(
  p_entry_id   uuid,
  p_outcome    text,   -- errei | dificil | bom | facil
  p_confidence text    -- baixa | media | alta
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  e            error_notebook_entries%ROWTYPE;
  q            int;
  delta        float8;
  new_ease     float8;
  new_interval int;
  new_reps     int;
  new_lapses   int;
  is_atencao   boolean;
  is_leech     boolean := false;
  did_master   boolean := false;
  conf_ok      boolean;
  last2_ok     boolean;
BEGIN
  SELECT * INTO e FROM error_notebook_entries
   WHERE id = p_entry_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'entry_not_found'; END IF;

  -- gating
  IF e.last_review_outcome IN ('awaiting_lesson','leech_blocked') THEN
    RAISE EXCEPTION 'review_blocked';
  END IF;

  -- qualidade
  q := CASE p_outcome WHEN 'errei' THEN 0 WHEN 'dificil' THEN 2
                      WHEN 'bom' THEN 3 WHEN 'facil' THEN 4 ELSE 0 END;
  -- override de confiança baixa
  IF p_confidence = 'baixa' AND q > 2 THEN q := 2; END IF;

  is_atencao := (e.reason = 'did_not_understand_statement');

  IF q = 0 THEN
    -- lapse
    new_reps     := 0;
    new_lapses   := e.srs_lapses + 1;
    new_ease     := GREATEST(1.3, e.srs_ease - 0.20);
    new_interval := GREATEST(1, ROUND(e.srs_interval * 0.20));
  ELSE
    -- acerto
    new_reps   := e.srs_reps + 1;
    new_lapses := e.srs_lapses;
    delta      := 0.1 - (4 - q) * (0.08 + (4 - q) * 0.02);
    new_ease   := LEAST(3.5, GREATEST(1.3, e.srs_ease + delta));
    IF is_atencao THEN
      new_interval := CASE new_reps WHEN 1 THEN 2 WHEN 2 THEN 6
                        ELSE ROUND(e.srs_interval * new_ease) END;
    ELSE
      new_interval := CASE new_reps WHEN 1 THEN 1 WHEN 2 THEN 4
                        ELSE ROUND(e.srs_interval * new_ease) END;
    END IF;
    new_interval := LEAST(365, GREATEST(1, new_interval));
  END IF;

  -- leech
  IF new_lapses >= 4 THEN is_leech := true; END IF;

  -- mastery: precisa das 2 últimas confianças >= media
  SELECT bool_and(confidence IN ('media','alta')) INTO last2_ok
    FROM (SELECT confidence FROM review_attempts
           WHERE entry_id = p_entry_id ORDER BY reviewed_at DESC LIMIT 2) t;
  conf_ok := (p_confidence IN ('media','alta'));

  IF q > 0 AND NOT is_leech AND new_reps >= 3 AND new_interval >= 21
     AND p_outcome IN ('bom','facil') AND conf_ok AND COALESCE(last2_ok, false) THEN
    did_master := true;
  END IF;

  UPDATE error_notebook_entries SET
    srs_ease           = new_ease,
    srs_interval       = new_interval,
    srs_reps           = new_reps,
    srs_lapses         = new_lapses,
    srs_due_at         = now() + (new_interval || ' days')::interval,
    last_review_outcome= CASE WHEN is_leech THEN 'leech_blocked' ELSE p_outcome END,
    mastered_at        = CASE WHEN q = 0 THEN NULL
                              WHEN did_master THEN COALESCE(e.mastered_at, now())
                              ELSE e.mastered_at END,
    updated_at         = now()
  WHERE id = p_entry_id;

  RETURN jsonb_build_object(
    'srs_due_at', now() + (new_interval || ' days')::interval,
    'srs_interval', new_interval, 'srs_reps', new_reps,
    'srs_ease', new_ease, 'srs_lapses', new_lapses,
    'mastered', did_master, 'is_leech', is_leech);
END $$;
GRANT EXECUTE ON FUNCTION public.schedule_next_review_guarded(uuid,text,text) TO authenticated;


-- desbloqueio de leech (mantém histórico de lapses)
CREATE OR REPLACE FUNCTION public.reset_leech_guarded(p_entry_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE error_notebook_entries
     SET srs_interval = 1, srs_ease = 1.3, srs_reps = 0,
         last_review_outcome = NULL,
         srs_due_at = now() + interval '1 day', updated_at = now()
   WHERE id = p_entry_id AND user_id = auth.uid();
END $$;
GRANT EXECUTE ON FUNCTION public.reset_leech_guarded(uuid) TO authenticated;
```

> O `add_to_notebook_bulk_guarded` (com ease inicial por causa, dedup `(user,question)` e limite 100) fica para o passo da triagem em lote — incluo junto quando formos codar a `TriagemPage`, para não criar RPC sem consumidor.

---

## Plano de validação antes de aplicar
1. Rodar em branch/preview do Supabase (não no projeto de produção).
2. Checar `question_id` órfão antes de criar a FK:
   ```sql
   SELECT count(*) FROM error_notebook_entries en
   LEFT JOIN questoes_simulado q ON q.id = en.question_id
   WHERE en.question_id IS NOT NULL AND q.id IS NULL;
   ```
3. Testar `schedule_next_review_guarded` com os exemplos da spec §8 do enamed (lapse, mastery em 3 reps, promoção), comparando com `src/lib/srs.ts`.
4. Confirmar que o gating (`review_blocked`) e o leech (`lapses>=4`) disparam.
```
