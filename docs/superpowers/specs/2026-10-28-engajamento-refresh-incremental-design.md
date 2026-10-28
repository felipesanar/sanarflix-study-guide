# Engajamento SanarFlix: refresh incremental da camada eng_* (spec)

**Data:** 2026-10-28 · **Autores:** João Vitor (produto/decisões), Claude (redação) · **Status:** aprovada para implementação faseada

**Spec mãe:** `docs/superpowers/specs/2026-10-22-engajamento-sanarflix-design.md`. Ela continua valendo para regras de cálculo (§4), modelo (§5), RPCs (§7–§8) e telas. Esta spec **substitui só a §6.5** (execução e cron) e **altera** a §6.2 e a §6.4 (pipeline), a §5.5 (log) e a §5.6 (`eng_atualizado_em`).

---

## 0. Como ler esta spec

O leitor é uma sessão de implementação **sem contexto** desta conversa.

- A implementação é **faseada** (§6). Cada fase tem um **DoD** (definition of done) com testes. **Não comece a fase N+1 antes de o DoD da fase N estar todo verde e o João dar o OK.** Registre o resultado de cada DoD no arquivo de acompanhamento (§6.0).
- Toda SQL marcada como **"referência"** mostra a forma esperada. Os nomes de tabela e coluna foram conferidos no schema de produção em 28/10/2026. A implementação pode ajustar detalhes de sintaxe, mas não a semântica.
- Quando algo não estiver escrito, siga a §3.3: **pare e pergunte ao João**.
- A §7 diz o que pode rodar **em paralelo com agentes** e o que precisa ser sequencial.

### 0.1 Glossário (além do da spec mãe)

| Termo | Definição exata |
|---|---|
| **Janela quente** | Dias BRT `dia >= v_desde`, com `v_desde = eng_hoje() - 3`. **Sem limite superior.** |
| **Rebuild total** | `eng_refresh('cron' \| 'manual')`: recalcula todas as `eng_*` a partir das fontes inteiras. Passa a ser a rede de segurança noturna. |
| **Incremental** | `eng_refresh_incremental()`: recalcula só a janela quente e classifica questões novas. |
| **Aplicar diff** | Gravar numa tabela `eng_*` só a diferença entre o estado atual e o estado novo: `DELETE` das chaves que sumiram e `INSERT … ON CONFLICT DO UPDATE … WHERE (colunas) IS DISTINCT FROM (novas)`. Nunca `DELETE` de tudo seguido de `INSERT`. |
| **Delta histórico** | Somar, em dias `< v_desde`, a contribuição de uma questão que ganhou classificação agora. Antes ela contribuía com zero. |
| **Deriva** | Linhas fora da janela quente que o rebuild total alterou. Mede o que o incremental deixou passar. |
| **Oráculo por dia** | Consulta só de leitura que calcula, direto das fontes, os totais por dia (§5.3). É o critério de aceite: **`eng_*` = oráculo**. |

---

## 1. Contexto e fatos verificados (28/10/2026, produção `gvqvrmkizemwsasmupmo`)

### 1.1 Problema

As DAGs entregam as fontes nas cadências que o negócio quer ver na tela:
- `fato_resolucao_questoes_b2b`: a cada 5 min;
- `dim_aluno_b2b` e `fato_consumo_conteudo_b2b`: a cada 1 h.

A tela, porém, só muda 1× ao dia, porque `eng_refresh()` roda às 06:00 BRT (cron `0 9 * * *`, jobid 5) e reconstrói a camada `eng_*` inteira. A idade do dado mais recente na tela vai de ~0,2 h a ~24 h, com média de ~12 h.

**Meta.** Questões aparecem na tela ~25–35 min depois do evento. Consumo aparece em ~30–90 min. Os ~24 min entre o evento e a chegada ao banco são da DAG e ficam fora do escopo.

### 1.2 Cadência real das fontes

| Fonte | Carga | Evidência |
|---|---|---|
| Questões | Lotes a cada 5 min, só INSERT/UPDATE (`n_tup_del = 0`). Evento → banco: mediana de 23,5 min, p90 de 25,9 min | 12 lotes por hora; `b2b_questions_sync_state` |
| Consumo | 1×/h, por volta de :25 UTC. Apaga e reinsere a janela `event_date >= hoje-2` **numa única transação** (1 `xmin` por carga). Traz eventos até a hora cheia anterior | Cargas às 13:25 e 14:25 UTC, de 2.102 e 2.182 linhas |
| Dim | 1×/h, por volta de :24 UTC, com substituição por DELETE+INSERT (`n_tup_del ≈ n_tup_ins`) | 13:24 e 14:23 UTC |

**Atraso.** Nas últimas 24 h, todas as linhas de questões carregadas ou corrigidas pelo `recent_repair` tinham `response_date` entre D-2 e D. Em 7 dias, nenhuma passou de 2 dias, apesar da pane da DAG de ~18 h em 26–27/10.

### 1.3 Por que o rebuild é lento

