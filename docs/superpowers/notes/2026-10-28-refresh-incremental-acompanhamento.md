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
| test/unit/gestorMigrationsAcessoPorPapel.test.ts | 8 |
| test/unit/gestorMigrationsAvisosAlunoContatoContexto.test.ts | 5 |
| gestor/__tests__/contratoEnvelopeRpc.test.ts | 4 (2 delas são as novas de 27/10) |
| gestor/__tests__/VisaoGeral.test.tsx | 2 |
| Detalhamento, Direcionadores, GestorShell, a11y, regua-unica, gestorMigrationsGetUserIesIdFallback | 1 cada |

Correção (29/10): a tabela acima tinha "11" em `gestorMigrationsAcessoPorPapel` por causa de linhas duplicadas na minha primeira contagem. Contando testes únicos por arquivo, são **8** (igual à baseline de 22/10) e o total fecha em 42 (17 + 8 + 5 + 4 + 2 + 6 de 1 falha cada). Nenhuma falha toca a camada `eng_*` além das 2 de `contratoEnvelopeRpc` herdadas do commit `65b74723` de 27/10. A lista é a mesma nas execuções das Fases 0, 2 (depois do ajuste), 3, 4 e 5.

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

---

## Fase 4: leitura parcial da observação (29/10/2026, 12:12 UTC, 17,7 h de 24)

Janela: de 28/10 18:29 UTC (cron ligado) até agora. **A observação de 24 h só fecha em 29/10 ~18:30 UTC**; esta é uma leitura intermediária, não o DoD.

| Item do DoD | Parcial | Situação |
|---|---|---|
| `cron.job_run_details`: 0 falhas | 213 incrementais + 1 rebuild + 1 VACUUM, todos `succeeded` | ok até agora |
| Incremental: >= 280 `ok` em 24 h | 213 em 17,7 h (12 por hora, nenhuma perdida) → ~288 em 24 h | no ritmo |
| Incremental: p95 < 5 s | **p95 = 6,98 s**, mediana ~4 s, máximo 14,2 s | **acima da meta**, abaixo do teto de 15 s da §3.3 |
| `pulado` só no horário do rebuild | **0 `pulado`**; o incremental das 06:02 foi **adiado**, não pulado (ver abaixo) | ok |
| Rebuild noturno: ok, < 20 min | id 202, 06:00:00 a 06:02:43 UTC = **163 s**, `ok` | ok |
| Rebuild noturno: deriva < 0,5% (§3.3) | `questoes_no_deriva = 10` de ~332 mil linhas = **0,003%**; consumo e atividade 0 | ok |
| VACUUM diário | rodou às 06:40 UTC, `succeeded` | ok |

**Rebuild noturno (id 202):** reclassificou **11 questões** que já estavam classificadas (`questoes_trocaram_folha = 11`, `classif_atualizadas = 11`), o que gerou as 10 linhas de deriva. É exatamente o papel do rebuild de rede de segurança (decisão I5: o incremental nunca reclassifica); não é defeito.

**Incremental das 06:02:** o `cron.job_run_details` mostra que o pg_cron só **iniciou** o job às 06:02:47.131, meio segundo depois de o rebuild (jobid 16) terminar (06:02:46.649). Ou seja, o pg_cron segurou a rodada das 06:02 até o rebuild acabar e ela rodou normalmente (3,5 s). Não houve rodada perdida e nenhuma linha `pulado` (a spec previa `pulado` nesse horário; o resultado é melhor).

