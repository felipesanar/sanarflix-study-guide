# Página do Mentor · Onda 3 (Simulados B2C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Os resultados dos simulados B2C (plataforma simulados.sanar.com.br, Supabase `lljnbysgcwvkhlnaqxtt`) e as metas de cada aluno (instituições-alvo + nota de corte) chegam ao Academy uma vez por dia, só para alunos que têm mentor, e acendem no portal do mentor: nota por simulado, possível aprovação contra a meta mais difícil, alertas Regrediram/Estagnados/Não fizeram e o detalhamento questão a questão.

**Architecture:** Pull diário, iniciado pelo Academy. O projeto de simulados expõe UMA edge function de exportação (`mentoria-export`), autenticada por segredo compartilhado, que recebe uma lista de e-mails e devolve só os dados desses alunos. O Academy tem uma edge (`sync-simulados-b2c`) disparada por `pg_cron` + `pg_net` às 04:00 (America/Sao_Paulo) que manda os e-mails dos vínculos ativos, recebe o pacote e faz upsert em tabelas espelho `b2c_*`. As RPCs do mentor leem dessas tabelas. Nenhum dos dois projetos recebe a service role do outro.

**Tech Stack:** Supabase (dois projetos), Deno edge functions, pg_cron + pg_net (já instalados no Academy), plpgsql, React (telas da Onda 2 ganham os números).

**Spec:** Handoff v1.0 telas 01 (alertas), 02, 03 (notas), 04, 04b. Decisões do Felipe: só simulado B2C alimenta o mentor B2C; métrica B2C = % acima do corte da instituição-alvo **mais difícil**; aluno B2C sem mentor faz simulado; "o simulado B2C vem de uma outra base no Supabase… pode criar uma API entre os dois" (14/10).

## Fatos verificados no banco de simulados (14/10/2026)

- `profiles` (id = auth user, `email` 100% minúsculo, `segment` pro=526/532 com e-mail), `onboarding_profiles` (`specialty_id`, `target_institution_ids uuid[]`; 302 PRO com alvo), `enamed_cutoff_scores` (`institution_id`, `specialty_id`, `cutoff_score_general`, `cutoff_score_quota`; 1.058 linhas), `enamed_institutions`, `enamed_specialties`.
- `simulados` (7 publicados, `sequence_number`, janelas), `attempts` (`user_id`, `simulado_id`, `status`, `finished_at`, `score_percentage`, `total_correct`, `total_answered`, `attempt_type` online/offline, `is_within_window`), `attempt_question_results` (`attempt_id`, `question_id`, `selected_option_id`, `correct_option_id`, `is_correct`, `was_answered`), `questions` (`simulado_id`, `question_number`, `text`, `area` — 16 valores, `theme` — 507), `question_options` (`label`, `text`, `is_correct`).
- 236 alunos PRO têm ao menos uma tentativa finalizada.
- Extensões no projeto de simulados: `pg_net` (sem `pg_cron`) — por isso o disparo fica no Academy.

## Global Constraints