- **Instância pequena.** `shared_buffers` 256 MB, `effective_cache_size` 768 MB, `work_mem` 3,5 MB, `max_parallel_workers_per_gather` 1.
- **Tabela de questões maior que a RAM.** `fato_resolucao_questoes_b2b` tem 1,57 GB e 1,33 mi de linhas, com jsonb pesado. O rebuild a varre 4 vezes.
- **Sort em disco.** Só o `DISTINCT ON (question_id)` leva 13 s e grava 125 MB em temp.
- **Leitura total.** Em 7 execuções manuais foram 9,4 mi de blocos lidos (~72 GB) e 1,6 mi de blocos temporários.
- **Duração.** Varia entre 2m30 e 18m23. Últimas 5: 15m18 · 2m41 · 2m34 · 2m30 · 18m23.

### 1.4 Por que o incremental resolve

- **Recalcular a janela custa pouco.** Medido com `EXPLAIN ANALYZE`, a frio: o agregado de questões para 3 dias leva 1,2 s (13 mil respostas); o de consumo, 46 ms (2.102 eventos).
- **Quase nada a classificar por rodada.** Na janela de 4 dias há ~2.350 questões sem classificação, mas só **18** têm taxonomia (`taxonomia_status <> 'ausente'`). As outras são do estoque permanente sem taxonomia, que o de-para (hoje vazio) é o único caminho para classificar.
- **Por que recalcular por dia é exato.** As três tabelas de agregado têm `dia` na chave, e todas as colunas são função de (aluno, dia). A única dependência entre dias é a classificação por questão, e ela é estável: 0 de 47 mil questões amostradas têm taxonomia divergente.
- **Por que não somar só as linhas novas por `carregado_em`.** Falha em dois casos: o consumo apaga e reinsere a janela, e o `recent_repair` faz UPDATE de respostas já carregadas. Recalcular dias inteiros não depende de delta.

### 1.5 Efeito nas RPCs (linha de base)

`pg_stat_statements`, acumulado desde o lançamento:

| RPC | Chamadas | Média | Máximo |
|---|---|---|---|
| `get_gestor_engajamento_visao_geral` | 126 | 2.266 ms | 7.935 ms |
| `get_gestor_engajamento_conteudos` | 36 | 1.948 ms | 7.469 ms |
| `get_gestor_engajamento_questoes` | 32 | 1.288 ms | 5.550 ms |

A leitura de disco é alta porque as varreduras do rebuild expulsam as `eng_*` do cache. **Esperado:** com o incremental, as RPCs ficam mais rápidas sem nenhum cache novo.

### 1.6 Ambiente

- Repositório `C:\Users\joao.nader\work\sanarflix-engajamento`, branch `feat/engajamento-sanarflix`. Nunca commitar na `main`.
- Migrations aplicadas em produção pelo MCP `apply_migration`. No modo automático, o classificador bloqueia essa chamada; troque o modo de permissão.
- `execute_sql` tem `statement_timeout` de 2 min. O rebuild total passa disso. Rode-o por um job avulso do cron (receita na spec mãe, §6.5) e acompanhe pelo `eng_refresh_log`.
- Suíte: `node node_modules/vitest/vitest.mjs run`. Baseline de 40 falhas pré-existentes em 1.722 testes. O critério é **nenhuma falha nova**. Lint não é critério.

---

## 2. Escopo

### 2.1 Entra
1. Suporte de schema: índices, fillfactor, autovacuum e colunas do log (Fase 1).
2. Funções do pipeline parametrizadas, com leitura única da fonte e aplicação de diff, sem mudar o resultado (Fase 2).
3. `eng_refresh_incremental()` com delta histórico (Fase 3).
4. Cron incremental a cada 5 min, rebuild noturno às 03:00 BRT, VACUUM diário e limpeza de logs (Fase 4).
5. `eng_atualizado_em()` honesto, RPC de versão e invalidação automática no front (Fase 5).

### 2.2 Não entra (decisões travadas)
- **Cache de resultado no servidor**, seja tabela de cache por RPC ou pré-cálculo por IES. Motivos na §4.
- **Mudança nas regras de cálculo, nas RPCs de dados ou nos textos da UI.** Exceção: a Fase 5 acrescenta uma RPC nova (`get_gestor_engajamento_versao`).
- **Triggers nas tabelas da DAG e índices em tabelas da DAG.** Ficam para conversa com o time de dados (§8).
- **Upgrade da instância.**

---

## 3. Decisões

### 3.1 Fechadas com o João (28/10/2026)

| # | Decisão | Motivo |
|---|---|---|
| I1 | Cadência do incremental: **a cada 5 min** (`'2-59/5 * * * *'`). | O João quer as questões na cadência da DAG. O minuto 2 cai depois dos lotes de questões. |
| I2 | Janela quente = `dia >= eng_hoje() - 3`, sem limite superior. | Cobre a reescrita de 3 dias do consumo, o atraso máximo observado das questões e a diferença UTC × BRT da DAG. |
| I3 | O rebuild total continua, **1×/dia às 03:00 BRT** (`0 6 * * *` UTC), como rede de segurança. | Pega reclassificações, mudança no de-para e atrasos maiores que 3 dias. |
| I4 | Sem cache no servidor. O front mantém o staleTime de 5 min. | §4. |
| I5 | O incremental **não reclassifica** questões que já têm classificação. Só o rebuild total faz isso. | Evita histórico incoerente dentro do dia. |

### 3.2 Padrões adotados nesta spec (o João pode vetar; a implementação não)