**p95 do incremental acima de 5 s.** Distribuição das 213 execuções por faixa de duração (s): 2 a 3: 2 · 3 a 4: 55 · 4 a 5: 88 · 5 a 6: 42 · 6 a 7: 11 · acima de 7: 15 (máximo 14,2 s). Por hora, a média fica em 3,1 a 4,9 s, com picos de 11,9 s (23h), 14,2 s (01h) e 12,3 s (02h UTC). Por minuto da hora, a média vai de 3,5 s a 4,6 s em todos os minutos, **sem relação com o horário das cargas da DAG** (:01/:06 das questões, :25 do consumo): não é colisão com a carga. É leitura de disco a frio (~23 mil blocos por rodada; o cache de 256 MB é expulso entre uma rodada e outra). O lote de laboratório da Fase 3, com cache aquecido, deu mediana de 0,8 s; em produção, com 5 min entre rodadas, o custo típico é ~3,5 a 4 s.
- Não passa do teto de 15 s da §3.3 item 2 (máximo 14,2 s, **apertado**), então não é "parar e perguntar" pela regra; o que falha é a meta de 5 s do DoD da Fase 4.
- Folga: 7 s é ~2% do intervalo de 5 min; o incremental não concorre consigo mesmo.
- Caminho para ficar < 5 s: um índice **de cobertura** em `fato_resolucao_questoes_b2b(response_date) INCLUDE (...)` permitiria varrer a janela sem ler a linha inteira (jsonb pesado). É tabela da DAG: §3.3 item 5 manda perguntar ao João e ao time de dados antes de qualquer índice. Já está na lista de trabalho futuro da spec (§8, "BRIN"), mas um índice de cobertura rende mais.

**Pendente para o checkpoint de 29/10 ~18:30 UTC:** fechar as 24 h (contagem de 280 `ok`, p95 final), o bloat (foto das tabelas contra o teto de 394.456.269 bytes; estava em +9,3% às 18:29 do dia 28), o snapshot de `pg_stat_statements` das RPCs com o delta desde a Fase 0 e a terceira amostra de frescor. A decisão sobre o p95 é do João.

---

## Fase 5: código pronto, migration NÃO aplicada (29/10/2026)

Por decisão do João (28/10: "Sim, código da Fase 5"), o código da Fase 5 foi escrito em paralelo à observação da Fase 4. A **migration só será aplicada depois do DoD da Fase 4** (spec §7). Nada da Fase 5 foi aplicado em produção.

Arquivos:
- `supabase/migrations/20261029120000_eng_incremental_fase5_versao.sql` (**não aplicada**): `eng_atualizado_em()` nova (o menor entre `terminado_em` do último `ok` e `fonte_carregado_resp`/`fonte_carregado_cons` da mesma linha; `LEAST` ignora NULL, então linhas antigas valem pelo `terminado_em`) e a RPC `get_gestor_engajamento_versao(p_ies_id uuid)` com `{ data: { atualizadoEm }, meta }`, na ordem papel → `v_ies` → `gestor_pode_acessar_ies`, sem período, `GRANT` a `authenticated`.
- `src/features/gestor/api/engajamento.ts`: `useEngajamentoVersao(iesId)` e `INTERVALO_VERSAO_ENGAJAMENTO_MS = 120_000`. Consulta a cada 2 min, só com a aba visível (`refetchIntervalInBackground: false`), e quando `atualizadoEm` muda invalida `['gestor', user.id, 'engajamento']` **menos** a chave de versão (via `predicate`). A primeira leitura de cada IES só é memorizada; trocar de IES não conta como mudança.
- `src/features/gestor/api/types-engajamento.ts`: `VersaoEngajamento`.
- `src/features/gestor/routes/engajamento/EngajamentoLayout.tsx`: chama o hook uma vez, com `filtros.iesId`.

Testes:
- **Unitário** (`useEngajamentoVersao.test.tsx`, relógio falso, 10 casos): consulta a cada 2 min; não consulta com a aba oculta; invalida quando `atualizadoEm` muda; não invalida quando não muda; não invalida a própria chave; não invalida outros módulos nem outro usuário; versão nula depois preenchida conta como mudança; sem IES ou sem usuário não consulta; trocar de IES não conta como mudança. **Teste de mutação:** removi o `predicate` e o caso "não invalida a própria chave" falhou (a primeira versão desse caso era vazia: uma consulta ativa invalidada é refeita na hora e o `isInvalidated` volta a `false`, então o sinal certo é contar chamadas à RPC; corrigido).
- **Estático** (`engajamentoRefreshIncremental.test.ts`, 15 casos novos): a função e a RPC da migration, mais o front (intervalo, `predicate`, uso único no layout, tipo).
- **Enumeração de RPCs** (`engajamentoMigrations.test.ts`): passou de 9 para 10 RPCs; a de versão tem `SEM_PERIODO` (não valida datas) e assinatura `uuid`.
- **Contrato** (`contratoEnvelopeRpc.test.ts`): `get_gestor_engajamento_versao` × `VersaoEngajamento` = `['atualizadoEm']`.
- **Layout** (`EngajamentoLayout.test.tsx`): o mock do módulo passou a expor o hook novo e há um caso novo (o layout chama o hook com a IES do recorte). Os demais casos do layout seguem verdes.

