# P8 — O `user_id` pode ficar impresso no cartão? Auditoria (16/10/2026)

**Pergunta:** o QR do cartão pessoal coloca o `users.id` (UUID) no papel. Qualquer pessoa que fotografe um cartão sabe o UUID de um aluno. Isso só é seguro se **saber um `user_id` nunca der acesso nem permitir uma ação**.

**Método (somente leitura):**
1. Leitura do código das Edge Functions, das migrations e do front, feita por um agente de exploração (55 leituras).
2. Consultas de **catálogo** no Supabase de produção (`gvqvrmkizemwsasmupmo`, ref confirmado antes): funções, privilégios, políticas de RLS e lista de funções publicadas. **Nenhuma linha de dado de aluno foi lida.**
3. Conferência por mim dos achados mais graves, direto no código e no banco.

Legenda: **[verificado]** = confirmei no código e/ou no banco; **[relatado]** = veio da leitura do agente e não foi reconferido.

## Conclusão
**Hoje não é seguro imprimir o `user_id`.** Há uma falha que não exige login (F1) e uma que exige só uma conta de aluno (F2). As duas se corrigem com mudança pequena no código do Academy. Com F1 e F2 corrigidas e F3 aceita por escrito, a P8 pode ser fechada.

O resto do que foi examinado está correto: as políticas de RLS das tabelas por usuário exigem `auth.uid() = user_id` (ou papel), e as funções que o `anon` consegue executar são todas protegidas ou rodam com as permissões de quem chama.

## Achados

| # | Sev. | Onde | O que faz quem só sabe o UUID da vítima | Status |
|---|---|---|---|---|
| F1 | **ALTA** | Edge Function `session-security`, `supabase/functions/session-security/index.ts:31, 45-66` | Derruba **todas as sessões** de qualquer usuário (inclusive admin), sem autenticação. Basta um POST com a anon key (pública no front), `{"action":"invalidate_sessions","userId":"<UUID>"}` e o cabeçalho `Origin` de um domínio permitido (qualquer cliente que não é navegador consegue forjá-lo). | **[verificado]** no código e na versão publicada (v280, `verify_jwt: false`). |
| F2 | **MÉDIA** | Edge Function `gestor-ai-insights`, modo `aluno`, `index.ts:1249-1266` | Qualquer usuário **logado** (até um aluno comum) lê o texto de IA sobre o desempenho de outro aluno, se um gestor o gerou nas últimas 6 horas. Precisa do `iesId` (a lista de IES é pública) e do UUID. | **[verificado]**: o cache é lido (`lerCache`) **antes** das RPCs que checam papel e IES. |
| F3 | BAIXA | RPCs `get_user_roles(uuid)` e `has_role(uuid, app_role)` | Um usuário **logado** descobre se um UUID tem papel de admin/gestor. Para um UUID de aluno, só confirma que não tem papel. | **[verificado]** com `pg_get_functiondef` e grants: `SECURITY DEFINER`, sem checar `auth.uid()`; `authenticated` executa, `anon` não. O `has_role` é a base das políticas de RLS, e a migration `20260807071431…` reverteu um guard que quebrou o login. Provável decisão: **aceitar por escrito**. |
| F4 | MÉDIA (fora do tema UUID) | Edge Function `send-study-reminder`, `index.ts:22-45` | Sem autenticação: qualquer pessoa com a anon key faz o domínio de e-mail da Sanar enviar mensagem a **qualquer destinatário**, com HTML livre (`subjects[].name` entra sem escape). Serve para phishing. Quem **não envia** `Origin` passa. | **[verificado]**. Não depende do UUID, mas é urgente. |
| F5 | BAIXA | `check-and-send-reminders` e `notify-performance-released` | Qualquer pessoa com a anon key dispara o lote de lembretes e a notificação em massa (spam e custo). Não leem id do pedido. | **[relatado]** |
| F6 | Higiene | Privilégios de tabela | O papel `anon` tem **todos** os privilégios (inclusive `TRUNCATE`) em todas as tabelas do `public`, por causa do ACL padrão. O RLS está ligado em todas e nenhuma política é satisfeita por anônimo, então a API não entrega nada. É o item já mapeado em [[sanarflix-supabase-default-acl-revoke]]. | **[verificado]** |

