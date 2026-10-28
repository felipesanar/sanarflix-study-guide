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
- [ ] **Rebuild das 06:00 BRT do dia seguinte roda ok** (29/10): pendente. Ainda não rodei rebuild manual.
- [ ] **Oráculo por dia = 0 linhas depois do último refresh da fase:** pendente pelo mesmo motivo (o último refresh foi às 09:00 UTC de 28/10, antes da migration; o dia corrente segue defasado, como na Fase 0).
- [x] **Suíte:** 42 falhas = baseline atual (ver Fase 0). O arquivo novo adiciona 11 testes verdes.
- [ ] Commit na branch: ver o commit desta fase.
- OK do João para a Fase 2: pendente.
