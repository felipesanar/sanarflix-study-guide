
# Relatório de Investigação — Admin → Simulados / Liberações (IES FAI)

Sem alterações aplicadas. Esta é uma análise técnica seguida de plano de correção para aprovação.

## 1. Diagnóstico atual

**O que funciona**
- A IES FAI (`id 2c458bcb-98f0-4dc2-8b43-298e85298845`) e seus simulados existem corretamente no banco:
  - `Simulado ENAMED 1 - FAI` (`f2621d1e…`, ativo, `liberacao_desempenho = ao_encerrar`) — 100 finalizações.
  - `2º simulado FAI` (`4063dda0…`, ativo) — 81 finalizações.
  - `Simulado 2 - FAI` (`818d82ab…`, aguardando).
- Cron `notify-performance-released-job` (a cada 15 min) está rodando: `net._http_post` retorna `200` em todas as execuções recentes; 100 notificações já registradas para o simulado FAI.
- `cron.job` lista 3 jobs ativos, todos executando sem erro.

**O que não funciona**
- A aba "Admin → Simulados" (`SimuladosTab.tsx`) está abortando com **`57014 — canceling statement due to statement timeout`** confirmado em `postgres_logs` (4 ocorrências consecutivas no último ciclo de uso).
- Sem essa lista, a admin não acessa ações por simulado (editar, encerrar, **liberar manualmente** desempenho, ver questões), incluindo os simulados da FAI.
- A aba "Liberações" (`LiberacoesTab.tsx`) lista finalizações individuais (re-tentativas), **não** liberação de desempenho de simulado — há sobreposição de nomenclatura na conversa.

## 2. Causa raiz

A query disparada pelo `fetchSimulados` em `SimuladosTab.tsx:182-186` é:

```ts
supabase.from('simulados_admin').select('*, questoes_simulado(count)')
```

O PostgREST traduz isso para um `LEFT JOIN LATERAL` com `json_agg` sobre `questoes_simulado` por linha de `simulados_admin` (query exata recuperada de `postgres_logs`):

```text
LEFT JOIN LATERAL (
  SELECT json_agg(...) FROM (
    SELECT "count" FROM "questoes_simulado" qs WHERE qs.simulado_id = sa.id
  ) ...
)
```

A tabela `questoes_simulado` tem **5 RLS policies permissivas** que viram um `OR` gigante avaliado para cada linha da subquery (2402 questões × 24 simulados):

1. `Admins podem gerenciar questões` — `has_role(auth.uid(),'admin')` (rápido, mas não corta as demais).
2. `B2B partners can view all questoes` — `has_role(...,'b2b_partner')`.
3. `Gestor de grupo pode ver questoes do grupo` — `EXISTS (SELECT 1 FROM simulados_admin sa WHERE sa.id = qs.simulado_id AND sa.ies_ids && get_accessible_ies(auth.uid()))`.
4. `Professors can view questoes from their IES simulados` — `EXISTS (SELECT 1 FROM simulados_admin sa WHERE sa.id = qs.simulado_id AND get_current_user_ies_id() = ANY(sa.ies_ids))`.
5. `Users can view questions they have answered` — `EXISTS (SELECT 1 FROM answer_progress ap WHERE ap.question_id = qs.id AND ap.user_id = auth.uid())`.
6. `Usuários podem ver questões de simulados ativos` — `EXISTS (SELECT 1 FROM simulados_admin sa WHERE sa.id = qs.simulado_id AND sa.status='ativo' AND get_current_user_ies_id() = ANY(sa.ies_ids))`.

Esse `OR` é re-avaliado dentro do LATERAL para cada uma das 2402 questões; cada `EXISTS` chama funções `STABLE` (`has_role`, `get_current_user_ies_id`, `get_accessible_ies`) que executam SELECT em `user_roles` / `users`. Como `answer_progress` tem **191.987 linhas** e `users` 7.272, mesmo com os índices presentes o plano gera milhões de avaliações lógicas e estoura o `statement_timeout` (8s padrão do PostgREST).

Como `EXPLAIN ANALYZE` executado fora do PostgREST (sem RLS) resolve em 1,2 ms, o gargalo é **inquestionavelmente o RLS aplicado sobre o embedding `questoes_simulado(count)`**, não os dados em si.

Não há nada específico da IES FAI causando o timeout — a query falha pra qualquer admin/IES. A FAI só foi a evidência porque a admin tentou abrir os simulados da FAI.

## 3. Impacto

- **Não é exclusivo da FAI.** Qualquer admin que abrir a aba "Simulados" hoje atinge o mesmo timeout. A página fica vazia ⇒ nenhuma ação administrativa (editar, encerrar, liberar desempenho, importar respostas, anular questão) é executável via UI.
- **Risco operacional alto:** sem essa tela a equipe perde o controle de simulados em andamento; a única via é SQL direto.
- O timeout tende a **piorar** linearmente: cada novo simulado adiciona ~100 questões e milhares de `answer_progress`, ampliando o cartesiano interno do LATERAL.
- Tabelas `simulados_finalizados` (LiberacoesTab) e `simulados_admin` isoladas continuam respondendo bem.

