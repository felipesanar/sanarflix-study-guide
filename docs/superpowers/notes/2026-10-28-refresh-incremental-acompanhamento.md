# Refresh incremental da camada eng_*: acompanhamento

Spec: `docs/superpowers/specs/2026-10-28-engajamento-refresh-incremental-design.md`. Produção: `gvqvrmkizemwsasmupmo`. Branch: `feat/engajamento-sanarflix`.

## Fase 0: linha de base (28/10/2026, 11:5x BRT / ~14:55 UTC)

**Correção na spec:** o oráculo da §5.3 usava `generate_series(date, date, 1)`, que não existe (erro 42883). Corrigido para `interval '1 day'`.

### Drift (hash md5 do `prosrc` em produção × corpo em `20261023181954_eng_pipeline.sql`)

| Função | md5 produção | md5 migration | Igual |
|---|---|---|---|
| `eng_refresh(text)` | aebf06eacca6be4077fdc65df68e62eb | aebf06eacca6be4077fdc65df68e62eb | sim |
| `eng_refresh_agregados()` | 3c3a6b7753eea81e032337839c25a7ff | 3c3a6b7753eea81e032337839c25a7ff | sim |
| `eng_refresh_classificacao()` | f8c90eed8360aa7fa2db89df73df91d1 | f8c90eed8360aa7fa2db89df73df91d1 | sim |

**Drift: nenhum.**

### Constraints de `eng_refresh_log`
- `eng_refresh_log_pkey` PRIMARY KEY (id)
- `eng_refresh_log_disparo_check` CHECK (disparo IN ('cron','manual'))
- `eng_refresh_log_status_check` CHECK (status IN ('rodando','ok','erro'))  ← a que a Fase 1 troca

Atenção para a Fase 2/3: o CHECK de `disparo` só aceita `cron` e `manual`. O incremental precisa gravar um desses valores (ou a Fase 1 amplia o CHECK; a spec não prevê isso, decidir na Fase 1/3).

### Últimas 7 linhas de `eng_refresh_log`

| id | disparo | início (UTC) | duração |
|---|---|---|---|
| 7 | cron | 2026-10-28 09:00 | 918 s (15m18) |
| 6 | cron | 2026-10-27 09:00 | 162 s (2m41) |
| 5 | cron | 2026-10-26 09:00 | 154 s (2m34) |
| 4 | cron | 2026-10-25 09:00 | 150 s (2m30) |
| 3 | cron | 2026-10-24 09:00 | 1103 s (18m23) |
| 2 | manual | 2026-10-23 19:42 | 1047 s |
| 1 | manual | 2026-10-23 18:22 | 930 s |

Todas `ok`. Mediana das 5 últimas execuções antigas (para o DoD da Fase 2): **918 s** (150, 154, 162, 918, 1103).

### Tamanhos e `n_dead_tup`

| Tabela | Linhas (est.) | Dead | Tamanho total | Bytes | reloptions |
|---|---|---|---|---|---|
| eng_atividade_aluno_dia | 70.747 | 0 | 19 MB | 19.759.104 | nenhuma |
| eng_consumo_aluno_dia_conteudo | 154.626 | 0 | 89 MB | 92.848.128 | nenhuma |
| eng_questoes_aluno_dia_no | 331.566 | 0 | 235 MB | 245.989.376 | nenhuma |
| eng_questao_classificacao | 68.388 | 0 | 47 MB | 49.364.992 | nenhuma |
| eng_no_taxonomia | 1.611 | 0 | 768 kB | 786.432 | nenhuma |
| eng_depara_quiz_no | 0 | 0 | 24 kB | 24.576 | nenhuma |
| eng_refresh_log | 7 | 7 | 48 kB | 49.152 | nenhuma |

Limite da Fase 4 para bloat: as 3 tabelas de agregado até +10% (19,8 + 92,8 + 246,0 MB = 358,6 MB → teto 394,5 MB).

### `pg_stat_statements` das RPCs (acumulado até 28/10, antes do incremental)

Só as chamadas do PostgREST (`WITH pgrst_source…`):