- Mesmo regime da Onda 2: branch `feat/mentor-fundacao`; migrations do Academy aplicadas pelo controller com o roteiro; nada de merge/push.
- **Repositório do projeto de simulados**: `C:\Users\felipe.souza\Documents\Projetos (Sanar)\enamed-arena` (GitHub `felipesanar/enamed-arena`). Trabalhar numa branch `feat/mentoria-export` em worktree própria; NÃO mexer na branch principal dele nem em worktrees existentes em `.claude/worktrees/`.
- Dados pessoais: a exportação só devolve alunos cujo e-mail veio na requisição; nunca lista a base. Limite de 2.000 e-mails por chamada.
- Segredo compartilhado `MENTORIA_EXPORT_SECRET`: gerado pelo controller, gravado como secret de edge nos DOIS projetos; nunca em código, migration ou log. Comparação em tempo constante.
- Identidade do aluno = e-mail minúsculo (igual a `mentoria_vinculos.email_normalizado`).
- Métrica: **% de acerto** (`score_percentage`, 0–100). Corte = `cutoff_score_general` (ampla concorrência). **Possível aprovação** = último `score_percentage` ≥ maior corte entre as instituições-alvo do aluno **na especialidade dele**. Aluno sem alvo ou sem corte cadastrado → "Sem meta".
- Alertas: **Regrediram** = queda ≥ 5 p.p. entre os 2 últimos simulados finalizados; **Estagnados** = variação (max − min) < 2 p.p. nos 3 últimos; **Não fizeram o último simulado** = simulado publicado mais recente com janela encerrada e sem tentativa finalizada do aluno; **Próximo do corte** = até 3 p.p. abaixo.
- Questão anulada: não existe flag no banco de simulados hoje → todas entram (registrar como pergunta aberta).

## Perguntas abertas (não bloqueiam; registrar no PR)

1. `cutoff_score_general` está na mesma escala de `score_percentage` (0–100)? Exemplo real: Oftalmologia / FAV geral = 93,0. Se a escala do corte for nota ENAMED e não % de acerto, a comparação muda.
2. Ampla concorrência (`general`) ou cota (`quota`) como padrão? Plano usa `general`.
3. Tentativa `offline` conta igual a `online`? Plano conta as duas, só finalizadas.

---

### Task 1: Exportação no projeto de simulados (`enamed-arena`)

**Files (repo enamed-arena):** Create `supabase/functions/mentoria-export/index.ts`, `supabase/functions/mentoria-export/montar.ts` (lógica pura), `src/test/mentoriaExport.test.ts` (ou o diretório de testes que o repo usar — conferir `package.json`/`vitest.config`), entrada `[functions.mentoria-export] verify_jwt = false` no `supabase/config.toml`.

**Contrato:** `POST /mentoria-export` com header `x-mentoria-export-secret` e corpo `{"emails": ["a@x.com", …], "desde": "2026-01-01T00:00:00Z" | null}`. Resposta 200:

```json
{
  "gerado_em": "2026-10-15T07:00:00Z",
  "simulados": [{"id": "uuid", "sequence_number": 1, "title": "Simulado 1", "questions_count": 100,
                  "execution_window_start": "…", "execution_window_end": "…", "status": "published"}],
  "questoes": [{"id": "uuid", "simulado_id": "uuid", "question_number": 1, "area": "Clínica Médica",
                "theme": "Hipertensão", "correta_label": "C"}],
  "alunos": [{
    "email": "a@x.com", "nome": "Ana", "segment": "pro",
    "especialidade": {"id": "uuid", "nome": "Cardiologia"} | null,
    "alvos": [{"institution_id": "uuid", "nome": "HC-FMUSP", "corte_geral": 82.0, "corte_cota": 75.0}],
    "tentativas": [{"id": "uuid", "simulado_id": "uuid", "finished_at": "…", "score_percentage": 61.0,
                     "total_correct": 61, "total_answered": 98, "attempt_type": "online"}],
    "respostas": [{"attempt_id": "uuid", "question_id": "uuid", "selected_label": "B", "is_correct": false,
                    "was_answered": true}]
  }]
}
```

- Só `attempts` com `finished_at is not null`; `respostas` só de tentativas com `finished_at >= desde` (ou todas quando `desde` é null); `questoes` e `simulados` sempre completos (são poucos: 7 × 100).
- Erros: 401 `{erro:'nao_autorizado'}`; 400 `{erro:'emails_invalidos'}` (não-array, vazio, > 2.000).
- A lógica de montagem (agrupar por e-mail, cortes por especialidade do aluno, label da alternativa) fica em `montar.ts`, função pura testável recebendo as linhas cruas.