| # | Padrão |
|---|---|
| P1 | Uma única definição de cálculo. O rebuild total e o incremental chamam as **mesmas** funções, com parâmetro. Proibido copiar SQL de cálculo. |
| P2 | Fonte lida **uma vez por execução**, em temporárias estreitas (`w_resp`, `w_cons`), para todos os agregados verem o mesmo snapshot. |
| P3 | Toda escrita nas `eng_*` é por **diff** (§0.1). |
| P4 | Incremental: `pg_try_advisory_xact_lock(hashtext('eng_refresh'))`. Se o lock estiver ocupado, grava o log `pulado` e sai. Rebuild: `pg_advisory_xact_lock` com `SET LOCAL lock_timeout = '10min'`. Sem lock, falha **com log**. |
| P5 | Teto do delta histórico: 20.000 respostas por execução. Acima disso, não aplica, grava `delta_adiado = true` em `contagens` e deixa para o rebuild. |
| P6 | O incremental **não lê** `dim_aluno_b2b`, para não entrar na fila de lock da carga da dim. |

### 3.3 Pare e pergunte ao João
1. Se o DoD de equivalência (§5.3) apontar diferença que não se explica por carga concorrente.
2. Se o incremental passar de 15 s no p95 ou o rebuild noturno passar de 20 min.
3. Se a deriva noturna passar de 0,5% das linhas da tabela em 3 noites seguidas.
4. Qualquer mudança no texto do selo "atualizado em" (a spec mantém o texto atual).
5. Qualquer necessidade de mexer em tabela da DAG (índice, trigger, coluna).

---

## 4. Cache: análise e decisão

| Opção | Ganho | Custo / risco | Decisão |
|---|---|---|---|
| Navegador (React Query, já existe em `useEnvelope`, `src/features/gestor/api/queries.ts`) | Troca de aba e filtro instantânea; refaz a consulta ao montar e ao focar a aba | Até 5 min a mais de defasagem | **Manter** |
| Cache de resultado no banco (`rpc + params + versão → jsonb`) | Reabrir o mesmo recorte fica instantâneo | Ver abaixo | **Não** |
| Pré-cálculo por IES ao fim de cada refresh | Abertura instantânea do recorte padrão | 21 IES × várias RPCs × 1–2 s a cada 5 min. Na instância pequena, isso compete com as RPCs | **Não** |
| Invalidação por versão no front (Fase 5) | A tela aberta se atualiza sozinha quando chega dado novo | 1 chamada barata a cada 2 min por aba aberta | **Sim** |
| `refetchInterval` direto na visão geral | Tela aberta atualizada | Uma aba aberta faria até 288 chamadas de 2,3 s por dia | **Não** |

Por que não o cache de resultado no banco:
- Com o dado mudando a cada 5 min, cada entrada vive no máximo 5 min.
- O uso é baixo (~25 aberturas da visão geral por dia), então quase não há acerto.
- As RPCs deixam de ser STABLE e passam a gravar.
- Se a chave errar, há risco de vazar dado entre IES.

---

## 5. Desenho técnico

### 5.1 Schema (Fase 1)

```sql
-- referência
CREATE INDEX IF NOT EXISTS eng_questoes_aluno_dia_no_dia_idx      ON public.eng_questoes_aluno_dia_no (dia);
CREATE INDEX IF NOT EXISTS eng_consumo_aluno_dia_conteudo_dia_idx ON public.eng_consumo_aluno_dia_conteudo (dia);

ALTER TABLE public.eng_atividade_aluno_dia        SET (fillfactor = 85, autovacuum_vacuum_scale_factor = 0.02, autovacuum_analyze_scale_factor = 0.02);
ALTER TABLE public.eng_questoes_aluno_dia_no      SET (fillfactor = 85, autovacuum_vacuum_scale_factor = 0.02, autovacuum_analyze_scale_factor = 0.02);
ALTER TABLE public.eng_consumo_aluno_dia_conteudo SET (fillfactor = 85, autovacuum_vacuum_scale_factor = 0.02, autovacuum_analyze_scale_factor = 0.02);

ALTER TABLE public.eng_refresh_log ADD COLUMN tipo text NOT NULL DEFAULT 'completo'
  CHECK (tipo IN ('completo', 'incremental'));
ALTER TABLE public.eng_refresh_log DROP CONSTRAINT eng_refresh_log_status_check;   -- confirmar o nome real
ALTER TABLE public.eng_refresh_log ADD CONSTRAINT eng_refresh_log_status_check
  CHECK (status IN ('rodando', 'ok', 'erro', 'pulado'));
CREATE INDEX IF NOT EXISTS eng_refresh_log_tipo_ok_idx ON public.eng_refresh_log (tipo, terminado_em DESC) WHERE status = 'ok';
```

O `fillfactor` só vale para páginas novas. A reescrita das tabelas existentes acontece naturalmente no primeiro rebuild da Fase 2. **Não** rode `VACUUM FULL`.

### 5.2 Funções (Fases 2 e 3)

**Assinaturas.** A migration faz `DROP FUNCTION` das assinaturas `()` atuais **antes** de criar as novas. Sem isso, `eng_refresh_classificacao()` fica ambígua e o rebuild quebra. Toda função nova recebe `REVOKE ALL … FROM PUBLIC, anon, authenticated`.