| RPC | Chamadas | Média (ms) | Máx (ms) | shared_blks_read | shared_blks_hit | temp_blks_written |
|---|---|---|---|---|---|---|
| get_gestor_engajamento_visao_geral | 128 | 2.259 | 7.935 | 579.009 | 3.420.401 | 0 |
| get_gestor_engajamento_alunos | 83 | 168 | 1.357 | 32.259 | 592.171 | 0 |
| get_gestor_engajamento_conteudos | 36 | 1.948 | 7.469 | 12.902 | 285.560 | 1.992 |
| get_gestor_engajamento_questoes | 32 | 1.288 | 5.550 | 83.230 | 1.555.395 | 40.039 |
| get_admin_engajamento | 16 | 1.022 | 6.234 | 10.229 | 3.388.360 | 17.144 |
| get_gestor_engajamento_lista | 16 | 149 | 625 | 3.740 | 114.165 | 0 |
| get_gestor_engajamento_questoes_alunos | 3 | 48 | 64 | 1.229 | 9.496 | 0 |
| get_gestor_engajamento_aluno | 2 | 182 | 320 | 3.954 | 51.077 | 0 |
| get_gestor_engajamento_conteudo_alunos | 2 | 96 | 176 | 962 | 3.274 | 0 |
| get_gestor_engajamento_export_alunos | 1 | 39 | 39 | 0 | 4.204 | 0 |

(Há também entradas `CREATE TEMP TABLE j* … get_gestor_engajamento_*` de QA manual, ignoradas.)

### Oráculo por dia (versão corrigida), 28/10 ~14:55 UTC

Última carga: fonte de questões `max(carregado_em)` = 14:51 UTC; consumo = 14:25 UTC; último refresh ok iniciou às 09:00 UTC.

| dia | rt fonte / eng | q fonte / eng | ac fonte / eng | vídeos fonte / eng | docs fonte / eng |
|---|---|---|---|---|---|
| 2026-10-28 | 1954 / 379 | 1301 / 231 | 844 / 164 | 76 / 17 | 99 / 9 |

Só o dia corrente difere (defasagem do refresh das 06:00 BRT); os dias 25 a 27 fecham. O oráculo detecta a defasagem, como esperado.

### Baseline da suíte (28/10, antes de qualquer mudança desta spec)
`node node_modules/vitest/vitest.mjs run`: **42 falhas** em 2.364 testes (11 arquivos falham de 162; 2.319 passam, 3 ignorados).

São as 40 falhas conhecidas mais **2 novas que já existiam antes desta spec**, vindas do commit `65b74723` (27/10, série diária de Conteúdos/Questões): `contratoEnvelopeRpc.test.ts` > `get_gestor_engajamento_conteudos` e `..._questoes` esperam as chaves `arvore, kpis, meses, ...` mas o SQL agora emite também `dias`. Ou seja, o teste e `types-engajamento.ts` ficaram atrás da migration `20261027140000`. **Não é regressão desta spec; fica fora do escopo.** Critério de "nenhuma falha nova" passa a ser: 42 falhas, nenhuma fora desta lista.

| Arquivo | Falhas |
|---|---|
| gestor/__tests__/CascataDiagnostico.test.tsx | 17 |
| test/unit/gestorMigrationsAcessoPorPapel.test.ts | 11 |
| test/unit/gestorMigrationsAvisosAlunoContatoContexto.test.ts | 5 |
| gestor/__tests__/contratoEnvelopeRpc.test.ts | 4 (2 delas são as novas de 27/10) |
| gestor/__tests__/VisaoGeral.test.tsx | 2 |
| Detalhamento, Direcionadores, GestorShell, a11y, regua-unica, gestorMigrationsGetUserIesIdFallback | 1 cada |

Observação: a baseline de 22/10 listava 8 falhas em `gestorMigrationsAcessoPorPapel`; agora são 11 (e 4 em `contratoEnvelopeRpc`, 2 em `VisaoGeral`). Não investiguei a causa dessas diferenças; nenhuma toca a camada `eng_*` nem esta spec (todas já falhavam antes da Fase 1). Vale reconciliar a lista exata com o João antes da Fase 4.

### DoD da Fase 0
- [x] Drift = nenhum.
- [x] As 6 medidas registradas (drift, pg_stat_statements, log, tamanhos/dead, baseline, constraints).
- [x] Oráculo rodado e registrado (difere no dia corrente).
- OK do João: "Prossiga" em 28/10 (após a entrega da Fase 0).

---

## Fase 1: suporte de schema (28/10/2026)

Migration: `supabase/migrations/20261028150000_eng_incremental_fase1_schema.sql`, aplicada em produção com `apply_migration` (name `eng_incremental_fase1_schema`).

**Decisão de implementação:** o CHECK de `disparo` (`cron`/`manual`) fica como está. O incremental grava `disparo = 'cron'` ou `'manual'` e se distingue pela coluna `tipo`. A spec não pede mudar o `disparo`.