- [ ] Testes de `montar.ts` (Vitest): aluno sem onboarding → `especialidade:null, alvos:[]`; alvo sem corte para a especialidade fica fora de `alvos`; `selected_label` vem de `question_options.label`; tentativa não finalizada é ignorada.
- [ ] Deploy (controller, com o segredo) no projeto `lljnbysgcwvkhlnaqxtt`: `verify_jwt=false`. Teste de fumaça: POST sem segredo → 401; com segredo e 1 e-mail real de PRO → 200 com 1 aluno.
- [ ] Commit no repo `enamed-arena` — `feat(mentoria): exportacao de resultados para o Academy`.

### Task 2: Tabelas espelho no Academy

**Files:** `supabase/migrations/20261014210000_b2c_simulados_espelho.sql`, teste de texto.

```sql
create table public.b2c_simulados (
  id uuid primary key, sequence_number int not null, titulo text not null, questoes int,
  janela_inicio timestamptz, janela_fim timestamptz, status text, sincronizado_em timestamptz not null default now()
);
create table public.b2c_questoes (
  id uuid primary key, simulado_id uuid not null references public.b2c_simulados(id) on delete cascade,
  numero int not null, grande_area text, tema text, correta_label text
);
create table public.b2c_alunos (
  email text primary key check (email = lower(email)), nome text, segment text,
  especialidade_id uuid, especialidade_nome text,
  alvos jsonb not null default '[]'::jsonb,           -- [{institution_id, nome, corte_geral, corte_cota}]
  corte_mais_dificil numeric,                          -- max(corte_geral) entre alvos
  sincronizado_em timestamptz not null default now()
);
create table public.b2c_tentativas (
  id uuid primary key, email text not null references public.b2c_alunos(email) on delete cascade,
  simulado_id uuid not null references public.b2c_simulados(id) on delete cascade,
  finalizada_em timestamptz not null, acerto_pct numeric not null, acertos int, respondidas int, modalidade text
);
create index b2c_tentativas_email on public.b2c_tentativas (email, finalizada_em desc);
create table public.b2c_respostas (
  tentativa_id uuid not null references public.b2c_tentativas(id) on delete cascade,
  questao_id uuid not null references public.b2c_questoes(id) on delete cascade,
  marcada_label text, correta boolean not null, respondida boolean not null,
  primary key (tentativa_id, questao_id)
);
create table public.b2c_sync_execucoes (
  id bigserial primary key, iniciado_em timestamptz not null default now(), terminado_em timestamptz,
  alunos int, tentativas int, respostas int, erro text
);
```

- RLS ligada em todas, **sem policy** (leitura só por RPC `SECURITY DEFINER`; escrita só pela edge com service role).
- [ ] Teste de texto: RLS ligada nas 6; zero `create policy`; `email = lower(email)`.
- [ ] Commit — `feat(mentor): onda 3 — tabelas espelho dos simulados B2C`.

### Task 3: Sincronização diária (`sync-simulados-b2c`)

**Files:** `supabase/functions/sync-simulados-b2c/index.ts` + `upsert.ts` (lógica pura) + teste Vitest; `supabase/migrations/20261014210100_b2c_sync_agenda.sql` (cron).

- A edge: (1) lê `distinct email_normalizado` de `mentoria_vinculos where fim is null`; (2) lê `max(finalizada_em)` de `b2c_tentativas` para o `desde` (menos 2 dias de folga); (3) chama `mentoria-export` em lotes de 1.000 com o segredo; (4) upsert de `b2c_simulados`, `b2c_questoes`, `b2c_alunos` (calcula `corte_mais_dificil`), `b2c_tentativas`, `b2c_respostas` (ON CONFLICT DO UPDATE); (5) grava `b2c_sync_execucoes` com contagens ou `erro`.
- Autenticação da própria edge: só aceita chamadas com `Authorization: Bearer <service role>` (o cron manda) — rejeita o resto com 401.
- Cron (migration): `select cron.schedule('sync-simulados-b2c', '0 7 * * *', $$ select net.http_post(url := '<gvqv>/functions/v1/sync-simulados-b2c', headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'))) $$);` — 07:00 UTC = 04:00 em São Paulo. Se o segredo `service_role_key` não existir no Vault do Academy, o controller o cadastra antes (não versionar o valor).
- [ ] Testes de `upsert.ts`: `corte_mais_dificil` = max dos `corte_geral`; aluno sem alvos → null; lote dividido em 1.000.
- [ ] Commit — `feat(mentor): onda 3 — sincronizacao diaria dos simulados B2C`.