| Função | Papel |
|---|---|
| `eng_refresh_classificacao(p_questoes text[] DEFAULT NULL) → jsonb` | `NULL` = todas as questões (rebuild). Com lista: lê **todo o histórico** dessas questões pelo índice `question_id` e regrava só elas. Aplica diff em `eng_questao_classificacao`. Upsert de nós com `WHERE … IS DISTINCT FROM`. Retorna as contagens e, com `NULL`, `questoes_trocaram_folha`. |
| `eng_refresh_agregados(p_desde date DEFAULT NULL) → jsonb` | `NULL` = tudo. Monta `w_resp` e `w_cons` (P2) e calcula o estado novo das três tabelas para `dia >= p_desde` (ou todos). Aplica diff (P3). Com `NULL`, registra a deriva: linhas alteradas com `dia < eng_hoje() - 3`. Contagens por `GET DIAGNOSTICS`, sem `count(*)` das tabelas. |
| `eng_delta_questoes(p_questoes text[], p_ate date, p_sinal smallint) → jsonb` | Soma (`p_sinal = 1`) ou subtrai (`-1`) a contribuição das respostas dessas questões com `response_date < p_ate` em `eng_questoes_aluno_dia_no` e `eng_atividade_aluno_dia`. Respeita o teto P5. Com `+1`: `INSERT … ON CONFLICT DO UPDATE SET questoes = t.questoes + EXCLUDED.questoes, …`. Com `-1`: linhas de `eng_questoes_aluno_dia_no` que chegarem a `questoes = 0` são **apagadas**, porque o CHECK exige `questoes > 0`. `respostas_todas` nunca muda, já que essas respostas já contavam nele. O `-1` existe para o teste da §5.3 (T-delta). |
| `eng_refresh_incremental() → jsonb` | Algoritmo abaixo. |
| `eng_refresh(p_disparo text)` | Igual ao atual, com P4. Chama `classificacao(NULL)` e `agregados(NULL)`. `SET LOCAL work_mem = '64MB'`. Grava `tipo = 'completo'`. Limpa as linhas de log `incremental` e as de `cron.job_run_details` com mais de 7 dias. |

**Leitura estreita (referência).**
```sql
CREATE TEMP TABLE w_resp ON COMMIT DROP AS
  SELECT sanarflix_user_id, response_date, question_id, acertou, taxonomia_status, carregado_em
  FROM public.fato_resolucao_questoes_b2b
  WHERE p_desde IS NULL OR response_date >= p_desde;
CREATE TEMP TABLE w_cons ON COMMIT DROP AS
  SELECT sanarflix_user_id, event_date, content_id, content_type, content_name, course_name, module_name,
         event_timestamp, event_key, carregado_em
  FROM public.fato_consumo_conteudo_b2b
  WHERE p_desde IS NULL OR event_date >= p_desde;
```
No rebuild, isso troca 3 varreduras de 1,4 GB por 1 varredura mais uma tabela estreita de ~130 MB. O `DISTINCT ON` da classificação ordena só `(question_id, response_timestamp, response_id)` e busca `taxonomias` depois, por `response_id`.

**Aplicação de diff (referência, `eng_questoes_aluno_dia_no`; as outras duas seguem a mesma forma).**
```sql
DELETE FROM public.eng_questoes_aluno_dia_no t
 WHERE (p_desde IS NULL OR t.dia >= p_desde)
   AND NOT EXISTS (SELECT 1 FROM tmp_novo_qn n
                   WHERE (n.sanarflix_user_id, n.dia, n.folha_id) = (t.sanarflix_user_id, t.dia, t.folha_id));
INSERT INTO public.eng_questoes_aluno_dia_no AS t SELECT * FROM tmp_novo_qn
ON CONFLICT (sanarflix_user_id, dia, folha_id) DO UPDATE
   SET ciclo = EXCLUDED.ciclo, n1_id = EXCLUDED.n1_id, n2_id = EXCLUDED.n2_id, n3_id = EXCLUDED.n3_id,
       esp_id = EXCLUDED.esp_id, questoes = EXCLUDED.questoes, acertos = EXCLUDED.acertos, erros = EXCLUDED.erros
 WHERE (t.ciclo, t.n1_id, t.n2_id, t.n3_id, t.esp_id, t.questoes, t.acertos, t.erros)
       IS DISTINCT FROM (EXCLUDED.ciclo, EXCLUDED.n1_id, EXCLUDED.n2_id, EXCLUDED.n3_id, EXCLUDED.esp_id,
                         EXCLUDED.questoes, EXCLUDED.acertos, EXCLUDED.erros);
```
Ordem de gravação: `eng_questoes_aluno_dia_no` e `eng_consumo_aluno_dia_conteudo` primeiro; `eng_atividade_aluno_dia` por último, calculada de `w_resp` (`respostas_todas`) mais as duas tabelas já gravadas. `MERGE … WHEN NOT MATCHED BY SOURCE` está **proibido**, porque junta a tabela-alvo inteira.