## 4. Liberação automática — como funciona hoje

Não existe "ativação automática" persistida. O ciclo de vida real é:

- `simulados_admin.status` é `aguardando` ou `ativo` (definido manualmente no insert/update). **Não há cron, trigger nem edge function** que altere `status` com base em `data_liberacao`/`data_encerramento`.
- O frontend calcula um status efêmero em `calcularStatusSimulado` (`SimuladosTab.tsx:24`) e `simuladosApi.listarSimulados` filtra cliente-side por `data_liberacao <= now()` e `data_encerramento >= now()` (`src/services/simuladosApi.ts:8-34`).
- RLS `Usuários podem ver simulados ativos da sua IES` exige literalmente `status='ativo'`. Logo, **simulado deixado como `aguardando` no banco nunca aparece automaticamente para alunos**, mesmo após `data_liberacao` passar — precisa de um update manual de status.
- Liberação de desempenho (`liberacao_desempenho ∈ {imediato, agendado, ao_encerrar}`) também é avaliada cliente-side ao montar a tela de desempenho. O cron `notify-performance-released-job` apenas **envia e-mail**; ele não muda estado no banco.

**Vulnerabilidades:**
- Falha silenciosa quando o simulado é criado em `aguardando` e nunca é promovido para `ativo` — explica o caso anterior em que "deveria ter liberado e não liberou": muito provavelmente o status ficou em `aguardando` e ninguém promoveu.
- Cron de notificação não tem alerta em caso de falha; `Resend` é opcional, sem fallback.
- Não há logging persistente de execuções/falhas (`performance_notifications_sent` só registra sucesso de envio).

## 5. Plano de correção

### Críticas (resolver para liberar a aba hoje)

1. **Remover o embedding pesado** em `SimuladosTab.fetchSimulados`:
   - Trocar `select('*, questoes_simulado(count)')` por duas queries paralelas:
     - `from('simulados_admin').select('*').order('created_at', desc)`
     - `from('questoes_simulado').select('simulado_id').in('simulado_id', ids)` → agregar contagens no cliente.
   - Custo: ~50 linhas em um único arquivo, sem mexer em RLS. Elimina o LATERAL × OR pesado do PostgREST.

2. **(Opcional, alternativa)** Criar RPC `admin_list_simulados()` `SECURITY DEFINER` que retorna `simulados_admin + count(questoes)` sem passar pelo OR de policies — usar apenas se a opção 1 não bastar.

### Recomendadas (estabilizar e prevenir recidiva)

3. **Promoção automática de status `aguardando → ativo → encerrado`** via cron (a cada 1 min) ou via policy que aceite `aguardando` quando `data_liberacao <= now()`. Resolve o "não liberou sozinho".
4. Adicionar **alerta/observabilidade** no `notify-performance-released`: gravar erros em tabela `cron_errors` e emitir métrica.
5. **Simplificar RLS de `questoes_simulado`**: consolidar as 5 policies SELECT em 2 (`admin/b2b/professor/gestor` via `has_role` OR ies-check + `aluno via simulado ativo`) usando funções `SECURITY DEFINER` (`can_view_questoes_for(simulado_id)`). Diminui drasticamente o OR avaliado em embeddings.
6. Adicionar `idx_answer_progress_user_question (user_id, question_id)` (atualmente só há índices separados) para acelerar o `EXISTS` da policy 5 quando ela for re-utilizada.

### Futuras (otimização)

7. Paginar `SimuladosTab` (ex: 25 por página) e mover busca para servidor.
8. Materialized view diária `mv_simulados_admin_summary` com contagens, atualizada por trigger em `questoes_simulado`.
9. Telemetria de tempo das principais RPCs do admin no `analytics_events` para detectar regressões.

## 6. Critérios de sucesso atendidos

- [x] Query do timeout identificada (LATERAL com `questoes_simulado(count)` + 5 policies OR).
- [x] Fluxo completo da página documentado (`SimuladosTab` → PostgREST → RLS questoes_simulado).
- [x] Liberação automática mapeada (não existe promoção de status; cron só notifica).
- [x] Falha anterior explicada (simulado em `aguardando` sem promoção manual).
- [x] Riscos: aplicáveis a todas as IES, não só FAI.
- [x] Plano de correção em 3 níveis.
- [x] Nenhuma alteração executada.

Aprove para eu seguir com a **correção crítica #1** (refatorar `fetchSimulados`) — é a única necessária para destravar a aba imediatamente. Recomendadas/Futuras podem ser priorizadas em seguida conforme sua decisão.