### Task 4: RPCs de desempenho do mentor

**Files:** `supabase/migrations/20261014210200_b2c_rpcs_mentor.sql`, teste de texto, `src/services/mentor/desempenho.ts` + teste.

- `mentor_desempenho_turma(p_simulados uuid[] default null)` → por aluno da turma (vínculo ativo, via `mentor_ativo_id()`): `{email, notas: [{simulado_id, sequence_number, acerto_pct}], ultimo_acerto, corte_mais_dificil, vs_corte_pp, situacao ('acima','proximo','longe','sem_meta','sem_simulado'), regrediu, estagnado, fez_ultimo}` + agregados `{possivel_aprovacao_pct, acerto_medio_ultimo, participacao_ultimo: {fizeram, total}}`. Filtro `p_simulados` recorta tudo (null = todos).
- `mentor_detalhamento(p_simulados uuid[])` → por grande área e tema: `% acerto` e respostas; por questão: número, área, tema, `% acerto`, distribuição por alternativa e e-mails por alternativa (para "Mensagem pra quem marcou C").
- `mentor_aluno_notas(p_email text)` → notas por simulado + desempenho por área → tema (agregado), para o drawer.
- Todas `SECURITY DEFINER`, `mentor_ativo_id()` + `mentor_exige_alunos` quando recebem e-mail; `revoke … from public, anon; grant … to authenticated`.
- [ ] Testes de texto com as regras numéricas (5, 2, 3 p.p.) literais no SQL; testes do service.
- [ ] Commit — `feat(mentor): onda 3 — RPCs de desempenho B2C`.

### Task 5: Telas acendem

- Início: alertas Regrediram, Estagnados, Não fizeram o último simulado (com "Ver os N que não fizeram") e faixa do último simulado (fizeram X de Y).
- Minha Turma (tela 02): filtro de simulados em chips (padrão do Gestor, `SeletorSimulados`), 4 cards com Primeiro/Anterior/Atual, segmentos Constantemente acima / Em variação / Constantemente abaixo / Sem histórico, colunas % por simulado e vs corte (p.p.); ausência = "–" fora da média.
- Drawer: notas dos simulados e desempenho por área.
- Detalhamento (tela 04/04b): reusar `TabelaQuestoes`, `DistribuicaoAlternativas` e `CascataDiagnostico` do Gestor alimentados por `mentor_detalhamento`; "Mensagem pra quem marcou X" abre o mural com esses alunos.
- Diagnóstico por prevalência e temas críticos ficam para depois (dependem da tabela de prevalência ENAMED).
- [ ] Testes de componente das regras visíveis (chip de simulado recorta, "–" fora da média, alerta só com ≥ 2 simulados).
- [ ] Commit — `feat(mentor): onda 3 — turma, inicio, drawer e detalhamento com simulados B2C`.

### Task 6: Aplicação e verificação

- [ ] Controller gera o segredo, grava nos dois projetos, faz deploy de `mentoria-export` (simulados) e `sync-simulados-b2c` (Academy), aplica as migrations com o roteiro, roda o sync uma vez manualmente e confere `b2c_sync_execucoes` (contagens > 0, `erro` nulo) e `get_advisors security` nos dois projetos.
- [ ] Simular um mentor com 2 alunos reais de teste numa transação desfeita e conferir `mentor_desempenho_turma`.