### DoD
- [x] **Testes estáticos** (`src/test/unit/engajamentoRefreshIncremental.test.ts`, escritos a partir da spec): 11/11 verdes.
- [x] **No banco:**
  - `pg_indexes`: `eng_questoes_aluno_dia_no_dia_idx`, `eng_consumo_aluno_dia_conteudo_dia_idx` e `eng_refresh_log_tipo_ok_idx` existem.
  - `reloptions` das 3 tabelas: `fillfactor=85, autovacuum_vacuum_scale_factor=0.02, autovacuum_analyze_scale_factor=0.02`.
  - `INSERT` com `status='pulado', tipo='incremental'` + `ROLLBACK`: aceito.
  - Constraints do log agora: `disparo_check`, `status_check` (com `pulado`), `tipo_check`.
- [x] **EXPLAIN** de `DELETE FROM eng_questoes_aluno_dia_no WHERE dia >= eng_hoje()-3`: `Index Scan using eng_questoes_aluno_dia_no_dia_idx` (com `enable_seqscan = off`; sem isso o planejador pode preferir seq scan, pois a janela hoje cobre ~2.000 de 331 mil linhas e o planner decide por estatística).
- [x] **Advisors (security):** 5 lints no projeto; o único que cita `eng_*` é `rls_enabled_no_policy` (INFO), que já existia (RLS ligado sem policy é intencional nas `eng_*`). Nenhum alerta novo.
- [x] **Rebuild roda ok depois da migration:** rodado manualmente em 28/10 (a pedido do João), `eng_refresh_log` id 9, `completo`/`manual`, 16:04:00 a 16:20:17 UTC = **977 s (16m17)**, status `ok`. Contagens: 331.811 linhas em `eng_questoes_aluno_dia_no`, 154.829 em consumo, 70.889 em atividade, 68.408 questões classificadas. O rebuild das 06:00 de 29/10 ainda vale como observação adicional (comportamento não mudou, então o tempo ficou na faixa histórica de 2m30 a 18m23).
- [x] **Oráculo por dia depois do rebuild:** os dias 25, 26 e 27 fecham. O dia corrente (28/10) ainda difere, só por cargas que chegaram **depois** do início do rebuild: 77 a 121 linhas de questões com `carregado_em` > 16:04 UTC (inclusive UPDATEs do `recent_repair`) e a recarga horária do consumo às ~16:22 UTC. Logo depois do fim do rebuild (16:23), a diferença era 19 respostas e 0 de consumo; às 16:45 era 78 respostas e 23 vídeos, só pelo tempo passado. Isso é a regra de T-equiv (diferença explicada por carga concorrente) e é exatamente o que o incremental vai eliminar.
- [x] **Suíte:** 42 falhas = baseline atual (ver Fase 0). O arquivo novo adiciona 11 testes verdes.
- [ ] Commit na branch: ver o commit desta fase.
- OK do João para a Fase 2: pendente.

### Incidente com o job avulso do pg_cron (lição para as Fases 2 e 3)
A receita da spec mãe (§6.5, `cron.schedule('eng-refresh-avulso', '* * * * *', ...)`) **não é segura** para um rebuild que dura 16 min. Enquanto a 1ª execução rodava, o pg_cron enfileirou uma rodada por minuto perdido e, mesmo depois do `cron.unschedule` da 1ª execução, o launcher continuou disparando o job removido (cache em memória), cada disparo iniciando um rebuild novo. Resultado: ~13 rebuilds extras iniciados, **todos cancelados por mim** com `pg_cancel_backend` (nenhum chegou a gravar; o log só tem o id 9; o estado das `eng_*` é o do rebuild 9). Parou depois que criei e removi um job temporário (`eng-tmp-invalida-cache`), o que fez o launcher recarregar a lista. Confirmado: nenhuma rodada nova do job 6 depois de 16:40 UTC.

**Para as próximas fases:** rodar rebuilds avulsos com agenda de **disparo único** (dia e minuto fixos, ex. `'15 17 28 10 *'`) em vez de `* * * * *`, e já deixar o `cron.unschedule` dentro do próprio comando. Ao cancelar, lembrar que `pg_stat_activity` dentro de um `DO` fica congelada: chamar `pg_stat_clear_snapshot()` a cada volta do laço.

### DoD da Fase 1: fechado
Todos os itens marcados. OK do João para a Fase 2: **pendente** (ver mensagem final da sessão).

---

## Fase 2: pipeline parametrizado com diff (28/10/2026)

Migration: `supabase/migrations/20261028160000_eng_incremental_fase2_pipeline.sql`, aplicada com `apply_migration` (name `eng_incremental_fase2_pipeline`). Observação: a versão aplicada no banco não tem os comentários `--` de dentro dos corpos das funções (o conteúdo executável é o mesmo do arquivo no repositório).

