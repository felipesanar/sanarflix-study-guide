# Diagnóstico técnico — Timeout em Portal do Admin → Simulados

Sem alterar código. Relatório completo conforme solicitado.

---

## 1. Causa raiz

O timeout (`57014 — canceling statement due to statement timeout`) não vem do volume bruto das tabelas — vem do **custo de avaliar as RLS policies de `questoes_simulado` linha-a-linha** em qualquer consulta que toque essa tabela direta ou indiretamente (embedding `questoes_simulado(count)`, EXISTS interno, etc.).

A tabela `questoes_simulado` tem **6 policies permissivas**, avaliadas em **OR**, e uma delas é altamente cara:

```
Users can view questions they have answered:
  EXISTS (SELECT 1 FROM answer_progress ap
          WHERE ap.question_id = questoes_simulado.id
            AND ap.user_id = auth.uid())
```

`answer_progress` tem **~192 mil linhas** e **35 MB**. Para cada uma das 2.402 questões o planner avalia esse EXISTS, somado a outras 5 policies que chamam `has_role()`, `get_current_user_ies_id()` e `get_accessible_ies()` (funções `SECURITY DEFINER` que por sua vez fazem SELECT em `user_roles`, `users`, `user_groups`, `group_ies`). Sob a role `authenticated` no PostgREST, esse custo agregado estoura o `statement_timeout` de 8 s.

Como prova: executado como superuser (RLS desligada), as mesmas queries respondem em <2 ms:

- `SELECT * FROM simulados_admin ORDER BY created_at DESC` → 0,17 ms
- `SELECT simulado_id FROM questoes_simulado WHERE simulado_id IN (...)` → 1,3 ms
- `SELECT * FROM simulados_finalizados ORDER BY finalizado_em DESC` → 0,46 ms

Ou seja: **o gargalo é exclusivamente RLS**, não volume nem índices ausentes.

---

## 2. Evidências — queries que estão falhando

| # | Origem | Query | Toca `questoes_simulado` sob RLS? |
|---|--------|-------|-----|
| 1 | `src/components/admin/SimuladosImportRespostasTab.tsx:137` | `from('simulados_admin').select('id, nome, ies_ids, questoes_simulado(count)')` | **Sim — embedding LATERAL + json_agg** |
| 2 | `src/components/admin/SimuladosTab.tsx:198` | `from('questoes_simulado').select('simulado_id').in('simulado_id', ids)` | **Sim — leitura direta** |
| 3 | `src/components/admin/MonitoramentoTab.tsx:54` | `from('answer_progress').select('user_id, correct').eq('simulado', sim.id)` em loop por simulado | Indireto, mas custoso |
| 4 | `src/components/admin/LiberacoesTab.tsx:47` | `from('simulados_finalizados').select('*')` + `users` + `simulados_admin` | Não — leve, mas o toast de timeout que aparece **não vem dessa aba**: o texto exato é `'Erro ao carregar simulados'`, que está em **SimuladosTab** e **SimuladosImportRespostasTab**. `LiberacoesTab` mostra `'Erro ao carregar finalizações'`. Logo, o toast visto no print foi disparado pela aba `Simulados` (default), e não por `Liberações`. |

**A correção anterior cobriu parcialmente o item 2 (separou da `simulados_admin`), mas o item 1 ainda dispara o embedding pesado original.** Como `SimuladosImportRespostasTab` é montado dentro do mesmo grupo de tabs e a aba "Importar respostas" não está visível por padrão, o toast persiste porque continua existindo a query do item 2 quando o admin abre a aba `Simulados`, e/ou o item 1 quando navega para `Importar respostas`.

---

## 3. Volume e índices (não são o problema, mas listados)

| Tabela | Linhas | Tamanho | Índices relevantes |
|---|---|---|---|
| simulados_admin | 24 | 160 kB | pk + status + ies_ids (gin) + data_liberacao |
| questoes_simulado | 2.402 | 6,7 MB | pk + simulado_id + (simulado_id, grande_area/especialidade/tema) |
| simulados_finalizados | 413 | 320 kB | pk + user_id + simulado_id + (user_id, simulado_id, tentativa) |
| simulados_iniciados | 421 | 264 kB | — |
| answer_progress | 192.187 | 35 MB | (não consultado em detalhe — possível ganho com índice em `user_id, question_id`) |
| users | 7.272 | 2,3 MB | pk + email + id_ies |
| user_roles | 86 | 72 kB | — |

Nenhuma tabela está grande o suficiente para justificar timeout por si só. Não há `created_at` indexado em `simulados_admin`, mas com 24 linhas é irrelevante (seq scan + sort em 0,06 ms).

---

## 4. Paginação e ordenação

- Nenhuma das telas (`SimuladosTab`, `LiberacoesTab`, `SimuladosImportRespostasTab`) usa paginação — todas carregam o conjunto inteiro. Com os volumes atuais isso é aceitável; **não é a causa do timeout**.
- `ORDER BY created_at DESC` em `simulados_admin` não está indexado, mas custa 0,06 ms. Não há gargalo de ordenação.