Verificação: TypeScript sem erros (`tsc --noEmit -p tsconfig.app.json`); conjunto do Engajamento 21 arquivos / 613 testes verdes; suíte completa: **42 falhas em 2.462 testes, a mesma lista da baseline, nenhuma nova**.

Erro meu durante o trabalho: o helper de teste ficou com um caractere de controle (backspace, código 8) na regex por causa do escape do heredoc; peguei porque os testes da Fase 2 passaram a falhar em massa, corrigi e confirmei que não restam caracteres de controle no arquivo.

**Falta para fechar a Fase 5 (depende da Fase 4):**
- [ ] Aplicar a migration (`apply_migration`) depois do DoD da Fase 4.
- [ ] No banco: com a última linha `ok` tendo `fonte_carregado_cons` 1 h atrás, `eng_atualizado_em()` devolve esse valor; gestor de outra IES recebe erro de acesso na RPC de versão.
- [ ] QA na PARACATU pelo navegador: com a tela aberta, o selo "atualizado em" avança sozinho em <= 7 min, sem recarregar; uma questão resolvida por um aluno de teste aparece nas contagens em <= 35 min.
- [ ] DoD comum (advisors, oráculo, suíte) depois de aplicar.

---

## Decisão do João sobre o p95 do incremental (29/10/2026)

O João **aceitou o p95 de ~7 s** como desvio da meta de 5 s do DoD da Fase 4, sem pedir índice ao time de dados. Motivos registrados: o máximo medido (14,2 s) fica abaixo do teto de 15 s da §3.3 item 2, o custo é ~2% do intervalo de 5 min e o incremental não concorre consigo mesmo.

- O índice de cobertura em `fato_resolucao_questoes_b2b(response_date) INCLUDE (...)` fica como **trabalho futuro** (§8 da spec), dependente do time de dados.
- A regra de parar continua valendo: se o **p95 final das 24 h** passar de **15 s**, ou o rebuild noturno passar de 20 min, ou a deriva noturna passar de 0,5% em 3 noites seguidas, parar e perguntar (§3.3).
- O item "p95 < 5 s" do DoD da Fase 4 passa a ser registrado como **desvio aceito**, não como cumprido.

Próximo passo combinado: fechar as 24 h da Fase 4 no checkpoint de 29/10 (~18:30 UTC, 15:30 BRT) e, em seguida, aplicar a migration da Fase 5, verificar no banco e fazer o QA na PARACATU.

---

## Fase 4: checkpoint das 24 h (feito em 30/10/2026, ~15:10 UTC)

O agendamento da conferência automática (29/10 15:33) não rodou, porque a sessão não estava aberta; o checkpoint foi feito a pedido do João em 30/10, com a janela das 24 h recortada em 28/10 18:29 UTC a 29/10 18:29 UTC e os dados seguintes registrados à parte.