Revisor independente (agente só de leitura) conferiu a migration contra P1–P4 e a spec mãe §6.2/§6.4: **sem achado bloqueante**. Achados menores registrados: (1) `atualizado_em`/`classificado_em` só mudam quando a linha muda, então a comparação de equivalência exclui essas colunas; (2) `EXCEPTION WHEN OTHERS` não pega `query_canceled` (statement_timeout do cron, R4 da spec, já era assim); (3) `fonte_max_*`/`fonte_carregado_*` do incremental vêm de `w_resp`/`w_cons` já filtradas pela janela, então a Fase 3 não deve usá-los como marca d'água de carga tardia anterior à janela; (4) o desempate determinístico dos nós é inerte hoje (0 ids com mais de um nome na fonte).

**Decisões de implementação:** a deriva (`*_deriva`) é calculada sempre (com `p_desde = eng_hoje()-3` dá 0 por construção); `eng_refresh_agregados` também grava `fonte_carregado_resp`/`fonte_carregado_cons` (a Fase 5 lê esses campos de qualquer rebuild); `dim_aluno_b2b` só é lida quando `p_desde IS NULL` (P6); a limpeza de `cron.job_run_details` mira só jobs `eng-%` (não toca no histórico dos outros jobs).

### DoD
- [x] **Testes estáticos** (33 no arquivo, 22 novos da Fase 2): verdes.
- [x] **Equivalência com a versão anterior.** Snapshot `eng_qa.antes_*` do estado do rebuild antigo (id 9) tirado antes da migration; rebuild novo = log id 30.
  - Classificação: 0 linhas só no antes; 2 só no depois (2 questões novas classificadas, `classif_inseridas = 2`). Nós de taxonomia: 0 e 0.
  - Fora da janela (`dia < eng_hoje()-3`), `EXCEPT` nos dois sentidos: **0 diferenças** em `eng_atividade_aluno_dia`, `eng_questoes_aluno_dia_no` e `eng_consumo_aluno_dia_conteudo`.
  - Dentro da janela: 34 chaves (aluno, dia) diferentes em atividade, 16 em questões, 16 em consumo; **0 sem explicação** (todas têm linha de fonte com `carregado_em` > 16:04 UTC, início do rebuild 9).
- [x] **Mais rápido que a mediana antiga.** Rebuild novo (id 30): 17:05:00 a 17:08:31 UTC = **211 s**, contra a mediana de **918 s** das 5 últimas antigas (150, 154, 162, 918, 1103). `pg_stat_statements`, delta de uma chamada nova contra a média das 8 antigas: blocos lidos do disco 824 mil (antigo ~1,42 mi), blocos temporários gravados 24 mil (antigo ~224 mil), WAL 80 MB (antigo ~450 MB).
- [x] **Segundo rebuild seguido** (id 31, 17:12:00 a 17:16:58, incluindo ~50 s de espera do lock): deriva 0 nas 3 tabelas e 0 `removidas`. Na janela, as mudanças foram só as de cargas novas entre as duas execuções (classificação +2 inseridas; consumo 0/0; questões 6 inseridas e 7 atualizadas; atividade 1 inserida e 10 atualizadas). `questoes_trocaram_folha = 0` nos dois rebuilds.
- [x] **Lock.**
  - Rebuild espera: com uma sessão segurando `pg_advisory_xact_lock(hashtext('eng_refresh'))` por ~105 s, o rebuild (log id 31) esperou e depois rodou ok; o log nasce antes do lock (iniciado_em 17:12:00).
  - Falha com `lock_timeout`: com o lock segurado por ~11,5 min (job temporário), o rebuild (log id 32) falhou ao fim de **10 min exatos** (17:22:00 a 17:32:00) com `status = 'erro'` e `erro = '55P03: canceling statement due to lock timeout'`, e não escreveu nas `eng_*`. Observação: o teste usou o `lock_timeout` real de 10 min (a função define o próprio `SET LOCAL`, então um timeout curto não dá para injetar de fora).
- [x] **Oráculo por dia** depois do rebuild 31 (17:17 UTC): consumo bate exatamente; questões do dia corrente diferem em 36 respostas, todas de cargas posteriores ao snapshot do rebuild (147 linhas de hoje com `carregado_em` > 17:11:38 UTC, que é o `fonte_carregado_resp` do rebuild). Dias 25 a 27 fecham.
- [x] **Advisors (security):** os mesmos 5 lints de antes; o único que cita `eng_*` é `rls_enabled_no_policy` (INFO, pré-existente). Funções novas: `anon` e `authenticated` sem EXECUTE.
- [x] **Suíte:** rodada completa depois da migration: 43 falhas em 2.397 testes. As 42 da baseline mais **1 nova, esperada**: `engajamentoMigrations.test.ts` > "eng_refresh tem exclusão mútua..." exigia `pg_try_advisory_xact_lock`, que a P4 substitui por `pg_advisory_xact_lock` + `lock_timeout`. Atualizei esse teste para a regra nova; os dois arquivos de migrations do Engajamento passam (105 testes). Resultado final: as mesmas 42 falhas da baseline, nenhuma nova (a suíte inteira não foi rodada de novo depois do ajuste de uma linha de teste).
- [x] `eng_qa` apagado (`DROP SCHEMA eng_qa CASCADE`; confirmado que não existe mais).
- [x] Commit na branch (ver `git log`).
- [ ] OK do João para a Fase 3.

