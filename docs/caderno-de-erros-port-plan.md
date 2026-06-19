# Caderno de Erros — Plano de Port para o SanarFlix Academy

> **Origem:** port adaptado do "Caderno de Erros V2" do projeto `enamed-arena` (SanarFlix PRO Simulados).
> **Decisões de escopo (2026-06-18):** (1) **MVP do coração primeiro**; (2) **estender `error_notebook_entries` in-place** (sem tabela paralela/cutover por flag); (3) **SRS via RPC `_guarded` SECURITY DEFINER**.
> **Realidade do academy:** sem tier PRO (gating por `ies_features.errorNotebook`), backend Supabase com mesma stack (Vite+React+shadcn+RLS), IA via Lovable AI gateway, fonte de erros = `simulados_*` + `answer_progress` + `questoes_simulado`. Bun, Inter, primary `hsl(0 65% 35%)`.

---

## 0. Princípios de adaptação

| Tema | enamed-arena | Decisão para o academy |
|---|---|---|
| Gating | segmentos free/standard/**pro** + `<ProGate>` | manter gate atual `ies_features.errorNotebook` (rota já condicional em `DynamicRoutes.tsx`). **Não** introduzir tier PRO. |
| Tabela | `error_notebook` + cutover por flag | **estender `error_notebook_entries` in-place**; sem flag de cutover; feature já está atrás do flag de IES. |
| Taxonomia | 5+ causas | **manter as 4 causas atuais** do academy; mapear cada uma para uma *ease* inicial (§2.2). |
| Backend | RPCs `_guarded` | **SRS e log de revisão em RPCs SECURITY DEFINER**; manter CRUD direto para notas/favoritos. |
| IA | Gemini direto (Prof. Sanor) | reusar `analyze-error-patterns` (Lovable gateway); triagem MVP é **heurística** (sem IA). IA acionável fica para fase posterior. |
| Confiança | capturada na prova (`answers.confidence`) | **capturar na triagem pós-prova** (não tocar o motor de prova no MVP). |

---

## STATUS DE IMPLEMENTAÇÃO (2026-06-18, branch `feat/caderno-srs`)

**Fase 1 (MVP do coração) — IMPLEMENTADA.** Verificação: `tsc` exit 0, 20 testes unitários verdes (srs + triagem), `vite build` OK. Browser pendente das migrações.

Entregue:
- Motor SRS (`src/lib/srs.ts` + testes) e heurística de triagem (`src/lib/triageHeuristic.ts` + testes).
- Migrações (NÃO aplicadas): `supabase/migrations/20260618120000_caderno_srs_schema.sql`, `..120100_caderno_srs_rpcs.sql`, `..120200_caderno_bulk_add.sql`.
- Recall ativo persistido: `useActiveRecallSession` + `/caderno-de-erros/revisao` (substitui o `FlashcardMode` descartável).
- Triagem pós-prova: `useTriageCandidates` + `/caderno-de-erros/triagem` + entrada na barra de `SimuladoCorrecao`.
- Surfacing de devidas: `useNotebookDueCount` + CTA no header do Caderno.
- Costura de RPCs em `src/lib/cadernoSrsApi.ts` (cast único até regenerar tipos).

### Runbook — aplicar as migrações (destrava verificação em browser + Fases 2+)
1. Aplicar, em ordem, no Supabase do academy (via CLI `supabase db push` ou branch do Supabase): `20260618120000` → `..120100` → `..120200`.
2. Antes da FK opcional, rodar a checagem de órfãos (comentada na migração de schema).
3. Regenerar tipos: `supabase gen types typescript ...` → `src/integrations/supabase/types.ts`.
4. Remover os casts `as any` em `src/lib/cadernoSrsApi.ts`, `useActiveRecallSession.ts`, `useTriageCandidates.ts`, `useNotebookDueCount.ts` (procurar `// ... fora dos tipos gerados`).
5. Smoke test: revisar um item (record→schedule grava em `review_attempts`), triar um simulado, conferir o badge de devidas.

**Fase 2 (diagnóstico + casca-hub) — PARCIALMENTE IMPLEMENTADA.** Verificação: `tsc` 0, 24 testes unitários verdes, `vite build` OK. Browser pendente das migrações.

Entregue:
- **Calibração de confiança:** `src/lib/confidenceCalibration.ts` (+ testes) + `useConfidenceCalibration` + `CalibrationPanel` na aba Evolução (compute client-side de review_attempts; sem RPC nova).
- **Favoritos:** migração `20260618120300_caderno_favorites_notes.sql` (question_favorites + user_notes); `useFavorites` + `FavoriteButton` na correção + aba Favoritos (`FavoritesList`).
- **Anotações:** `useNotes` + `NotesPanel` (save-on-blur, flush em troca/unmount) + aba Anotações.
- **Busca server-side:** `useErrorNotebook` agora busca em learning_text + tema + grande_area.

**ATUALIZAÇÃO (2026-06-19): migrações da Fase 1+2 APLICADAS via Lovable** (numa transação), FK criada (0 órfãos), tipos regenerados e casts removidos. Integração reverificada local: `tsc` 0, testes verdes. Merge na `main` feito (substituiu a tela "em manutenção"). Smoke test em runtime ainda pendente (auth).

**Fase 2 — COMPLETA.** Insights estruturados entregues de forma **determinística no cliente** (sem IA / sem edge function): `src/lib/cadernoInsights.ts` (+ testes) + `useCadernoInsights` + `InsightCards` na aba Evolução (5 tipos + gate de dados + ordenação por severidade). `AIInsightsCard` (prosa) mantido como complemento.

**Fase 3 — IMPLEMENTADA.** `tsc` 0, 97 testes unitários verdes, `vite build` OK.
- **Reta Final:** `src/lib/retaFinalPlan.ts` (+ testes) + `useRetaFinalPlan` + `/caderno-de-erros/reta-final` + botão no header. Pesos de área PROVISÓRIOS (validar com Conteúdo).
- **Export PDF:** `src/utils/cadernoPdfExport.ts` (+ testes de agrupamento) + `ExportCadernoButton` (aba Meus Erros).
- **TTS:** `useTextToSpeech` (Web Speech API pt-BR) na revisão (botão "Ouvir").
- **Flashcards com SRS:** migração `20260619130000_caderno_flashcards.sql` (**NÃO aplicada** — 2º ciclo Lovable) + `flashcardsApi.ts` (casts) + `useFlashcards` + `FlashcardsPanel` (criar/listar/excluir + revisão flip com SM-2-lite) + aba Flashcards.

### Runbook — 2ª leva (Fase 3: flashcards)
1. Aplicar `supabase/migrations/20260619130000_caderno_flashcards.sql` (tabela `flashcards` + RPC `schedule_flashcard_review_guarded`).
2. Regenerar `src/integrations/supabase/types.ts`.
3. Remover os casts `as any` em `src/lib/flashcardsApi.ts` (tipar `flashcards` e a RPC).
4. Smoke test: criar flashcard → revisar (flip + nota) grava SRS e reagenda `srs_due_at`.

**Fase 4 (feeders) — IMPLEMENTADA (parcial).** `tsc` 0, 97 testes, build OK.
- Badge de devidas no nav global (`SidebarMenuItem` ganhou `badge`; `AppSidebar` injeta `useNotebookDueCount` no item Caderno).
- Surfacing na home: `CadernoHomeBanner` (auto-contido; some quando sem acesso/sem devidas) com CTA "Revisar".
- Salvar/favoritar/anotar: já cobertos na correção (Fase 1–2).

### Falta (não iniciado)
**Lembretes via Novu** (edge function + preferências + cron) — depende de config de workflow/cadência/secrets do time. Único item da Fase 4 fora de escopo do que é construível/verificável sem infra.

---

## FASE 1 — O CORAÇÃO (MVP)

Objetivo: transformar o caderno atual (captura + dashboard + flashcard descartável) em um **motor de revisão real**: SRS persistido, recall ativo com histórico, triagem pós-prova com confiança e a questão de verdade na tela.

### 1.1 Banco — estender `error_notebook_entries` (migração 1)

Adicionar colunas SRS (espelhando o enamed, defaults idênticos):

```sql
ALTER TABLE public.error_notebook_entries
  ADD COLUMN IF NOT EXISTS srs_ease         float8      NOT NULL DEFAULT 2.5,
  ADD COLUMN IF NOT EXISTS srs_interval     int4        NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS srs_reps         int4        NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS srs_lapses       int4        NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS srs_due_at       timestamptz,
  ADD COLUMN IF NOT EXISTS confidence_at_answer text CHECK (confidence_at_answer IN ('baixa','media','alta')),
  ADD COLUMN IF NOT EXISTS last_review_outcome  text CHECK (last_review_outcome IN ('errei','dificil','bom','facil','snoozed','awaiting_lesson','leech_blocked')),
  ADD COLUMN IF NOT EXISTS mastered_at      timestamptz;

-- Backfill: itens existentes ficam "devidos agora" para entrar na fila
UPDATE public.error_notebook_entries
   SET srs_due_at = COALESCE(srs_due_at, now())
 WHERE deleted_at IS NULL AND srs_due_at IS NULL;

-- Índices parciais (fila de devidas, leech, mastered)
CREATE INDEX IF NOT EXISTS idx_en_srs_due
  ON public.error_notebook_entries (user_id, srs_due_at)
  WHERE deleted_at IS NULL AND mastered_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_en_leech
  ON public.error_notebook_entries (user_id)
  WHERE srs_lapses >= 4;
```

`review_attempts` (log imutável de revisões):

```sql
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
ALTER TABLE public.review_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY ra_select_own ON public.review_attempts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY ra_no_insert  ON public.review_attempts FOR INSERT WITH CHECK (false); -- só via RPC
```

> **Bug que o enamed pegou e devemos evitar de cara:** a policy de SELECT com `deleted_at IS NULL` bloqueava o próprio UPDATE do soft-delete. Ao escrever as policies de `error_notebook_entries`, **não** colocar `deleted_at IS NULL` na policy de UPDATE.

### 1.2 Banco — RPCs `_guarded` (migração 2)

`schedule_next_review_guarded(p_entry_id uuid, p_outcome text, p_confidence text) → jsonb` — porta direta do motor SM-2-lite do enamed (`docs/specs/02` + `src/lib/srs.ts` de referência). Lógica:

- **Gating:** `RAISE EXCEPTION 'review_blocked'` se `last_review_outcome IN ('awaiting_lesson','leech_blocked')`.
- Qualidade `errei→0, dificil→2, bom→3, facil→4`. **Override:** `IF p_confidence='baixa' AND q>2 THEN q:=2`.
- **Lapse (q=0):** `reps→0`, `lapses+1`, `ease=GREATEST(1.3, ease-0.2)`, `interval=GREATEST(1, ROUND(interval*0.2))`, `mastered_at=NULL`.
- **Acerto:** `reps+1`; `delta_ease = 0.1-(4-q)*(0.08+(4-q)*0.02)`, ease clamp `[1.3,3.5]`; intervalo `reps1→1, reps2→4, else ROUND(interval*ease)`, clamp `[1,365]`; `due_at = now()+interval`.
- **Leech:** `lapses>=4 → outcome='leech_blocked'`.
- **Mastery:** acerto + não-leech + `reps>=3` + `interval>=21` + outcome∈(bom,facil) + confiança∈(media,alta) + últimas 2 confianças de `review_attempts` ∈(media,alta) → `mastered_at=COALESCE(mastered_at, now())`.
- Retorna `{srs_due_at, srs_interval, srs_reps, srs_ease, srs_lapses, mastered, is_leech}`.

`record_review_attempt_guarded(p_entry_id, p_was_correct, p_confidence, p_self_grade) → uuid` — único caminho de INSERT em `review_attempts`.

`reset_leech_guarded(p_entry_id) → void` — `interval=1, ease=1.3, reps=0, outcome=NULL, due=now()+1d`, **mantém `srs_lapses`**.

`add_to_notebook_bulk_guarded(p_entries jsonb) → jsonb {added, skipped, entry_ids[]}` — limite 100, dedup `(user_id, question_id)` (existente → ressuscita soft-delete = skipped; novo → INSERT = added), `user_id := auth.uid()`.

Todas: `SECURITY DEFINER`, `SET search_path=public`, `GRANT EXECUTE ... TO authenticated`. **Mapear a ease inicial pela causa do erro no add_to_notebook** (§2.2).

### 1.3 Frontend — motor SRS de referência + status

- `src/lib/srs.ts` — port do espelho TS do enamed (constantes + `computeNextReview`), usado em testes e preview de UI. **A RPC é a fonte da verdade; divergência = bug, corrige nos dois.**
- `src/lib/cadernoStatus.ts` — deriva status do item (prioridade `awaiting_lesson → leech_blocked → mastered → due → scheduled → active`).
- `src/lib/srs.test.ts` — reproduzir os exemplos da spec §8 (lapse, mastery, promoção). **Cobertura de teste do motor é inegociável no MVP.**

### 1.4 Frontend — recall ativo persistido (substitui o `FlashcardMode` descartável)

- Nova rota `/caderno-de-erros/revisao` (lazy, dentro do gate `errorNotebook`).
- `src/hooks/useActiveRecallSession.ts` — FSM por questão: `answering → confidence → revealed → self_grade`.
  - Fila: `mode=due|all` (URL), exclui resolvidos/deletados/`leech_blocked`/`awaiting_lesson`, ordena `srs_due_at` asc depois `srs_ease` asc.
  - **Ordem crítica (bug do enamed):** `await recordReviewAttempt(...)` **ANTES** de `scheduleNextReview(...)` — o schedule lê as 2 últimas tentativas para mastery. Envolver schedule num timeout-race de ~3s.
  - Leech → banner de intervenção + `reset_leech_guarded`.
- A tela mostra **a questão de verdade**: join `error_notebook_entries.question_id → questoes_simulado` (`enunciado`, `alternativa_a..e`, `correta`, `comentario`, `imagem`). Hoje o caderno só mostra `learning_text` — esse é o gap nº 3.
- Self-grade `facil` é rejeitado quando a resposta foi errada.

### 1.5 Frontend — triagem pós-prova com confiança

- Nova rota `/simulados/:id/triagem` (ou painel dentro de `SimuladoCorrecao.tsx`), atrás do gate `errorNotebook`.
- Lista candidatos (erros + acertos de baixa confiança). Para cada item o aluno marca confiança (`Chute / Parcial / Tenho certeza` → `baixa/media/alta`) e a causa (4 do academy).
- **Heurística MVP** (`src/lib/triageHeuristic.ts`, sem IA): R1 acerto+baixa → `answered_without_confidence`; R2 erro+alta → `did_not_understand_statement`; R3 alternativas adjacentes **pela ordem original da lista** → `did_not_understand_statement`; R4/R5 → `did_not_know`. (No enamed o R3 por ordem lexicográfica foi um bug — usar posição original.)
- "Adicionar todas" → `add_to_notebook_bulk_guarded`, gravando `confidence_at_answer`.

### 1.6 Frontend — fila de devidas na UI atual

- Aba "Meus Erros" ganha um filtro/segmento "Devidos hoje" + badge de contagem (`useNotebookDueCount`).
- Migrar o `useErrorNotebook.ts`: revisão agora passa pelas RPCs; manter CRUD direto para add manual/edição/soft-delete.

### 1.7 Checklist de bugs a prevenir desde o início (lições do enamed)

- [ ] Soft-delete: policy de UPDATE **sem** `deleted_at IS NULL`.
- [ ] Recall: `recordReviewAttempt` awaited **antes** de `scheduleNextReview`.
- [ ] Triagem R3 por **ordem original** das alternativas, não lexicográfica.
- [ ] Mobile: "Confirmar resposta" abre o passo de confiança (nunca forçar `media`).
- [ ] `now()` calculado dentro do `useMemo` dos buckets (não no topo do render).
- [ ] Undo de exclusão **cancela** o delete de fato.
- [ ] Query-key de favoritos unificada entre lista e botão da correção.
- [ ] Confiança baixa força qualidade ≤ 2 no SRS.

### 1.8 Critérios de pronto (Fase 1)
`tsc` 0, build verde, testes do `srs.ts` passando, recall persiste em `review_attempts`, fila de devidas reflete `srs_due_at`, triagem adiciona em lote, app monta sem erro de console.

---

## FASE 2 — Diagnóstico acionável + casca-hub

- **Insights de padrão acionáveis:** evoluir `analyze-error-patterns` (ou novo `get_caderno_pattern_data`) para os 5 tipos do enamed (área fraca, causa dominante, confusão recorrente, overconfidence, ROI), com cache (24h server-side, não só sessionStorage) e **gate de dados** (`<5 entradas → sem IA`). Anti-PII/anti-IDOR: auth na função, ignorar params do body.
- **Calibração de confiança:** RPC `get_confidence_calibration` + painel (over/underconfidence) usando `review_attempts.confidence` vs `was_correct`.
- **Casca-hub:** favoritos (`question_favorites`, UNIQUE `(user,question)`), anotações (`user_notes`, autosave), ações em lote com undo, busca **server-side** (hoje é client-side só em `learning_text`).
- **ROI:** desempenho antes/depois do `mastered_at` (recharts, já disponível no projeto).

---

## FASE 3 — Flashcards reais + Reta Final + export

- **Flashcards com SRS** (`decks`/`flashcards` compartilhando o motor): substitui o player efêmero; persiste estado, imagem em **bucket privado** (`createSignedUrl`, nunca `getPublicUrl` — bug crítico do enamed), geração por IA via Lovable gateway (`generate-flashcard`).
- **Reta Final / War Room:** `retaFinalPlan.ts` + blueprint de pesos por área (validar pesos com Conteúdo). Distribuição gulosa por dias.
- **Treino cronometrado** (`weakAreas.ts`, `?timed=1`).
- **Export PDF** (jspdf já está no projeto). CSV Anki: o enamed construiu e **removeu** — não portar.
- **TTS pt-BR** (Web Speech API) na revisão.

---

## FASE 4 — Feeders na plataforma + lembretes

- Salvar/favoritar/anotar a partir de `SimuladoCorrecao.tsx` e `SimuladoDesempenho.tsx` (drawer já existe, estender).
- Badge de devidas no nav; surfacing na home; resumo pós-prova.
- **Lembretes:** o academy já tem Novu (`_shared/novu.ts`) e `check-and-send-reminders` — reaproveitar para o caderno (cron diário sobre devidas, respeitando `notification_preferences`). Mais barato que no enamed (que era scaffold).

---

## Riscos / dependências externas
- **Pesos por área** (Reta Final) e **mapa tema→aula** (deep-link de lacuna) dependem de Conteúdo.
- **`questoes_simulado` ↔ `error_notebook_entries`** hoje têm FK frouxa (só UUID). Para a tela de revisão mostrar a questão, validar que `question_id` referencia `questoes_simulado.id` de forma confiável; considerar FK ou índice.
- Lovable AI gateway tem limites de rate (429/402) — tratar como o `analyze-error-patterns` já faz.

## Mapa de referência (de → para)
| enamed-arena | academy (port) |
|---|---|
| `error_notebook` | `error_notebook_entries` (estendida) |
| `src/lib/srs.ts` | `src/lib/srs.ts` (port) |
| `useActiveRecallSession.ts` | idem |
| `schedule_next_review_guarded` | idem (RPC nova) |
| `classify-exam-errors` (IA) | heurística MVP → depois `analyze-error-patterns` |
| `caderno-pattern-insights` | evolução de `analyze-error-patterns` |
| `ProGate` | `ies_features.errorNotebook` (já existe) |
| `answers.confidence` (na prova) | confiança capturada na triagem |
