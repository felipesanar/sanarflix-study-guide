# Simplificação do modelo de acesso do Portal do Gestor

Data: 2026-08-07 · Decisão de produto: Felipe Souza

## O problema

O acesso ao Portal do Gestor hoje depende de **três** perguntas encadeadas:

1. o usuário tem papel de gestor?
2. essa IES está no escopo dele?
3. a IES tem a feature `gestao.enabled` ligada?

A terceira nunca serviu ao produto. Ela existe como herança do modelo de features por
IES, e produziu três problemas concretos em menos de um mês:

- Uma limpeza que removeu a chave `gestao.portal_v2` derrubou junto o master
  `gestao.enabled`, porque a helper `user_has_feature_for_ies` embute o master. Ninguém
  percebeu até uma auditoria.
- Uma migration gerada por outro caminho recriou duas RPCs sem o guard, apagando-o de
  novo em silêncio.
- Das 24 IES, 10 nunca receberam linha de `gestao.enabled`. Elas estão de fato bloqueadas
  do portal, e o estado "sem linha" não distingue "não contratou" de "esqueceram".

**Decisão:** todo gestor de faculdade tem acesso completo ao portal, sempre. Não há
liberação por IES. Sobram duas perguntas: papel e escopo de IES.

## O que fica de fora, deliberadamente

Removendo `gestao.enabled`, a Sanar perde a capacidade de desligar o portal de uma IES
específica sem revogar a role de cada gestor — inadimplência, disputa contratual,
investigação. Isso foi levantado e aceito: o controle passa a ser comercial, não técnico.

O papel `atendimento` (CX) **deixa de acessar** o portal. Hoje ele passa por um bypass
dentro da helper de feature; com a helper fora, sobra só papel, e `atendimento` não é
papel de gestor. É mudança de comportamento — se alguém do CX usa o portal para dar
suporte, vai perceber.

## Escopo

Dois PRs, ambos posteriores ao merge do PR #17.

### PR 1 — simplificação e endurecimento de baixo risco

**1.1 · Banco: tirar o guard de feature das 11 RPCs**

Uma migration recria as 11 `get_gestor_*` removendo **apenas** o bloco de
`gestao.enabled`. Os outros três blocos do preâmbulo ficam intactos e nesta ordem:

```
papel (has_role admin/gestor/gestor_grupo)  -> Access denied
resolucao de v_ies                          -> IES not resolved
gestor_pode_acessar_ies(v_ies)              -> Permission denied: cannot access this IES
```

`get_gestor_contexto` perde o `user_has_feature('gestao.enabled')` e passa a ter só o
bloco de papel.

Base obrigatória: as duas migrations mais recentes que recriam cada função
(`20260807021546_*.sql` para 9 delas, `20260807022207_*.sql` para `get_gestor_detalhamento`
e `get_gestor_questoes`). Usar base mais antiga reverte fixes de produção — já aconteceu.

**1.2 · Banco: apagar as chaves e a helper órfã**

- `DELETE` das 3 chaves `gestao.enabled`, `gestao.exportar`, `gestao.ia` de
  `feature_catalog` e `ies_features`.