Observação transversal **[verificado]**: todas as 37 Edge Functions publicadas estão com `verify_jwt: false`. A proteção depende **só** da checagem dentro de cada função. O `supabase/config.toml` do repositório desliga isso apenas em duas, então **não reflete o que está publicado**.

## O que foi verificado e está correto
**No banco [verificado]:**
- RLS ligado em **todas** as tabelas do `public`.
- Políticas das tabelas por usuário (`answer_progress`, `simulados_finalizados`, `simulados_iniciados`, `user_progress*`, `study_progress`, `push_subscriptions`, `user_sessions`, `flashcards`, `error_notebook_entries`, `calendar_*`, `study_reminders`, `user_notes`, `question_favorites`, `analytics_events`, `page_views` e outras): todas `auth.uid() = user_id` ou `has_role(...)`. Nenhuma é satisfeita só por conhecer um UUID.
- Políticas `USING (true)`: apenas catálogos e dados sem PII (`ies`, `ies_branding`, `ies_features`, `feature_catalog`, `simulado_cadernos`, `intensivouscs`, `dados_meu_semestre` para autenticados) e papéis de serviço.
- Funções executáveis pelo `anon`: 13, todas com guarda em `auth.uid()` ou sem `SECURITY DEFINER`. Em particular `get_gestor_aluno_desempenho_por_area(p_ies_id, p_aluno_id, …)` aceita o `anon` no grant, mas o corpo exige papel (admin/gestor) e IES; sem login ela nega.
- `admin_import_one_response(p_user_id …)` não é executável por `anon` nem por `authenticated`.

**No código [relatado pelo agente]:** `auth-login`, `generate-user-link`, `get-progress-hub`, `get-study-contents`, `save-push-subscription`, `save-calendar-arrangement`, `corrigir-simulado`, `ai-study-recommendation`, `analyze-error-patterns`, `delete-user`, `admin-user-support`, `admin-import-simulado-responses`, `admin-bulk-update-email`, `admin-upload-*`, `b2b-create-user`, `old-user-creation`, `sync-user-auth`, `update-password`, `request-password-reset`, `resend-welcome-link`, `metabase-proxy` e `gestor-ai-insights` (fora o cache): obtêm o usuário do JWT e/ou exigem papel. Nenhuma função usa o `user_id` como segredo, sal ou token, e o front não usa o UUID em rota ou query como identidade.

## Não verificado
- **Políticas de storage** e buckets (`sanarclass-files`, `imagensSimulado`, `feedback-screenshots`).
- **`cron.job`**: como `check-and-send-reminders` e `notify-performance-released` são chamadas e se há chave embutida no comando.
- A tabela `profiles`, citada em `caderno-reminders/index.ts:70`, que nenhuma migration cria.
- As Edge Functions `create-test-user`, `delete_all_users` e `migrate_users` existem como pastas vazias no repositório; **não estão publicadas** (conferido na lista).

## O que corrigir antes de imprimir
| # | Correção | Esforço |
|---|---|---|
| F1 | `session-security`: obter o id com `supabase.auth.getUser(token)` e **ignorar** o `userId` do corpo (o front só chama a função com o próprio id). Se algum fluxo administrativo precisar derrubar sessão de outro usuário, exigir papel admin. | Pequeno |
| F2 | `gestor-ai-insights`: autorizar (papel + IES) **antes** de `lerCache`, por exemplo chamando a RPC guardada ou `has_role` + `gestor_pode_acessar_ies`. | Pequeno |
| F3 | Decidir por escrito: aceitar (recomendado enquanto o login depender de `has_role` sem guarda) ou migrar para uma versão com guarda e revisar o login. | Decisão |
| F4 | `send-study-reminder`: exigir JWT e usar o e-mail do usuário autenticado como destinatário. | Pequeno |
| F6 | Revogar privilégios do `anon` nas tabelas (migration aditiva, com portão de produção). | Médio |

Estas correções são **do código do Academy**, fora do `services/cartao-omr`, e nenhuma foi feita. Dependem de decisão e de aprovação do João.