**Algoritmo do incremental (referência).**
```
1. tenta o lock (P4); se ocupado → log {tipo:'incremental', status:'pulado'} e retorna.
2. log 'rodando' (tipo 'incremental').
3. v_desde := eng_hoje() - 3.
4. novas := question_id DISTINCT das respostas com response_date >= v_desde,
            sem linha em eng_questao_classificacao,
            e com (taxonomia_status <> 'ausente'
                   OR (EXISTS eng_depara_quiz_no AND carregado_em > início do último incremental ok - 1 h)).
5. se novas ≠ ∅: v_c := eng_refresh_classificacao(novas);
   classificadas_agora := novas ∩ eng_questao_classificacao;
   eng_delta_questoes(classificadas_agora, v_desde, 1).
6. v_a := eng_refresh_agregados(v_desde).
7. contagens := v_c || v_a || {fonte_carregado_resp: max(w_resp.carregado_em),
                              fonte_carregado_cons: max(w_cons.carregado_em)}.
8. log 'ok' (ou 'erro' via EXCEPTION, como o eng_refresh atual).
```
A tabela `w_resp` do passo 6 pode ser reaproveitada no passo 4: montar `w_resp` antes do passo 4 e passar uma flag para `agregados` não recriá-la. Escolha da implementação, desde que P1 e P2 valham.

### 5.3 Consultas de verificação (usadas nos DoDs)

**Oráculo por dia (referência).** Leitura apenas. Compara as `eng_*` com as fontes na janela, numa única consulta (um snapshot).
```sql
WITH d AS (SELECT generate_series(eng_hoje() - 3, eng_hoje(), interval '1 day')::date AS dia),
src_r AS (SELECT response_date dia, count(*) rt,
                 count(*) FILTER (WHERE c.question_id IS NOT NULL) q,
                 count(*) FILTER (WHERE c.question_id IS NOT NULL AND f.acertou) ac
          FROM fato_resolucao_questoes_b2b f
          LEFT JOIN eng_questao_classificacao c USING (question_id)
          WHERE response_date >= eng_hoje() - 3 GROUP BY 1),
src_c AS (SELECT event_date dia,
                 count(DISTINCT (sanarflix_user_id, content_id)) FILTER (WHERE content_type = 'video') vi,
                 count(DISTINCT (sanarflix_user_id, content_id)) FILTER (WHERE content_type = 'document') dc
          FROM fato_consumo_conteudo_b2b WHERE event_date >= eng_hoje() - 3 GROUP BY 1),
eng AS (SELECT dia, sum(respostas_todas) rt, sum(questoes) q, sum(acertos) ac, sum(videos) vi, sum(documentos) dc
        FROM eng_atividade_aluno_dia WHERE dia >= eng_hoje() - 3 GROUP BY 1)
SELECT d.dia, s.rt, e.rt, s.q, e.q, s.ac, e.ac, c.vi, e.vi, c.dc, e.dc
FROM d LEFT JOIN src_r s USING (dia) LEFT JOIN src_c c USING (dia) LEFT JOIN eng e USING (dia)
WHERE (s.rt, s.q, s.ac, c.vi, c.dc) IS DISTINCT FROM (e.rt, e.q, e.ac, e.vi, e.dc);
-- aceite: 0 linhas, desde que nenhuma carga tenha commitado entre o fim do refresh e esta consulta
-- (conferir: max(carregado_em) das fontes <= iniciado_em da última linha ok do log)
```

**Equivalência entre rebuild e incremental (T-equiv).**
1. Rode o rebuild total (job avulso) e guarde a janela das 3 tabelas em `eng_qa.snap_*`. O schema `eng_qa` é temporário de QA: criado e apagado nesta fase, com `REVOKE` total.
2. Logo depois, rode o incremental.
3. Diferenças entre `eng_qa.snap_*` e as `eng_*` (`EXCEPT` nos dois sentidos) só são aceitas para `(aluno, dia)` com linhas de fonte de `carregado_em >` início do rebuild do passo 1. Qualquer outra diferença é falha.

**Idempotência (T-idem).** Rode o incremental duas vezes seguidas, sem carga entre elas: a segunda grava 0 linhas (todas as contagens de diff = 0).

**Delta histórico (T-delta)**, numa transação que termina em `ROLLBACK`:
1. Escolha uma questão X classificada, com `taxonomia_status <> 'ausente'` e respostas dentro e fora da janela. Guarde os totais por dia de `eng_atividade_aluno_dia` e as linhas de `eng_questoes_aluno_dia_no` de X.
2. `DELETE FROM eng_questao_classificacao WHERE question_id = X`.
3. `eng_delta_questoes('{X}', v_desde, -1)`, que simula "X nunca foi classificada" fora da janela.
4. `eng_refresh_incremental()`: deve reclassificar X e aplicar o `+1`.
5. Os totais por dia devem ser iguais aos do passo 1, em **todos** os dias.
6. `ROLLBACK`.

**Saúde (referência).**
```sql
SELECT tipo, status, count(*), max(terminado_em),
       percentile_cont(0.95) WITHIN GROUP (ORDER BY extract(epoch FROM terminado_em - iniciado_em)) p95_s
FROM eng_refresh_log WHERE iniciado_em > now() - interval '24 hours' GROUP BY 1, 2;
SELECT status, count(*) FROM cron.job_run_details
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname LIKE 'eng-%')
  AND start_time > now() - interval '24 hours' GROUP BY 1;
SELECT relname, n_live_tup, n_dead_tup, last_autovacuum, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_stat_user_tables WHERE relname LIKE 'eng_%';
```

### 5.4 Front (Fase 5)

- **`eng_atualizado_em()`** passa a devolver o **menor** valor entre:
  - `terminado_em` do último ok (de qualquer tipo);
  - `contagens->>'fonte_carregado_resp'`;
  - `contagens->>'fonte_carregado_cons'`, da mesma linha.

  Se a DAG parar, o selo envelhece em vez de dizer "há 2 min". Sem varrer fonte na hora da RPC. O texto do selo não muda.