| Item do DoD | Resultado | Situação |
|---|---|---|
| Testes estáticos, DoD comum (suíte, advisors, oráculo, commit) | feitos em 28/10 e revalidados nas Fases 5 | ok |
| `cron.job_run_details`: 0 falhas nos 3 jobs | desde 28/10 18:29: incremental 536 `succeeded`, rebuild 2, VACUUM 2; **0 falhas** | ok |
| Incremental: >= 280 `ok` em 24 h | **288** `ok` na janela das 24 h; 0 `erro`, 0 `pulado` | ok |
| Incremental: p95 < 5 s | janela das 24 h: mediana 3,63 s, **p95 6,74 s**, máx 14,2 s. Desde o início (535 execuções): p95 6,82 s, **máx 20,2 s** (uma execução, fora da janela das 24 h) | **desvio aceito pelo João em 29/10** |
| Rebuild noturno ok, < 20 min | 29/10: 163 s; 30/10: 174 s | ok |
| Deriva do rebuild < 0,5% | 29/10: 10 linhas de ~558 mil = 0,0018% (11 questões reclassificadas); 30/10: 0 | ok (a regra "3 noites seguidas" não disparou) |
| Frescor, 3 amostras | 28/10 18:37 e 18:43, 30/10 15:07 UTC: `fonte_carregado_resp` do último `ok` = `max(carregado_em)` da fonte (diferença de 35 s, 0 s e 0 s); consumo das `eng_*` = último evento da fonte; **oráculo com 0 linhas nas 3** | ok |
| Bloat: `n_dead_tup` estável e <= +10% | 3 tabelas de agregado somam 391.946.240 bytes = **+9,30%** sobre a Fase 0 (teto 394.456.269); era 391.823.360 em 28/10 (+122.880 bytes em 2 dias). `n_dead_tup`: 25 / 0 / 76 / 19. VACUUM diário rodou 2 vezes | ok |
| RPCs: a média da visão geral não piora | **não atendido** pelos dados disponíveis (ver abaixo) | **pendente de decisão do João** |

Nota sobre a interpretação do frescor "a no máximo 10 min da fonte": usei o `fonte_carregado_resp` do log do último incremental contra `max(carregado_em)` da fonte (mede o atraso do pipeline) e `max(ultima_abertura)` das `eng_*` contra o último evento de consumo da fonte. O horário do próprio evento de consumo é anterior à carga (a DAG de consumo carrega de hora em hora), e isso é atraso da DAG, não do pipeline.

### RPCs: o critério "a média da visão geral não piora" NÃO foi atendido
`pg_stat_statements` (acumulado desde o lançamento) para `get_gestor_engajamento_visao_geral`:

| Momento | Chamadas | Média | Blocos lidos |
|---|---|---|---|
| Fase 0 (28/10, antes de tudo) | 128 | 2.259 ms | 579.009 |
| Antes de ligar o cron (28/10 18:29 UTC) | 141 | 2.497 ms | 700.064 |
| Agora (30/10) | 146 | **2.611 ms** (+15,6% sobre a Fase 0) | 753.568 |

As 5 chamadas feitas depois de o cron ligar somam ~29 s, **~5,8 s por chamada** e ~10,7 mil blocos por chamada (histórico: ~4,5 mil). Outras RPCs: `alunos` 168 → 239 ms; `questoes` 1.288 → 1.270 ms; `conteudos` 1.948 → 1.909 ms; `admin` 1.022 → 1.013 ms.

Limites da evidência: são só 5 chamadas, o uso do painel é baixo e os logs do Supabase só guardam 24 h (sem nenhuma chamada dessas RPCs nesse período), então não há tempo por chamada para separar antes e depois do cron.

Medição controlada (simulando um admin autenticado, PARACATU, 01/05 a 30/10, sem escrever nada): 1ª chamada **6,8 s** (frio), 2ª 1,4 s, 3ª a 5ª **~155 ms** (quente). Dentro da mesma transação de um incremental os números ficaram ruidosos (0,26 s a 16 s) e não valem.

Explicação provável: cada incremental lê ~16 mil blocos (~123 MB) com `shared_buffers` de 256 MB, então expulsa páginas das `eng_*` entre uma consulta do gestor e outra. A spec previa o contrário ("espera-se que melhore"), porque o rebuild diário expulsava o cache só 1x/dia. Com o incremental a cada 5 min, a primeira consulta depois de uma rodada tende a pegar cache frio (~7 s); com cache quente é ~0,15 s.