**Deslize meu, sem efeito:** um job de disparo único foi removido antes de disparar (era 17:01, o job era 17:03); reagendei para 17:05 e rodou normalmente.

**Estado do pg_cron ao fim da fase:** só `eng-refresh-diario` (0 9 * * *, jobid 5) segue agendado. Todos os jobs temporários foram removidos.

**Atenção para a Fase 3:** o rebuild noturno **já usa as funções novas** a partir de agora; o próximo é o das 06:00 BRT de 29/10 (jobid 5 chama `eng_refresh('cron')`, que existe com a mesma assinatura). Ele roda com a base já quase em dia, então deve ser curto.

---

## Fase 3: incremental manual, sem cron (28/10/2026)

Migrations (aplicadas com `apply_migration`):
1. `20261028170000_eng_incremental_fase3_incremental.sql` (name `eng_incremental_fase3_incremental`): `eng_delta_questoes(text[], date, smallint)`, `eng_refresh_incremental()` e `eng_refresh_agregados(date)` com a leitura da dim num `IF`.
2. `20261028180000_eng_incremental_fase3_leitura_unica.sql` (name `eng_incremental_fase3_leitura_unica`): `eng_monta_w_resp(date)`, e `eng_refresh_agregados`/`eng_refresh_incremental` passam a ler a janela de respostas uma vez só. **Esta segunda migration não estava prevista**: nasceu da medição de custo (abaixo) e segue a opção que a própria spec deixava para a implementação (§5.2, "montar `w_resp` antes do passo 4").

O disparo do log vem de `application_name`: `pg_cron` grava `disparo = 'cron'`, qualquer outra origem grava `'manual'` (a função não tem parâmetro, como na spec).

### Revisor independente (agente só de leitura)
Sem achado bloqueante. Importantes, todos aceitos:
- **T-delta da spec está em ordem errada.** O passo 2 apaga a classificação de X antes do `-1` do passo 3, e o `-1` descobre a folha por JOIN com a classificação, então não acharia nada. Executei na ordem **`-1` primeiro, depois apagar a classificação**, que é o que o teste quer simular. (A spec §5.3 deve ser corrigida na revisão do João.)
- **P6 violado indiretamente:** o `CASE WHEN p_desde IS NULL THEN (SELECT ... dim_aluno_b2b)` dentro do `SELECT jsonb_build_object` é planejado por inteiro, e o planejamento já trava a relação. Passou a ser `IF p_desde IS NULL THEN SELECT ... INTO v_dim ...; END IF;`. Teste estático garante.
- **Resposta tardia em dia antigo** (fora da janela quente) para uma questão recém-classificada: o `UPDATE` da atividade perderia a contribuição ou quebraria `eng_aad_coerencia_ck`, e o incremental falharia a cada rodada até o rebuild. Agora o delta +1 confere antes de escrever (`respostas_todas >= questoes + delta` para todo (aluno, dia)); se alguma não bate, devolve `delta_adiado = true` e `delta_incoerentes = N` sem escrever (verificado: chamar o `+1` para uma questão já contada devolve `delta_adiado`).
- Menores: o `UPDATE` de atividade no `+1` (em vez de `INSERT ... ON CONFLICT` da spec) é deliberado, porque criar linha de atividade com `respostas_todas = 0` violaria o CHECK; questão com taxonomia inválida (nunca classifica) é reprocessada a cada rodada (hoje são poucas; custo desprezível, medido junto); `question_id` é NOT NULL (confirmado), então o achado do `array_agg(DISTINCT)` com NULL não se aplica.

Erro meu no meio do caminho, corrigido antes de aplicar: um script que gerou a segunda migration trocou `$$` por `$` (comportamento do `String.replace`). Peguei na revisão da leitura do arquivo e acrescentei um teste estático (cada função tem o seu par `$$ ... $$`).