- **RPC nova `get_gestor_engajamento_versao(p_ies_id uuid) → jsonb`** `{ data: { atualizadoEm }, meta }`. Mesma ordem de autorização das RPCs do gestor (spec mãe §7.1: papel → `v_ies` → `gestor_pode_acessar_ies`). Grant para `authenticated`.
- **Hook `useEngajamentoVersao(iesId)`** em `src/features/gestor/api/engajamento.ts`:
  - consulta a cada 2 min (`refetchInterval: 120_000`), só com a aba visível (`refetchIntervalInBackground: false`);
  - quando `atualizadoEm` muda, `invalidateQueries({ queryKey: ['gestor', user.id, 'engajamento'] })`, exceto a própria chave de versão;
  - usado uma vez, em `EngajamentoLayout.tsx`.

---

## 6. Implementação faseada

### 6.0 Regras para todas as fases
- **Arquivo de acompanhamento:** `docs/superpowers/notes/2026-10-28-refresh-incremental-acompanhamento.md`. Por fase: data, migrations aplicadas, saída resumida de cada item do DoD e o OK do João.
- **Uma migration por fase**, nomeada `AAAAMMDDHHMMSS_eng_incremental_faseN_<assunto>.sql`. A migration é aplicada com `apply_migration` **e** commitada na branch.
- **Testes estáticos** (sem banco) num arquivo novo, `src/test/unit/engajamentoRefreshIncremental.test.ts`. Mesmo padrão de `engajamentoMigrations.test.ts`: `vigente()`, `corpoDaFuncao()`, `semComentarios()`. Extraia esses helpers para `src/test/unit/helpers/migrations.ts` só se os dois arquivos passarem a usá-los. Cada fase acrescenta casos.
- **DoD comum a toda fase:**
  - (a) a suíte inteira tem as mesmas 40 falhas do baseline, e nenhuma nova;
  - (b) `get_advisors` (security) sem alerta novo para objetos `eng_*`;
  - (c) o oráculo por dia (§5.3) dá 0 linhas depois do último refresh da fase;
  - (d) commit na branch.

### Fase 0 — Linha de base (só leitura)
**Entregáveis:** o arquivo de acompanhamento com:
- **Drift.** Hash de `prosrc` de `eng_refresh`, `eng_refresh_agregados` e `eng_refresh_classificacao` em produção, comparado com `20261023181954_eng_pipeline.sql`.
- **Snapshot de `pg_stat_statements`** das RPCs `get_gestor_engajamento_*` e `get_admin_engajamento`: chamadas, média, máximo, `shared_blks_read`.
- **Últimas 7 linhas de `eng_refresh_log`.**
- **Tamanhos e `n_dead_tup`** das `eng_*`.
- **Baseline da suíte.**
- **Nome real das constraints** de `eng_refresh_log`.

**DoD:**
- [ ] Drift = nenhum. Se houver, pare (§3.3).
- [ ] As 6 medidas registradas no arquivo.
- [ ] Oráculo por dia rodado e registrado. Hoje ele deve dar diferença no dia corrente, o que prova que o oráculo detecta defasagem.

### Fase 1 — Suporte de schema
**Entregáveis:** a migration da §5.1.

**Testes estáticos novos:**
- os 2 índices `(dia)` existem;
- `fillfactor` e autovacuum nas 3 tabelas;
- `tipo` com CHECK e DEFAULT `'completo'`;
- `status` aceita `'pulado'`;
- nenhum `TRUNCATE` e nenhum `VACUUM FULL` nas migrations da fase.

**DoD:**
- [ ] Testes estáticos verdes.
- [ ] No banco: `pg_indexes` mostra os 2 índices; `reloptions` das 3 tabelas está certo; `eng_refresh_log` aceita `'pulado'` (teste com `INSERT` + `ROLLBACK`).
- [ ] `EXPLAIN` de `DELETE FROM eng_questoes_aluno_dia_no WHERE dia >= eng_hoje()-3` usa o índice novo (`EXPLAIN` sem `ANALYZE`).
- [ ] O rebuild das 06:00 do dia seguinte roda ok (o comportamento não mudou).
- [ ] DoD comum.

### Fase 2 — Pipeline parametrizado com diff (o resultado não muda)
**Entregáveis:**
- `eng_refresh_classificacao(text[])`, `eng_refresh_agregados(date)` e `eng_refresh(text)` novas (§5.2, P1–P4);
- `DROP` das assinaturas `()`;
- `REVOKE` nas novas.

O cron continua o mesmo, 06:00 BRT.

**Testes estáticos novos:**
- não existe mais `eng_refresh_classificacao()` sem parâmetro como função vigente;
- `REVOKE` para as novas assinaturas;
- nenhum `DELETE FROM public.eng_<tabela>;` sem `WHERE` no corpo das funções;
- `ON CONFLICT … DO UPDATE … IS DISTINCT FROM` nas 3 tabelas;
- `pg_advisory_xact_lock` mais `lock_timeout` em `eng_refresh`;
- `work_mem` em `eng_refresh`;
- nenhum `MERGE`.

