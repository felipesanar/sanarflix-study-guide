# Engajamento SanarFlix no Academy — Plano de implementação

> **Para agentes:** execute tarefa por tarefa, **na ordem**. Os passos usam checkbox (`- [ ]`). Marque cada um ao concluir e commite o plano atualizado junto com o código da tarefa. Não pule o **Portão A→B**.

**Objetivo:** dar ao gestor da IES a seção **Engajamento** e ao time interno a tela **Admin › Engajamento SanarFlix**.
- Gestor: aba Visão geral, aba Questões e aba Conteúdos, no Portal do Gestor v2.
- Fonte: as três tabelas B2B do SanarFlix (`dim_aluno_b2b`, `fato_consumo_conteudo_b2b`, `fato_resolucao_questoes_b2b`).
- Os totais têm que fechar em toda a tela.

**Arquitetura:**
- **Camada derivada `eng_*`** no Postgres:
  - classificação principal por questão;
  - agregados por aluno × dia, aluno × dia × nó e aluno × dia × conteúdo.
- **Refresh:** recalculada 1× ao dia por `pg_cron`.
- **RPCs:** 9 `get_gestor_engajamento_*` e 1 `get_admin_engajamento`, todas `SECURITY DEFINER` e lendo **só** a camada `eng_*`.
- **Front React:** consome apenas essas RPCs.

**Stack:** Postgres 17 (Supabase `gvqvrmkizemwsasmupmo`), React 18 + Vite + TS, React Query v5, shadcn/ui + Tailwind, vitest + Testing Library.

**Spec (fonte de toda regra, SQL e texto):** `docs/superpowers/specs/2026-10-22-engajamento-sanarflix-design.md`. Neste plano, "§N" é seção da spec.

**Ordem obrigatória:**
1. **Bloco A — back-end inteiro.**
2. **Portão A→B:** checklist assinado pelo João.
3. **Bloco B — front-end.** Nenhuma tarefa do Bloco B cria ou altera tabela, função ou RPC. Se o front precisar de um campo que a RPC não devolve, **pare e avise o João**.

---

## Restrições globais

### Ambiente