### DoD
- [x] **Testes estáticos:** 59 no arquivo `engajamentoRefreshIncremental.test.ts` (26 da Fase 3), verdes.
- [x] **T-equiv** (a versão de snapshot da spec): rebuild de referência id 33 (17:46:00 a 17:49:35 UTC), snapshot da janela em `eng_qa.snap_*`, incremental logo depois: **0 diferenças** nas 3 tabelas da janela e na classificação. Como não houve carga entre os passos, esse teste sozinho é fraco, então fiz a versão forte:
  - **T-equiv forte:** depois de ~23 incrementais com dados reais (cargas da DAG a cada 5 min, 2 questões novas classificadas), rodei um rebuild total (id 58, 18:14:00 a 18:17:57 = 237 s, com o incremental `pulado` durante ele) e **todas as contagens de diff do rebuild deram 0** (classificação inseridas/atualizadas/removidas, consumo, questões, atividade, deriva e `questoes_trocaram_folha`). O estado que os incrementais deixaram é idêntico ao do rebuild.
- [x] **T-idem:** incrementais id 34 e 35 em sequência (sem carga entre eles): todas as contagens de diff = 0 nos dois.
- [x] **T-delta** (transação com `ROLLBACK`; duas questões, uma `unica` e uma `primeira`, com 153 respostas fora da janela): o `-1` alterou 139 linhas de questões (137 atualizadas e 2 removidas) e 139 de atividade; depois de apagar a classificação, o incremental reclassificou as duas questões **com a mesma folha** e aplicou o `+1`; **0 diferenças em todos os dias** nas duas tabelas. Repetido com o código novo e em `REPEATABLE READ` depois de um incremental em dia: 0/0/0/0. (Uma tentativa intermediária mostrou 7/13/10/11 diferenças: era carga da DAG que chegou depois do rebuild e entrou no recálculo da janela, não falha do delta; a prova foi rodar um incremental antes e repetir.)
- [x] **Oráculo por dia:** 0 linhas logo depois de um incremental (18:19 UTC).
- [x] **Lock:** com o rebuild (id 58) rodando, o incremental gravou `pulado` em **15 ms** (id 59).
- [x] **Custo** (10 execuções; ver abaixo para o que mudou no meio):
  - Lote 1 (ids 37 a 46, antes da otimização, execuções espaçadas em ~15 min com algumas coladas, atravessando cargas da DAG): durações 0,60 · 1,84 · 2,45 · 2,52 · 2,64 · 3,91 · 4,38 · 5,06 · 9,82 · 12,80 s. **Mediana 3,28 s, p95 ≈ 11,5 s, máximo 12,8 s.** Blocos temporários gravados: **0**. WAL: ~2,7 MB por execução (meta < 20 MB). A meta de 5 s não foi atingida; o teto de 15 s da §3.3 também não foi.
  - Diagnóstico: o EXPLAIN da leitura da janela (17,4 mil linhas) mostra 7.249 blocos lidos do disco por varredura (0,6 s a quente), e o incremental varria a janela duas vezes (busca de questões novas + `w_resp`). Classificar 1 questão leva ~0,1 s, o delta ~0,06 s e os agregados da janela ~0,3 s a quente. Os 9,8 s e 12,8 s vieram de leitura de disco logo depois de cargas da DAG (cache pequeno), não de uma etapa lenta.
  - Otimização (migration 2): a janela passa a ser lida uma vez.
  - Lote 2 (ids 47 a 56, depois da otimização): **mediana 0,77 s, p95 2,35 s, máximo 2,89 s**, 0 blocos temporários, ~0,48 MB de WAL por execução. **Ressalva importante:** esse lote foi rodado colado (cache aquecido) e sem dados novos, então é o melhor caso e não é comparável ao lote 1. Não provei que a otimização resolve os picos com carga real. **O p95 que vale é o da Fase 4**, com 24 h de cron a cada 5 min (DoD: p95 < 5 s; a regra de parar é 15 s).
- [x] **Advisors (security):** mesmos 5 lints de antes; o único que cita `eng_*` é `rls_enabled_no_policy` (pré-existente). As 6 funções do pipeline com `anon` e `authenticated` sem EXECUTE.
- [x] **Suíte:** rodada completa depois das migrations: 43 falhas em 2.423 testes. As 42 da baseline mais **1 nova**: `engajamentoMigrations.test.ts` > "toda função public.eng_* revoga de PUBLIC, anon e authenticated na mesma migration". As minhas duas migrations recriavam `eng_refresh_agregados` (e a segunda `eng_refresh_incremental`) sem repetir o `REVOKE` no mesmo arquivo. A ACL no banco já estava certa (`CREATE OR REPLACE` preserva; conferido: `anon` e `authenticated` sem EXECUTE nas 6 funções), mas a regra do teste vale; acrescentei os `REVOKE` aos dois arquivos de migration (no-op no banco, que já tinha esse estado; o texto aplicado e o commitado diferem só por essa linha). Os dois arquivos de migrations do Engajamento passam (131 testes). Resultado final: as mesmas 42 falhas da baseline, nenhuma nova (a suíte inteira não foi rodada de novo depois desse ajuste).
- [x] `eng_qa` apagado; só `eng-refresh-diario` agendado no pg_cron (todos os jobs de teste removidos).
- [ ] OK do João para a Fase 4.