- `DROP FUNCTION public.user_has_feature_for_ies(text, uuid)` — fica sem chamador.
- **`public.user_has_feature(text) NÃO é tocada.** 19 RPCs institucionais legadas ainda a
  usam para chaves `aluno.%`. O ramo dela que trata `gestao.%` vira código morto inerte.

`gestao.exportar` e `gestao.ia` são dado morto **no estado pós-#17**, não hoje. Correção de
07/08, depois que uma revisão pegou o erro: `src/experiences/gestor/GestorLayout.tsx:51-52`
lê as duas (`canExport`, `canChat`) e com elas controla os botões Exportar e IA e os
drawers correspondentes. Esse arquivo é da experiência legada do gestor, **apagada pelo
PR #17** — some no merge. A primeira varredura afirmou "zero consumidores" porque rodou
na branch do #17, onde o arquivo já não existe.

Consequência prática, e é ela que importa: **este trabalho precisa ter como base a `main`
depois do merge do #17**, nunca a `main` de hoje. Se as chaves forem apagadas enquanto
`GestorLayout.tsx` ainda existir, os botões Exportar e IA somem em silêncio para todo
gestor, sem teste que acuse.

`get_gestor_contexto` devolve `podeExportar: true` hardcoded, sem checar feature — isso
sim é verdade nos dois estados.

**1.3 · Front: gate por papel, não por feature**

`ExperienceGuard` passa a exigir só `hasExperience(access, 'gestao')`, removendo a
checagem de `accessRules.desempenhoInstitucional`. Esse campo hoje é
`hasFeature('gestao.enabled')` (`useAccessRules.ts:35`) e também alimenta
`getDefaultRouteForUser` — passa a derivar de papel.

**1.4 · Admin: remover os toggles**

Tirar as 3 chaves de gestão do catálogo exibido no console. Interruptor que não faz nada
é a armadilha que este projeto já pagou duas vezes.

**1.5 · Furo: funções de papel aceitam UUID alheio**

`get_user_roles(_user_id)`, `has_role(uid, role)` e `get_accessible_ies(_user)` recebem um
UUID arbitrário e não conferem se é o do chamador. Qualquer autenticado — inclusive
aluno — enumera papel e escopo de IES de qualquer conta.

Verificado em produção em 07/08: `anon` **não** executa nenhuma das três
(`has_function_privilege('anon', ...) = false`); o ACL está em `authenticated` e
`service_role`. Não é exposição pública, é divulgação entre usuários autenticados.

Correção **dentro** da função, não por `REVOKE`: as RLS policies chamam `has_role` e
revogar de `authenticated` derrubaria todas. Cada uma passa a recusar quando o UUID
pedido não é o do chamador, salvo se o chamador for admin. Para `has_role` isso é seguro
porque as policies sempre a chamam com `auth.uid()` — o caso self passa.

**1.6 · Furo: `announcements` não filtra por persona**

Confirmado em produção em 07/08. A policy `"Users can view their IES announcements"`
filtra `ativo`, `data_expiracao` e `visibilidade`, e nada mais. A coluna `publico_alvo`
foi adicionada depois e o filtro por persona existe **só dentro** da RPC
`get_gestor_avisos`. Um aluno lê aviso de gestor via `GET /rest/v1/announcements`.

Acrescentar o filtro de `publico_alvo` à policy de SELECT.

### PR 2 — as 9 policies que autorizam pela função errada

Nove RLS policies em seis tabelas (`answer_progress`, `questoes_simulado`,
`resultados_alunos_tri`, `resultados_ies_tri`, `simulados_admin`, `simulados_finalizados`)
autorizam por `get_accessible_ies` em vez de `gestor_pode_acessar_ies`.

Consequência: um gestor rebaixado de `gestor_grupo` que deixou linha órfã em `user_groups`
lê dado de IES-irmã **direto pelo REST**, sem passar por nenhuma das 11 RPCs. O
repositório já documenta isso como gap conhecido e não corrigido.

Migrar as nove para `gestor_pode_acessar_ies(<coluna de ies da tabela>)`.

**Por que em PR separado:** é a única parte que pode derrubar a experiência do aluno.
Essas tabelas são lidas por aluno também. Um erro aqui não é "o gestor não vê o portal",
é "o aluno não vê o simulado". Merece rollback independente da simplificação.

## Verificação

**Para o que é texto de migration** — guards estáticos no padrão dos
`src/test/unit/gestorMigrations*.test.ts` já existentes:

- as 11 RPCs são recriadas e **nenhuma** contém `gestao.enabled`;
- as três checagens que ficam (papel, resolução, `gestor_pode_acessar_ies`) continuam
  presentes **e nessa ordem** — a asserção de ordem é a que já pegou duas regressões;
- nenhum `CREATE OR REPLACE FUNCTION public.user_has_feature` (recriá-la apagaria o guard
  de 19 RPCs legadas, cujo corpo não é confiável a partir do repo).

**Para o PR 2, análise estática não serve.** RLS só se prova executando. Teste de
execução real no banco, autenticado como cada persona:

| persona | deve ler | não deve ler |
|---|---|---|
| aluno | os próprios dados | qualquer coisa de gestor |
| gestor puro | dados da própria `users.id_ies` | qualquer outra IES |
| gestor_grupo | dados das IES do grupo | IES fora do grupo |
| gestor com `user_groups` órfão | só a própria IES | **a IES-irmã órfã** — é o caso que hoje vaza |

A última linha é o teste que justifica o PR 2 existir. Sem ela, não há prova de correção.

## Riscos

**A migration do PR 1 recria 11 funções.** O modo de falha conhecido é usar base
desatualizada e reverter fix em silêncio. Mitigação: construir por fatiamento de linhas
dos arquivos-fonte, nunca retranscrição, e verificar por script que — fora o bloco
removido — nenhuma outra linha mudou.

**O PR 2 mexe em RLS de tabela lida por aluno.** Mitigação: os testes de execução acima,
rodados antes do merge, e rollback independente.

**Aplicação em produção não é por push.** O banco deste projeto recebe DDL por outro
caminho, manual. Toda migration deste spec nasce não aplicada, e a aplicação é decisão
explícita, não consequência do merge.

## Fora de escopo

- As 19 RPCs `get_institutional_*` legadas: nenhum call site no front deste repo. São
  código morto do ponto de vista da aplicação, mas continuam no banco com checagem de
  papel ativa. Não dá para afirmar, a partir deste repositório, que nada fora dele as
  chama — remover exige investigação própria.
- A policy de `users` para gestor, que existiu por 22 minutos em 01/07 e foi revertida sem
  explicação. Hoje dado nominal de aluno só sai pelas RPCs, que é o desenho correto.
- Os 4 itens Média que sobraram da auditoria de conformidade (rótulos de `ChipNivel` e
  `BadgeStatus`, `meta.criterio` vazando nome de coluna, e o histórico de avisos).