**DoD:**
- [ ] Testes estáticos verdes.
- [ ] **Equivalência com a versão anterior.**
  1. Antes de aplicar a migration, rode o rebuild antigo e copie as 4 tabelas `eng_*` (classificação mais os 3 agregados) para `eng_qa.antes_*`.
  2. Aplique a migration e rode o rebuild novo.
  3. `EXCEPT` nos dois sentidos para dias `< eng_hoje() - 3` (fora da janela, que a DAG não muda) dá **0 linhas**.
  4. Na janela, as diferenças só podem ser explicadas por carga concorrente (regra da T-equiv).
- [ ] O rebuild novo é **mais rápido** que a mediana das 5 últimas execuções antigas, e grava menos blocos temporários (`pg_stat_statements` delta).
- [ ] Segundo rebuild seguido: as contagens de diff da janela são ≈ 0, e as de fora da janela (deriva) são **0**.
- [ ] Lock: com um incremental simulado segurando o lock (sessão com `pg_advisory_lock` manual), o rebuild **espera** e depois roda. Com `lock_timeout` curto, ele falha **e deixa a linha de log**.
- [ ] Oráculo por dia: 0 linhas.
- [ ] DoD comum. Apague `eng_qa` ao final.

### Fase 3 — Incremental (manual, sem cron)
**Entregáveis:**
- `eng_delta_questoes` e `eng_refresh_incremental` (§5.2);
- `REVOKE` nas duas.

**Testes estáticos novos:**
- `eng_refresh_incremental` usa `pg_try_advisory_xact_lock` e grava `'pulado'`;
- `v_desde = eng_hoje() - 3`;
- não referencia `dim_aluno_b2b` (P6);
- não chama `eng_refresh_classificacao(NULL)` nem `eng_refresh_agregados(NULL)`;
- `eng_delta_questoes` tem o teto P5.

**DoD:**
- [ ] Testes estáticos verdes.
- [ ] **T-equiv** (§5.3) verde.
- [ ] **T-idem** verde.
- [ ] **T-delta** verde.
- [ ] Oráculo por dia: 0 linhas logo depois de um incremental.
- [ ] **Custo:** 10 execuções manuais espaçadas ao longo de 1 h. Medir p95 da duração (meta < 5 s; teto 15 s, §3.3), `temp_blks_written = 0` e o delta de WAL por execução (`pg_current_wal_lsn()` antes e depois; meta < 20 MB).
- [ ] Lock: com o rebuild rodando, o incremental grava `'pulado'` em menos de 1 s.
- [ ] DoD comum.

### Fase 4 — Ligar o cron
**Entregáveis:** migration com os jobs.
```sql
-- referência (idempotente: unschedule por nome antes de cada schedule)
SELECT cron.schedule('eng-refresh-incremental', '2-59/5 * * * *',
  $$SET statement_timeout TO '90s'; SET lock_timeout TO '5s'; SELECT public.eng_refresh_incremental();$$);
SELECT cron.schedule('eng-refresh-diario', '0 6 * * *',          -- 03:00 BRT
  $$SET statement_timeout TO '30min'; SELECT public.eng_refresh('cron');$$);
SELECT cron.schedule('eng-vacuum-diario', '40 6 * * *',          -- 03:40 BRT
  $$VACUUM (ANALYZE) public.eng_atividade_aluno_dia, public.eng_questoes_aluno_dia_no,
           public.eng_consumo_aluno_dia_conteudo, public.eng_questao_classificacao$$);
```
**Testes estáticos novos:** os 3 jobs com nome, agenda e timeouts exatos; o job antigo `0 9 * * *` deixou de existir.

**DoD (observação de 24 h, com uma madrugada incluída):**
- [ ] Testes estáticos verdes.
- [ ] `cron.job_run_details`: 0 falhas nos 3 jobs.
- [ ] `eng_refresh_log` incremental: ≥ 280 linhas ok em 24 h; p95 < 5 s; `pulado` só no horário do rebuild.
- [ ] Rebuild noturno: ok; duração < 20 min; deriva < 0,5% (§3.3).
- [ ] **Frescor**, em 3 amostras em horários diferentes:
  - o maior `dia` e o maior `ultima_abertura` de `eng_*` estão a no máximo 10 min do `max(carregado_em)` das fontes;
  - oráculo por dia com 0 linhas.
- [ ] Bloat: `n_dead_tup` estável e tamanho das 3 tabelas até +10% em relação à Fase 0.
- [ ] RPCs: novo snapshot de `pg_stat_statements` (delta desde a Fase 0). A média da visão geral não piora; espera-se que melhore.
- [ ] DoD comum.

### Fase 5 — "Atualizado em" honesto e tela que se atualiza sozinha
**Entregáveis:**
- `eng_atualizado_em()` nova (§5.4);
- RPC `get_gestor_engajamento_versao`;
- hook `useEngajamentoVersao`;
- uso em `EngajamentoLayout.tsx`;
- tipos em `api/types-engajamento.ts`.

**Testes novos:**
- **Estático:** `get_gestor_engajamento_versao` segue papel → `v_ies` → `gestor_pode_acessar_ies`. Entra na enumeração de RPCs de `engajamentoMigrations.test.ts`, que precisa ser atualizada.
- **Unitário** (`src/features/gestor/__tests__/engajamento/useEngajamentoVersao.test.tsx`, com fake timers):
  - consulta a cada 2 min;
  - não consulta com a aba oculta;
  - invalida as queries do engajamento quando `atualizadoEm` muda;
  - não invalida quando não muda;
  - não invalida a própria chave.