**Desvios do protocolo, a seu critério:**
- A spec pede 10 execuções "espaçadas ao longo de 1 h". Espacei só o primeiro lote (~16 min no total) e fiz o segundo em ~1 min, a pedido do João ("precisa esperar esse tempo todo?"). A amostragem real do p95 fica para a Fase 4.
- Ordem dos passos do T-delta (acima).

**Para a Fase 4:**
- Ligar o cron faz o incremental rodar com `application_name = 'pg_cron'`, o que grava `disparo = 'cron'`.
- O `statement_timeout` do job (90 s) não é capturado pelo `EXCEPTION WHEN OTHERS`: a transação inteira volta e **nem a linha de log `rodando` sobra** (só `cron.job_run_details` registra). Isso já está na spec como R4; vale um alerta no acompanhamento.
- Com o cron ligado, `eng_atualizado_em()` (ainda a versão antiga, `max(terminado_em)` do último `ok`) vai passar a dizer "há 2 min" mesmo que a DAG pare. A Fase 5 corrige. Se a Fase 4 ficar dias em produção antes da Fase 5, o selo "atualizado em" ficará otimista (decisão do João, spec §3.3 item 4).

---

## Fase 4: cron ligado (28/10/2026)

Migration: `supabase/migrations/20261028190000_eng_incremental_fase4_cron.sql`, aplicada com `apply_migration` às 18:29 UTC (15:29 BRT) de 28/10; commit `8fd10c1d`.

Jobs agora no pg_cron (conferido em `cron.job`):

| jobid | nome | agenda (UTC) | comando |
|---|---|---|---|
| 15 | eng-refresh-incremental | `2-59/5 * * * *` | `SET statement_timeout TO '90s'; SET lock_timeout TO '5s'; SELECT public.eng_refresh_incremental();` |
| 16 | eng-refresh-diario | `0 6 * * *` (03:00 BRT) | `SET statement_timeout TO '30min'; SELECT public.eng_refresh('cron');` |
| 17 | eng-vacuum-diario | `40 6 * * *` (03:40 BRT) | `VACUUM (ANALYZE)` das 4 tabelas eng_* |

O job antigo (jobid 5, `0 9 * * *`) foi substituído: o rebuild total passa a rodar às 06:00 UTC. O teste antigo do cron em `engajamentoMigrations.test.ts` passou a olhar a migration mais recente do job e a agenda nova.

### O que já está provado (primeiros 15 min)
- [x] **Testes estáticos** (7 da Fase 4 + o teste antigo do cron atualizado): os 3 jobs com nome, agenda e timeouts exatos, o job das 09:00 UTC não existe mais no estado final, cada job é removido pelo nome antes de ser agendado, o VACUUM é um comando único. 138 testes verdes nos dois arquivos de migrations do Engajamento.
- [x] **Primeiras execuções pelo cron** (18:32, 18:37, 18:42 UTC): `cron.job_run_details` com 3 `succeeded`, 0 falhas; `eng_refresh_log` com 3 linhas `incremental`, `ok`, `disparo = 'cron'` (a detecção por `application_name = 'pg_cron'` funciona), de 7,3 s (a primeira, cache frio), 2,9 s e 2,8 s.
- [x] **Frescor, amostra 1 (18:37 UTC):** `fonte_carregado_resp` do último `ok` a 35 s da carga mais recente da fonte; último evento de consumo da fonte e `max(ultima_abertura)` das `eng_*` idênticos (17:59:37). Maior `dia` das `eng_*` = maior `response_date` da fonte.
- [x] **Frescor, amostra 2 (18:43 UTC):** `fonte_carregado_resp` do último `ok` = `max(carregado_em)` da fonte (18:41:54); **oráculo por dia com 0 linhas**. A spec pede 3 amostras em horários diferentes; a terceira (e as de outras horas do dia) ficam para a observação.
- [x] **Foto antes de ligar o cron (referência para o bloat e as RPCs):**