- Pasta: `C:\Users\joao.nader\work\sanarflix-engajamento` (worktree). Branch: `feat/engajamento-sanarflix`.
  - **Nunca** crie outra branch ou worktree.
  - **Nunca** commite na `main`.
  - **Não toque** em `C:\Users\joao.nader\work\sanarflix-principal` nem nas outras pastas de `work\`.
  - Não use a cópia do OneDrive.
- Supabase de produção: `gvqvrmkizemwsasmupmo`. Confirme o ref (`get_project`) antes de qualquer query.
- `list_tables` mente na contagem de linhas. Use `count(*)`.

### Migrations (todas exigem o João)

- **Cada migration** precisa de "ok" explícito do João **para aquela migration**, no chat, antes do `apply_migration`. Aprovação de uma não vale para a próxima.
- `apply_migration` pode ser barrada pelo classificador do auto mode como "Production Deploy". Se acontecer, peça ao João para trocar o modo de permissão da sessão. Não tente contornar.
- Antes de toda migration, confira que nenhum objeto com o mesmo nome existe (drift), com a consulta da tarefa A1. Esta entrega não altera RPC existente. Se precisar, pare.
- Depois de aplicar:
  - rode `list_migrations` e pegue a `version` registrada;
  - salve o **mesmo SQL** em `supabase/migrations/<version>_<nome>.sql`;
  - migration aplicada nunca é editada: correção vai em migration nova.
- **Grants:** toda tabela nova revoga de `PUBLIC, anon, authenticated` e liga RLS. Toda função interna revoga de `PUBLIC, anon, authenticated`. Toda RPC revoga de `PUBLIC, anon` e concede a `authenticated` (§5, §7).
- Depois de mudar o schema, regenere `src/integrations/supabase/types.ts` com `generate_typescript_types`. **Nunca** edite à mão.

### Testes e verificação

- **Baseline real:** 1.722 testes, **40 falhas pré-existentes** (§15.1). O "385/385" antigo não vale.
- **Critério:** nenhuma falha **nova** em relação à lista salva na A0.
- Lint tem milhares de erros pré-existentes e **não** é critério.

| Para quê | Comando |
|---|---|
| Um arquivo de teste | `node node_modules/vitest/vitest.mjs run <caminho>` |
| Testes do gestor | `node node_modules/vitest/vitest.mjs run src/features/gestor` |
| Suíte inteira (≈ 5 min; rode em background) | `node node_modules/vitest/vitest.mjs run` |
| Type-check | `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json` |
| Dev server | ferramenta `preview_start` com `name: "dev"` (porta 8080) ou `"dev-8091"` se a 8080 estiver ocupada |

`npx vitest` / `npx tsc` não resolvem nesta pasta (o `node_modules` é link). Use os caminhos acima.

### Fim de fase

Cada fase (Bloco A, Portão, Bloco B) termina com uma mensagem ao João listando os **próximos passos** em duas listas: "Claude" e "João".

---

## Índice

- **Bloco A — Back-end:** A0 Baseline · A1 Fatos e drift · A2 Migration fundação · A3 Migration agregados e funções de leitura · A4 Migration pipeline · A5 1º refresh e validação · A6 Migration cron · A7 RPC visão geral · A8 RPCs de alunos · A9 RPCs de questões · A10 RPCs de conteúdos · A11 RPC admin · A12 Segurança, desempenho e idempotência · A13 Testes estáticos de SQL · A14 Types.
- **Portão A→B.**
- **Bloco B — Front-end:** B1 Tipos, lib e hooks · B2 Rotas, layout, filtros, sidebar · B3 Gráficos base · B4 VG KPIs, mês a mês, hábito · B5 VG nível de engajamento · B6 VG consumo e tabela · B7 VG drawer · B8 VG quem não voltou, especialidades, comparativo · B9 Questões KPIs e gráficos · B10 Questões gaveta · B11 Conteúdos KPIs e gráficos · B12 Conteúdos gaveta · B13 Exportar · B14 Admin página e KPIs · B15 Admin ranking, evolução, dispersão · B16 QA final.

---

# Bloco A — Back-end

### Tarefa A0: Baseline de testes e ambiente

**Objetivo:** registrar o estado de partida (branch, ref, falhas de teste pré-existentes) para que toda tarefa seguinte seja julgada contra ele.

**Arquivos:**
- Criar: `docs/superpowers/notes/2026-10-22-engajamento-baseline-testes.md`

- [x] **Passo 1.** Rode `git status`, `git log -1` e `git rev-parse --abbrev-ref HEAD`.
  - Esperado: branch `feat/engajamento-sanarflix`, árvore limpa, HEAD contendo o commit das specs.
  - Se não for isso, **pare**.
- [x] **Passo 2.** `get_project` em `gvqvrmkizemwsasmupmo`. Esperado: nome "SanarFlix Academy", status `ACTIVE_HEALTHY`.
- [x] **Passo 3.** Rode a suíte inteira em background: `node node_modules/vitest/vitest.mjs run > <scratchpad>/baseline-full.txt 2>&1`.
- [x] **Passo 4.** Extraia do arquivo:
  - a linha de resumo ("Test Files … Tests …");
  - a lista de **arquivos** e **casos** que falharam, com as linhas `FAIL`.

  Grave os dois no arquivo de notas, com data e hash do commit.
- [x] **Passo 5.** Commit: `docs(engajamento): baseline de testes antes do bloco A`.

**Aceite:** o arquivo de notas existe com o resumo e a lista de falhas. Referência de 22/10: 40 falhas em 11 arquivos.

**Não fazer:** não tente consertar falhas pré-existentes.

**Confirmação do João:** não.

---

### Tarefa A1: Reconfirmar os fatos da §1 e checar drift

**Objetivo:** garantir que as fontes continuam como a spec descreve e que os nomes que vamos criar estão livres.

**Arquivos:** nenhum (só leitura).

- [x] **Passo 1.** Rode e compare com a §1.3. Divergência relevante → **pare e avise o João**.

  ```sql
  SELECT (SELECT count(*) FROM dim_aluno_b2b) dim,
         (SELECT count(*) FROM dim_aluno_b2b WHERE lower(btrim(perfil))='aluno' AND status_atual='ativo' AND semestre_atual BETWEEN 1 AND 12) base_ativa,
         (SELECT count(*) FROM fato_consumo_conteudo_b2b) consumo,
         (SELECT min(event_date)||'..'||max(event_date) FROM fato_consumo_conteudo_b2b) consumo_datas,
         (SELECT count(*) FROM fato_resolucao_questoes_b2b) respostas,
         (SELECT min(response_date)||'..'||max(response_date) FROM fato_resolucao_questoes_b2b) resp_datas;
  SELECT taxonomia_status, count(*) FROM fato_resolucao_questoes_b2b GROUP BY 1;
  SELECT DISTINCT t.v->>'ciclo' FROM (SELECT taxonomias FROM fato_resolucao_questoes_b2b WHERE response_date >= current_date - 7) f,
         jsonb_array_elements(f.taxonomias) t(v);
  ```

  O que conta como divergência relevante:
  - base ativa variando mais de 10% em relação a 7.120;
  - aparecer um terceiro `ciclo`;
  - mudança de colunas, verificada em `information_schema.columns` das três tabelas.
- [x] **Passo 2 (drift).**

  ```sql
  SELECT n.nspname, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND (p.proname LIKE 'eng\_%' OR p.proname LIKE 'get\_gestor\_engajamento%' OR p.proname = 'get_admin_engajamento');
  SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'eng\_%';
  SELECT jobname FROM cron.job WHERE jobname LIKE 'eng-%';
  ```

  Esperado: **0 linhas** nas três consultas. Se houver linha, pare.

**Aceite:** os números batem com a §1.3 (ordem de grandeza) e as três consultas de drift voltam vazias.

**Confirmação do João:** não.

---

### Tarefa A2: Migration `eng_fundacao`

**Objetivo:** criar as funções auxiliares puras, as tabelas de taxonomia, classificação, de-para e log, com grants.

**Arquivos:**
- Criar: `supabase/migrations/<version>_eng_fundacao.sql`, depois de aplicar.

**Conteúdo, nesta ordem:**
1. Funções da §5.6: `eng_hoje`, `eng_norm_rotulo`, `eng_norm_texto`, `eng_rotulo_curso`, `eng_norm_busca`, `eng_pct`, `eng_razao`, `eng_validar_periodo`.
2. Tabelas `eng_no_taxonomia` (§5.1), `eng_questao_classificacao` (§5.2), `eng_depara_quiz_no` (§5.3) e `eng_refresh_log` (§5.5).
3. Função `eng_atualizado_em` (§5.6), que depende de `eng_refresh_log`.
4. Para cada tabela:
   ```sql
   ALTER TABLE … ENABLE ROW LEVEL SECURITY;
   REVOKE ALL ON TABLE … FROM PUBLIC, anon, authenticated;
   ```
   Para cada sequência identity (`eng_depara_quiz_no_id_seq`, `eng_refresh_log_id_seq`):
   ```sql
   REVOKE ALL ON SEQUENCE … FROM PUBLIC, anon, authenticated;
   ```
5. Para cada função: `REVOKE ALL ON FUNCTION public.<f>(<tipos>) FROM PUBLIC, anon, authenticated;`.
6. `COMMENT ON TABLE` curto em cada tabela, citando a spec.

**Passos:**
- [x] **Passo 1.** Monte o SQL copiando **literalmente** os blocos da spec.
- [x] **Passo 2.** Mostre o SQL ao João e peça o "ok" para aplicar `eng_fundacao`.
- [x] **Passo 3.** `apply_migration` (name `eng_fundacao`). Depois `list_migrations` e salve o arquivo com a `version`.
- [x] **Passo 4.** Verifique:

  ```sql
  SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'eng\_%' ORDER BY 1;
  SELECT grantee, table_name, privilege_type FROM information_schema.role_table_grants
   WHERE table_name LIKE 'eng\_%' AND grantee IN ('anon','authenticated');
  SELECT public.eng_norm_rotulo('Obstetrícia (Residência Médica)'), public.eng_rotulo_curso('  Cirurgia  Geral (Internato e Prática Médica) '),
         public.eng_norm_busca('Conceição João'), public.eng_pct(1, 3), public.eng_razao(10, 4), public.eng_hoje();
  ```

  Esperado:
  - 4 tabelas listadas;
  - **0** grants para anon/authenticated;
  - `obstetrícia` | `Cirurgia Geral` | `conceicao joao` | `33.3` | `2.5` | data de hoje (BRT).
- [x] **Passo 5.** Commit: `feat(engajamento): fundação eng_* (taxonomia, classificação, de-para, log)`.

**Dependências:** A1.

**Não fazer:**
- não insira nada em `eng_depara_quiz_no`;
- não crie as tabelas de agregados aqui.

**Confirmação do João:** **sim** (migration).

---

### Tarefa A3: Migration `eng_agregados_e_leitura`

**Objetivo:** criar as tabelas de agregados e as funções internas de leitura que as RPCs vão usar.

**Arquivos:**
- Criar: `supabase/migrations/<version>_eng_agregados_e_leitura.sql`

**Conteúdo:**
1. Tabelas da §5.4: `eng_atividade_aluno_dia`, `eng_questoes_aluno_dia_no`, `eng_consumo_aluno_dia_conteudo`, com índices, RLS e revokes.
2. Funções:
   - `eng_base_ativa(uuid)`, `eng_alunos_recorte(uuid, date, date)` e `eng_detalhe_atividade(text, date)` (§5.6);
   - `eng_meta(date, date, boolean, text)` (§7.4).
3. Revokes das 4 funções (`FROM PUBLIC, anon, authenticated`).

**Passos:**
- [x] **Passo 1.** Monte o SQL a partir da spec. Mostre ao João e peça o "ok".
- [x] **Passo 2.** `apply_migration` (`eng_agregados_e_leitura`) e salve o arquivo.
- [x] **Passo 3.** Verifique:
  - tabelas e grants, como na A2 (0 grants para anon/authenticated);
  - `SELECT count(*) FROM public.eng_base_ativa('d86c32ba-2d09-4c7e-a426-1d981ec7b595');` → ≈ 521;
  - `SELECT count(*) FROM public.eng_alunos_recorte('d86c32ba-2d09-4c7e-a426-1d981ec7b595', DATE '2026-05-01', public.eng_hoje());` → igual ao anterior. Com as tabelas ainda vazias, todos têm `faixa_recencia = 'nunca_acessou'`.
- [x] **Passo 4.** Commit: `feat(engajamento): agregados aluno×dia e funções de leitura`.

**Dependências:** A2.

**Confirmação do João:** **sim**.

---

### Tarefa A4: Migration `eng_pipeline`

**Objetivo:** criar `eng_refresh_classificacao()`, `eng_refresh_agregados()` e `eng_refresh(text)` (§6.2, §6.4).

**Arquivos:**
- Criar: `supabase/migrations/<version>_eng_pipeline.sql`

**Passos:**
- [x] **Passo 1.** Copie as 3 funções da spec **literalmente**. Acrescente:
  ```sql
  REVOKE ALL ON FUNCTION public.eng_refresh_classificacao(), public.eng_refresh_agregados(), public.eng_refresh(text) FROM PUBLIC, anon, authenticated;
  ```
- [x] **Passo 2.** Mostre ao João, peça o "ok", aplique e salve o arquivo.
- [x] **Passo 3.** Commit: `feat(engajamento): pipeline de refresh da camada eng_*`.

**Dependências:** A3.

**Não fazer:** **não** rode o refresh nesta tarefa. Ele é a A5.

**Confirmação do João:** **sim**.

---

### Tarefa A5: Primeiro refresh e validação da camada

**Objetivo:** popular a camada `eng_*` e provar que ela fecha com as fontes.

**Arquivos:** nenhum (o resultado vai para o relatório ao João).

- [x] **Passo 1.** Peça o "ok" do João para **rodar** o refresh em produção. É escrita nas tabelas novas.
- [x] **Passo 2.** Execute numa única chamada de `execute_sql`:
  ```sql
  SET statement_timeout TO '30min'; SELECT public.eng_refresh('manual');
  ```
  Se o MCP cortar em 2 min, use o job avulso da §6.5 e acompanhe por `eng_refresh_log`.
- [x] **Passo 3.** Confira o log:
  ```sql
  SELECT id, status, erro, terminado_em - iniciado_em AS duracao, contagens FROM eng_refresh_log ORDER BY id DESC LIMIT 1;
  ```
  Esperado:
  - `status='ok'`;
  - duração < 15 min;
  - `contagens` na ordem de grandeza da tabela da §6.2 (questões ≈ 84,7 mil; sem classificação ≈ 17 mil; `entradas_invalidas` = 0; `classificadas_depara` = 0).
- [x] **Passo 4.** Rode as validações **V3** e **V4** (§14). Rode também:
  ```sql
  -- V5 na camada: questões da PARACATU no período, camada vs. fonte
  WITH B AS (SELECT sanarflix_user_id FROM eng_base_ativa('d86c32ba-2d09-4c7e-a426-1d981ec7b595'))
  SELECT (SELECT sum(questoes) FROM eng_atividade_aluno_dia a JOIN B USING (sanarflix_user_id) WHERE a.dia BETWEEN '2026-05-01' AND eng_hoje()) camada,
         (SELECT count(*) FROM fato_resolucao_questoes_b2b f JOIN B USING (sanarflix_user_id) JOIN eng_questao_classificacao c USING (question_id)
           WHERE f.response_date BETWEEN '2026-05-01' AND eng_hoje()) fonte;
  -- a classificação respeita a regra (amostra auditável)
  SELECT motivo, count(*) FROM eng_questao_classificacao GROUP BY 1 ORDER BY 1;
  SELECT n.nivel, n.ciclo, n.sintetico, count(*) FROM eng_no_taxonomia n GROUP BY 1,2,3 ORDER BY 1,2,3;
  ```
  Esperado:
  - `camada = fonte`;
  - nós: clínico nível 1 = 5, nível 2 = 43, nível 3 ≈ 390 (+1 sintético); básico nível 1 = 33.
- [x] **Passo 5.** Rode **V8, V9 e V10** usando direto `eng_alunos_recorte` (sem RPC):
  ```sql
  SELECT faixa_recencia, count(*) FROM eng_alunos_recorte('d86c32ba-2d09-4c7e-a426-1d981ec7b595', '2026-05-01', eng_hoje()) GROUP BY 1;
  SELECT nivel, count(*) FROM eng_alunos_recorte('d86c32ba-2d09-4c7e-a426-1d981ec7b595', '2026-05-01', eng_hoje()) GROUP BY 1;
  ```
  As somas têm que dar a base ativa.
- [x] **Passo 6.** Relate ao João os números, com o esperado ao lado.

**Aceite:** log `ok`; V3, V4, V5 (camada), V8, V9 e V10 batendo.

**Não fazer:** não "ajuste" consulta de validação para bater (§3.3).

**Confirmação do João:** **sim** (para rodar).

---

### Tarefa A6: Migration `eng_cron`

**Objetivo:** agendar o refresh diário (§6.5).

**Arquivos:**
- Criar: `supabase/migrations/<version>_eng_cron.sql`, com o bloco "Job diário" da §6.5: `unschedule` idempotente + `schedule` com `SET statement_timeout`.

- [x] **Passo 1.** Mostre ao João, peça o "ok", aplique e salve.
- [x] **Passo 2.** Verifique: `SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'eng-refresh-diario';` → 1 linha, `0 9 * * *`.
- [x] **Passo 3.** No dia seguinte, ou quando o João pedir, confira se apareceu uma linha `disparo='cron'` com `status='ok'` em `eng_refresh_log`. Esse item é do checklist do portão.
- [x] **Passo 4.** Commit: `feat(engajamento): cron diário do refresh (06:00 BRT)`.

**Confirmação do João:** **sim**.

---

### Tarefa A7: Migration `get_gestor_engajamento_visao_geral`

**Objetivo:** criar a RPC da §8.1.

**Arquivos:**
- Criar: `supabase/migrations/<version>_get_gestor_engajamento_visao_geral.sql`, com a função da §8.1 **literal** e os grants da §7.1:
  ```sql
  REVOKE ALL ON FUNCTION public.get_gestor_engajamento_visao_geral(uuid, date, date, smallint, text) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.get_gestor_engajamento_visao_geral(uuid, date, date, smallint, text) TO authenticated;
  ```

**Passos:**
- [x] **Passo 1.** Mostre ao João, peça o "ok", aplique e salve.
- [x] **Passo 2.** Pegue um gestor da PARACATU (§14) e confirme com o João qual usar. Chame a RPC simulando o JWT (bloco `BEGIN … ROLLBACK` da §14) com `[2026-05-01, eng_hoje()]`.
- [x] **Passo 3.** Valide **V1, V2, V5, V6, V7, V8, V9, V10 e V13** contra o JSON. Repita com `p_semestre = 8` e com `p_aluno` = um aluno da PARACATU com atividade:
  - com semestre: `kpis.baseAtiva` = `count(*)` da base com semestre 8;
  - com aluno: `kpis.baseAtiva = 1` e soma dos níveis = 1.
- [x] **Passo 4.** Erros esperados:
  - `p_inicio > p_fim` → `periodo_invalido`;
  - `p_semestre = 13` → `semestre_invalido`;
  - semestre e aluno juntos → `filtro_conflitante`;
  - aluno de outra IES → `aluno_fora_do_recorte`.
- [x] **Passo 5.** Commit: `feat(engajamento): RPC get_gestor_engajamento_visao_geral`.

**Dependências:** A5.

**Confirmação do João:** **sim**.

---

### Tarefa A8: Migration `get_gestor_engajamento_alunos_lista_aluno_export`

**Objetivo:** criar as RPCs §8.2, §8.3, §8.4 e §8.9 numa migration.

**Arquivos:**
- Criar: `supabase/migrations/<version>_get_gestor_engajamento_alunos.sql`, com as 4 funções e os 4 pares de `REVOKE`/`GRANT`. As assinaturas estão na §8.11.

**Passos:**
- [x] **Passo 1.** Monte cada função com o cabeçalho, o `DECLARE` e as guardas da §8.1 mais o corpo da seção. Mostre ao João, peça o "ok", aplique e salve.
- [x] **Passo 2.** Valide:
  - **V18:** as 9 categorias da lista batem com os cartões e as faixas da visão geral;
  - **V19:** `alunos.total` = base ativa;
  - `alunos` com `p_busca = 'conceicao'` acha nomes com "Conceição";
  - `p_sem_atividade_14d = true` → `total` = número de alunos com `dias_sem_atividade ≥ 14` ou nulo;
  - `export_alunos` devolve `email` e o mesmo número de linhas de `alunos.total`;
  - `aluno` (drawer) de um aluno ativo: `timeline` com até 4 itens, `meses` com uma linha por mês do período.
- [x] **Passo 3.** Commit: `feat(engajamento): RPCs de alunos, listas, drawer e exportação`.

**Confirmação do João:** **sim**.

---

### Tarefa A9: Migration `get_gestor_engajamento_questoes`

**Objetivo:** criar as RPCs §8.5 e §8.6.

**Arquivos:**
- Criar: `supabase/migrations/<version>_get_gestor_engajamento_questoes.sql`

**Passos:**
- [x] **Passo 1.** Mostre ao João, peça o "ok", aplique e salve.
- [x] **Passo 2.** Valide **V11** e **V12**. Para isso, escreva uma consulta que percorre o JSON com `jsonb_array_elements` e compara as somas.
  - `questoes_alunos` com a folha de maior volume:
    - `resumo.questoes` = `questoes` do mesmo nó na árvore;
    - `alunos` tem ≤ 12 itens, ordenados por questões.
  - Folha inexistente → `no_invalido`.
- [x] **Passo 3.** Commit: `feat(engajamento): RPCs da aba Questões`.

**Confirmação do João:** **sim**.

---

### Tarefa A10: Migration `get_gestor_engajamento_conteudos`

**Objetivo:** criar as RPCs §8.7 e §8.8.

**Arquivos:**
- Criar: `supabase/migrations/<version>_get_gestor_engajamento_conteudos.sql`

**Passos:**
- [x] **Passo 1.** Mostre ao João, peça o "ok", aplique e salve.
- [x] **Passo 2.** Valide **V7** (`kpis.videos`/`documentos` com `p_tipo='todos'`) e **V14**. Depois:
  - com `p_tipo='video'`: `kpis.documentos = 0` e `kpis.consumos = kpis.videos`;
  - `"Materiais gerais"` aparece por último dentro da especialidade;
  - `conteudo_alunos` do conteúdo de maior volume: `resumo.consumos` = `consumos` do nó.
- [x] **Passo 3.** Commit: `feat(engajamento): RPCs da aba Conteúdos`.

**Confirmação do João:** **sim**.

---

### Tarefa A11: Migration `get_admin_engajamento`

**Objetivo:** criar a RPC §8.10.

**Arquivos:**
- Criar: `supabase/migrations/<version>_get_admin_engajamento.sql`, com o `v_criterio_admin` da §7.4 e os grants da §7.2.

**Passos:**
- [x] **Passo 1.** Mostre ao João, peça o "ok", aplique e salve.
- [x] **Passo 2.** Chame como admin (JWT simulado de um usuário com `user_roles.role='admin'`; confirme qual com o João) e valide **V15, V16 e V17**.
  - Confira também que **nenhuma** chave do JSON traz nome, e-mail ou `sanarflix_user_id`: inspecione as chaves de `ranking[0]`.
- [x] **Passo 3.** Commit: `feat(engajamento): RPC do admin`.

**Confirmação do João:** **sim**.

---

### Tarefa A12: Segurança, desempenho e idempotência

**Objetivo:** provar V20, V21 e V22.

**Arquivos:** nenhum.

- [x] **Passo 1.** **V20** (a)–(d) da §14:
  - (a) `SET LOCAL role anon; SELECT public.get_gestor_engajamento_visao_geral(...)` → erro de permissão;
  - (b) gestor de **outra** IES com o id da PARACATU → `Permission denied: cannot access this IES`;
  - (c) gestor chamando o admin → `admin role required`;
  - (d) grants das tabelas → 0 linhas.
- [x] **Passo 2.** **V22:** `EXPLAIN (ANALYZE, BUFFERS)` de cada RPC na Integrado (`72b19e77-c569-4bf7-a433-44563df1015f`) com "Últimos 6 meses", e do admin.
  - Limites: < 2 s (gestor) e < 5 s (admin).
  - Se estourar, **pare e avise o João** com o plano. Não mude regra para ganhar desempenho.
- [x] **Passo 3.** **V21:** com o "ok" do João, rode `eng_refresh('manual')` mais uma vez e compare as `contagens` das duas últimas linhas de log.

**Confirmação do João:** sim, só para o refresh do passo 3.

---

### Tarefa A13: Testes estáticos de SQL

**Objetivo:** travar no repositório as regras de segurança das migrations novas.

**Arquivos:**
- Criar: `src/test/unit/engajamentoMigrations.test.ts`. Siga o padrão de `src/test/unit/gestorMigrationsPortalVersao.test.ts`, ou seja, ler a migration mais recente que define cada função.
- Modificar: `src/test/unit/gestorMigrationsAvisosAlunoContatoContexto.test.ts`, acrescentando as 9 RPCs `get_gestor_engajamento_*` à lista `toEqual` em ordem alfabética, sem mexer no resto.

**Passos:**
- [x] **Passo 1.** Escreva os casos da linha "SQL estático" da §15.2.
- [x] **Passo 2.** Rode os 2 arquivos.
  - Esperado: `engajamentoMigrations.test.ts` todo verde.
  - No arquivo antigo: as mesmas falhas do baseline, nenhuma nova. O caso da lista de RPCs pode continuar falhando se já falhava por outras RPCs (ex.: `get_gestor_prova_oficial` fora da lista). Registre no relatório.
- [x] **Passo 3.** Commit: `test(engajamento): guardas estáticos das migrations eng_*`.

**Confirmação do João:** não.

---

### Tarefa A14: Regenerar types

**Arquivos:**
- Modificar: `src/integrations/supabase/types.ts`, **só** via `generate_typescript_types`.

**Passos:**
- [x] **Passo 1.** Rode `generate_typescript_types` e substitua o arquivo inteiro pelo resultado.
- [x] **Passo 2.** Rode o type-check. Esperado: nenhum erro novo.
- [x] **Passo 3.** Commit: `chore(types): regenera types do Supabase com a camada eng_*`.

**Não fazer:** não edite o arquivo à mão.

**Confirmação do João:** não.

---

## Portão A→B — checklist de saída do Bloco A

O Bloco B **só começa** com todos os itens marcados **e** o "ok" do João nesta lista. Cole a lista preenchida no chat, com os números.

- [x] As 4 migrations de estrutura/pipeline/cron (A2, A3, A4, A6) e as 5 de RPC (A7–A11) foram aplicadas, cada uma com o "ok" do João. Os 9 arquivos estão em `supabase/migrations/` com a `version` de `list_migrations`.
- [x] `eng_refresh_log` tem ≥ 1 linha `status='ok'` com `disparo='cron'` (o cron rodou sozinho).
- [x] V1–V22 da §14 batem na PARACATU, com números relatados ao lado do esperado.
- [x] As 10 RPCs devolvem dados reais da PARACATU (gestor) e da rede (admin).
- [x] V20: anon, gestor de outra IES e gestor no admin recebem erro. Nenhum grant em `eng_*` para anon/authenticated.
- [x] V22: tempos dentro do limite na Integrado.
- [x] `src/integrations/supabase/types.ts` regenerado e type-check sem erro novo.
- [x] Suíte de testes sem falha nova em relação à A0.
- [x] Próximos passos enviados ao João, separados em Claude/João.

---

# Bloco B — Front-end

Regras do Bloco B (valem para todas as tarefas):

- **Nenhuma tarefa cria ou altera tabela, função ou RPC.** Campo faltando → pare e pergunte.
- Textos: **literalmente** os da §12. Cores: **só** o mapa da §13 (o guard `tema.test.tsx` reprova hex/rgb).
- Todo gráfico usa `FiguraGrafico` (§10.6). Todo bloco usa `BlocoGestor` com os estados da §11.
- Fixtures de teste: derivadas do exemplo JSON da §8 da RPC correspondente, salvas em `src/features/gestor/__tests__/fixtures/engajamento/*.ts`. Nunca invente chave que a RPC não emite (é isso que o `contratoEnvelopeRpc.test.ts` protege).
- Toda tarefa termina rodando `node node_modules/vitest/vitest.mjs run src/features/gestor` + type-check, sem falha nova, e commit.

---

### Tarefa B1: Tipos, lib, filtros e hooks

**Objetivo:** criar a camada de dados do front, sem nada visual.

**Arquivos:**
- Criar:
  - `src/features/gestor/api/types-engajamento.ts`: interfaces de **todos** os JSON da §8, com nomes de campo idênticos.
  - `src/features/gestor/lib/engajamento.ts`: funções da §10.3.
  - `src/features/gestor/hooks/useFiltrosEngajamento.ts`: estado da §9.6, usando `useFiltrosGestor().iesId`.
  - `src/features/gestor/api/engajamento.ts`: hooks da §10.4.
- Modificar: `src/features/gestor/api/queries.ts`, acrescentando `export` em `function useEnvelope` (nada mais).
- Testes:
  - `src/features/gestor/__tests__/engajamento/libEngajamento.test.ts`
  - `…/engajamento/useFiltrosEngajamento.test.tsx`
  - `…/engajamento/queriesEngajamento.test.tsx`
  - acrescentar casos em `src/features/gestor/__tests__/contratoEnvelopeRpc.test.ts`, um por RPC nova, com as chaves de primeiro nível de `data` lidas do SQL. Exemplo para a visão geral: `ies`, `temDados`, `periodo`, `recorte`, `kpis`, `aluno`, `meses`, `habito`, `niveis`, `recencia`, `consumo`, `especialidades`, `semestres`.

**Interface de `useFiltrosEngajamento`:**

```ts
export interface FiltrosEngajamento {
  iesId: string | null;
  periodo: OpcaoPeriodo; de: string | null; ate: string | null;
  inicio: string; fim: string;          // calculados por calcularPeriodo(hojeSaoPaulo(), …)
  semestre: number | null;              // URL eng_sem
  alunoId: string | null;               // URL aluno
  tipo: TipoConteudo;                   // URL tipo
  setPeriodo(p: OpcaoPeriodo, de?: string, ate?: string): void;
  setSemestre(n: number | null): void;  // apaga aluno
  setAluno(id: string | null): void;    // apaga eng_sem
  setTipo(t: TipoConteudo): void;
  limparFiltroPagina(): void;           // apaga aluno e eng_sem
}
```

**Passos:**
- [x] **Passo 1.** Escreva os testes de `lib/engajamento.ts` com os casos da §15.2. Para datas, use `hoje` fixo, por exemplo:
  - `calcularPeriodo('6m', '2026-10-22')` → `{inicio:'2026-05-01', fim:'2026-10-22'}`;
  - `calcularPeriodo('letivo', '2026-10-22')` → `2026-07-01`;
  - `calcularPeriodo('30d', '2026-03-01')` → `2026-01-31`;
  - `custom` com `de > ate` → cai em `6m`.

  Rode: FAIL.
- [x] **Passo 2.** Implemente `lib/engajamento.ts`. Rode: PASS.
- [x] **Passo 3.** Teste do hook de URL: regras 1–8 da §9.6, com `MemoryRouter` e `initialEntries`. Implemente. PASS.
- [x] **Passo 4.** Teste dos hooks de RPC, no padrão de `__tests__/queries.test.tsx`:
  - `mockRpc` chamado com o nome e os `p_*` exatos da §8.11;
  - `queryKey` contém `'engajamento'` e o `user.id`;
  - sem `iesId`, nenhuma chamada.

  Implemente. PASS.
- [x] **Passo 5.** Casos do contrato. PASS.
- [x] **Passo 6.** Suíte do gestor + type-check. Commit: `feat(engajamento): tipos, filtros e hooks do front`.

**Não fazer:** nenhum componente visual nesta tarefa.

**Confirmação do João:** não.

---

### Tarefa B2: Rotas, layout, filtros, abas e sidebar

**Objetivo:** a seção "Engajamento" navegável, com cabeçalho, filtros, abas, faixa de filtro e estado "IES sem dados". Os blocos ficam como placeholders `BlocoGestor estado="loading"` até as tarefas seguintes.

**Arquivos:**
- Criar:
  - `routes/engajamento/EngajamentoLayout.tsx`
  - `routes/engajamento/VisaoGeralEngajamento.tsx`
  - `routes/engajamento/QuestoesEngajamento.tsx`
  - `routes/engajamento/ConteudosEngajamento.tsx`
  - `components/engajamento/FiltroPeriodo.tsx`
  - `components/engajamento/FiltroSemestreEngajamento.tsx`
  - `components/engajamento/FiltroTipoConteudo.tsx`
  - `components/engajamento/AbasEngajamento.tsx`
  - `components/engajamento/FaixaFiltroPagina.tsx`
  - `components/engajamento/BotaoExportarAba.tsx` (só o botão; o conteúdo vem na B13)
- Modificar: `gestorV2Routes.tsx` e `shell/SidebarNav.tsx`, exatamente como a §10.2.
- Testes:
  - `__tests__/engajamento/EngajamentoLayout.test.tsx`
  - atualizar `__tests__/SidebarNav.test.tsx` e `__tests__/gestorV2Routes.test.tsx` (§15.3)

**Passos:**
- [x] **Passo 1.** Testes do layout:
  - título e subtítulo da §12.1, com o nome da IES e "atualizado em" vindos do mock da RPC de visão geral;
  - opções dos dois `<select>`;
  - "Personalizado…" mostra "De", "Até" e "Aplicar";
  - abas com os links certos; os links de Questões/Conteúdos sem `aluno` (regra 5);
  - faixa "Página filtrada por" com "Aluno: … (8º sem.)" quando há `aluno`, e o "×" limpa;
  - `temDados=false` → estado vazio da §11 nas 3 abas.

  FAIL → implemente → PASS.
- [x] **Passo 2.** Atualize os testes da sidebar:
  - 4 itens;
  - títulos de grupo "Desempenho Institucional" e "Uso da plataforma";
  - badge "NOVO" no item Engajamento;
  - o hover em Engajamento aquece o chunk do layout.

  Implemente a §10.2. PASS.
- [x] **Passo 3.** Rotas: `/gestor/engajamento`, `/questoes` e `/conteudos` montam dentro do portal novo. PASS.
- [x] **Passo 4.** Abra o dev server (`preview_start` `dev`) com `?ies=d86c32ba-2d09-4c7e-a426-1d981ec7b595` logado como gestor/admin. Confira a sidebar e o cabeçalho e tire um screenshot para o relatório.
- [x] **Passo 5.** Suíte + type-check + commit: `feat(engajamento): rotas, layout, filtros e item na sidebar`.

**Confirmação do João:** não.

---

### Tarefa B3: Componentes de gráfico

**Objetivo:** criar os gráficos reutilizáveis da §10.6.

**Arquivos:**
- Criar em `components/engajamento/`: `FiguraGrafico.tsx`, `BarrasMensais.tsx`, `LinhaMensal.tsx`, `BarrasPorSemestre.tsx`, `BarraHorizontal.tsx`.
- Teste: `__tests__/engajamento/graficos.test.tsx`.

**Props mínimas:**

```ts
FiguraGrafico({ rotulo: string; linhasTabela: { rotulo: string; valor: string }[]; children })
BarrasMensais({ pontos: { mes: string; parcial: boolean; valor: number; texto: string; sub?: string }[]; altura?: number })
LinhaMensal({ pontos: { mes: string; parcial: boolean; valor: number | null }[]; modo: 'quantidade' | 'pct'; formatar: (v: number) => string })
BarrasPorSemestre({ linhas: { semestre: number; valor: number | null; texto: string }[]; modo: 'quantidade' | 'pct'; selecionado?: number | null; onSelecionar?: (n: number) => void })
BarraHorizontal({ pct: number; cor?: string; marcador?: number | null })   // marcador = traço da média
```

**Passos:**
- [x] **Passo 1.** Testes:
  - todo gráfico tem `figure`, `role="img"` com nome, "Ver dados em tabela" e `table` (como em `a11y.test.tsx`);
  - mês parcial com `*`;
  - eixo de % na faixa calculada;
  - `BarrasPorSemestre` clicável chama `onSelecionar` e marca `aria-pressed`.

  FAIL → implemente → PASS.
- [x] **Passo 2.** Suíte + type-check + commit: `feat(engajamento): componentes de gráfico`.

**Não fazer:** não use recharts (§10.6). Não use hex/rgb.

---

### Tarefa B4: Visão geral — KPIs, mês a mês, hábito

**Arquivos:**
- Criar: `components/engajamento/KpisEngajamento.tsx`, `EngajamentoMesAMes.tsx`, `DoAcessoAoHabito.tsx`.
- Modificar: `routes/engajamento/VisaoGeralEngajamento.tsx`, ligando `useEngajamentoVisaoGeral`.
- Teste: `__tests__/engajamento/VisaoGeralTopo.test.tsx`, com a fixture da visão geral (PARACATU da §8.1) e uma variante com aluno.

**Passos:**
- [x] **Passo 1.** Testes:
  - **sem aluno:** os 5 KPIs com rótulos, valores e notas da §12.2. `engajadosPctAnterior = null` → "sem comparativo para este período". Com `p_semestre`, a nota vira "média da IES: …".
  - **mês a mês:** "63%" com "180 alunos"; último mês com `*` e o rodapé "Outubro parcial, até 22/10.".
  - **hábito:** a descrição com "set/26", "223 dos 521"; percentuais "59,6%", "22,4%", "15,7%", "2,2%" (133/223, 50/223, 35/223, 5/223).
  - **com aluno:** os 5 KPIs do modo aluno, "Dias ativos mês a mês" com "N d", e as faixas "Sim"/"Não".

  FAIL → implemente → PASS.
- [x] **Passo 2.** Confira no dev server com a PARACATU. Os números têm que bater com a RPC chamada na A7 (mesmo dia).
- [x] **Passo 3.** Suíte + type-check + commit.

---

### Tarefa B5: Visão geral — Nível de engajamento e pop-up de lista

**Arquivos:**
- Criar: `components/engajamento/NivelEngajamento.tsx`, `ListaAlunosDialog.tsx`.
- Teste: `__tests__/engajamento/NivelEngajamento.test.tsx`.

**Comportamento:**
- **Cartões:** 4 cartões com as cores da §13, 3 chips e "+N". O "+N" abre `ListaAlunosDialog` com `categoria` = nível.
- **`ListaAlunosDialog`** (reusada na B8 por "Quem não voltou"):
  - recebe `categoria`, `titulo`, `regra?` e `colunaDetalhe: 'ultima' | 'melhorMes'`;
  - usa `useEngajamentoLista` com página de 20 e busca com debounce de 300 ms;
  - "Exportar CSV" chama `buscarListaCompleta`, só se `podeExportar`;
  - paginação "Anterior"/"Próxima".

**Passos:**
- [x] **Passo 1.** Testes:
  - textos da §12.2 (cartões e pop-up);
  - cartão vazio;
  - "+N" só quando `total > amostra`;
  - coluna "Melhor mês" em parou/nunca com "set/26 · 18 dias ativos", "— (nunca acessou)" e "— (sem atividade no período)";
  - coluna "Última atividade" em frequente/esporádico com "última: há 3 dias · 9 dias ativos em 30";
  - foco volta ao botão ao fechar (`useDevolverFocoAoFechar`).

  FAIL → implemente → PASS.
- [x] **Passo 2.** Suíte + type-check + commit.

---

### Tarefa B6: Visão geral — Consumo dos alunos e tabela Por aluno

**Arquivos:**
- Criar: `components/engajamento/ConsumoAlunos.tsx`, `TabelaPorAluno.tsx`.
- Teste: `__tests__/engajamento/ConsumoAlunos.test.tsx`.

**Comportamento:**
- **Abas.** Trocar de aba muda os KPIs, as barras (`meses[].questoes/videos/documentos`) e o `p_ordem` da tabela, e volta a tabela para a página 1.
- **Tabela:**
  - busca (300 ms), filtro "Sem atividade há 14 dias" e paginação de 20;
  - clicar no nome chama `setAluno(id)`; clicar de novo no aluno selecionado limpa;
  - a seta abre o drawer (B7);
  - colunas da aba ativa realçadas.
- **Exportar base de alunos (CSV):** só se `podeExportar`. Chama `buscarExportAlunos` e monta com `montarCsv` e `baixarCsv`, colunas da §10.7.

**Passos:**
- [x] **Passo 1.** Testes:
  - textos da §12.2 (KPIs por aba, sem e com aluno);
  - título do gráfico com "· Out parcial até 22/10";
  - "Mostrando 1–20 de 521 alunos, ordenados pela aba selecionada";
  - estado vazio;
  - CSV com o cabeçalho exato e `;`;
  - o botão de exportar some com `podeExportar=false`.

  FAIL → implemente → PASS.
- [x] **Passo 2.** Dev server: busca "conceicao" acha "Conceição" (se houver na PARACATU; senão, teste com outro nome acentuado da base).
- [x] **Passo 3.** Suíte + type-check + commit.

---

### Tarefa B7: Visão geral — Drawer do aluno

**Arquivos:**
- Criar: `components/engajamento/DrawerAlunoEngajamento.tsx`, seguindo o padrão do `Sheet` de `components/DrawerAluno.tsx`.
- Teste: `__tests__/engajamento/DrawerAlunoEngajamento.test.tsx` + caso no `a11y.test.tsx` (axe + ESC devolve o foco).

**Passos:**
- [x] **Passo 1.** Testes:
  - textos da §12.2 (drawer);
  - barras empilhadas com legenda "Questões (÷4)";
  - "Acerto por especialidade vs. semestre" com o traço;
  - timeline com as 3 frases;
  - vazio "Nenhuma atividade registrada";
  - "Filtrar a página por este aluno" chama `setAluno`, apaga `eng_sem` e fecha.

  FAIL → implemente → PASS.
- [x] **Passo 2.** Suíte + type-check + commit.

---

### Tarefa B8: Visão geral — Quem não voltou, Especialidades, Comparativo

**Arquivos:**
- Criar: `components/engajamento/QuemNaoVoltou.tsx`, `EspecialidadesPraticadas.tsx`, `ComparativoSemestres.tsx`.
- Teste: `__tests__/engajamento/VisaoGeralRodape.test.tsx`.

**Comportamento:**
- **Quem não voltou:**
  - sem faixa selecionada, a prévia vem de `recencia.previaSumidos30mais`;
  - faixa clicada (toggle) → `useEngajamentoLista` com `p_page_size=5`;
  - "Ver lista completa" (só se total > 5) abre `ListaAlunosDialog`;
  - "Filtrar na tabela de alunos" liga o filtro de 14 dias da B6 e rola até `#consumo`. O estado do filtro de 14 dias fica no componente pai `VisaoGeralEngajamento`.
- **Comparativo:** clicar no semestre chama `setSemestre(n)` (toggle). A linha selecionada fica realçada, e a linha do semestre do aluno filtrado fica realçada mais leve.

**Passos:**
- [x] **Passo 1.** Testes:
  - textos da §12.2;
  - legenda "Nunca acessaram";
  - segmentos com `aria-pressed`;
  - "Mostrando 5 de 133 alunos";
  - especialidades com "acerto 64%";
  - comparativo com 12 linhas e o ciclo;
  - clicar no 8º grava `eng_sem=8` e apaga `aluno`.

  FAIL → implemente → PASS.
- [x] **Passo 2.** Dev server: o filtro do topo e o Comparativo ficam sincronizados nos dois sentidos.
- [x] **Passo 3.** Suíte + type-check + commit.

---

### Tarefa B9: Questões — KPIs, Evolução, Por semestre

**Arquivos:**
- Criar: `components/engajamento/KpisQuestoes.tsx`.
- Modificar: `routes/engajamento/QuestoesEngajamento.tsx`, ligando `useEngajamentoQuestoes`, `LinhaMensal` e `BarrasPorSemestre` com o seletor Quantidade | % de acerto.
- Teste: `__tests__/engajamento/QuestoesTopo.test.tsx`.

**Passos:**
- [x] **Passo 1.** Testes:
  - textos da §12.3;
  - o seletor troca título e descrição;
  - o eixo de % aparece na descrição.

  FAIL → implemente → PASS.
- [x] **Passo 2.** Suíte + type-check + commit.

---

### Tarefa B10: Questões — Gaveta de taxonomia e pop-up

**Arquivos:**
- Criar: `components/engajamento/GavetaTaxonomia.tsx`, `AlunosDoNoDialog.tsx`.
- Teste: `__tests__/engajamento/GavetaTaxonomia.test.tsx`.

**Comportamento:**
- **Estrutura.** `role="treegrid"` com:
  - duas faixas de seção (§13);
  - níveis expansíveis (`aria-expanded`);
  - folhas que abrem o pop-up;
  - linha "Total";
  - rodapé da §12.3.
- **Expansão.** "Recolher tudo" fecha tudo. Abertura inicial conforme a §12.3.
- **Pop-up.** `useEngajamentoQuestoesAlunos(folhaId)`.

**Passos:**
- [x] **Passo 1.** Testes:
  - a soma das questões das linhas de nível 1 = total exibido (com fixture coerente);
  - o básico aparece como "Ciclo básico" e **não** dentro das grandes áreas;
  - folha do clínico com `aria-label` "Ver alunos do tema …", do básico com "Ver alunos do assunto …";
  - pop-up com sobretítulo "Clínica Médica › Cardiologia" ou "Ciclo básico › Fisiologia";
  - rodapé "Mostrando os 12 alunos…" só com mais de 12 alunos.

  FAIL → implemente → PASS.
- [x] **Passo 2.** Dev server, PARACATU: abrir e fechar níveis e abrir um pop-up. O total da gaveta = KPI do topo.
- [x] **Passo 3.** Suíte + type-check + commit.

---

### Tarefa B11: Conteúdos — filtro de tipo, KPIs, Evolução, Por semestre

**Arquivos:**
- Criar: `components/engajamento/KpisConteudos.tsx`.
- Modificar: `routes/engajamento/ConteudosEngajamento.tsx`.
- Teste: `__tests__/engajamento/ConteudosTopo.test.tsx`.

**Passos:**
- [ ] **Passo 1.** Testes:
  - "Todos", "Vídeo" e "Documento" com ícones e `aria-pressed`;
  - trocar o tipo grava `tipo` na URL e recarrega;
  - textos da §12.4 por tipo.

  FAIL → implemente → PASS.
- [ ] **Passo 2.** Suíte + type-check + commit.

---

### Tarefa B12: Conteúdos — Gaveta e pop-up

**Arquivos:**
- Criar: `components/engajamento/GavetaConteudos.tsx`, `AlunosDoConteudoDialog.tsx`.
- Teste: `__tests__/engajamento/GavetaConteudos.test.tsx`.

**Comportamento:**
- "Participação no nível" calculada no front (§4.6), inteiro.
- Ícones de vídeo e documento na folha.
- "Materiais gerais" por último.
- Rodapé da §12.4.
- Pop-up com `useEngajamentoConteudoAlunos({ content_id, especialidade, modulo })`.

**Passos:**
- [ ] **Passo 1.** Testes:
  - participação 100% somada nos filhos (±1 por arredondamento);
  - ícones com `aria-label`;
  - pop-up com "Aberturas" e "Última abertura" (UTC → BRT).

  FAIL → implemente → PASS.
- [ ] **Passo 2.** Suíte + type-check + commit.

---

### Tarefa B13: Exportar (cabeçalho) nas 3 abas

**Arquivos:**
- Criar: `src/features/gestor/lib/exportarEngajamento.ts`, com as seções da §10.7 por aba.
- Modificar: `components/engajamento/BotaoExportarAba.tsx`.
- Teste: `__tests__/engajamento/exportarEngajamento.test.ts`.

**Passos:**
- [ ] **Passo 1.** Testes:
  - para cada aba, a lista de seções e os cabeçalhos de coluna;
  - a primeira linha de cada seção traz o recorte;
  - nenhum e-mail nem id de aluno no CSV agregado;
  - nome do arquivo via `nomeArquivoCsv`.

  FAIL → implemente → PASS.
- [ ] **Passo 2.** Suíte + type-check + commit.

---

### Tarefa B14: Admin — navegação, rota, página e KPIs

**Arquivos:**
- Criar:
  - `src/services/admin/engajamento.ts` (`useAdminEngajamento`)
  - `src/experiences/admin/pages/EngajamentoSanarflixPage.tsx`
  - `src/components/admin/engajamento/KpisRede.tsx`
- Modificar: `src/experiences/admin/AdminNav.ts` e `src/experiences/admin/adminRoutes.tsx` (§10.2).
- Testes:
  - `src/components/admin/engajamento/__tests__/KpisRede.test.tsx`
  - atualizar `src/test/unit/adminNav.test.ts` (§15.3)

**Passos:**
- [ ] **Passo 1.** Testes:
  - item "Engajamento SanarFlix" depois de "Monitoramento", com a capability `simulados.manage`;
  - KPIs sem e com semestre (§12.5);
  - `compacto(261000)` → "261 mil";
  - faixa de filtro com o texto da §12.5.

  FAIL → implemente → PASS.
- [ ] **Passo 2.** Suíte + type-check + commit.

---

### Tarefa B15: Admin — Ranking, Evolução da rede, Dispersão

**Arquivos:**
- Criar: `src/components/admin/engajamento/RankingIes.tsx`, `EvolucaoRede.tsx`, `DispersaoEngajamentoAcerto.tsx`.
- Testes em `src/components/admin/engajamento/__tests__/`.

**Comportamento:**
- **Ranking:**
  - "Ordenar por" Engajamento | Acerto | Base ativa (desc, empate pelo nome) e posição renumerada;
  - proficiência com o nome do simulado e "mmm/aa", ou "—" e "sem simulado ENAMED";
  - tendência sem verde;
  - "Abrir portal →" para `/gestor/engajamento?ies=<id>`;
  - os dois rodapés literais.
- **Evolução:**
  - 5 indicadores;
  - gráfico mensal + barras por semestre clicáveis, que gravam `sem` na URL (toggle) e sincronizam com o `<select>`.
- **Dispersão:** conforme a §10.6.

**Passos:**
- [ ] **Passo 1.** Testes:
  - ordenação pelos 3 critérios;
  - IES sem proficiência;
  - clique no semestre grava `sem`;
  - `figure` + tabela alternativa nos gráficos.

  FAIL → implemente → PASS.
- [ ] **Passo 2.** Dev server como admin: PARACATU no ranking com os mesmos números da visão geral do gestor (V16).
- [ ] **Passo 3.** Suíte + type-check + commit.

---

### Tarefa B16: QA final

**Objetivo:** conferir tela × fonte na PARACATU e fechar a entrega.

**Passos:**
- [ ] **Passo 1.** `a11y.test.tsx`: acrescente as 3 abas e o drawer (axe sem violações). PASS.
- [ ] **Passo 2.** Dev server, PARACATU, "Últimos 6 meses":
  - para **cada número visível** das 3 abas e do admin, confira contra a RPC do mesmo minuto e contra as validações V1–V19 da §14;
  - preencha uma tabela "tela | RPC | fonte" no relatório.
- [ ] **Passo 3.** Repita o essencial com "Últimos 30 dias", com 8º semestre, com um aluno filtrado e com `tipo=video`.
- [ ] **Passo 4.** Viewport mobile (`resize_window` `mobile`): sem rolagem horizontal da página. Tabelas largas rolam dentro do próprio contêiner. Tema escuro (`colorScheme: dark`): legível, sem branco estourado.
- [ ] **Passo 5.** Suíte inteira em background: nenhuma falha nova contra a A0.
- [ ] **Passo 6.** Commit final do plano com os checkboxes marcados. **Não** faça push nem PR sem o João pedir.
- [ ] **Passo 7.** Relatório ao João:
  - screenshots;
  - tabela de conferência;
  - pendências: de-para, telas do aluno e as R1–R9 da §16;
  - próximos passos em "Claude" e "João".

**Confirmação do João:** sim, para push/PR (fora deste plano).