---

## 5. Views, RPCs e cron

- Não há views ou materialized views envolvidas no admin de simulados.
- RPCs envolvidas (`get_user_simulados`, `get_user_performance_aggregates`, `get_user_rankings`, `get_institutional_simulados`, `get_questions_by_subspecialty`) são chamadas **fora** da aba `Simulados` admin — não participam do erro relatado.
- Não há auto-promoção `aguardando → ativo`. O cron `notify-performance-released-job` apenas envia e-mails.

---

## 6. FAI

- A IES FAI tem simulados normalmente cadastrados (`Simulado ENAMED 1 - FAI`, `2º simulado FAI`, `Simulado 2 - FAI`) e finalizações reais (100 e 81 respectivamente).
- Não há nada específico da FAI no plano de execução — o timeout é global a qualquer admin que abra a aba; a FAI é só onde tipicamente é reproduzido porque tem mais alunos finalizados.

---

## 7. Erros HTTP / refresh token

- `HTTP 500` ao chamar PostgREST = a resposta do timeout 57014 (PostgREST devolve 5xx quando o Postgres cancela).
- `HTTP 400` em `order=created_at.desc` = costuma vir quando o cliente recebe `null` após o timeout e tenta encadear outra query. Consequência, não causa.
- `AuthApiError: Invalid Refresh Token / Refresh Token Not Found` = **consequência**, não causa raiz. Acontece quando a página fica aberta por horas com o admin debugando e o refresh expira. Não está relacionado à query.

---

## 8. Impacto

- **Portal do Admin → Simulados** (aba default): trava o `fetchSimulados` quando a leitura separada em `questoes_simulado` cai no caminho RLS pesado por causa da policy `Users can view questions they have answered` somada a outras 5.
- **Portal do Admin → Simulados → Liberações**: o toast `Erro ao carregar simulados` que aparece é da aba irmã `Simulados` (a `LiberacoesTab` em si carrega ok).
- **Portal do Admin → Simulados → Importar respostas**: continua usando o embedding pesado `questoes_simulado(count)` — falha sempre que aberto.

---

## 9. Correção recomendada — passo a passo técnico

Ordem do mais barato para o mais estrutural:

**A. Imediato — remover acessos pesados a `questoes_simulado` no admin**
1. Em `SimuladosImportRespostasTab.tsx:137`, eliminar o embedding `questoes_simulado(count)` e usar o mesmo padrão já aplicado em `SimuladosTab` (2 queries + agregação no cliente).
2. Em `SimuladosTab.tsx`, ao invés de `from('questoes_simulado').select('simulado_id').in('simulado_id', ids)`, criar e usar uma **RPC `SECURITY DEFINER`** `get_simulados_questoes_count(ids uuid[])` que retorna `(simulado_id uuid, total int)`. A função roda fora da RLS, é instantânea, e é a única consumidora do contador no admin.

**B. Curto prazo — enxugar RLS de `questoes_simulado`**
3. Consolidar as 6 policies em **uma única** policy `SECURITY DEFINER` (`can_view_questao(question_id)`) que faz:
   - `has_role(uid,'admin')` → true
   - `has_role(uid,'b2b_partner')` → true
   - role professor/gestor_grupo: cruza `simulados_admin.ies_ids` com IES acessíveis
   - aluno: simulado ativo & IES do aluno, ou EXISTS em `answer_progress`
   Resultado: uma chamada de função vs. seis OR encadeados com EXISTS.
4. Reescrever a policy `Users can view questions they have answered` para usar `IN (SELECT question_id FROM answer_progress WHERE user_id = auth.uid())` apenas dentro da função consolidada, evitando o EXISTS correlacionado linha-a-linha.

**C. Médio prazo**
5. Adicionar índice `CREATE INDEX idx_answer_progress_user_question ON answer_progress (user_id, question_id);` — útil para a policy acima e para outras consultas de aluno.
6. Adicionar paginação na `LiberacoesTab` (`range()` por 100) para preparar crescimento futuro de `simulados_finalizados`.
7. Considerar **auto-promoção** `aguardando → ativo → encerrado` via cron, eliminando a necessidade de status calculado no cliente.

---

## 10. Correção imediata (o mínimo para restaurar o funcionamento agora)

1. Substituir a query do passo **A.1** (`SimuladosImportRespostasTab`) pelo padrão de 2 queries.
2. Substituir a query do passo **A.2** (`SimuladosTab`) pela **RPC `SECURITY DEFINER`** que conta questões por simulado.

Apenas esses dois passos eliminam o timeout em todas as abas internas de Simulados sem mexer em RLS. As policies podem ser tratadas depois com calma.

---

## Restrições respeitadas
- Nenhuma alteração de código foi feita.
- Nenhuma edge function foi tocada.
- Nenhum cron foi alterado.
- Diagnóstico baseado em RLS lidas no banco, EXPLAIN reais e mapeamento completo das queries do frontend.