Opções (decisão do João):
1. **Aceitar** como desvio: uso baixo, a 2ª consulta já é rápida, e o ganho de frescor (tela de até 5 min, não de até 24 h) é o objetivo da spec.
2. **Reduzir a pegada de cache do incremental** (menos blocos por rodada): possível mexendo na consulta de questões novas e no `w_cons`, ganho incerto.
3. **Instância maior** (já listada na §8 da spec): resolve de vez, tem custo.

Importante para a Fase 5: o hook novo faz a tela aberta refazer as consultas do Engajamento quando a versão muda (até a cada ~5 min por aba aberta), o que aumenta o número de chamadas à visão geral. A decisão acima pesa mais agora.

**Status da Fase 4:** todos os itens do DoD cumpridos, **com dois desvios**: o p95 (aceito pelo João) e a média da visão geral (aguardando decisão). Não marco a Fase 4 como fechada até a decisão sobre o segundo.

---

## Fase 5: migration aplicada e verificada no banco (30/10/2026)

Migration `20261029120000_eng_incremental_fase5_versao.sql` aplicada com `apply_migration` (name `eng_incremental_fase5_versao`) em 30/10, a pedido do João ("já podemos fechar a Fase 4 e 5"). Isso foi feito **antes de a decisão sobre a média da visão geral** (item acima), que não bloqueia a Fase 5 tecnicamente.

Verificação no banco (tudo em transações revertidas, sem deixar dado):
- [x] **`eng_atualizado_em()`**: com uma linha `ok` simulada com `fonte_carregado_cons` 1 h atrás, devolve exatamente esse valor (diferença de 8 µs da referência); com uma linha sem as chaves `fonte_carregado_*`, devolve o `terminado_em` dela. **Valor real hoje:** 14:20:59 UTC (a carga de consumo), não 15:07 (o fim do último refresh): o selo agora mostra o horário da fonte mais atrasada, como a spec manda.
- [x] **`get_gestor_engajamento_versao`**, simulando cada papel:
  - gestor, própria IES: OK, devolve `{ data: { atualizadoEm }, meta }`;
  - gestor, `p_ies_id` nulo: OK (resolve a IES dele);
  - **gestor, outra IES: `Permission denied: cannot access this IES`**;
  - admin, qualquer IES: OK;
  - usuário sem papel: `Access denied`; sem login: `Access denied`.
- [x] Privilégios: `get_gestor_engajamento_versao` com `authenticated` sim e `anon` não; `eng_atualizado_em` sem EXECUTE para ambos.
- [x] **Advisors (security):** 5 lints, os mesmos tipos de antes, nenhum novo. A lint "SECURITY DEFINER executável por `authenticated`" lista as RPCs de Engajamento: eram 10 (115 achados), agora são 11 (116), porque a nova RPC entra no mesmo padrão das outras 9, por desenho.
- [x] **Oráculo por dia: 0 linhas** depois de aplicar.
- [x] **Suíte:** sem mudança de código depois da última rodada completa (42 falhas, a mesma lista da baseline).

**Correção de uma afirmação minha nas Fases 1 a 4:** escrevi que "o único alerta que cita `eng_*` é `rls_enabled_no_policy`". O filtro que usei procurava a string `eng_`, que não casa com `get_gestor_engajamento_*` (as RPCs de Engajamento não começam com `eng_`). Elas já apareciam na lint de `SECURITY DEFINER` desde o Bloco B (10 funções, 115 achados). O resultado "nenhum alerta novo" continua verdadeiro: as contagens por tipo de lint eram as mesmas.

Falta para fechar a Fase 5:
- [ ] **QA na PARACATU pelo navegador**: com a tela aberta, o selo "atualizado em" avança sozinho em <= 7 min, sem recarregar; uma questão resolvida por um aluno de teste aparece nas contagens em <= 35 min. O servidor de desenvolvimento (`dev-node`, porta 8080, aponta para o Supabase de produção) está no ar e a aba do painel abriu na tela de login: **o QA depende de o João entrar no app** (não digito credenciais). O front da Fase 5 ainda não está em produção (não foi mergeado), então o QA é no servidor local.
- [ ] OK do João para dar a Fase 5 por fechada.

