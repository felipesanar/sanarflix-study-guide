# Rollout faseado por IES do Portal do Gestor (reintrodução do console antigo)

Data: 2026-08-11 · Decisão de produto: Felipe Souza

## O problema

Em 05/08 houve uma "virada total sem piloto": a experiência antiga do gestor foi apagada
(~50 arquivos, commit `58226452`) e todo gestor de toda IES passou a receber o Portal do
Gestor v2 direto, sem gate. Em 07/08 (PR #19), o próprio conceito de liberação por IES foi
removido de vez do modelo de acesso — "todo gestor tem acesso completo, sempre, sem
liberação por IES" — e as chaves `gestao.enabled`/`gestao.exportar`/`gestao.ia` foram
apagadas de `feature_catalog`/`ies_features`.

Essas duas decisões se provaram prematuras: a virada precisa ser acompanhada por IES —
cada faculdade recebe um vídeo tutorial de como usar a visão nova e só é migrada depois de
dar o OK. Até lá, ela continua no console antigo, **exatamente como era antes**, incluindo
o export de relatório em PDF/XLSX que existia em `/gestor/visao-institucional` e que sumiu
junto com a experiência antiga.

**Decisão:** reintroduzir um gate de rollout por IES. Por padrão, hoje, **todas as IES
voltam para o console antigo** — inclusive as que já usam o portal novo desde a virada
total. A migração de cada IES para o portal novo volta a ser uma ativação manual, feita
depois do vídeo + OK da faculdade.

## O que isso reverte, explicitamente

- A "virada total sem piloto" de 05/08 (Tasks 62/63, descontinuadas naquela ocasião, voltam
  a ter objeto).
- A parte de `gestao.enabled` como master switch por IES do PR #19 — mas **não** a
  simplificação do modelo de papel/escopo (`hasExperience`, `gestor_grupo` via
  `user_groups`), que continua valendo e é, inclusive, pré-requisito técnico deste trabalho
  (item 3 abaixo).

## Escopo

### 1 · Banco: restaurar as chaves de feature

Nova migration (não editar as de 07/08 — elas já foram aplicadas):

- Recriar `gestao.enabled`, `gestao.exportar`, `gestao.ia` em `feature_catalog`
  (`experience = 'gestao'`, `active = true`), mesmo texto/`sort_order` de antes.
- Recriar as linhas em `ies_features` com `enabled = true` para as **24 IES** (as 14 que já
  tinham antes **e as 10 que nunca tiveram linha** — decisão explícita: essas 10 também
  ganham acesso ao console antigo agora, não ficam de fora). Mesmo valor para as três
  chaves.
- Essa migration não muda nada visível: as RPCs novas (`get_gestor_*`) não checam essas
  chaves, e o front ainda não olha para o console antigo. É só pré-condição de dados.

Nova chave, separada, é o toggle real do rollout:

- `gestao.portal_v2` volta a existir em `feature_catalog`. **Nenhuma linha** em
  `ies_features` para ela no dia do deploy — ausência de linha = `false` = console antigo.
  Ativar uma IES depois do OK do vídeo é um `INSERT`/`UPDATE` direto rodado manualmente,
  sem UI de admin (decisão explícita: sem tela nova para isso).

### 2 · Banco: compatibilizar `get_user_ies_id()` com `gestor_grupo`

O console antigo resolve a IES do usuário chamando `get_user_ies_id()`, que só lê
`users.id_ies`. O papel `gestor_grupo` (multi-IES via `user_groups`) não existia quando o
console antigo foi apagado e tipicamente tem `id_ies` nulo — a função devolveria `NULL` e o
console antigo quebraria com "IES do usuário não encontrada".

Patch pontual: quando `users.id_ies` for nulo, cair no mesmo fallback que as RPCs novas já
usam — primeira IES de `get_accessible_ies(v_uid)`. Não é uma experiência multi-IES de
verdade dentro do console antigo (ele nunca teve seletor para isso); é o suficiente para um
`gestor_grupo` enxergar dado de uma IES válida do grupo em vez de quebrar.

### 3 · Roteamento: decidir console antigo vs. portal novo

Hoje `buildAppRoutes.tsx:80` decide só por papel:
`hasExperience(access, 'gestao') ? gestorV2Routes() : deniedPortal('/gestor')`.

Passa a existir uma segunda pergunta, resolvida no servidor (junto do carregamento de
`access`, sem round-trip extra na hora de montar as rotas): a IES (ou, para `gestor_grupo`,
**todas** as IES acessíveis do grupo) está com `gestao.portal_v2 = true`?

- Sim para todas → `gestorV2Routes()` (o que existe hoje).
- Não (qualquer uma false ou sem linha) → rotas do console antigo restaurado.
- Sem papel de gestão → `deniedPortal('/gestor')`, como hoje.

Isso é avaliado uma vez, no mesmo lugar em que `access` já é resolvido — evita gate
assíncrono no meio da árvore de rotas.

### 4 · Restaurar o código do console antigo

Recuperar do histórico (`git show 58226452^:<arquivo>`), sem alterar UX/lógica, só o
necessário para religar ao app atual:

- `src/experiences/gestor/GestorLayout.tsx`, `gestorRoutes.tsx`, `GestorNav.ts`,
  `GestorFeatureGate.tsx`, `GestorFiltersProvider.tsx`
- `src/pages/DesempenhoInstitucionalV2.tsx`
- `src/hooks/useInstitutionalPerformanceData.ts`
- `src/services/institutional.ts`
- `src/utils/institutionalReportPdf.ts`, `institutionalReportXlsx.ts`,
  `mapInstitutionalData.ts`, `desempenhoV2Filters.ts`
- `src/types/desempenhoV2.ts`
- `src/components/analytics/v2/**` (as 5 telas: Visão Institucional, Diagnóstico
  Curricular, Insights Pedagógicos, Inteligência Decisória, Visão de Alunos) e o
  `ExportReportDrawer.tsx`

As 5 URLs de compatibilidade (`/gestor/visao-institucional` etc.), hoje redirect morto para
`/gestor`, voltam a montar a tela real **quando a IES está no console antigo**; continuam
redirecionando para `/gestor` quando a IES já está no portal novo.

`analytics/journey` e `simulados` (consumidos pelo `AnalyticsPage` do admin) não são
tocados — já sobreviveram à limpeza de 05/08 e não fazem parte deste escopo.

### 5 · O export

- **Export antigo**: volta junto com o console antigo, item 4, sem nenhuma mudança de
  comportamento — é o mesmo `institutionalReportPdf.ts`/`ExportReportDrawer.tsx` de antes,
  gated pelas mesmas chaves `gestao.exportar` (restauradas no item 1).
- **Export novo** (`DialogExportarDados.tsx`, `relatorioPdf.ts`, `exportarRecorte.ts`):
  nenhuma mudança. Já vive só dentro de `src/features/gestor/`, que só é montado quando a
  IES está no portal novo — a exclusividade pedida ("reservado à nova versão, só disponível
  junto com a ativação") já é verdade estruturalmente pelo gate do item 3, sem precisar de
  checagem própria adicional.

## Ordem de aplicação

A lição de 07/08 ("a ordem de aplicação tem 3 passos, errar derruba todos os gestores")
vale aqui na direção inversa: **a chave que HABILITA precisa estar populada antes do front
que passa a exigi-la**, nunca depois.

1. Aplicar a migration do item 1 (chaves + linhas de `ies_features`) e o patch do item 2.
   Nenhum efeito visível ainda — o front continua mostrando o portal novo para todo mundo.
2. Deploy do front com a restauração do console antigo (item 4) e o novo roteamento (item
   3). **Este é o corte real**: no instante do deploy, toda IES sem `gestao.portal_v2=true`
   passa a ver o console antigo — regressão de UI esperada e aceita para quem já estava no
   portal novo hoje.
3. Depois disso, cada ativação por IES é só um `UPDATE`/`INSERT` isolado em `ies_features`,
   reversível a qualquer momento sem novo deploy.

Fazer o passo 2 antes do 1 significaria mostrar o console antigo com as RPCs ainda
fail-closed — todo gestor cai em `feature_not_enabled` em vez de ver dado.

## Testes

- A suíte do console antigo foi apagada junto em 05/08. Recriar pelo menos: smoke test de
  cada rota antiga renderizando sem erro, e um teste de regressão para o fallback de
  `get_user_ies_id()` com `gestor_grupo` (hoje não teria como existir, é comportamento
  novo).
- Teste do roteamento (item 3): papel sem `portal_v2` → console antigo; papel com
  `portal_v2=true` em todas as IES do grupo → portal novo; `gestor_grupo` com uma IES
  aprovada e outra não → console antigo.
- Fechar com suíte completa + `type-check` + `build` na árvore inteira antes de dar como
  pronto — este projeto já teve suíte verde com type-check quebrado três vezes na mesma
  frente (ver memória `portal-gestor-v2`).

## Riscos

- **Recriar RPCs a partir do `.sql` do repositório não é seguro** para as 9 RPCs
  `get_institutional_*`: o corpo real em produção pode ter divergido do que está versionado
  (guard foi injetado via `EXECUTE`/`pg_get_functiondef` em produção, não por migration
  convencional). Por isso este desenho **não recria nenhuma função** — só repopula dados de
  `feature_catalog`/`ies_features`, que é operação segura e reversível.
- **Corte de UI para quem já está no portal novo hoje.** Aceito explicitamente — é a
  consequência de tornar o rollout faseado de verdade em vez de manter a virada total.
- **`gestor_grupo` misto** (algumas IES aprovadas, outras não) cai inteiro no console
  antigo por design — evita tela híbrida, mas significa que uma única IES pendente atrasa
  o grupo inteiro.

## Fora de escopo

- Qualquer UI de admin para ativar/desativar IES — ativação é SQL direto, por decisão
  explícita.
- Registrar "IES assistiu o vídeo" no banco — é processo manual (gravar vídeo, mandar,
  aguardar OK verbal/e-mail); não existe e não será criada tabela de acompanhamento disso.
- As 9 RLS policies que autorizam por `get_accessible_ies` em vez de
  `gestor_pode_acessar_ies` (gap conhecido, cancelado em 07/08) — nada neste trabalho muda
  esse estado.
- Migrar o console antigo para o modelo de dados/UX do portal v2 — é para ficar **idêntico**
  ao que era, não uma versão intermediária.