- **Layout:** `EngajamentoLayout.test.tsx` continua verde.

**DoD:**
- [ ] Testes verdes.
- [ ] No banco:
  - com a última linha ok tendo `fonte_carregado_cons` 1 h atrás, `eng_atualizado_em()` devolve esse valor;
  - gestor de outra IES recebe erro de acesso na RPC de versão.
- [ ] **QA na PARACATU** pelo browser:
  - com a tela aberta, o selo "atualizado em" avança sozinho em ≤ 7 min, sem recarregar;
  - uma questão resolvida por um aluno de teste aparece nas contagens em ≤ 35 min.
- [ ] DoD comum.

---

## 7. Paralelismo com agentes

**Regras:**
- **Um único escritor no banco.** `apply_migration`, rebuilds, incrementais manuais e testes com `ROLLBACK` rodam **só na sessão principal**, em sequência.
- **Agentes não escrevem no mesmo arquivo.** Cada agente recebe arquivos próprios. A sessão principal junta e commita.
- **Agentes de verificação só leem.** Recebem a consulta da §5.3 e devolvem o resultado bruto; não interpretam o DoD sozinhos.

| Fase | Paralelo (agentes) | Sequencial (sessão principal) |
|---|---|---|
| 0 | **3 agentes de leitura ao mesmo tempo:** (A) drift das funções; (B) snapshot de `pg_stat_statements`, log e tamanhos; (C) baseline da suíte vitest. | Consolidar no arquivo de acompanhamento. |
| 1 | **2 agentes:** (A) escreve a migration da §5.1; (B) escreve os testes estáticos da Fase 1 a partir **desta spec**, não da migration, para o teste não copiar o código. | Rodar os testes, aplicar a migration, rodar os DoDs no banco. |
| 2 | **2 agentes:** (A) escreve a migration das funções; (B) escreve os testes estáticos da Fase 2 e o roteiro SQL de equivalência num arquivo de notas. **Mais um revisor** (só leitura) que confere a migration contra P1–P4 e a spec mãe §6.2/§6.4 antes da aplicação. | Snapshot `eng_qa.antes_*`, aplicar, rebuilds, DoD. |
| 3 | **2 agentes:** (A) migration de `eng_delta_questoes` e `eng_refresh_incremental`; (B) testes estáticos e os roteiros T-equiv, T-idem e T-delta. **Revisor** só de leitura, como na Fase 2. | Execuções manuais, medidas de custo, DoD. |
| 4 | **Agentes de leitura em paralelo durante as 24 h** (saúde, frescor, bloat, RPCs), cada um com sua consulta da §5.3. | Aplicar os jobs; consolidar. |
| 5 | **Pode começar junto com a Fase 2:** só depende da §5.4, não das funções do pipeline. **2 agentes:** (A) RPC de versão e nova `eng_atualizado_em()` (migration **só aplicada depois da Fase 4**); (B) hook, uso no layout e testes unitários (front). | Aplicar a migration da Fase 5 depois do DoD da Fase 4; QA no browser. |

**Ordem global:** Fase 0 → 1 → 2 → 3 → 4 → 5. O **código** da Fase 5 corre em paralelo a partir da Fase 2. A **aplicação** da Fase 5 espera o DoD da Fase 4.

---

## 8. Trabalho futuro (fora desta spec)

| Item | Ganho | Depende de |
|---|---|---|
| A DAG chamar `eng_refresh_incremental()` ao fim de cada carga | Tira até 5 min de espera e a corrida com carga em andamento. O cron vira fallback a cada 30 min | Time de dados |
| Índice BRIN em `fato_resolucao_questoes_b2b(carregado_em)` | Detectar dias sujos fora da janela sem esperar o rebuild | Time de dados (a tabela é da DAG) |
| Upgrade da instância (Micro → Small/Medium) | Rebuild e RPCs mais rápidos | Custo |
| Reduzir o atraso evento → banco (~24 min) | O maior atraso que sobra | DAG |
| Painel de saúde do pipeline no admin | Alerta de "rebuild sem ok há mais de 26 h" e de "incremental parado" | Spec própria |

---

## 9. Riscos

| # | Risco | Mitigação |
|---|---|---|
| R1 | Carga da DAG commitada no meio da leitura | P2: leitura única em `w_resp`/`w_cons`. O consumo é atômico por carga (1 `xmin`). |
| R2 | Atraso maior que 3 dias ou `recent_repair` antigo | O rebuild noturno corrige. A deriva é medida (§3.3). |
| R3 | Bloat ou WAL demais na instância pequena | P3 (diff), fillfactor, autovacuum agressivo, VACUUM diário. Medido nas Fases 3 e 4. |
| R4 | Timeout do incremental sem linha de log (`query_canceled` escapa do `EXCEPTION`) | Monitorar `cron.job_run_details` (consulta de saúde). |
| R5 | Telas com RPCs em snapshots diferentes (até 288 por dia) | Aceito: as diferenças são de poucas unidades e transitórias. Registrar no acompanhamento se alguém notar. |
| R6 | O selo envelhece por causa do consumo (horário), mesmo com as questões frescas | Aceito: o selo mostra a fonte mais atrasada (§5.4). Mudar o texto é decisão do João (§3.3). |