---

## Decisão do João sobre a média da visão geral (30/10/2026)

O João **aceitou o desvio** do critério "a média da visão geral não piora" (média global +15,6% sobre a Fase 0; a 1ª consulta depois de uma rodada do incremental pega cache frio, ~7 s, e as seguintes levam ~0,15 s). Opções 2 (reduzir a leitura do incremental) e 3 (instância maior) ficam como trabalho futuro (§8 da spec).

**Fase 4: FECHADA**, com dois desvios aceitos pelo João: o p95 do incremental (6,74 s contra a meta de 5 s, decisão de 29/10) e a média da visão geral (+15,6%, decisão de 30/10). Os demais itens do DoD foram cumpridos (ver o checkpoint acima).

---

## Fase 5: achado no QA, correção e fechamento (30/10/2026)

### Achado: o sinal de invalidação da spec não funciona sozinho
No QA da PARACATU, com o hook como a spec descreve (comparar `atualizadoEm`), a tela **não se atualizava**: `atualizadoEm` é o MENOR entre o fim do refresh e as cargas das fontes, e o consumo só carrega de hora em hora, então ele ficou em **14:20:59 por 6 rodadas seguidas (15:02 a 15:27 UTC)** enquanto a carga de questões avançava a cada 5 min e os dados da PARACATU mudavam (147.871 → 147.885 questões no banco; a tela ficou em 147.871 até um refetch por foco da aba). Do jeito que a spec define (§5.4), a tela só se atualizaria sozinha 1x por hora e o critério "questão em <= 35 min" não fecharia.

**Correção** (migration `20261030170000_eng_incremental_fase5_versao_dos_dados.sql`, aplicada em 30/10; só acrescenta uma chave, então é compatível com o hook anterior):
- `eng_versao_dados()` (nova): a **maior** carga de fonte lida pela última linha ok e o `terminado_em` do último rebuild total (que pode reclassificar). Só lê a última linha ok e o índice parcial `(tipo, terminado_em) WHERE status = 'ok'`; `STABLE`, sem EXECUTE para `anon`/`authenticated`.
- `get_gestor_engajamento_versao` passa a devolver `{ data: { atualizadoEm, versao }, meta }`. O selo continua sendo o `atualizadoEm` (a fonte mais atrasada, R6); só o sinal da tela mudou.
- Hook `useEngajamentoVersao` compara `versao` (reserva: `atualizadoEm`, se a RPC não trouxer `versao`). Tipo `VersaoEngajamento` ganhou `versao`.
- A spec (§5.4) e a ordem dos passos do T-delta (§5.3, achado do revisor da Fase 3) foram corrigidas.

Testes do achado: 3 casos novos no unitário do hook (13 no total): invalida quando só a `versao` muda com `atualizadoEm` parado; não invalida quando só o `atualizadoEm` muda; com a RPC antiga cai para o `atualizadoEm`. **Mutação:** com o hook voltando a comparar `atualizadoEm`, 2 testes falham. Estáticos: `eng_versao_dados` (maior carga, não o menor; sem varrer fonte; REVOKE) e a RPC devolvendo os dois campos; contrato do envelope com `['atualizadoEm', 'versao']`.