| Tabela | Bytes | n_dead_tup |
|---|---|---|
| eng_atividade_aluno_dia | 20.963.328 | 10 |
| eng_consumo_aluno_dia_conteudo | 102.825.984 | 0 |
| eng_questoes_aluno_dia_no | 268.034.048 | 120 |
| eng_questao_classificacao | 49.438.720 | 8 |

  **Atenção ao bloat:** as 3 tabelas de agregado somam 391,8 MB, **+9,3%** sobre os 358,6 MB da Fase 0 (o teto do DoD é +10% = 394,5 MB), embora as linhas quase não tenham crescido (+0,1%). O crescimento veio dos rebuilds e incrementais das Fases 2 e 3 (atualizações que não são HOT, páginas novas). O VACUUM diário não encolhe o arquivo, só permite reuso do espaço. Vale ficar de olho: se passar de +10%, a regra é parar e perguntar (a spec lista o bloat como medida, não como item de §3.3, então o critério é do João).

  RPCs, snapshot de `pg_stat_statements` antes do cron (acumulado desde o lançamento, para o delta da observação): visão geral 141 chamadas, média 2.497 ms, máx 7.935 ms, 700 mil blocos lidos; questões 32 chamadas, média 1.288 ms; conteúdos 36 chamadas, média 1.948 ms; admin 16 chamadas, média 1.022 ms.

### O que depende da observação de 24 h (pendente)
A spec exige 24 h com uma madrugada incluída. A primeira madrugada depois da migration é a de 29/10: rebuild às **06:00 UTC (03:00 BRT)** e VACUUM às 06:40 UTC. A janela de 24 h fecha em **29/10 ~18:30 UTC (15:30 BRT)**. Consultas prontas para esse checkpoint (todas de leitura):

```sql
-- saúde: incremental (>= 280 linhas ok em 24 h; p95 < 5 s; pulado só no horário do rebuild), completo e cron
SELECT tipo, status, count(*), max(terminado_em),
       percentile_cont(0.95) WITHIN GROUP (ORDER BY extract(epoch FROM terminado_em - iniciado_em)) p95_s
FROM eng_refresh_log WHERE iniciado_em > now() - interval '24 hours' GROUP BY 1, 2;
SELECT j.jobname, d.status, count(*) FROM cron.job_run_details d JOIN cron.job j USING (jobid)
WHERE j.jobname LIKE 'eng-%' AND d.start_time > now() - interval '24 hours' GROUP BY 1, 2;   -- 0 falhas
-- bloat: n_dead_tup estável e as 3 tabelas até +10% da Fase 0 (394.456.269 bytes = 358.596.608 x 1,1)
SELECT relname, n_live_tup, n_dead_tup, last_autovacuum, pg_total_relation_size(relid) FROM pg_stat_user_tables WHERE relname LIKE 'eng_%';
-- rebuild noturno: duração < 20 min; deriva < 0,5% (consumo_deriva, questoes_no_deriva, atividade_deriva no contagens da linha do rebuild das 06:00 UTC)
SELECT id, status, round(extract(epoch FROM terminado_em - iniciado_em)) dur_s, contagens FROM eng_refresh_log WHERE tipo = 'completo' ORDER BY id DESC LIMIT 2;
```

- [ ] `cron.job_run_details`: 0 falhas nos 3 jobs em 24 h.
- [ ] `eng_refresh_log` incremental: >= 280 linhas `ok` em 24 h; p95 < 5 s; `pulado` só no horário do rebuild.
- [ ] Rebuild noturno: `ok`, duração < 20 min, deriva < 0,5% (§3.3).
- [ ] Frescor: 3 amostras em horários diferentes (feitas 2, ambas no começo da tarde de 28/10).
- [ ] Bloat: `n_dead_tup` estável e tamanho das 3 tabelas até +10% da Fase 0.
- [ ] RPCs: novo snapshot de `pg_stat_statements` com o delta desde a Fase 0 (a média da visão geral não pode piorar).
- [x] DoD comum, verificado hoje: (a) suíte completa depois da Fase 4: 42 falhas em 2.430 testes, a mesma lista da baseline, nenhuma nova; (b) advisors de segurança: os mesmos 5 lints, só `rls_enabled_no_policy` cita `eng_*` (pré-existente); (c) oráculo por dia com 0 linhas às 18:43 UTC; (d) commits `8fd10c1d` e este registro.
- [ ] OK do João para dar a Fase 4 por fechada.

**A Fase 5 virá logo depois** (aviso do João de 28/10). Pelo que a spec diz, o **código** da Fase 5 (migration escrita mas não aplicada, hook, layout, testes) pode ser feito já, em paralelo à observação; a **aplicação** da migration da Fase 5 espera o DoD da Fase 4.