### QA na PARACATU no navegador (servidor `dev-node` local, Supabase de produção, 30/10)
O João entrou no app no painel. Medições na aba visível, sem recarregar a página:
- **Consulta de versão:** a cada 2 min (15:46:25 e 15:48:25 no relógio da página, que fica ~70 s atrás do banco), ~115 a 235 ms cada.
- **Tela atualiza sozinha só quando a versão muda:** no ciclo observado, a `versao` passou de 15:41:36 para 15:46:54, a tela refez alunos e visão geral **uma vez** (a visão geral levou 7 a 8 s, cache frio) e a consulta seguinte, com a mesma versão, não fez nada além da chamada de versão.
- **Selo "atualizado em" avança sozinho em <= 7 min:** a carga de consumo da DAG caiu às **15:37:10** e o selo passou de "30/10/2026, 11:20" para **"12:37"** às ~15:42:40 (página): **~5,5 min** depois, sem recarregar. Como o selo é o menor das fontes, ele só anda quando o consumo carrega; o critério vale a partir de uma carga de consumo.
- **Questão resolvida aparece nas contagens em <= 35 min:** em vez de um aluno de teste, usei respostas reais da PARACATU. Duas respostas, dadas às 15:21:32 e 15:24:59 UTC, entraram no banco às 15:46:18 (atraso da DAG de 21,3 a 24,8 min, no padrão documentado) e o KPI "Questões resolvidas" subiu na tela por volta das 15:47:40: **evento → tela em ~23 a 26 min**, dos quais **~1,5 min são do nosso pipeline** (incremental + consulta de versão). A tela e o banco bateram em todas as leituras (147.885, 147.891, 147.897).
- Observação: o painel automatizado alterna a visibilidade da aba (`hidden`/`visible`) quando recebe comandos, e a janela fica sem foco. Isso pode causar refetches por foco que não são do hook; não afetam o resultado acima. O front da Fase 5 só roda no servidor local (ainda não foi mergeado), então o QA não foi feito em produção.

### DoD da Fase 5
- [x] **Testes** (13 do hook, 83 no arquivo estático da refresh incremental, enumeração e contrato atualizados, layout verde): verdes.
- [x] **No banco:** `eng_atualizado_em()` com `fonte_carregado_cons` 1 h atrás devolve esse valor; gestor de outra IES recebe `Permission denied: cannot access this IES`; sem papel e sem login recebem `Access denied` (verificado antes e depois da correção; a correção só acrescenta uma chave).
- [x] **QA na PARACATU** (acima): selo avança em ~5,5 min; evento → tela em ~23 a 26 min.
- [x] **DoD comum:** suíte completa depois da correção: **42 falhas em 2.469 testes**, o mesmo perfil da baseline (17 + 8 + 5 + 4 + 2 + 6 de uma falha cada, contado por teste único), nenhuma nova. As únicas falhas de Engajamento são as 2 de `contratoEnvelopeRpc` herdadas de 27/10 (chave `dias`). TypeScript sem erros nos arquivos da fase na rodada anterior. Advisors (segurança): os mesmos 5 tipos, sem alerta novo; oráculo com 0 linhas depois de aplicar.
- [x] Migrations aplicadas: `20261029120000_eng_incremental_fase5_versao` e `20261030170000_eng_incremental_fase5_versao_dos_dados`.

**Fase 5: FECHADA**, com a correção acima em relação à spec.

---

## Estado final (30/10/2026)
- Cron em produção: `eng-refresh-incremental` (a cada 5 min, minuto 2), `eng-refresh-diario` (06:00 UTC) e `eng-vacuum-diario` (06:40 UTC). Nenhum job temporário restou.
- Funções do pipeline: `eng_refresh`, `eng_refresh_classificacao(text[])`, `eng_refresh_agregados(date)`, `eng_monta_w_resp(date)`, `eng_delta_questoes`, `eng_refresh_incremental`, `eng_atualizado_em`, `eng_versao_dados`; RPC `get_gestor_engajamento_versao`.
- **Pendente fora desta spec:** o código do front (hook, tipo, layout) e as migrations estão na branch `feat/engajamento-sanarflix`, **sem push nem PR**. Em produção o banco já está com tudo; a tela publicada só passa a se atualizar sozinha depois do merge e do deploy do front.
- Dois testes de contrato (`get_gestor_engajamento_conteudos` e `_questoes`, chave `dias`) seguem quebrados desde 27/10, fora do escopo; vale uma tarefa à parte.
- Trabalho futuro (§8): chamar `eng_refresh_incremental()` do fim da carga da DAG, índice de cobertura na fato de questões, instância maior, painel de saúde do pipeline.
