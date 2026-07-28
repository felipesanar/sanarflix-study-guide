# Portal do Gestor v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir as 5 telas atuais do gestor por um portal de 3 telas (Início, Visão Geral, Detalhamento por Simulados) que responde "minha instituição está melhorando?" em segundos e permite investigar até a questão e o aluno, com rollout controlado por IES.

**Architecture:** Diretório novo `src/features/gestor/` convivendo com `src/experiences/gestor/` (telas antigas) atrás da feature flag `gestao.portal_v2`. A camada de dados são 10 RPCs Postgres novas `get_gestor_*`, agregadoras por tela, que devolvem o envelope `{data, meta}` do handoff — a agregação e as regras de negócio ficam no servidor, o front nunca soma base bruta. O front consome via React Query com estado de filtro na URL, error boundary por bloco e as três telas em code-split.

**Tech Stack:** React 18 · TypeScript · Vite · Tailwind + shadcn/ui · recharts 2.12 · @tanstack/react-query 5 · react-router-dom 6 · Supabase (Postgres + RPC) · vitest 3.2 + @testing-library/react 16.

**Spec:** [docs/superpowers/specs/2026-07-25-portal-gestor-v2-design.md](../specs/2026-07-25-portal-gestor-v2-design.md) — leia antes da Task 1. Referências `§N` neste plano apontam para seções dela.

**Ordem de execução:** dados → backend → front. Combinada na reunião de 24/07: *"primeiro você puxa os cards dos dados e depois você puxa os cards do back-end, aí depois que a gente fizer toda a camada de dados, aí a gente vai para o front"*. As Fases 0 e 0b são pré-requisito de tudo.

---

## Global Constraints

Estas restrições valem para **todas** as tarefas. Os requisitos de cada tarefa incluem implicitamente esta seção.

### Comandos de verificação (os reais deste repo)

| Ação | Comando |
|---|---|
| Lint | `npm run lint` |
| Tipos | `npm run type-check` (é `type-check`, **não** `typecheck`) |
| Testes | `npm run test:run` |
| Um teste | `npx vitest run <caminho>` |
| Build | `npm run build` |

Não existe `pnpm` neste projeto. Não existe Playwright. Não existe MSW. Não existe script de e2e.

### Banco de dados

- Projeto de produção: **`gvqv`** (`gvqvrmkizemwsasmupmo`), hardcoded em `src/integrations/supabase/client.ts:5`.
- **O MCP do Supabase da sessão pode apontar para outro projeto (`lljn`).** Antes de qualquer DDL, confirmar explicitamente o project ref `gvqv`. Já houve incidente de migration aplicada no projeto errado.
- Toda DDL é aplicada via MCP do Supabase (project ref confirmado) ou via `send_message` ao agente do Lovable, e **o mesmo SQL é salvo em `supabase/migrations/<timestamp>_<slug>.sql`** para o histórico.
- Sempre que o schema muda, regenerar `src/integrations/supabase/types.ts`.

### Armadilha crítica: guards de feature injetados

A migration `20260709171344` injetou o guard `feature_not_enabled` em **19 RPCs** dinamicamente, via `pg_get_functiondef`. **Nenhum arquivo `.sql` do repositório contém o corpo que está rodando em produção.** Recriar qualquer uma delas a partir da migration versionada **remove o guard silenciosamente**, e IES com a feature desligada volta a receber dado.

RPCs afetadas que este projeto encosta: `get_institutional_tri`, `get_institutional_evolution_tri`, `get_institutional_performance`, `get_institutional_student_scores`, `get_institutional_evolution`, `get_institutional_simulados`, `get_theme_evolution`, `get_ies_student_count`.

**Regra:** este plano **não modifica nenhuma delas.** As RPCs novas `get_gestor_*` recompõem a lógica sobre as tabelas. Se em algum momento for inevitável tocar numa delas, extrair o corpo real com `pg_get_functiondef` primeiro e conferir depois que a string `feature_not_enabled` continua presente.

### Padrão obrigatório das RPCs novas

Toda RPC `get_gestor_*`:

```sql
CREATE OR REPLACE FUNCTION public.get_gestor_<nome>(...)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ies_id uuid;
BEGIN
  -- 1. guard de feature ESCRITO NO CORPO (nunca injetado)
  IF NOT public.user_has_feature('gestao.portal_v2') THEN
    RAISE EXCEPTION 'feature_not_enabled' USING ERRCODE = '42501';
  END IF;

  -- 2. guard de role
  IF NOT (has_role(auth.uid(), 'admin'::app_role)
       OR has_role(auth.uid(), 'gestor'::app_role)
       OR has_role(auth.uid(), 'gestor_grupo'::app_role)) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- 3. escopo de IES
  IF p_ies_id IS NOT NULL THEN
    IF NOT public.user_can_access_ies(auth.uid(), p_ies_id) THEN
      RAISE EXCEPTION 'Permission denied: cannot access this IES';
    END IF;
    v_ies_id := p_ies_id;
  ELSE
    SELECT u.id_ies INTO v_ies_id FROM public.users u WHERE u.id = auth.uid();
    IF v_ies_id IS NULL THEN
      v_ies_id := (public.get_accessible_ies(auth.uid()))[1];
    END IF;
  END IF;
  IF v_ies_id IS NULL THEN
    RAISE EXCEPTION 'IES not resolved';
  END IF;

  -- 4. ... agregação ...

  RETURN jsonb_build_object('data', ..., 'meta', jsonb_build_object(
    'periodo', ..., 'fonte', ..., 'atualizadoEm', ...,
    'criterio', ..., 'partial', ..., 'lowSample', ...
  ));
END;
$$;

REVOKE ALL ON FUNCTION public.get_gestor_<nome>(...) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_<nome>(...) TO authenticated;
```

### Regras de negócio invioláveis

| Regra | Valor |
|---|---|
| Proficiente | `proficiencia >= 60` — **`>=`, não `>`**. 60 **é** proficiente (§4.3) |
| Nível crítico | `acertoPct < 50` (§4.4 — corte medido na Task 2 em 28/07; era 30) |
| Nível mediano | `50 <= acertoPct < 80` (§4.4) |
| Nível excelente | `acertoPct >= 80` (§4.4) |
| Conceito ENAMED | 1–5 inteiro, **nunca média**; com 2+ simulados vira comparativo (§4.1) |
| Área, especialidade, tema | **sempre % de acerto**, nunca proficiência (§4.1) |
| "Nota TRI" | **não existe** como métrica separada; o rótulo único é "Proficiência" (§4.1) |
| `theta` | **nunca exibido** em nenhuma tela (§4.2) |
| Semestre | seleção **única** em toda a página, inclusive na dispersão (§4.5) |
| "6º ano" | agregador de `users.semestre IN (11,12)`; todos os semestres visíveis, 11º e 12º em evidência (§4.5) |
| Hierarquia | `grande_area` → `especialidade` → `tema`. Três níveis. Não existe subespecialidade (§4.9) |
| Dado ausente | `—` / "sem dados" / estado de carregamento. **Nunca 0, nunca média do grupo, nunca estimativa** (§4.10) |
| `lowSample` | `true` quando a amostra do nó/recorte é `< 10` (§4.10) |
| Detalhamento | **nunca "todos"**; seleção explícita de 1+; servidor rejeita lista vazia (§4.7) |
| `variacao` | só quando o aluno participou de **todos** os simulados comparados; senão `null` (§4.7) |
| Ponto corrente da régua | rótulo **"atual"**, não "último" (§4.7) |

### Copy e formatação

- Todo texto em **pt-BR**. Tom direto, segunda pessoa (`você`), sentence case, verbo primeiro no CTA ("Ver cronograma", "Exportar recorte").
- **Sem emoji, sem exclamação**, sem jargão de dashboard. **Nunca** "drill-down" — a copy é "Ver visão detalhada".
- **Sem linguagem de aluno** ("estude", "revise seu ponto fraco") em nenhuma tela.
- Quando o dado é fraco, o texto assume: "cobertura parcial", "dados em processamento".
- Números em locale `pt-BR` com `font-variant-numeric: tabular-nums`, alinhados à direita em tabela. Datas `dd/MM/yyyy`, horas `HH:mm`.
- Nomenclatura: **"desempenho"** na visão por grande área; "proficiência" só onde há TRI (aluno e simulado) — §4.6.

### Estados obrigatórios

Todo componente que consome dado implementa `loading` (skeleton que **reserva a altura final**), `empty`, `error` (com "Tentar novamente" que refaz **só a query daquele bloco**), e `partial` / `low_sample` quando aplicável. **Error boundary por bloco, não por página** — um gráfico quebrado não derruba a tela (§8.4).

Componente sem seus estados não passa em review.

### Segurança e privacidade (§7.7)

- `iesId` do cliente é **hint de UI**, nunca autorização — o servidor sempre valida via `user_can_access_ies`.
- ID de aluno na URL é **UUID opaco**. Nunca CPF, matrícula ou e-mail.
- Payload de aluno **não vai para `localStorage`/`sessionStorage`** — cache só em memória (React Query).
- **Sem PII** em telemetria, log, breadcrumb ou nome de evento.
- Texto vindo da API renderizado como texto. **Nunca `dangerouslySetInnerHTML`.**
- Export sempre de um recorte, nunca a base inteira, com auditoria e cabeçalho de confidencialidade.

### Estilo

- **Nenhum hex ou px solto.** Cor, espaço, raio, sombra e duração saem de token (`hsl(var(--…))` / classes Tailwind).
- Nunca `filter: invert()` na marca. Nunca sombra colorida na marca. Lockup com altura mínima de 48px na sidebar.
- No tema escuro: elevação vem da **cor da superfície**, não de sombra; hover **clareia**; nunca preto puro como fundo de card; nunca `#B81414` como cor de texto.
- Sem `scrollIntoView`, sem manipulação de DOM fora do React.

### Definição de pronto por tarefa

- `npm run lint` · `npm run type-check` · `npm run test:run` verdes.
- Sem `any`, sem `@ts-ignore`, sem `console.log`, sem código morto, sem `TODO` órfão.
- Todos os estados do componente implementados e revisados no claro **e** no escuro.
- Commit ao fim de cada tarefa.

### Orçamento de performance (§8.5)

LCP < 2,5s · INP < 200ms · CLS < 0,1 na Visão Geral com dado real · JS inicial da rota < 250 KB gzip · latência de RPC < 800ms.

---

## Índice

**[Fase 0 — Fundacao e dados](#fase-0-fundacao-e-dados)**

- `1` [Auditoria de hierarquia nos simulados existentes](#task-1-auditoria-de-hierarquia-nos-simulados-existentes)
- `2` [Validacao da distribuicao das reguas de desempenho](#task-2-validacao-da-distribuicao-das-reguas-de-desempenho)
- `3` [Commitar os assets da marca SanarFlix Academy](#task-3-commitar-os-assets-da-marca-sanarflix-academy)
- `4` [Chave de feature `gestao.portal_v2`](#task-4-chave-de-feature-gestaoportalv2)
- `5` [Colunas novas em `simulados_admin`](#task-5-colunas-novas-em-simuladosadmin)
- `6` [Tabelas `ies_contrato_simulados` e `ies_simulado_previsto`](#task-6-tabelas-iescontratosimulados-e-iessimuladoprevisto)
- `7` [`publico_alvo` em `announcements`](#task-7-publicoalvo-em-announcements)
- `8` [`api/types.ts`, `lib/regras.ts` e `lib/formatters.ts` com TDD](#task-8-apitypests-libregrasts-e-libformattersts-com-tdd)

**[Fase 0b — Superfície de admin do cronograma](#fase-0b-superficie-de-admin-do-cronograma)**

- `9` [RPCs de escrita do contrato de simulados](#task-9-rpcs-de-escrita-do-contrato-de-simulados)
- `10` [RPCs de escrita dos slots e da agenda do simulado](#task-10-rpcs-de-escrita-dos-slots-e-da-agenda-do-simulado)
- `11` [RPC de leitura do contrato para o admin](#task-11-rpc-de-leitura-do-contrato-para-o-admin)
- `12` [Wrappers de serviço do contrato de simulados](#task-12-wrappers-de-servico-do-contrato-de-simulados)
- `13` [Seção de admin "Contratos & cronograma"](#task-13-secao-de-admin-contratos-cronograma)

**[Fase 1 — Backend: RPCs `get_gestor_*`](#fase-1-backend-rpcs-getgestor)**

- `14` [RPC `get_gestor_contexto`](#task-14-rpc-getgestorcontexto)
- `15` [RPC `get_gestor_cronograma`](#task-15-rpc-getgestorcronograma)
- `16` [RPC `get_gestor_avisos`](#task-16-rpc-getgestoravisos)
- `17` [RPC `get_gestor_visao_geral`](#task-17-rpc-getgestorvisaogeral)
- `18` [RPC `get_gestor_diagnostico`](#task-18-rpc-getgestordiagnostico)
- `19` [RPC `get_gestor_diagnostico_temas`](#task-19-rpc-getgestordiagnosticotemas)
- `20` [RPC `get_gestor_alunos`](#task-20-rpc-getgestoralunos)
- `21` [RPC `get_gestor_aluno`](#task-21-rpc-getgestoraluno)
- `22` [RPC `get_gestor_detalhamento`](#task-22-rpc-getgestordetalhamento)
- `23` [RPC `get_gestor_questoes` e regeneração do `types.ts`](#task-23-rpc-getgestorquestoes-e-regeneracao-do-typests)

**[Fase 2 — Fundação do front: shell, rotas e filtros](#fase-2-fundacao-do-front-shell-rotas-e-filtros)**

- `24` [Rotas e gate do portal v2](#task-24-rotas-e-gate-do-portal-v2)
- `25` [GestorShell — sidebar fixa de 240px](#task-25-gestorshell-sidebar-fixa-de-240px)
- `26` [SidebarIes — seletor de instituição por papel](#task-26-sidebaries-seletor-de-instituicao-por-papel)
- `27` [`useFiltrosGestor` — recorte global na URL](#task-27-usefiltrosgestor-recorte-global-na-url)
- `28` [`queries.ts` — os 10 hooks de dados](#task-28-queriests-os-10-hooks-de-dados)
- `29` [`FiltroSemestre` — controle segmentado](#task-29-filtrosemestre-controle-segmentado)
- `30` [Primitivas de estado e rastreabilidade](#task-30-primitivas-de-estado-e-rastreabilidade)

**[Fase 3 — Tela 1: Início do Gestor](#fase-3-tela-1-inicio-do-gestor)**

- `30b` [Glossário "Entenda as métricas"](#task-30b-glossario-entenda-as-metricas)
- `31` [CronogramaSimulados — componente e os 5 status](#task-31-cronogramasimulados-componente-e-os-5-status)
- `32` [Navegação do cronograma para o Detalhamento já filtrado](#task-32-navegacao-do-cronograma-para-o-detalhamento-ja-filtrado)
- `33` [AvisosSanar com marcação de lido otimista e rollback](#task-33-avisossanar-com-marcacao-de-lido-otimista-e-rollback)
- `34` [Direcionadores, saudação e prefetch da Visão Geral](#task-34-direcionadores-saudacao-e-prefetch-da-visao-geral)
- `35` [Rota Início montada, com loading, empty e error por bloco](#task-35-rota-inicio-montada-com-loading-empty-e-error-por-bloco)

**[Fase 4 — Tela 2: Visão Geral](#fase-4-tela-2-visao-geral)**

- `36` [KpiCard + TooltipRastreabilidade](#task-36-kpicard-tooltiprastreabilidade)
- `37` [Os 4 KPIs da Visão Geral na ordem canônica](#task-37-os-4-kpis-da-visao-geral-na-ordem-canonica)
- `38` [EvolucaoChart — modo Geral](#task-38-evolucaochart-modo-geral)
- `39` [AreasChart — modo Por grande área](#task-39-areaschart-modo-por-grande-area)
- `40` [DispersaoChart — modo Por aluno](#task-40-dispersaochart-modo-por-aluno)
- `41` [GraficoProtagonista — 3 modos sem refetch](#task-41-graficoprotagonista-3-modos-sem-refetch)
- `42` [CascataDiagnostico — 2 níveis, ao lado, no lugar](#task-42-cascatadiagnostico-2-niveis-ao-lado-no-lugar)
- `43` [DrawerTemas](#task-43-drawertemas)
- `44` [Bloco Visão de Alunos (distribuição + dispersão)](#task-44-bloco-visao-de-alunos-distribuicao-dispersao)
- `45` [TabelaAlunos + DrawerAluno](#task-45-tabelaalunos-draweraluno)
- `45b` [Gate de "Exportar recorte" e "Copiar resumo"](#task-45b-gate-de-exportar-recorte-e-copiar-resumo)
- `46` [Rota VisaoGeral.tsx — composição, estados independentes e Insights](#task-46-rota-visaogeraltsx-composicao-estados-independentes-e-insights)
- `46b` [Verificação de fim de fase](#task-46b-verificacao-de-fim-de-fase)

**[Fase 5 — Tela 3: Detalhamento por Simulados](#fase-5-tela-3-detalhamento-por-simulados)**

- `47` [SeletorSimulados](#task-47-seletorsimulados)
- `48` [Estado vazio do Detalhamento e zero requisição de métrica](#task-48-estado-vazio-do-detalhamento-e-zero-requisicao-de-metrica)
- `49` [Os 3 KPIs do Detalhamento](#task-49-os-3-kpis-do-detalhamento)
- `50` [Evolução do recorte e a virada para distribuição](#task-50-evolucao-do-recorte-e-a-virada-para-distribuicao)
- `51` [AcertoPorAreaESemestre — render dos dois grupos de barras](#task-51-acertoporareaesemestre-render-dos-dois-grupos-de-barras)
- `52` [AcertoPorAreaESemestre — clique cruzado nos dois sentidos](#task-52-acertoporareaesemestre-clique-cruzado-nos-dois-sentidos)
- `53` [TabelaAlunosSimulado](#task-53-tabelaalunossimulado)
- `54` [TabelaQuestoes e DistribuicaoAlternativas](#task-54-tabelaquestoes-e-distribuicaoalternativas)
- `55` [ComparativoSimulados](#task-55-comparativosimulados)
- `56` [Rota Detalhamento e os 3 sub-estados](#task-56-rota-detalhamento-e-os-3-sub-estados)

**[Fase 6 — QA, piloto, GA e pós-produção](#fase-6-qa-piloto-ga-e-pos-producao)**

- `57` [Suíte dos 17 casos críticos do spec §12](#task-57-suite-dos-17-casos-criticos-do-spec-12)
- `58` [Acessibilidade — instalar `vitest-axe` e testar por rota](#task-58-acessibilidade-instalar-vitest-axe-e-testar-por-rota)
- `59` [Tema escuro — mapear os tokens do handoff sobre as variáveis do repo](#task-59-tema-escuro-mapear-os-tokens-do-handoff-sobre-as-variaveis-do-repo)
- `59b` [Reduced-motion e decisão sobre virtualização](#task-59b-reduced-motion-e-decisao-sobre-virtualizacao)
- `60` [Telemetria — os 7 eventos da §10, sem PII](#task-60-telemetria-os-7-eventos-da-10-sem-pii)
- `61` [Checklist de segurança e LGPD (§7.7) — o que é automatizável vira teste](#task-61-checklist-de-seguranca-e-lgpd-77-o-que-e-automatizavel-vira-teste)
- `62` [Piloto por IES — procedimento operacional](#task-62-piloto-por-ies-procedimento-operacional)
- `63` [GA por lotes](#task-63-ga-por-lotes)
- `64` [Cleanup pós-GA (§9)](#task-64-cleanup-pos-ga-9)
- `64b` [Eliminar a régua divergente do `AiChatDrawer`](#task-64b-eliminar-a-regua-divergente-do-aichatdrawer)

---

## Decisões pendentes registradas

Itens que este plano **não resolve sozinho** e que precisam de decisão humana. Nenhum deles bloqueia o início da Fase 0.

### 1. O gestor perde o caminho de volta para a experiência de aluno

O `GestorLayout` atual tem o botão **"Ir para aluno"** (`src/experiences/gestor/GestorLayout.tsx`), introduzido de propósito nos commits `479a6179` ("gestor ganha a experiência de aluno completa") e `96022cbd` ("botão 'Ir para versão aluno' nos portais Admin/Gestor/CX"). O gestor tem a experiência `aluno` além de `gestao`.

A sidebar nova do spec §8.3 lista lockup, seletor de IES, navegação e rodapé com notificações e perfil — **sem** o botão de voltar para o aluno. Se a Task 25 for implementada ao pé da letra e a Task 64 remover o layout antigo, o gestor fica sem caminho de volta pela UI.

**Recomendação:** incluir o botão no rodapé da sidebar, ao lado do perfil, na Task 25. É afordância que já existe hoje e cuja remoção seria regressão silenciosa. **Decisão do Felipe** — se ele confirmar, é um item no rodapé da sidebar, não muda arquitetura.

### 2. `score_proprio` × `score_enamed` (pendência nº8 do spec)

O plano assume `score_proprio` como "Proficiência" e trata "Nota TRI" como métrica eliminada (spec §4.1). Se `score_enamed` for uma métrica de produto distinta — projeção na escala ENAMED — e não um intermediário de cálculo, então as duas não eram duplicadas e a decisão precisa ser revista antes da Task 45 (`DrawerAluno`). **Confirmar com o João.**

### 3. Nomenclatura "desempenho" × "proficiência" (pendência nº5 do spec)

O plano usa **"desempenho"** na visão por grande área, conforme a decisão de 24/07. O Leonardo tem apego declarado a "consistentemente proficiente". Se ele vetar, é troca de string nos rótulos — nenhuma tarefa muda de forma. **Validar com o Leonardo** antes da Task 42.

### 4. Superfície de admin do cronograma (pendência nº2 do spec)

A Fase 0b entrega as RPCs e a tela, mas **quem popula o dado é o CX/cadastros**. Sem contrato e datas preenchidos para as IES-piloto, a home nasce sem âncora. A Task 62 já trava o piloto nisso, mas o alinhamento com a equipe de cadastros é externo a este plano.


---

## Fase 0 — Fundacao e dados

> **Regra transversal desta fase (spec §7.1):** nenhuma task abaixo recria, altera ou faz `CREATE OR REPLACE` em qualquer uma das 19 RPCs com guard injetado (`get_institutional_tri`, `get_institutional_evolution_tri`, `get_institutional_performance`, `get_institutional_student_scores`, `get_institutional_evolution`, `get_institutional_simulados`, `get_theme_evolution`, `get_ies_student_count`, e as demais). As tasks 1 e 2 são **somente leitura**; as tasks 4 a 7 são **aditivas** (INSERT/ALTER ADD/CREATE TABLE), nunca `CREATE OR REPLACE FUNCTION`.

> **Regra transversal de banco:** antes de **qualquer** chamada de MCP do Supabase nesta fase, confirmar o project ref. Rodar `mcp__supabase__get_project_url` e verificar que a URL contém `gvqvrmkizemwsasmupmo`. Se a URL contiver `lljn`, **PARAR** — o MCP está apontado para o projeto errado e nenhuma DDL pode ser aplicada; nesse caso a aplicação vai pelo agente do Lovable (`mcp__7677056b-...__send_message` no projeto do SanarFlix), que escreve no gvqv.

---

### Task 1: Auditoria de hierarquia nos simulados existentes

Spec §4.9 e §7.6, pendência nº3. Não é código de app: é diagnóstico de dado em produção que decide se o piloto pode começar. Uma questão com `grande_area`, `especialidade` ou `tema` nulo/vazio produz nó órfão na cascata do Diagnóstico e distorce o % de acerto por área.

**Files:**
- Create: `docs/superpowers/notes/2026-07-25-auditoria-hierarquia-simulados.md`

**Interfaces:**
- Consumes: nada (primeira task da fase).
- Produces: decisão registrada `HIERARQUIA_OK` ou `HIERARQUIA_PRECISA_CORRECAO` + a lista de `simulado_id` afetados. A Task 2 escreve no mesmo arquivo. A Fase 2 (RPCs de diagnóstico) consome a decisão sobre tratar `'Sem classificação'` como nó legítimo.

- [ ] **Step 1: Confirmar o project ref**

Chamar `mcp__supabase__get_project_url` e conferir a saída.

Expected: URL contendo `gvqvrmkizemwsasmupmo`. Se contiver `lljn`, parar e trocar o alvo conforme a regra transversal.

- [ ] **Step 2: Rodar a query de auditoria por simulado**

Rodar via `mcp__supabase__execute_sql` (project gvqv confirmado). `answer_progress` não é usada aqui — a auditoria é de `questoes_simulado`. **Atenção ao schema real:** as três colunas de hierarquia são `text` **nullable** e podem estar preenchidas com string vazia ou só espaços, então o teste é `nullif(btrim(col),'') is null`, não `col is null`.

```sql
-- AUDITORIA 1: completude da hierarquia por simulado
with q as (
  select
    q.simulado_id,
    nullif(btrim(q.grande_area), '')   as grande_area,
    nullif(btrim(q.especialidade), '') as especialidade,
    nullif(btrim(q.tema), '')          as tema,
    q.anulada
  from public.questoes_simulado q
)
select
  s.id                                                     as simulado_id,
  s.nome                                                   as simulado,
  s.status,
  s.data_liberacao,
  cardinality(s.ies_ids)                                   as qtd_ies,
  count(*)                                                 as questoes,
  count(*) filter (where q.grande_area   is null)           as sem_grande_area,
  count(*) filter (where q.especialidade is null)           as sem_especialidade,
  count(*) filter (where q.tema          is null)           as sem_tema,
  count(*) filter (
    where q.grande_area is null or q.especialidade is null or q.tema is null
  )                                                        as questoes_incompletas,
  round(
    100.0 * count(*) filter (
      where q.grande_area is null or q.especialidade is null or q.tema is null
    ) / nullif(count(*), 0)
  , 2)                                                     as pct_incompletas,
  -- nó órfão de verdade: filho preenchido com pai vazio
  count(*) filter (where q.grande_area is null and q.especialidade is not null) as orfao_esp_sem_area,
  count(*) filter (where q.especialidade is null and q.tema is not null)        as orfao_tema_sem_esp,
  count(*) filter (where q.anulada)                        as anuladas
from public.simulados_admin s
join q on q.simulado_id = s.id
group by s.id, s.nome, s.status, s.data_liberacao, s.ies_ids
order by pct_incompletas desc, questoes desc;
```

Expected: uma linha por simulado que tem questões cadastradas. Copiar a tabela inteira para o relatório.

- [ ] **Step 3: Rodar a query de totais e a de valores distintos**

```sql
-- AUDITORIA 2: total global
select
  count(*)                                                              as questoes_total,
  count(distinct simulado_id)                                           as simulados_com_questoes,
  count(*) filter (where nullif(btrim(grande_area),'')   is null)        as sem_grande_area,
  count(*) filter (where nullif(btrim(especialidade),'') is null)        as sem_especialidade,
  count(*) filter (where nullif(btrim(tema),'')          is null)        as sem_tema,
  round(100.0 * count(*) filter (
    where nullif(btrim(grande_area),'')   is null
       or nullif(btrim(especialidade),'') is null
       or nullif(btrim(tema),'')          is null
  ) / nullif(count(*),0), 2)                                            as pct_incompletas_global
from public.questoes_simulado;

-- AUDITORIA 3: vocabulário de grande_area (detecta duplicata de grafia,
-- que na cascata vira dois nós para a mesma área)
select
  coalesce(nullif(btrim(grande_area),''), '(NULO/VAZIO)') as grande_area,
  count(*)                                               as questoes,
  count(distinct simulado_id)                            as simulados,
  count(distinct coalesce(nullif(btrim(especialidade),''),'(NULO)')) as especialidades_distintas
from public.questoes_simulado
group by 1
order by questoes desc;
```

Expected: `pct_incompletas_global` como número único; a lista de `grande_area` sem duplicata de grafia (ex.: "Clínica Médica" e "Clinica Medica" seriam dois nós distintos e é achado a registrar).

- [ ] **Step 4: Aplicar o critério de decisão**

Critério, fixado agora para não ser negociado depois de ver o número:

| Resultado | Decisão |
|---|---|
| `pct_incompletas <= 5` em **todos** os simulados **e** `orfao_esp_sem_area = 0` **e** `orfao_tema_sem_esp = 0` | `HIERARQUIA_OK` — tratar `'Sem classificação'` como **nó legítimo** na cascata; nenhuma correção de dado antes do piloto |
| `pct_incompletas > 5` em **qualquer** simulado | `HIERARQUIA_PRECISA_CORRECAO` para **aquele** simulado — listar os `simulado_id`; correção de dado obrigatória antes do piloto e a IES-piloto não pode ter simulado dessa lista |
| Existe `orfao_esp_sem_area > 0` ou `orfao_tema_sem_esp > 0` em qualquer simulado | `HIERARQUIA_PRECISA_CORRECAO` independente do percentual — filho sem pai quebra a cascata de 2 níveis por construção |
| Duplicata de grafia em `grande_area` | Registrar como **achado separado**, não bloqueia o piloto; entra como normalização de dado a pedir ao CX |

Em qualquer cenário, a cascata de diagnóstico da Fase 2 sempre implementa o nó `'Sem classificação'` — o critério decide se ele é ruído tolerável ou sintoma de dado quebrado.

- [ ] **Step 5: Escrever o relatório com o resultado REAL**

Criar `docs/superpowers/notes/2026-07-25-auditoria-hierarquia-simulados.md` com este esqueleto, **substituindo os placeholders pelos números que saíram do Step 2 e 3** (o arquivo não é entregável válido com placeholder):

```markdown
# Auditoria de dado — Fase 0 do Portal do Gestor v2

**Data de execução:** <data real>
**Projeto:** gvqv (gvqvrmkizemwsasmupmo) — confirmado via get_project_url
**Spec:** docs/superpowers/specs/2026-07-25-portal-gestor-v2-design.md
**Pendências atacadas:** nº3 (hierarquia, §4.9/§7.6) e nº1 (distribuição das réguas, §4.4)

## 1. Hierarquia de conteúdo (§4.9, §7.6)

### 1.1 Query executada
<colar o SQL da AUDITORIA 1>

### 1.2 Resultado por simulado
| simulado | status | questões | sem grande_area | sem especialidade | sem tema | % incompletas | órfão esp/sem área | órfão tema/sem esp |
|---|---|---|---|---|---|---|---|---|
<colar as linhas reais>

### 1.3 Totais globais
- Questões: <n>
- Simulados com questões: <n>
- % incompletas global: <n>%

### 1.4 Vocabulário de grande_area
<colar a tabela da AUDITORIA 3>

### 1.5 DECISÃO
**<HIERARQUIA_OK | HIERARQUIA_PRECISA_CORRECAO>**

Critério aplicado: >5% de questões com qualquer nível nulo/vazio em um simulado ⇒
aquele simulado precisa de correção de dado antes do piloto; caso contrário
"Sem classificação" é nó legítimo na cascata.

Simulados que precisam de correção: <lista de simulado_id + nome, ou "nenhum">
Achados de normalização (não bloqueantes): <lista, ou "nenhum">

Consequência para a Fase 2: a cascata de `get_gestor_diagnostico` agrupa questões
sem `grande_area` sob o rótulo literal "Sem classificação" e **não** as descarta
(descartar mudaria o denominador do % de acerto silenciosamente).
```

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/notes/2026-07-25-auditoria-hierarquia-simulados.md
git commit -m "Fase 0: auditoria de hierarquia dos simulados (pendencia nº3)"
```

---

### Task 2: Validacao da distribuicao das reguas de desempenho

Spec §4.4, o bloco "RISCO A VERIFICAR COM DADO REAL (Fase 0)" e pendência nº1. A régua **proposta** era crítico `<30` / mediano `30–80` / excelente `>=80` sobre **% de acerto**. **EXECUTADA em 28/07: o corte subiu para `<50`** — ver Step 3. "Mediano" absorve 50 pontos de faixa; se "crítico" nascer quase sempre vazio, a tela perde valor diagnóstico. A decisão é por evidência, não por preferência, e o ajuste é de **uma constante** em `regras.ts` (`NIVEL_CRITICO_MAX`) — sem impacto de arquitetura.

**Files:**
- Modify: `docs/superpowers/notes/2026-07-25-auditoria-hierarquia-simulados.md`

**Interfaces:**
- Consumes: o arquivo de notes criado na Task 1.
- Produces: valor decidido de `NIVEL_CRITICO_MAX` (30 ou 50), consumido literalmente pela Task 8 ao escrever `src/features/gestor/lib/regras.ts`.

- [ ] **Step 1: Rodar a query de distribuição por grande área × IES × simulado**

Rodar via `mcp__supabase__execute_sql` (gvqv confirmado). **Detalhe de schema que não pode errar:** em `answer_progress` a coluna que aponta para o simulado se chama **`simulado`** (uuid, FK para `simulados_admin.id`), **não** `simulado_id`. O `id_ies` do aluno vem de `public.users`.

```sql
-- Distribuição real de % de acerto por (IES, simulado, grande área)
with base as (
  select
    u.id_ies                                             as ies_id,
    ap.simulado                                          as simulado_id,
    coalesce(nullif(btrim(q.grande_area),''), 'Sem classificação') as grande_area,
    ap.correct
  from public.answer_progress ap
  join public.questoes_simulado q on q.id = ap.question_id
  join public.users u             on u.id = ap.user_id
  where ap.user_id is null = false
    and q.anulada = false
    and u.id_ies is not null
),
recorte as (
  select
    ies_id,
    simulado_id,
    grande_area,
    count(*)                                             as respostas,
    round(100.0 * count(*) filter (where correct) / nullif(count(*),0), 2) as acerto_pct
  from base
  group by ies_id, simulado_id, grande_area
)
select
  i.nome                                                 as ies,
  s.nome                                                 as simulado,
  r.grande_area,
  r.respostas,
  r.acerto_pct,
  case
    when r.acerto_pct <  30 then 'critico'
    when r.acerto_pct >= 80 then 'excelente'
    else 'mediano'
  end                                                    as nivel_corte_30,
  case
    when r.acerto_pct <  50 then 'critico'
    when r.acerto_pct >= 80 then 'excelente'
    else 'mediano'
  end                                                    as nivel_corte_50
from recorte r
join public.ies i            on i.id = r.ies_id
join public.simulados_admin s on s.id = r.simulado_id
order by i.nome, s.nome, r.acerto_pct asc;
```

Expected: uma linha por (IES, simulado, grande área) com `acerto_pct` e as duas classificações lado a lado.

- [ ] **Step 2: Rodar a query de contagem agregada — a que decide**

```sql
-- Quantos recortes (IES × simulado) têm ao menos uma área crítica, em cada corte
with base as (
  select
    u.id_ies as ies_id,
    ap.simulado as simulado_id,
    coalesce(nullif(btrim(q.grande_area),''), 'Sem classificação') as grande_area,
    ap.correct
  from public.answer_progress ap
  join public.questoes_simulado q on q.id = ap.question_id
  join public.users u             on u.id = ap.user_id
  where q.anulada = false and u.id_ies is not null
),
recorte as (
  select ies_id, simulado_id, grande_area,
         round(100.0 * count(*) filter (where correct) / nullif(count(*),0), 2) as acerto_pct
  from base group by 1,2,3
),
por_recorte as (
  select
    ies_id, simulado_id,
    count(*)                                          as areas,
    count(*) filter (where acerto_pct <  30)          as areas_criticas_30,
    count(*) filter (where acerto_pct <  50)          as areas_criticas_50,
    count(*) filter (where acerto_pct >= 80)          as areas_excelentes
  from recorte group by 1,2
)
select
  count(*)                                                  as recortes_total,
  count(*) filter (where areas_criticas_30 = 0)             as recortes_sem_critico_corte30,
  round(100.0 * count(*) filter (where areas_criticas_30 = 0) / nullif(count(*),0), 1)
                                                            as pct_sem_critico_corte30,
  count(*) filter (where areas_criticas_50 = 0)             as recortes_sem_critico_corte50,
  round(100.0 * count(*) filter (where areas_criticas_50 = 0) / nullif(count(*),0), 1)
                                                            as pct_sem_critico_corte50,
  count(*) filter (where areas_excelentes = 0)              as recortes_sem_excelente,
  round(avg(areas), 1)                                      as media_areas_por_recorte
from por_recorte;

-- Percentis do % de acerto por área, para enxergar onde a massa está
with base as (
  select coalesce(nullif(btrim(q.grande_area),''),'Sem classificação') as grande_area,
         u.id_ies, ap.simulado, ap.correct
  from public.answer_progress ap
  join public.questoes_simulado q on q.id = ap.question_id
  join public.users u             on u.id = ap.user_id
  where q.anulada = false and u.id_ies is not null
),
recorte as (
  select id_ies, simulado, grande_area,
         100.0 * count(*) filter (where correct) / nullif(count(*),0) as acerto_pct
  from base group by 1,2,3
)
select
  round(min(acerto_pct),1)                                              as minimo,
  round((percentile_cont(0.05) within group (order by acerto_pct))::numeric,1) as p05,
  round((percentile_cont(0.25) within group (order by acerto_pct))::numeric,1) as p25,
  round((percentile_cont(0.50) within group (order by acerto_pct))::numeric,1) as mediana,
  round((percentile_cont(0.75) within group (order by acerto_pct))::numeric,1) as p75,
  round(max(acerto_pct),1)                                              as maximo
from recorte;
```

Expected: `pct_sem_critico_corte30` como número único — é ele que decide.

- [ ] **Step 3: Aplicar o critério de decisão**

| Resultado | Decisão |
|---|---|
| `pct_sem_critico_corte30 > 70` | **Recomendação registrada: subir o corte para `< 50`** (absorve Insuficiente + Regular da régua canônica). `NIVEL_CRITICO_MAX = 50` na Task 8 |
| `pct_sem_critico_corte30 <= 70` | **Mantém `< 30`** conforme §4.4. `NIVEL_CRITICO_MAX = 30` na Task 8 |

**Resultado real (28/07): `pct_sem_critico_corte30 = 87,9%` — primeiro galho acionado, `NIVEL_CRITICO_MAX = 50`.** Verificação de robustez: excluindo a IES de teste `B2B` e simulados com "teste" no nome, o número vai a 100% em 47 recortes reais. Sem ambiguidade de fronteira.
| `recortes_total = 0` (nenhuma IES com resposta) | **Mantém `< 30`** por não haver evidência; registrar "sem dado suficiente para revisar o corte" e reavaliar no fim do piloto |

Registrar também, se `recortes_sem_excelente` for alto, que o topo da régua não está sendo exercitado — achado informativo, **não** muda corte nesta fase.

- [ ] **Step 4: Escrever a seção no mesmo relatório**

Acrescentar ao fim de `docs/superpowers/notes/2026-07-25-auditoria-hierarquia-simulados.md`, com os números reais:

```markdown
## 2. Distribuição das réguas de desempenho (§4.4, pendência nº1)

### 2.1 Query executada
<colar os dois SQLs do Step 1 e Step 2>

### 2.2 Resultado por recorte (IES × simulado × grande área)
| ies | simulado | grande área | respostas | % acerto | nível (corte 30) | nível (corte 50) |
|---|---|---|---|---|---|---|
<colar as linhas reais — se forem muitas, colar as 20 menores e as 10 maiores e dizer isso>

### 2.3 Agregado
- Recortes (IES × simulado) analisados: <n>
- Recortes SEM nenhuma área crítica no corte <30: <n> (<n>%)
- Recortes SEM nenhuma área crítica no corte <50: <n> (<n>%)
- Recortes SEM nenhuma área excelente: <n>
- Média de grandes áreas por recorte: <n>
- Percentis do % de acerto por área: min <n> · p05 <n> · p25 <n> · mediana <n> · p75 <n> · max <n>

### 2.4 DECISÃO
**NIVEL_CRITICO_MAX = <30 | 50>**

Critério aplicado: se mais de 70% dos recortes ficarem sem nenhuma área crítica
no corte <30, sobe o corte para <50 (§4.4).

Justificativa com o número medido: <uma frase citando pct_sem_critico_corte30>

Este valor é consumido literalmente por `src/features/gestor/lib/regras.ts`
(constante `NIVEL_CRITICO_MAX`). Mudá-lo depois é alterar uma constante e o teste
correspondente — não há impacto de arquitetura.
```

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/notes/2026-07-25-auditoria-hierarquia-simulados.md
git commit -m "Fase 0: validacao da distribuicao das reguas de desempenho (pendencia nº1)"
```

---

### Task 3: Commitar os assets da marca SanarFlix Academy

Spec §8.3 e pendência nº7. Os assets estão no repo mas **untracked** — o shell da Fase 1 referencia `public/sanarflix-academy-lockup.svg` e sem commit o build da Vercel quebra com 404.

**Files:**
- Create (git add de arquivo já existente em disco): `public/sanarflix-academy-lockup.svg`, `public/sanarflix-academy-lockup-white.svg`, `public/sanarflix-academy-lockup.png`, `public/sanarflix-academy-lockup-white.png`, `public/sanarflix-academy-symbol.svg`, `public/sanarflix-academy-symbol-white.svg`, `public/sanarflix-academy-symbol.png`, `public/sanarflix-academy-symbol-white.png`, `public/sanarflix-academy-appicon.svg`, `public/sanarflix-academy-appicon-192.png`, `public/sanarflix-academy-appicon-512.png`, `public/sanarflix-academy-favicon-64.png`
- Create: os 6 `public/SanarFlix Academy Logo Animation*.mp4` (ver Step 3)
- Modify: `docs/superpowers/notes/2026-07-25-auditoria-hierarquia-simulados.md` (registro da decisão sobre os mp4)

**Interfaces:**
- Consumes: nada.
- Produces: os caminhos versionados de `public/sanarflix-academy-*`, consumidos por `src/features/gestor/shell/SidebarIes.tsx` e `GestorShell.tsx` na Fase 1 (lockup no topo da sidebar, altura mínima 48px).

- [ ] **Step 1: Confirmar o estado untracked**

```bash
cd "C:/Users/felipe.souza/Documents/Projetos (Sanar)/sanarflix-study-guide"
git status --porcelain public/
```

Expected: 18 linhas começando com `??` — 12 assets `sanarflix-academy-*` e 6 `.mp4`. Se algum já aparecer sem `??`, ele já está versionado e sai da lista.

- [ ] **Step 2: Medir o tamanho dos assets**

```bash
ls -la public/sanarflix-academy-*
du -ch public/*.mp4 | tail -1
```

Expected (medido em 26/07/2026):
- 12 assets `sanarflix-academy-*` somando ~849 KB (maiores: `symbol.png` e `symbol-white.png` com 274 KB cada, `lockup.png`/`lockup-white.png` com ~124 KB cada).
- 6 `.mp4` somando **1.832.743 bytes ≈ 1,75 MB** (`Animation.mp4` 216 KB · `AnimationDark.mp4` 193 KB · `AnimationLente.mp4` 527 KB · `AnimationLenteDark.mp4` 440 KB · `AnimationQueda.mp4` 208 KB · `AnimationQuedaDark.mp4` 205 KB).

- [ ] **Step 3: Aplicar a regra dos mp4**

Regra: se os mp4 somarem **mais de 5 MB**, não commitar e registrar a exclusão. Medido: **1,75 MB < 5 MB ⇒ commitar**.

Registrar no relatório de notes, ao fim, para o próximo que abrir o repo não achar que os vídeos são usados nesta entrega:

```markdown
## 3. Assets da marca (§8.3, pendência nº7)

- 12 arquivos `public/sanarflix-academy-*` (svg/png, ~849 KB) commitados. São os
  consumidos pelo shell da Fase 1 (lockup na sidebar, 48px de altura mínima).
- 6 arquivos `public/SanarFlix Academy Logo Animation*.mp4` somam 1,75 MB
  (< 5 MB) e foram commitados. **Nenhum é usado nesta entrega** — o handoff
  emprega o vídeo apenas em splash/hero, que está fora do escopo das 3 telas
  (§2.1). Ficam versionados para a entrega futura de splash.
- Regras de uso da marca (§8.3): nunca `filter: invert()`, nunca redesenhar o
  lockup, nunca sombra colorida na marca. As variantes `-white` existem
  justamente para o tema escuro — trocar de arquivo, não filtrar.
```

Se, ao rodar o Step 2, a soma dos mp4 tiver mudado e passar de 5 MB, **não** rodar o `git add` dos mp4 no Step 4 e trocar o parágrafo acima por: "os 6 mp4 somam \<n\> MB (> 5 MB) e **não** foram commitados; ficam apenas em disco local até a entrega de splash/hero decidir hospedagem (CDN/Storage) em vez de Git".

- [ ] **Step 4: Commitar os assets**

Nomes com espaço exigem aspas. Dois commits separados: assets estáticos (dependência da Fase 1) e vídeos (uso futuro), para o histórico ficar legível e o revert de um não arrastar o outro.

```bash
cd "C:/Users/felipe.souza/Documents/Projetos (Sanar)/sanarflix-study-guide"

git add public/sanarflix-academy-lockup.svg \
        public/sanarflix-academy-lockup-white.svg \
        public/sanarflix-academy-lockup.png \
        public/sanarflix-academy-lockup-white.png \
        public/sanarflix-academy-symbol.svg \
        public/sanarflix-academy-symbol-white.svg \
        public/sanarflix-academy-symbol.png \
        public/sanarflix-academy-symbol-white.png \
        public/sanarflix-academy-appicon.svg \
        public/sanarflix-academy-appicon-192.png \
        public/sanarflix-academy-appicon-512.png \
        public/sanarflix-academy-favicon-64.png
git commit -m "Assets da marca SanarFlix Academy (dependencia do shell do gestor v2)"

git add "public/SanarFlix Academy Logo Animation.mp4" \
        "public/SanarFlix Academy Logo AnimationDark.mp4" \
        "public/SanarFlix Academy Logo AnimationLente.mp4" \
        "public/SanarFlix Academy Logo AnimationLenteDark.mp4" \
        "public/SanarFlix Academy Logo AnimationQueda.mp4" \
        "public/SanarFlix Academy Logo AnimationQuedaDark.mp4"
git commit -m "Logo animado SanarFlix Academy (uso futuro em splash/hero, fora desta entrega)"

git add docs/superpowers/notes/2026-07-25-auditoria-hierarquia-simulados.md
git commit -m "Fase 0: registra decisao sobre assets da marca"
```

- [ ] **Step 5: Verificar que nada de `public/` ficou untracked**

```bash
git status --porcelain public/
```

Expected: **saída vazia**.

---

### Task 4: Chave de feature `gestao.portal_v2`

Spec §9. A chave nova vive sob o master `gestao.enabled` já existente — `user_has_feature` já trata `gestao.*` diferente de `gestao.enabled` exigindo o master ligado (migration `20260709171344`), então nenhuma função precisa ser alterada. O rollback do piloto é desligar esta chave.

**Files:**
- Create: `supabase/migrations/20260726103000_gestao_portal_v2_feature_key.sql`

**Interfaces:**
- Consumes: `public.feature_catalog` (colunas `key`, `experience`, `label`, `description`, `sort_order`, `is_master`, `active`); `public.user_has_feature(text)`; `public.get_effective_features()`; `public.admin_set_ies_features(uuid, jsonb)`.
- Produces: a chave literal `'gestao.portal_v2'`, consumida por (a) todas as 10 RPCs `get_gestor_*` da Fase 2 no guard `IF NOT public.user_has_feature('gestao.portal_v2')`, (b) `GestorIndexRedirect` na Fase 1 via `hasExperience`/`can()` de `src/experiences/access.ts`, (c) `src/test/unit/route-gates.test.tsx`.

- [ ] **Step 1: Conferir o sort_order livre e que a chave não existe**

Rodar via `mcp__supabase__execute_sql` (gvqv confirmado):

```sql
select key, label, sort_order, is_master, active
from public.feature_catalog
where experience = 'gestao'
order by sort_order;
```

Expected: **8 linhas** — `gestao.enabled` (100, master), `gestao.visao_institucional` (110), `gestao.diagnostico_curricular` (120), `gestao.alunos` (130), `gestao.insights_pedagogicos` (140), `gestao.inteligencia_decisoria` (150), `gestao.exportar` (160), `gestao.ia` (170). **Nenhuma** linha `gestao.portal_v2`. Logo `sort_order = 180`.

> **Corrigido em 28/07 na execução:** este passo dizia "6 linhas" e "logo `sort_order = 160`". A produção tem 8 — `gestao.exportar` (160) e `gestao.ia` (170) já foram semeados na migration `20260709154234`. Como `sort_order` não tem unique constraint (a PK é só `key`), usar 160 não daria erro: empataria com `gestao.exportar` e deixaria a ordem do board de features do admin indefinida. O valor aplicado foi **180**.

- [ ] **Step 2: Escrever o SQL da migration**

Criar `supabase/migrations/20260726103000_gestao_portal_v2_feature_key.sql`:

```sql
-- Portal do Gestor v2 — chave de feature (spec §9)
-- Aditivo. Sob o master 'gestao.enabled' já existente: public.user_has_feature
-- exige o master ligado para qualquer chave 'gestao.%' diferente de 'gestao.enabled'
-- (migration 20260709171344), portanto nenhuma função precisa ser recriada aqui.
-- NÃO tocar em nenhuma das 19 funções com guard injetado (§7.1).

insert into public.feature_catalog (key, experience, label, description, sort_order, is_master, active)
values (
  'gestao.portal_v2',
  'gestao',
  'Portal do Gestor v2',
  'Nova experiência do gestor: Início, Visão Geral e Detalhamento por Simulados. Com a chave desligada, a IES continua nas 5 telas antigas.',
  180,
  false,
  true
)
on conflict (key) do update
  set experience  = excluded.experience,
      label       = excluded.label,
      description = excluded.description,
      sort_order  = excluded.sort_order,
      is_master   = excluded.is_master,
      active      = excluded.active;
```

- [ ] **Step 3: Aplicar em produção**

Confirmar `mcp__supabase__get_project_url` → contém `gvqvrmkizemwsasmupmo`. Então aplicar com `mcp__supabase__apply_migration`, name `gestao_portal_v2_feature_key`, query igual ao arquivo acima.

Alternativa (se o MCP estiver em `lljn`): mandar o mesmo SQL ao agente do Lovable via `send_message`, pedindo aplicação de DDL no banco de produção — o banco não é gerenciado pelo Lovable, mas o agente aplica.

Expected: sucesso, sem erro.

- [ ] **Step 4: Verificar a chave no catálogo**

```sql
select key, experience, label, sort_order, is_master, active
from public.feature_catalog
where key = 'gestao.portal_v2';
```

Expected: exatamente 1 linha, `experience = 'gestao'`, `sort_order = 160`, `is_master = false`, `active = true`.

- [ ] **Step 5: Verificar que `get_effective_features` passa a devolver a chave**

`get_effective_features()` monta o objeto a partir de `feature_catalog where active`, então a chave nova aparece automaticamente. Verificação sem depender de sessão:

```sql
-- a chave entra no conjunto que get_effective_features enumera?
select exists (
  select 1 from public.feature_catalog where active and key = 'gestao.portal_v2'
) as chave_no_catalogo_ativo;

-- e para um gestor real, qual é o estado dela hoje?
select
  u.id                                    as user_id,
  u.id_ies,
  coalesce(fm.enabled, false)             as gestao_enabled_master,
  coalesce(fv.enabled, false)             as portal_v2
from public.users u
left join public.ies_features fm on fm.ies_id = u.id_ies and fm.feature_key = 'gestao.enabled'
left join public.ies_features fv on fv.ies_id = u.id_ies and fv.feature_key = 'gestao.portal_v2'
where exists (
  select 1 from public.user_roles r where r.user_id = u.id and r.role = 'gestor'::app_role
)
limit 10;
```

Expected: `chave_no_catalogo_ativo = true`; na segunda query, `portal_v2 = false` para todos (ninguém ligou ainda) — que é exatamente o comportamento desejado: **o portal novo nasce desligado para todas as IES**.

- [ ] **Step 6: Ligar para a IES de teste**

Caminho canônico (com auditoria, é o que o produto usa): entrar no console do admin → **IES** → escolher a IES-piloto → board de features (`src/components/admin/ies/IesFeaturesBoard.tsx`) → confirmar `Portal do Gestor` (master) ligado → ligar `Portal do Gestor v2` → salvar. Isso chama `admin_set_ies_features(p_ies_id, p_changes)` via `src/services/admin/iesFeatures.ts` e grava em `admin_audit_log` com `action = 'ies_features_update'`.

**Atenção:** `admin_set_ies_features` começa com `IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'admin role required'`. Rodando por MCP/`execute_sql` o `auth.uid()` é nulo e a chamada **falha** — não é caminho válido. Se for necessário ligar sem UI, fazer o upsert direto (sem auditoria, e registrar isso):

```sql
-- caminho manual, só se a UI de admin não estiver disponível.
-- Trocar <IES_ID> pelo uuid real da IES-piloto.
insert into public.ies_features (ies_id, feature_key, enabled)
values
  ('<IES_ID>'::uuid, 'gestao.enabled',   true),
  ('<IES_ID>'::uuid, 'gestao.portal_v2', true)
on conflict (ies_id, feature_key) do update
  set enabled = excluded.enabled, updated_at = now();
```

Verificação:

```sql
select feature_key, enabled, updated_at
from public.ies_features
where ies_id = '<IES_ID>'::uuid
  and feature_key in ('gestao.enabled','gestao.portal_v2');
```

Expected: 2 linhas, ambas `enabled = true`. **Rollback do piloto** = repetir com `enabled = false` em `gestao.portal_v2`.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260726103000_gestao_portal_v2_feature_key.sql
git commit -m "Feature gestao.portal_v2 no feature_catalog (spec §9)"
```

---

### Task 5: Colunas novas em `simulados_admin`

Spec §6.2 e §6.4. `simulados_admin` hoje tem `data_liberacao`, `data_encerramento`, `data_liberacao_desempenho` — nada de modalidade nem de data original de agendamento, então "reagendado" é inderivável. Aditivo e nullable: nenhum registro existente é invalidado.

**Files:**
- Create: `supabase/migrations/20260726104000_simulados_admin_modalidade_datas.sql`
- Modify: `src/integrations/supabase/types.ts`

**Interfaces:**
- Consumes: `public.simulados_admin`.
- Produces: `simulados_admin.modalidade` (`text`, check `in ('online','presencial')`, nullable), `simulados_admin.data_realizacao` (`timestamptz`, nullable), `simulados_admin.data_agendada_original` (`timestamptz`, nullable). Consumidos pela derivação de status de `get_gestor_cronograma` (Fase 2) e pelo tipo `ItemCronograma.modalidade: 'online'|'presencial'|null` de `src/features/gestor/api/types.ts` (Task 8).

- [ ] **Step 1: Conferir o estado atual da tabela**

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'simulados_admin'
order by ordinal_position;
```

Expected: 14 colunas (`id`, `nome`, `descricao`, `duracao_minutos`, `ies_ids`, `status`, `liberacao_desempenho`, `data_liberacao`, `data_encerramento`, `data_liberacao_desempenho`, `simulado_pai_id`, `created_by`, `created_at`, `updated_at`). **Nenhuma** de `modalidade`, `data_realizacao`, `data_agendada_original`.

- [ ] **Step 2: Escrever o SQL da migration**

Criar `supabase/migrations/20260726104000_simulados_admin_modalidade_datas.sql`:

```sql
-- Portal do Gestor v2 — modalidade e datas de cronograma em simulados_admin (spec §6.2, §6.4)
-- Aditivo, nullable, sem default. Nenhum registro existente muda de significado.
-- Semântica (24/07): 'online' usa data_liberacao (quando aparece pro aluno) +
-- data_liberacao_desempenho (liberação do resultado); 'presencial' usa
-- data_realizacao (data única de aplicação).
-- data_agendada_original guarda a 1ª data marcada e permite derivar 'reagendado':
-- status 'reagendado' = data futura E data_agendada_original <> data atual (§6.4).

alter table public.simulados_admin
  add column if not exists modalidade              text,
  add column if not exists data_realizacao         timestamptz,
  add column if not exists data_agendada_original   timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.simulados_admin'::regclass
      and conname  = 'simulados_admin_modalidade_check'
  ) then
    alter table public.simulados_admin
      add constraint simulados_admin_modalidade_check
      check (modalidade is null or modalidade in ('online','presencial'));
  end if;
end $$;

comment on column public.simulados_admin.modalidade is
  'online | presencial | null (não classificado). Decide qual conjunto de datas vale (spec §6.4).';
comment on column public.simulados_admin.data_realizacao is
  'Presencial: data única de aplicação. Nulo para online.';
comment on column public.simulados_admin.data_agendada_original is
  'Primeira data agendada. Permite derivar o status reagendado. Atualizada junto quando a data vira definitiva — a tag "Reagendado" some sozinha (spec §6.4).';
```

Nada de backfill: `modalidade` nula é estado legítimo ("não classificado") e a derivação de status trata isso.

- [ ] **Step 3: Aplicar em produção**

Confirmar `mcp__supabase__get_project_url` → `gvqvrmkizemwsasmupmo`. Aplicar com `mcp__supabase__apply_migration`, name `simulados_admin_modalidade_datas`.

Expected: sucesso.

- [ ] **Step 4: Verificar as colunas e o CHECK**

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema='public' and table_name='simulados_admin'
  and column_name in ('modalidade','data_realizacao','data_agendada_original')
order by column_name;

select conname, pg_get_constraintdef(oid) as definicao
from pg_constraint
where conrelid = 'public.simulados_admin'::regclass
  and conname = 'simulados_admin_modalidade_check';
```

Expected: 3 linhas — `data_agendada_original` (`timestamp with time zone`, YES), `data_realizacao` (`timestamp with time zone`, YES), `modalidade` (`text`, YES). E o CHECK com definição `CHECK (((modalidade IS NULL) OR (modalidade = ANY (ARRAY['online'::text, 'presencial'::text]))))`.

- [ ] **Step 5: Provar que o CHECK rejeita valor inválido**

```sql
do $$
begin
  begin
    update public.simulados_admin set modalidade = 'hibrido'
    where id = (select id from public.simulados_admin limit 1);
    raise exception 'FALHOU: o CHECK aceitou modalidade invalida';
  exception when check_violation then
    raise notice 'OK: CHECK rejeitou modalidade=hibrido';
  end;
  rollback;
end $$;
```

Se o bloco `DO` reclamar de `rollback` no ambiente do MCP, rodar como transação explícita:

```sql
begin;
update public.simulados_admin set modalidade = 'hibrido'
where id = (select id from public.simulados_admin limit 1);
rollback;
```

Expected: erro `new row for relation "simulados_admin" violates check constraint "simulados_admin_modalidade_check"` — e o `rollback` garante que nada foi gravado.

- [ ] **Step 6: Regenerar `src/integrations/supabase/types.ts`**

Confirmar de novo que o MCP está em gvqv, então rodar `mcp__supabase__generate_typescript_types` e sobrescrever `src/integrations/supabase/types.ts` com a saída.

**Se o MCP estiver em `lljn`, NÃO regenerar** — os tipos gerados seriam de outro banco e apagariam tabelas reais do arquivo. Fallback: editar `src/integrations/supabase/types.ts` à mão, adicionando às três seções (`Row`, `Insert`, `Update`) de `simulados_admin`:

```ts
// em Row:
          data_agendada_original: string | null
          data_realizacao: string | null
          modalidade: string | null
// em Insert e em Update:
          data_agendada_original?: string | null
          data_realizacao?: string | null
          modalidade?: string | null
```

(mantendo a ordem alfabética das chaves usada pelo gerador).

- [ ] **Step 7: Verificar que o type-check continua verde**

```bash
cd "C:/Users/felipe.souza/Documents/Projetos (Sanar)/sanarflix-study-guide"
npm run type-check
```

Expected: sem saída de erro, exit 0.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260726104000_simulados_admin_modalidade_datas.sql src/integrations/supabase/types.ts
git commit -m "simulados_admin: modalidade, data_realizacao e data_agendada_original (spec §6.2)"
```

---

### Task 6: Tabelas `ies_contrato_simulados` e `ies_simulado_previsto`

Spec §6.1 e §6.2. É o dado que **não existe** e sem o qual a home nasce vazia (§7.2). O contrato declara *quantos* simulados a IES tem direito; cada linha de `ies_simulado_previsto` é um slot. Slot com `simulado_id` nulo = **"A definir"**. O KPI "3 de 7" é `count(slots com simulado realizado) / contrato.simulados_contratados`.

**Files:**
- Create: `supabase/migrations/20260726105000_ies_contrato_simulados.sql`
- Modify: `src/integrations/supabase/types.ts`

**Interfaces:**
- Consumes: `public.ies(id)`, `public.simulados_admin(id)`, `auth.users(id)`, `public.user_can_access_ies(uuid, uuid)`, `public.has_role(uuid, app_role)`.
- Produces: `public.ies_contrato_simulados` (`id`, `ies_id`, `nome_contrato`, `simulados_contratados`, `vigencia_inicio`, `vigencia_fim`, `created_at`, `created_by`) e `public.ies_simulado_previsto` (`id`, `contrato_id`, `ies_id`, `ordem`, `nome_previsto`, `simulado_id`, `created_at`). Consumidos por `get_gestor_contexto()` (campo `contrato: { nome, simuladosContratados, vigencia }`) e `get_gestor_cronograma(p_ies_id)` (itens com `status: 'previsto'`) na Fase 2, e pela superfície de admin de §6.3.

- [ ] **Step 1: Conferir que as tabelas não existem**

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('ies_contrato_simulados','ies_simulado_previsto');
```

Expected: **0 linhas**.

- [ ] **Step 2: Escrever o SQL da migration**

Criar `supabase/migrations/20260726105000_ies_contrato_simulados.sql`:

```sql
-- Portal do Gestor v2 — contrato de simulados e slots previstos (spec §6.1, §6.2)
-- Dado novo, tabelas novas, nenhuma migração destrutiva.
-- Leitura por user_can_access_ies (admin e b2b_partner já retornam true nela).
-- Escrita bloqueada para authenticated: só admin (política própria) ou service_role.

-- ---------------------------------------------------------------- contrato
create table if not exists public.ies_contrato_simulados (
  id                    uuid primary key default gen_random_uuid(),
  ies_id                uuid not null references public.ies(id) on delete cascade,
  nome_contrato         text not null,
  simulados_contratados int  not null check (simulados_contratados > 0),
  vigencia_inicio       date not null,
  vigencia_fim          date not null,
  created_at            timestamptz not null default now(),
  created_by            uuid references auth.users(id),
  constraint ies_contrato_simulados_vigencia_check check (vigencia_fim >= vigencia_inicio)
);

create unique index if not exists ies_contrato_simulados_ies_nome_uidx
  on public.ies_contrato_simulados (ies_id, nome_contrato);

create index if not exists ies_contrato_simulados_ies_idx
  on public.ies_contrato_simulados (ies_id);

create index if not exists ies_contrato_simulados_vigencia_idx
  on public.ies_contrato_simulados (ies_id, vigencia_fim desc);

comment on table public.ies_contrato_simulados is
  'Contrato de simulados por IES. simulados_contratados é o denominador do KPI "3 de 7" (spec §6.2).';

-- ------------------------------------------------------------------- slots
create table if not exists public.ies_simulado_previsto (
  id            uuid primary key default gen_random_uuid(),
  contrato_id   uuid not null references public.ies_contrato_simulados(id) on delete cascade,
  ies_id        uuid not null references public.ies(id) on delete cascade,
  ordem         int  not null check (ordem > 0),
  nome_previsto text,
  simulado_id   uuid references public.simulados_admin(id),
  created_at    timestamptz not null default now()
);

create unique index if not exists ies_simulado_previsto_contrato_ordem_uidx
  on public.ies_simulado_previsto (contrato_id, ordem);

create index if not exists ies_simulado_previsto_ies_idx
  on public.ies_simulado_previsto (ies_id);

create index if not exists ies_simulado_previsto_simulado_idx
  on public.ies_simulado_previsto (simulado_id)
  where simulado_id is not null;

comment on table public.ies_simulado_previsto is
  'Um slot por simulado contratado. simulado_id nulo = "A definir" (spec §6.2, decisão 24/07).';
comment on column public.ies_simulado_previsto.simulado_id is
  'Nulo = slot ainda sem simulado real vinculado; o cronograma mostra "A definir" e status previsto (spec §6.4).';

-- --------------------------------------------------------------------- RLS
alter table public.ies_contrato_simulados enable row level security;
alter table public.ies_simulado_previsto  enable row level security;

-- Grants: authenticated só lê. Escrita fica com service_role e com a política de admin.
-- CORRIGIDO em 28/07: o revoke tem que citar authenticated. O pg_default_acl do
-- schema public concede arwdDxtm (tudo) a anon, authenticated e service_role em
-- TODA tabela nova; revogando so de public+anon, authenticated mantem
-- INSERT/UPDATE/DELETE e o grant select abaixo fica redundante.
revoke all on table public.ies_contrato_simulados from public, anon, authenticated;
revoke all on table public.ies_simulado_previsto  from public, anon, authenticated;
grant select on public.ies_contrato_simulados to authenticated;
grant select on public.ies_simulado_previsto  to authenticated;
grant all    on public.ies_contrato_simulados to service_role;
grant all    on public.ies_simulado_previsto  to service_role;

-- SELECT: quem pode acessar a IES lê o contrato dela.
drop policy if exists "Contrato legivel por quem acessa a IES" on public.ies_contrato_simulados;
create policy "Contrato legivel por quem acessa a IES"
  on public.ies_contrato_simulados for select to authenticated
  using (public.user_can_access_ies(auth.uid(), ies_id));

drop policy if exists "Slots legiveis por quem acessa a IES" on public.ies_simulado_previsto;
create policy "Slots legiveis por quem acessa a IES"
  on public.ies_simulado_previsto for select to authenticated
  using (public.user_can_access_ies(auth.uid(), ies_id));

-- ESCRITA: só admin. Sem política de INSERT/UPDATE/DELETE para gestor ou
-- gestor_grupo — com RLS ligada e nenhuma política aplicável, a escrita é negada
-- por padrão. As RPCs de admin de §6.3 são SECURITY DEFINER e passam por cima.
drop policy if exists "Admins gerenciam contrato de simulados" on public.ies_contrato_simulados;
create policy "Admins gerenciam contrato de simulados"
  on public.ies_contrato_simulados for all to authenticated
  using      (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "Admins gerenciam slots previstos" on public.ies_simulado_previsto;
create policy "Admins gerenciam slots previstos"
  on public.ies_simulado_previsto for all to authenticated
  using      (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));
```

> Nota sobre o grant: a política "Admins gerenciam" cobre `FOR ALL`, mas `authenticated` só recebeu `GRANT SELECT` — o privilégio de tabela vem antes da RLS, então um admin usando a chave anon **não** consegue escrever direto. Isso é deliberado: escrita de contrato passa por RPC `SECURITY DEFINER` de admin (§6.3), que é onde a auditoria mora. A política existe para o caso de a superfície de admin optar por escrita direta; nesse momento o `GRANT INSERT, UPDATE, DELETE TO authenticated` entra na migration da §6.3, não nesta.

- [ ] **Step 3: Aplicar em produção**

Confirmar `mcp__supabase__get_project_url` → `gvqvrmkizemwsasmupmo`. Aplicar com `mcp__supabase__apply_migration`, name `ies_contrato_simulados`.

Expected: sucesso.

- [ ] **Step 4: Verificar tabelas, índices e políticas**

```sql
-- colunas
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema='public'
  and table_name in ('ies_contrato_simulados','ies_simulado_previsto')
order by table_name, ordinal_position;

-- RLS ligada
select relname, relrowsecurity
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('ies_contrato_simulados','ies_simulado_previsto');

-- políticas
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname='public'
  and tablename in ('ies_contrato_simulados','ies_simulado_previsto')
order by tablename, policyname;

-- índices
select tablename, indexname, indexdef
from pg_indexes
where schemaname='public'
  and tablename in ('ies_contrato_simulados','ies_simulado_previsto')
order by tablename, indexname;

-- grants de tabela
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema='public'
  and table_name in ('ies_contrato_simulados','ies_simulado_previsto')
  and grantee in ('anon','authenticated','service_role')
order by table_name, grantee, privilege_type;
```

Expected:
- `ies_contrato_simulados` com 9 colunas (8 do spec + o CHECK de vigência não é coluna), `ies_simulado_previsto` com 7 colunas.
- `relrowsecurity = true` nas duas.
- 4 políticas: 2 de `SELECT` (`Contrato legivel...`, `Slots legiveis...`) e 2 de `ALL` (`Admins gerenciam...`), todas com role `{authenticated}`.
- Índices: `ies_contrato_simulados_pkey`, `ies_contrato_simulados_ies_nome_uidx`, `ies_contrato_simulados_ies_idx`, `ies_contrato_simulados_vigencia_idx`, `ies_simulado_previsto_pkey`, `ies_simulado_previsto_contrato_ordem_uidx`, `ies_simulado_previsto_ies_idx`, `ies_simulado_previsto_simulado_idx`.
- Grants: `authenticated` só com `SELECT`; `anon` **sem nenhuma linha**; `service_role` com o conjunto completo.

- [ ] **Step 5: Provar os CHECKs e a unicidade com rollback**

```sql
begin;
-- pega uma IES real
create temp table _ies as select id from public.ies limit 1;

-- 1) simulados_contratados <= 0 deve falhar
savepoint s1;
insert into public.ies_contrato_simulados (ies_id, nome_contrato, simulados_contratados, vigencia_inicio, vigencia_fim)
select id, 'TESTE_ZERO', 0, '2026-01-01', '2026-12-31' from _ies;
rollback to savepoint s1;

-- 2) vigencia_fim < vigencia_inicio deve falhar
savepoint s2;
insert into public.ies_contrato_simulados (ies_id, nome_contrato, simulados_contratados, vigencia_inicio, vigencia_fim)
select id, 'TESTE_VIGENCIA', 7, '2026-12-31', '2026-01-01' from _ies;
rollback to savepoint s2;

-- 3) contrato válido + 7 slots, sendo 7 "A definir"
insert into public.ies_contrato_simulados (ies_id, nome_contrato, simulados_contratados, vigencia_inicio, vigencia_fim)
select id, 'TESTE_OK', 7, '2026-01-01', '2026-12-31' from _ies;

insert into public.ies_simulado_previsto (contrato_id, ies_id, ordem, nome_previsto)
select c.id, c.ies_id, g, 'Simulado ' || g
from public.ies_contrato_simulados c, generate_series(1,7) g
where c.nome_contrato = 'TESTE_OK';

select count(*) as slots, count(simulado_id) as slots_com_simulado
from public.ies_simulado_previsto p
join public.ies_contrato_simulados c on c.id = p.contrato_id
where c.nome_contrato = 'TESTE_OK';

-- 4) mesma (contrato_id, ordem) deve falhar
savepoint s4;
insert into public.ies_simulado_previsto (contrato_id, ies_id, ordem)
select c.id, c.ies_id, 1 from public.ies_contrato_simulados c where c.nome_contrato = 'TESTE_OK';
rollback to savepoint s4;

rollback;
```

Expected: os inserts 1, 2 e 4 levantam erro (`check constraint "ies_contrato_simulados_simulados_contratados_check"`, `..._vigencia_check`, `duplicate key value violates unique constraint "ies_simulado_previsto_contrato_ordem_uidx"`); o `select` do item 3 devolve `slots = 7`, `slots_com_simulado = 0`; e o `rollback` final não deixa nada gravado. Confirmar com `select count(*) from public.ies_contrato_simulados where nome_contrato like 'TESTE_%';` → **0**.

- [ ] **Step 6: Regenerar `src/integrations/supabase/types.ts`**

Confirmar gvqv e rodar `mcp__supabase__generate_typescript_types`, sobrescrevendo `src/integrations/supabase/types.ts`. Se o MCP estiver em `lljn`, aplicar o mesmo fallback manual da Task 5 Step 6, adicionando os dois blocos de tabela em ordem alfabética (`ies_contrato_simulados` e `ies_simulado_previsto` entram depois de `ies_features`):

```ts
      ies_contrato_simulados: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          ies_id: string
          nome_contrato: string
          simulados_contratados: number
          vigencia_fim: string
          vigencia_inicio: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          ies_id: string
          nome_contrato: string
          simulados_contratados: number
          vigencia_fim: string
          vigencia_inicio: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          ies_id?: string
          nome_contrato?: string
          simulados_contratados?: number
          vigencia_fim?: string
          vigencia_inicio?: string
        }
        Relationships: [
          {
            foreignKeyName: "ies_contrato_simulados_ies_id_fkey"
            columns: ["ies_id"]
            isOneToOne: false
            referencedRelation: "ies"
            referencedColumns: ["id"]
          },
        ]
      }
      ies_simulado_previsto: {
        Row: {
          contrato_id: string
          created_at: string
          id: string
          ies_id: string
          nome_previsto: string | null
          ordem: number
          simulado_id: string | null
        }
        Insert: {
          contrato_id: string
          created_at?: string
          id?: string
          ies_id: string
          nome_previsto?: string | null
          ordem: number
          simulado_id?: string | null
        }
        Update: {
          contrato_id?: string
          created_at?: string
          id?: string
          ies_id?: string
          nome_previsto?: string | null
          ordem?: number
          simulado_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ies_simulado_previsto_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "ies_contrato_simulados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ies_simulado_previsto_ies_id_fkey"
            columns: ["ies_id"]
            isOneToOne: false
            referencedRelation: "ies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ies_simulado_previsto_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "simulados_admin"
            referencedColumns: ["id"]
          },
        ]
      }
```

- [ ] **Step 7: Verificar type-check e advisors de segurança**

```bash
cd "C:/Users/felipe.souza/Documents/Projetos (Sanar)/sanarflix-study-guide"
npm run type-check
```

Expected: exit 0.

Depois rodar `mcp__supabase__get_advisors` com type `security` e confirmar que **nenhum** advisor novo aponta `ies_contrato_simulados` ou `ies_simulado_previsto` como "RLS disabled" ou "policy allows public access". Se aparecer, corrigir antes de commitar.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260726105000_ies_contrato_simulados.sql src/integrations/supabase/types.ts
git commit -m "Tabelas ies_contrato_simulados e ies_simulado_previsto com RLS (spec §6.2)"
```

---

### Task 7: `publico_alvo` em `announcements`

Spec §6.1 item 3 e §6.2. `announcements` hoje segmenta por IES (`ies_selecionadas`/`ies_excluidas`) e por `semestre_destino`, mas **não por papel** — sem esta coluna, `get_gestor_avisos` mostraria aviso de aluno no portal do gestor. O backfill explícito é a parte que **não** pode ser esquecida.

**Files:**
- Create: `supabase/migrations/20260726110000_announcements_publico_alvo.sql`
- Modify: `src/integrations/supabase/types.ts`

**Interfaces:**
- Consumes: `public.announcements`.
- Produces: `announcements.publico_alvo` (`text[]` not null default `'{aluno}'`, elementos em `('aluno','gestor','professor')`). Consumido pelo filtro `'gestor' = any(a.publico_alvo)` em `get_gestor_avisos(p_ies_id)` na Fase 2 e pelo tipo `Aviso` de `src/features/gestor/api/types.ts`.

- [ ] **Step 1: Contar as linhas antes, para o backfill ser verificável**

```sql
select count(*) as avisos_total, count(*) filter (where ativo) as avisos_ativos
from public.announcements;
```

Expected: um par de números. **Anotar `avisos_total`** — é a referência do Step 4.

- [ ] **Step 2: Escrever o SQL da migration**

Criar `supabase/migrations/20260726110000_announcements_publico_alvo.sql`:

```sql
-- Portal do Gestor v2 — público-alvo dos avisos (spec §6.1, §6.2)
-- announcements segmenta por IES e por semestre, mas não por papel.
-- Backfill explícito para '{aluno}': sem ele, todo aviso existente apareceria
-- no portal do gestor (vazamento de comunicação de aluno).

-- 1) coluna nullable, sem default ainda, para o backfill ser mensurável
alter table public.announcements
  add column if not exists publico_alvo text[];

-- 2) backfill de TODAS as linhas existentes
update public.announcements
set publico_alvo = array['aluno']::text[]
where publico_alvo is null;

-- 3) agora fixa default e NOT NULL
alter table public.announcements
  alter column publico_alvo set default array['aluno']::text[];

alter table public.announcements
  alter column publico_alvo set not null;

-- 4) CHECK de vocabulário: array não vazio e só valores conhecidos
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.announcements'::regclass
      and conname  = 'announcements_publico_alvo_check'
  ) then
    alter table public.announcements
      add constraint announcements_publico_alvo_check
      check (
        cardinality(publico_alvo) >= 1  -- CORRIGIDO: array_length(a,1) devolve NULL para array vazio,
        and publico_alvo <@ array['aluno','gestor','professor']::text[]
      );
  end if;
end $$;

-- 5) índice GIN: o filtro do gestor é 'gestor' = any(publico_alvo)
create index if not exists announcements_publico_alvo_gin
  on public.announcements using gin (publico_alvo);

comment on column public.announcements.publico_alvo is
  'Personas que veem o aviso: aluno | gestor | professor. Default {aluno}. Backfill de 26/07/2026 marcou todo o histórico como {aluno} (spec §6.2).';
```

- [ ] **Step 3: Aplicar em produção**

Confirmar `mcp__supabase__get_project_url` → `gvqvrmkizemwsasmupmo`. Aplicar com `mcp__supabase__apply_migration`, name `announcements_publico_alvo`.

Expected: sucesso. Se o passo 4 do SQL falhar com violação de CHECK, significa que o backfill do passo 2 não pegou tudo — investigar antes de seguir, **não** relaxar o CHECK.

- [ ] **Step 4: Verificar a coluna e contar as linhas afetadas**

```sql
-- coluna, default e nullability
select column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema='public' and table_name='announcements' and column_name='publico_alvo';

-- backfill: nenhum nulo, e TODO mundo é {aluno}
select
  count(*)                                                  as total,
  count(*) filter (where publico_alvo is null)              as nulos,
  count(*) filter (where publico_alvo = array['aluno'])      as somente_aluno,
  count(*) filter (where 'gestor' = any(publico_alvo))       as visiveis_ao_gestor
from public.announcements;

-- CHECK e índice
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid='public.announcements'::regclass and conname='announcements_publico_alvo_check';

select indexname, indexdef from pg_indexes
where schemaname='public' and tablename='announcements' and indexname='announcements_publico_alvo_gin';
```

Expected:
- `data_type = 'ARRAY'`, `udt_name = '_text'`, `is_nullable = 'NO'`, `column_default = 'ARRAY[''aluno''::text]'`.
- `total` = o `avisos_total` anotado no Step 1; `nulos = 0`; `somente_aluno = total`; **`visiveis_ao_gestor = 0`** — este é o número que prova que nenhum aviso de aluno vaza para o portal do gestor.
- CHECK presente e índice GIN presente.

- [ ] **Step 5: Provar o CHECK e o default com rollback**

```sql
begin;
-- array vazio deve falhar
savepoint s1;
update public.announcements set publico_alvo = array[]::text[]
where id = (select id from public.announcements limit 1);
rollback to savepoint s1;

-- valor fora do vocabulário deve falhar
savepoint s2;
update public.announcements set publico_alvo = array['gestor','diretor']::text[]
where id = (select id from public.announcements limit 1);
rollback to savepoint s2;

-- combinação válida deve passar
update public.announcements set publico_alvo = array['aluno','gestor']::text[]
where id = (select id from public.announcements limit 1);
select id, publico_alvo from public.announcements
where 'gestor' = any(publico_alvo);

rollback;
```

Expected: os dois primeiros updates levantam `violates check constraint "announcements_publico_alvo_check"`; o terceiro passa e o `select` devolve 1 linha; após o `rollback`, `select count(*) from public.announcements where 'gestor' = any(publico_alvo);` volta a **0**.

- [ ] **Step 6: Regenerar `src/integrations/supabase/types.ts`**

Confirmar gvqv e rodar `mcp__supabase__generate_typescript_types`, sobrescrevendo o arquivo. Fallback manual (MCP em `lljn`): nas três seções de `announcements`, entre `prioridade` e `semestre_destino`:

```ts
// em Row:
          publico_alvo: string[]
// em Insert e em Update:
          publico_alvo?: string[]
```

- [ ] **Step 7: Verificar que nada do aluno quebrou**

`announcements` já é lida pelo portal do aluno. A coluna é aditiva e com default, então nenhum `insert` existente quebra — mas confirmar:

```bash
cd "C:/Users/felipe.souza/Documents/Projetos (Sanar)/sanarflix-study-guide"
npm run type-check
npm run test:run
```

Expected: `type-check` exit 0. `test:run` com o mesmo número de testes passando que antes da task (rodar `npm run test:run` **antes** da task e anotar o total, se ainda não tiver a referência).

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260726110000_announcements_publico_alvo.sql src/integrations/supabase/types.ts
git commit -m "announcements.publico_alvo com backfill para {aluno} (spec §6.2)"
```

---

### Task 8: `api/types.ts`, `lib/regras.ts` e `lib/formatters.ts` com TDD

Primeira task de código. Spec §4.3 (`>= 60`), §4.4 (régua de 3 níveis), §4.10 (nunca preencher lacuna com zero — daí o `TRACO`), §11 (as regras da §4 cobertas por teste unitário). `regras.ts` é a fonte da verdade que substitui as 5 réguas divergentes e os 10 `PROFICIENCY_THRESHOLD` duplicados.

**Files:**
- Create: `src/features/gestor/api/types.ts`
- Create: `src/features/gestor/lib/regras.ts`
- Create: `src/features/gestor/lib/formatters.ts`
- Test: `src/features/gestor/__tests__/regras.test.ts`
- Test: `src/features/gestor/__tests__/formatters.test.ts`

**Interfaces:**
- Consumes: `NIVEL_CRITICO_MAX` decidido na Task 2. **DECIDIDO em 28/07: 50** (`pct_sem_critico_corte30 = 87,9%`, acima do limiar de 70%). Os trechos abaixo já refletem 50; o histórico da revisão está na §2 do arquivo de notes.
- Produces:
  - `src/features/gestor/api/types.ts`: `FiltroSemestre`, `NivelDesempenho`, `GrupoEvolucao`, `StatusSimulado`, `Tendencia`, `ModoGrafico`, `Meta`, `Envelope<T>`, `Paginado<T>`, `ContextoGestor`, `ItemCronograma`, `Aviso`, `PontoSerie`, `Kpi`, `VisaoGeral`, `NoDiagnostico`, `TemaCritico`, `LinhaAluno`, `AlunoNoSimulado`, `MetricasSimulado`, `Alternativa`, `Questao`, `AcertoPorAreaESemestre`, `Detalhamento`.
  - `src/features/gestor/lib/regras.ts`: `PROFICIENCIA_MINIMA`, `NIVEL_CRITICO_MAX`, `NIVEL_EXCELENTE_MIN`, `ehProficiente`, `nivelDesempenho`, `grupoEvolucao`, `calcularVariacao`, `tendencia`.
  - `src/features/gestor/lib/formatters.ts`: `TRACO`, `formatPct`, `formatNumero`, `formatConceito`, `formatData`, `formatDelta`.
  - Consumidos por todas as tasks de front das Fases 1 a 4 e por `api/queries.ts`.

- [ ] **Step 1: Criar `src/features/gestor/api/types.ts`**

É dependência de `regras.ts` (importa `NivelDesempenho`, `GrupoEvolucao`, `Tendencia`). Só tipos — a verificação é `npm run type-check`, não teste unitário.

```ts
/**
 * Contratos de dado do Portal do Gestor v2.
 * Espelha `contracts/types.ts` do handoff de design, com duas divergências
 * deliberadas resolvidas na spec:
 *  - NÃO existe `notaTri`: "Nota TRI" foi eliminada como métrica separada e o
 *    rótulo único é "Proficiência" (spec §4.1).
 *  - Papéis são `admin | gestor_grupo | gestor` do enum `app_role`, não
 *    `admin_b2b | gestor_grupo | gestor_ies` do handoff (spec §3).
 */

export type FiltroSemestre =
  | '6ano'
  | 'geral'
  | '1' | '2' | '3' | '4' | '5' | '6'
  | '7' | '8' | '9' | '10' | '11' | '12';

export type NivelDesempenho = 'excelente' | 'mediano' | 'critico';

export type GrupoEvolucao =
  | 'consistentemente_proficiente'
  | 'em_variacao'
  | 'consistentemente_nao_proficiente';

export type StatusSimulado =
  | 'realizado'
  | 'agendado'
  | 'reagendado'
  | 'previsto'
  | 'processing';

export type Tendencia = 'subindo' | 'descendo' | 'alternando' | 'estavel';

export type ModoGrafico = 'geral' | 'area' | 'aluno';

/** Rastreabilidade obrigatória de todo indicador (spec §4.1). */
export interface Meta {
  periodo: string;
  fonte: string;
  atualizadoEm: string;
  criterio: string;
  partial: boolean;
  lowSample: boolean;
}

export interface Envelope<T> {
  data: T;
  meta: Meta;
}

export interface Paginado<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ContextoGestor {
  usuario: { id: string; nome: string; papel: 'admin' | 'gestor_grupo' | 'gestor' };
  iesDisponiveis: { id: string; nome: string }[];
  iesAtual: { id: string; nome: string };
  contrato: { nome: string; simuladosContratados: number; vigencia: string } | null;
  podeTrocarIes: boolean;
  podeExportar: boolean;
}

export interface ItemCronograma {
  id: string;
  nome: string;
  data: string | null;
  status: StatusSimulado;
  modalidade: 'online' | 'presencial' | null;
  participantes?: number;
  indisponivelPorque?: string;
}

export interface Aviso {
  id: string;
  titulo: string;
  resumo: string;
  data: string;
  lido: boolean;
}

export interface PontoSerie {
  rotulo: string;
  valor: number | null;
}

export interface Kpi {
  valor: number | null;
  delta: number | null;
  serie: PontoSerie[];
  criterio: string;
}

export interface VisaoGeral {
  kpis: {
    enamedProjetado: Kpi;
    proficientesPct: Kpi;
    acertoPct: Kpi;
    simulados: { realizados: number; contratados: number };
  };
  evolucao: {
    simuladoId: string;
    nome: string;
    data: string;
    valor: number | null;
    participantes: number;
  }[];
  evolucaoPorArea: { area: string; pontos: PontoSerie[]; critica: boolean }[];
  diagnosticoResumo: {
    nivel: NivelDesempenho;
    areas: { id: string; nome: string; acertoPct: number }[];
  }[];
  distribuicaoAlunos: { grupo: GrupoEvolucao; quantidade: number; percentual: number }[];
  dispersao: { alunoId: string; semestre: number; nota: number }[];
  insights: { escopo: 'area' | 'aluno'; texto: string }[];
}

export interface NoDiagnostico {
  id: string;
  nome: string;
  nivel: 'grande_area' | 'especialidade';
  acertoPct: number;
  desempenho: NivelDesempenho;
  amostra: number;
  lowSample: boolean;
  temFilhos: boolean;
}

export interface TemaCritico {
  id: string;
  nome: string;
  acertoPct: number;
  amostra: number;
  lowSample: boolean;
}

export interface LinhaAluno {
  id: string;
  nome: string;
  semestre: number;
  grupo: GrupoEvolucao;
  proficiencias: (number | null)[];
  tendencia: Tendencia;
}

export interface AlunoNoSimulado {
  id: string;
  nome: string;
  semestre: number;
  participou: boolean;
  acertos: number | null;
  proficiencia: number | null;
  situacao: 'proficiente' | 'abaixo_do_limiar' | 'nao_participou';
  posicao?: { lugar: number; total: number; percentil: number };
  acertoPorArea?: { area: string; acertoPct: number; critica: boolean }[];
  variacao?: number | null;
}

export interface MetricasSimulado {
  simuladoId: string;
  nome: string;
  data: string;
  participantes: number;
  acertoMedioPct: number | null;
  enamedProjetado: number | null;
  proficienciaMedia: number | null;
}

export interface Alternativa {
  letra: 'A' | 'B' | 'C' | 'D' | 'E';
  texto: string;
  correta: boolean;
  marcadaPct: number;
}

export interface Questao {
  numero: number;
  grandeArea: string;
  especialidade: string;
  tema: string;
  acertoPct: number;
  enunciado: string;
  alternativas: Alternativa[];
  distratorDominante?: Alternativa['letra'];
}

export interface AcertoPorAreaESemestre {
  areas: { id: string; nome: string; acertoPct: number; critica: boolean }[];
  semestres: { semestre: number; acertoPct: number; emEvidencia: boolean }[];
  recorte?: { tipo: 'area' | 'semestre'; id: string };
}

export interface Detalhamento {
  metricas: MetricasSimulado[];
  acertoPorAreaESemestre: AcertoPorAreaESemestre;
  dispersao: { alunoId: string; semestre: number; nota: number }[];
  questoes?: Paginado<Questao>;
  comparativoTemas?: {
    tema: string;
    porSimulado: { simuladoId: string; acertoPct: number }[];
  }[];
}
```

Run: `npm run type-check`
Expected: exit 0 (arquivo só de tipos, nada importa dele ainda).

- [ ] **Step 2: Escrever o teste que falha — `regras.test.ts`**

Criar `src/features/gestor/__tests__/regras.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  PROFICIENCIA_MINIMA,
  NIVEL_CRITICO_MAX,
  NIVEL_EXCELENTE_MIN,
  ehProficiente,
  nivelDesempenho,
  grupoEvolucao,
  calcularVariacao,
  tendencia,
} from '@/features/gestor/lib/regras';

describe('constantes da régua canônica (spec §4.3, §4.4)', () => {
  it('fixa os três cortes oficiais', () => {
    expect(PROFICIENCIA_MINIMA).toBe(60);
    expect(NIVEL_CRITICO_MAX).toBe(50);
    expect(NIVEL_EXCELENTE_MIN).toBe(80);
  });
});

describe('ehProficiente — corte >= 60 (spec §4.3, caso de teste crítico nº1)', () => {
  it('59.9 NÃO é proficiente', () => {
    expect(ehProficiente(59.9)).toBe(false);
  });

  it('60 É proficiente — o handoff está errado ao dizer que não é', () => {
    expect(ehProficiente(60)).toBe(true);
  });

  it('60.1 é proficiente', () => {
    expect(ehProficiente(60.1)).toBe(true);
  });

  it('null não é proficiente (ausência não vira zero — spec §4.10)', () => {
    expect(ehProficiente(null)).toBe(false);
  });

  it('extremos da escala', () => {
    expect(ehProficiente(0)).toBe(false);
    expect(ehProficiente(100)).toBe(true);
  });
});

describe('nivelDesempenho — 3 níveis sobre % de acerto (spec §4.4)', () => {
  it('null devolve null, nunca crítico', () => {
    expect(nivelDesempenho(null)).toBeNull();
  });

  it('49.9 é crítico', () => {
    expect(nivelDesempenho(49.9)).toBe('critico');
  });

  it('50 é mediano — a borda pertence ao mediano', () => {
    expect(nivelDesempenho(50)).toBe('mediano');
  });

  it('30 é crítico com o corte decidido na Task 2 — não mais mediano', () => {
    expect(nivelDesempenho(30)).toBe('critico');
  });

  it('79.9 é mediano', () => {
    expect(nivelDesempenho(79.9)).toBe('mediano');
  });

  it('80 é excelente — a borda pertence ao excelente', () => {
    expect(nivelDesempenho(80)).toBe('excelente');
  });

  it('extremos da escala', () => {
    expect(nivelDesempenho(0)).toBe('critico');
    expect(nivelDesempenho(100)).toBe('excelente');
  });
});

describe('calcularVariacao (spec §4.10)', () => {
  it('devolve a diferença quando os dois lados existem', () => {
    expect(calcularVariacao(58, 61)).toBe(3);
    expect(calcularVariacao(61, 58)).toBe(-3);
    expect(calcularVariacao(60, 60)).toBe(0);
  });

  it('devolve null quando o anterior é null', () => {
    expect(calcularVariacao(null, 61)).toBeNull();
  });

  it('devolve null quando o atual é null', () => {
    expect(calcularVariacao(58, null)).toBeNull();
  });

  it('devolve null quando os dois são null', () => {
    expect(calcularVariacao(null, null)).toBeNull();
  });

  it('não devolve ruído de ponto flutuante', () => {
    expect(calcularVariacao(59.9, 62.5)).toBe(2.6);
  });
});

describe('grupoEvolucao (spec §4.8)', () => {
  it('série toda proficiente => consistentemente_proficiente', () => {
    expect(grupoEvolucao([60, 72, 88])).toBe('consistentemente_proficiente');
  });

  it('série toda não proficiente => consistentemente_nao_proficiente', () => {
    expect(grupoEvolucao([12, 40, 59.9])).toBe('consistentemente_nao_proficiente');
  });

  it('série alternando => em_variacao', () => {
    expect(grupoEvolucao([45, 71, 52])).toBe('em_variacao');
  });

  it('ignora null e classifica pelos pontos existentes', () => {
    expect(grupoEvolucao([null, 72, null, 88])).toBe('consistentemente_proficiente');
    expect(grupoEvolucao([null, 41, null])).toBe('consistentemente_nao_proficiente');
    expect(grupoEvolucao([null, 41, 91])).toBe('em_variacao');
  });

  it('devolve null quando não há nenhum ponto utilizável', () => {
    expect(grupoEvolucao([])).toBeNull();
    expect(grupoEvolucao([null, null])).toBeNull();
  });

  it('um único ponto ainda classifica — não força em_variacao', () => {
    expect(grupoEvolucao([61])).toBe('consistentemente_proficiente');
    expect(grupoEvolucao([59])).toBe('consistentemente_nao_proficiente');
  });
});

describe('tendencia (spec §4.11 — representa a janela toda)', () => {
  it('monotônica crescente => subindo', () => {
    expect(tendencia([40, 55, 70])).toBe('subindo');
  });

  it('monotônica decrescente => descendo', () => {
    expect(tendencia([70, 55, 40])).toBe('descendo');
  });

  it('sobe e desce => alternando', () => {
    expect(tendencia([40, 70, 55])).toBe('alternando');
    expect(tendencia([70, 40, 65])).toBe('alternando');
  });

  it('valores repetidos => estavel', () => {
    expect(tendencia([60, 60, 60])).toBe('estavel');
  });

  it('platô com um único sentido segue o sentido', () => {
    expect(tendencia([40, 40, 55])).toBe('subindo');
    expect(tendencia([55, 40, 40])).toBe('descendo');
  });

  it('menos de dois pontos utilizáveis => estavel', () => {
    expect(tendencia([])).toBe('estavel');
    expect(tendencia([61])).toBe('estavel');
    expect(tendencia([null, 61, null])).toBe('estavel');
  });

  it('null é buraco na série, não queda', () => {
    expect(tendencia([40, null, 70])).toBe('subindo');
    expect(tendencia([70, null, 40])).toBe('descendo');
  });
});
```

- [ ] **Step 3: Rodar o teste para confirmar que falha**

Run: `npx vitest run src/features/gestor/__tests__/regras.test.ts`
Expected: **FAIL** com erro de resolução de import, do tipo `Failed to load url /src/features/gestor/lib/regras (resolved id: .../src/features/gestor/lib/regras). Does the file exist?` — nenhum teste executa. Se em vez disso vier "No test files found", o caminho do arquivo de teste está errado.

- [ ] **Step 4: Escrever `src/features/gestor/lib/regras.ts`**

```ts
/**
 * Fonte da verdade das regras de negócio do Portal do Gestor v2.
 *
 * Substitui as cinco réguas incompatíveis mapeadas na spec §4.4 e os dez pontos
 * de `PROFICIENCY_THRESHOLD` duplicados. Nenhum componente reimplementa corte.
 *
 * Referências: spec §4.3 (proficiente >= 60), §4.4 (3 níveis sobre % de acerto),
 * §4.8 (grupos de evolução), §4.10 (null nunca vira zero), §4.11 (tendência).
 */

import type { GrupoEvolucao, NivelDesempenho, Tendencia } from '../api/types';

/**
 * Corte de proficiência do aluno, sobre `resultados_alunos_tri.score_proprio`.
 * `>=`, não `>`: o banco trata `score_proprio < 60` como abaixo do esperado
 * (migration 20260708143105) e `is_proficient_proprio` já materializa isso.
 * O handoff, que diz "> 60", está errado neste ponto (spec §4.3).
 */
export const PROFICIENCIA_MINIMA = 60;

/**
 * Teto exclusivo do nível crítico, sobre **% de acerto** (nunca proficiência).
 * 50, medido com dado real na Task 2: em 87,9% dos recortes o corte de 30 não
 * classificaria nenhuma área como crítica (100% sem dado de teste). Trocar aqui
 * e no teste correspondente é o único custo de revisar o corte (spec §4.4).
 */
export const NIVEL_CRITICO_MAX = 50;

/** Piso inclusivo do nível excelente, sobre % de acerto (spec §4.4). */
export const NIVEL_EXCELENTE_MIN = 80;

/** Proficiência ausente não é "não proficiente por zero" — é ausência (§4.10). */
export function ehProficiente(proficiencia: number | null): boolean {
  return proficiencia !== null && proficiencia >= PROFICIENCIA_MINIMA;
}

/**
 * Classifica **% de acerto** em crítico / mediano / excelente.
 * Vale para grande área, especialidade e tema — os três usam % de acerto e
 * nunca proficiência (spec §4.1, invariantes). `null` devolve `null`: a UI
 * mostra `—`, não "crítico".
 */
export function nivelDesempenho(acertoPct: number | null): NivelDesempenho | null {
  if (acertoPct === null) return null;
  if (acertoPct < NIVEL_CRITICO_MAX) return 'critico';
  if (acertoPct >= NIVEL_EXCELENTE_MIN) return 'excelente';
  return 'mediano';
}

/**
 * Agrupa o aluno pela consistência da proficiência ao longo dos simulados.
 * `null` é buraco na série (não participou) e é descartado antes de classificar.
 * Sem nenhum ponto utilizável, devolve `null` — grupo desconhecido, não "em variação".
 */
export function grupoEvolucao(proficiencias: (number | null)[]): GrupoEvolucao | null {
  const pontos = proficiencias.filter((p): p is number => p !== null);
  if (pontos.length === 0) return null;

  const proficientes = pontos.filter((p) => ehProficiente(p)).length;
  if (proficientes === pontos.length) return 'consistentemente_proficiente';
  if (proficientes === 0) return 'consistentemente_nao_proficiente';
  return 'em_variacao';
}

/**
 * Diferença entre dois pontos comparáveis. Devolve `null` se QUALQUER um dos
 * dois lados for `null` — variação só existe quando os dois pontos existem
 * (spec §4.10 e caso de teste crítico nº8).
 * Arredonda a 1 decimal para não propagar ruído de ponto flutuante para a UI.
 */
export function calcularVariacao(anterior: number | null, atual: number | null): number | null {
  if (anterior === null || atual === null) return null;
  return Math.round((atual - anterior) * 10) / 10;
}

/**
 * Direção da série de proficiência na **janela toda** (spec §4.11) — não é
 * leitura ponto a ponto e não gera tooltip por ponto.
 * Menos de dois pontos utilizáveis => 'estavel' (nada a inferir).
 */
export function tendencia(proficiencias: (number | null)[]): Tendencia {
  const pontos = proficiencias.filter((p): p is number => p !== null);
  if (pontos.length < 2) return 'estavel';

  let subiu = false;
  let desceu = false;

  for (let i = 1; i < pontos.length; i += 1) {
    const delta = pontos[i] - pontos[i - 1];
    if (delta > 0) subiu = true;
    if (delta < 0) desceu = true;
  }

  if (subiu && desceu) return 'alternando';
  if (subiu) return 'subindo';
  if (desceu) return 'descendo';
  return 'estavel';
}
```

- [ ] **Step 5: Rodar o teste para confirmar que passa**

Run: `npx vitest run src/features/gestor/__tests__/regras.test.ts`
Expected: **PASS** — `Test Files 1 passed (1)`, `Tests 31 passed (31)`.

- [ ] **Step 6: Escrever o teste que falha — `formatters.test.ts`**

Criar `src/features/gestor/__tests__/formatters.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  TRACO,
  formatPct,
  formatNumero,
  formatConceito,
  formatData,
  formatDelta,
} from '@/features/gestor/lib/formatters';

describe('TRACO', () => {
  it('é o em-dash, não hífen nem "N/A"', () => {
    expect(TRACO).toBe('—');
  });
});

describe('formatPct (spec §4.10 — null nunca vira 0%)', () => {
  it('null devolve TRACO', () => {
    expect(formatPct(null)).toBe(TRACO);
  });

  it('zero é zero, NÃO é TRACO', () => {
    expect(formatPct(0)).toBe('0%');
  });

  it('sem decimais por padrão, com % colado', () => {
    expect(formatPct(60)).toBe('60%');
    expect(formatPct(100)).toBe('100%');
  });

  it('arredonda para inteiro por padrão', () => {
    expect(formatPct(58.6)).toBe('59%');
    expect(formatPct(58.4)).toBe('58%');
  });

  it('respeita o número de decimais pedido, com vírgula pt-BR', () => {
    expect(formatPct(12.5, 1)).toBe('12,5%');
    expect(formatPct(60, 1)).toBe('60,0%');
    expect(formatPct(7.25, 2)).toBe('7,25%');
  });
});

describe('formatNumero', () => {
  it('null devolve TRACO', () => {
    expect(formatNumero(null)).toBe(TRACO);
  });

  it('zero é zero', () => {
    expect(formatNumero(0)).toBe('0');
  });

  it('usa separador de milhar pt-BR', () => {
    expect(formatNumero(1234)).toBe('1.234');
    expect(formatNumero(1234567)).toBe('1.234.567');
  });

  it('preserva decimal com vírgula', () => {
    expect(formatNumero(1234.5)).toBe('1.234,5');
  });
});

describe('formatConceito (spec §4.1 — escala 1 a 5, nunca média)', () => {
  it('null devolve TRACO', () => {
    expect(formatConceito(null)).toBe(TRACO);
  });

  it('devolve N/5', () => {
    expect(formatConceito(3)).toBe('3/5');
    expect(formatConceito(1)).toBe('1/5');
    expect(formatConceito(5)).toBe('5/5');
  });
});

describe('formatData', () => {
  it('null devolve TRACO', () => {
    expect(formatData(null)).toBe(TRACO);
  });

  it('formata date em dd/MM/yyyy', () => {
    expect(formatData('2026-07-24')).toBe('24/07/2026');
    expect(formatData('2026-01-05')).toBe('05/01/2026');
  });

  it('formata timestamptz usando a data que o servidor mandou, sem deslocar por fuso', () => {
    expect(formatData('2026-07-24T03:00:00+00:00')).toBe('24/07/2026');
    expect(formatData('2026-07-24T23:59:00Z')).toBe('24/07/2026');
  });

  it('string inválida devolve TRACO em vez de "Invalid Date"', () => {
    expect(formatData('')).toBe(TRACO);
    expect(formatData('nao-e-data')).toBe(TRACO);
  });
});

describe('formatDelta (régua 1º · anterior · atual, spec §4.8)', () => {
  it('null devolve TRACO', () => {
    expect(formatDelta(null)).toBe(TRACO);
  });

  it('positivo ganha sinal explícito', () => {
    expect(formatDelta(3)).toBe('+3');
    expect(formatDelta(2.5)).toBe('+2,5');
  });

  it('negativo mantém o sinal', () => {
    expect(formatDelta(-2)).toBe('-2');
    expect(formatDelta(-2.5)).toBe('-2,5');
  });

  it('zero é "0", sem sinal', () => {
    expect(formatDelta(0)).toBe('0');
  });
});
```

- [ ] **Step 7: Rodar o teste para confirmar que falha**

Run: `npx vitest run src/features/gestor/__tests__/formatters.test.ts`
Expected: **FAIL** com `Failed to load url /src/features/gestor/lib/formatters ... Does the file exist?`

- [ ] **Step 8: Escrever `src/features/gestor/lib/formatters.ts`**

```ts
/**
 * Formatadores do Portal do Gestor v2. Locale pt-BR.
 *
 * Regra que atravessa todos: valor `null` devolve `TRACO`. Nunca preencher
 * lacuna com zero, média do grupo ou estimativa (spec §4.10).
 */

/** Em-dash. Único símbolo de ausência da interface do gestor. */
export const TRACO = '—';

const LOCALE = 'pt-BR';

/**
 * Percentual 0–100 com `%` colado. Sem decimais por padrão.
 * `0` formata como `'0%'` — zero é dado, ausência é `TRACO`.
 */
export function formatPct(valor: number | null, decimals = 0): string {
  if (valor === null) return TRACO;
  const numero = valor.toLocaleString(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${numero}%`;
}

/** Inteiro ou decimal com separadores pt-BR (`1.234,5`). */
export function formatNumero(valor: number | null): string {
  if (valor === null) return TRACO;
  return valor.toLocaleString(LOCALE, { maximumFractionDigits: 1 });
}

/**
 * Conceito ENAMED projetado, escala 1–5 inteira (spec §4.1).
 * Formato `N/5` para a escala ficar explícita no card.
 */
export function formatConceito(valor: number | null): string {
  if (valor === null) return TRACO;
  return `${Math.round(valor)}/5`;
}

/**
 * `dd/MM/yyyy` a partir do que o servidor mandou.
 *
 * Lê os dígitos da porção de data do ISO em vez de instanciar `Date`: um
 * `new Date('2026-07-24')` é meia-noite UTC e, em UTC-3, renderizaria
 * `23/07/2026` — data errada no cronograma. A data exibida é a data-calendário
 * que a RPC devolveu, sem reinterpretação de fuso no cliente.
 */
export function formatData(iso: string | null): string {
  if (iso === null) return TRACO;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return TRACO;
  const [, ano, mes, dia] = match;
  return `${dia}/${mes}/${ano}`;
}

/**
 * Variação com sinal explícito, para a régua `1º · anterior · atual` (spec §4.8).
 * `0` sai sem sinal; positivo ganha `+`; negativo já vem com `-` do locale.
 */
export function formatDelta(valor: number | null): string {
  if (valor === null) return TRACO;
  const numero = formatNumero(valor);
  if (valor > 0) return `+${numero}`;
  return numero;
}
```

- [ ] **Step 9: Rodar o teste para confirmar que passa**

Run: `npx vitest run src/features/gestor/__tests__/formatters.test.ts`
Expected: **PASS** — `Test Files 1 passed (1)`, `Tests 20 passed (20)`.

- [ ] **Step 10: Rodar a verificação completa**

```bash
cd "C:/Users/felipe.souza/Documents/Projetos (Sanar)/sanarflix-study-guide"
npm run lint
npm run type-check
npm run test:run
```

Expected: `lint` sem erro (warnings pré-existentes de outros arquivos podem continuar; **nenhum** novo em `src/features/gestor/`); `type-check` exit 0; `test:run` com os 51 testes novos somados ao total anterior (30 em regras + 1 acrescentado na revisão do corte + 20 em formatters). Atenção: a suíte já vinha com 2 falhas pré-existentes em `src/test/unit/access.test.ts` — comparar contra o total anotado antes da task, não contra zero.

Se o `lint` reclamar de `import type` ou de ordem de import nos arquivos novos, corrigir com `npx eslint src/features/gestor --fix` e rodar `npm run lint` de novo — não silenciar com `eslint-disable`.

- [ ] **Step 11: Commit**

```bash
git add src/features/gestor/api/types.ts \
        src/features/gestor/lib/regras.ts \
        src/features/gestor/lib/formatters.ts \
        src/features/gestor/__tests__/regras.test.ts \
        src/features/gestor/__tests__/formatters.test.ts
git commit -m "Gestor v2: types, regras e formatters com teste (spec §4.3, §4.4, §4.10)"
```

---

## Fase 0b — Superfície de admin do cronograma

> **Por que esta fase existe:** o spec §6.3 diz literalmente que *"O CX/cadastros precisa poder: criar contrato por IES, definir quantos simulados, criar slots, vincular slot a simulado, marcar modalidade e datas. Sem isso o cronograma nasce vazio e a home fica sem âncora no piloto. Escopo próprio, mas **bloqueia a Fase 1**."* As Tasks 9–13 entregam essa superfície: 4 RPCs de escrita, 1 de leitura, os wrappers de serviço e a tela.
>
> **O que investiguei no repo e onde SIGO O REPO em vez do enunciado:**
> 1. **Padrão de RPC de admin (confirmado):** `supabase/migrations/20260707172740_5974477f-84b9-4f8e-8370-3476953fc389.sql` tem 4 funções (`admin_command_center`, `admin_get_audit_log`, `admin_log_action`, `admin_anular_questao`) todas com `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp`, guard `IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'admin role required'; END IF;`, `RETURNS jsonb`, e o par `REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon;` + `GRANT EXECUTE ON FUNCTION ... TO authenticated, service_role;`. **É esse padrão exato que as Tasks 9–11 seguem** (inclusive `service_role` no GRANT, que o enunciado não mencionava).
> 2. **Auditoria:** `admin_audit_log` tem só `(admin_id, action, target_user_id, metadata, created_at)`. Não há coluna de "target genérico" — então contrato/slot/simulado vão dentro de `metadata`, com `target_user_id` nulo. Confirmado em `src/integrations/supabase/types.ts`.
> 3. **Wrapper de serviço:** há DOIS padrões em `src/services/admin/`. `iesFeatures.ts` usa `withRetry` + `withTimeout` + cast de `supabase.rpc`; `simulados.ts` usa o cast simples `(supabase.rpc as CallableFunction)` + `Logger.error` + `throw`. **Sigo o de `simulados.ts`** (mais enxuto, é o mais recente) e documento o cast, porque as RPCs novas não estão em `types.ts`.
> 4. **Registro de seção nova de admin (confirmado):** é em DOIS arquivos — `src/experiences/admin/adminRoutes.tsx` (rota-filha lazy dentro de `/admin`) e `src/experiences/admin/AdminNav.ts` (item em `ADMIN_NAV_GROUPS` com `capability`). Não há registro automático. **E há dois testes que travam a contagem** (`src/test/unit/adminNav.test.ts` e `src/test/unit/buildAppRoutes.test.ts` asseveram exatamente 11 seções) — a Task 13 obrigatoriamente atualiza os dois, senão `npm run test:run` quebra.
> 5. **Capability:** `src/experiences/access.ts` linha 19/48 tem `'ies.manage'` e o item de nav `/admin/ies` já usa ela. **A seção nova usa `ies.manage`** — não invento capability nova.
> 6. **DIVERGÊNCIA que assumo explicitamente (1):** escrita em `simulados_admin` no repo hoje é `.from('simulados_admin').update(...)` direto do client (`SimuladoConfigDialog.tsx:514`, `ProvasTab.tsx:264`), **não** RPC. Mesmo assim crio a RPC `admin_set_simulado_agenda` para modalidade/datas, porque a derivação de `data_agendada_original` (§6.4 — "a tag Reagendado some automaticamente quando a data é alterada para uma nova data definitiva, e o campo `data_agendada_original` é atualizado junto") é regra de negócio que não pode viver no client, e precisa de auditoria. A Task 10 diz isso na cara.
> 7. **DIVERGÊNCIA que assumo explicitamente (2):** os nomes canônicos do handoff listam só 3 RPCs de admin nesta fase. `admin_set_simulado_agenda` é um **quarto nome que estou introduzindo**, porque a Task 13 pede "modalidade e datas" e nenhuma das 3 escreve em `simulados_admin`. Quem revisar o plano deve adicionar esse nome à lista canônica.
> 8. **DIVERGÊNCIA que assumo explicitamente (3):** os testes não são colocados no repo — vivem em `src/test/unit/` e `src/test/components/admin/`. O contexto compartilhado manda `src/features/gestor/__tests__/` para o **portal novo do gestor**; esta fatia é admin, então **sigo o repo** e uso `src/test/unit/` e `src/test/components/admin/`.
> 9. **DIVERGÊNCIA que assumo explicitamente (4):** os `<select>` da tela nova são **nativos**, não `@/components/ui/select` (Radix). Motivo concreto: `src/test/components/admin/IesFeaturesBoard.test.tsx:170-184` precisa stubar `Element.prototype.hasPointerCapture` e `scrollIntoView` e caçar a opção portalizada no body para testar UM Radix Select. Numa tabela com N selects por linha isso fica intratável. Estilizo o `<select>` nativo com as classes do trigger shadcn para o visual não destoar.
> 10. **Pré-requisito da Fase 0a:** as Tasks 9–13 assumem que as tabelas `public.ies_contrato_simulados` / `public.ies_simulado_previsto` e as colunas `simulados_admin.modalidade` / `simulados_admin.data_realizacao` / `simulados_admin.data_agendada_original` **já existem em produção** (criadas na Fase 0a). Se `\d public.ies_contrato_simulados` falhar, PARE e volte para a Fase 0a.

---

### Task 9: RPCs de escrita do contrato de simulados

**Files:**
- Create: `supabase/migrations/20260726120000_admin_contrato_simulados_write.sql`

**Interfaces:**
- Consumes (da Fase 0a): tabelas `public.ies_contrato_simulados(id, ies_id, nome_contrato, simulados_contratados, vigencia_inicio, vigencia_fim, created_at, created_by)` e `public.ies_simulado_previsto(id, contrato_id, ies_id, ordem, nome_previsto, simulado_id, created_at)`; índice único `(ies_id, nome_contrato)`. Consome também `public.has_role(uuid, app_role)` e `public.admin_audit_log`.
- Produces: `public.admin_upsert_ies_contrato(uuid, text, int, date, date) → jsonb` e `public.admin_delete_ies_contrato(uuid) → jsonb`. Consumidas pela Task 12 (`upsertIesContrato`, `deleteIesContrato`).

Não há teste automatizado de SQL neste repo (não existe pgTAP, não existe `supabase db test`) — a verificação é a query de checagem do Step 3, rodada contra o prod. Isso é explícito, não é omissão.

- [ ] **Step 1: Confirmar o project ref antes de qualquer DDL**

**PERIGO REAL:** o MCP do Supabase desta sessão pode estar apontando para o projeto **lljn**, que NÃO é produção. Produção é **gvqv** (`gvqvrmkizemwsasmupmo`), hardcoded em `src/integrations/supabase/client.ts`.

Rode, via MCP do Supabase, `get_project_url` e confira que a URL contém `gvqvrmkizemwsasmupmo`.

Expected: `https://gvqvrmkizemwsasmupmo.supabase.co`

Se vier qualquer outro ref: **PARE**. Não aplique. Ou troque o projeto do MCP, ou aplique via agente do Lovable com `send_message` (o Lovable está ligado no gvqv).

Confirme também que a Fase 0a já rodou:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('ies_contrato_simulados', 'ies_simulado_previsto')
order by table_name;
```

Expected: 2 linhas — `ies_contrato_simulados`, `ies_simulado_previsto`. Se vier 0 ou 1 linha, volte para a Fase 0a.

- [ ] **Step 2: Escrever o SQL das duas RPCs**

Crie `supabase/migrations/20260726120000_admin_contrato_simulados_write.sql` com:

```sql
-- Fase 0b · Task 9 — RPCs de escrita do contrato de simulados por IES (spec §6.2/§6.3).
-- Padrão idêntico ao de 20260707172740 (admin_set_ies_features & cia):
-- SECURITY DEFINER + search_path=public,pg_temp + guard has_role(admin) + audit + REVOKE/GRANT.

-- 1) admin_upsert_ies_contrato — cria ou atualiza o contrato de uma IES.
--    Idempotente pela chave natural (ies_id, nome_contrato): chamar duas vezes
--    com o mesmo nome ATUALIZA, não duplica.
CREATE OR REPLACE FUNCTION public.admin_upsert_ies_contrato(
  p_ies_id uuid,
  p_nome text,
  p_simulados_contratados int,
  p_vigencia_inicio date,
  p_vigencia_fim date
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_nome text := btrim(COALESCE(p_nome, ''));
  v_ies_nome text;
  v_id uuid;
  v_existia boolean;
  v_slots_atuais int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  SELECT nome INTO v_ies_nome FROM public.ies WHERE id = p_ies_id;
  IF v_ies_nome IS NULL THEN
    RAISE EXCEPTION 'IES % não encontrada', p_ies_id;
  END IF;

  IF length(v_nome) = 0 THEN
    RAISE EXCEPTION 'p_nome é obrigatório';
  END IF;
  IF length(v_nome) > 120 THEN
    RAISE EXCEPTION 'p_nome muito longo (máx 120)';
  END IF;
  IF p_simulados_contratados IS NULL OR p_simulados_contratados <= 0 THEN
    RAISE EXCEPTION 'p_simulados_contratados deve ser maior que zero';
  END IF;
  IF p_simulados_contratados > 60 THEN
    RAISE EXCEPTION 'p_simulados_contratados fora da faixa esperada (máx 60)';
  END IF;
  IF p_vigencia_inicio IS NULL OR p_vigencia_fim IS NULL THEN
    RAISE EXCEPTION 'vigência (início e fim) é obrigatória';
  END IF;
  IF p_vigencia_fim < p_vigencia_inicio THEN
    RAISE EXCEPTION 'vigencia_fim (%) é anterior a vigencia_inicio (%)', p_vigencia_fim, p_vigencia_inicio;
  END IF;

  SELECT id INTO v_id
  FROM public.ies_contrato_simulados
  WHERE ies_id = p_ies_id AND nome_contrato = v_nome;
  v_existia := v_id IS NOT NULL;

  -- Reduzir o contratado abaixo do número de slots JÁ criados deixaria slots
  -- órfãos (o KPI "3 de 7" ficaria com denominador menor que o numerador).
  IF v_existia THEN
    SELECT count(*) INTO v_slots_atuais
    FROM public.ies_simulado_previsto
    WHERE contrato_id = v_id;

    IF p_simulados_contratados < v_slots_atuais THEN
      RAISE EXCEPTION
        'contrato já tem % slot(s); remova slots antes de reduzir para %',
        v_slots_atuais, p_simulados_contratados;
    END IF;
  END IF;

  INSERT INTO public.ies_contrato_simulados
    (ies_id, nome_contrato, simulados_contratados, vigencia_inicio, vigencia_fim, created_by)
  VALUES
    (p_ies_id, v_nome, p_simulados_contratados, p_vigencia_inicio, p_vigencia_fim, auth.uid())
  ON CONFLICT (ies_id, nome_contrato) DO UPDATE
    SET simulados_contratados = EXCLUDED.simulados_contratados,
        vigencia_inicio       = EXCLUDED.vigencia_inicio,
        vigencia_fim          = EXCLUDED.vigencia_fim
  RETURNING id INTO v_id;

  INSERT INTO public.admin_audit_log(admin_id, action, metadata)
  VALUES (
    auth.uid(),
    CASE WHEN v_existia THEN 'ies_contrato_update' ELSE 'ies_contrato_create' END,
    jsonb_build_object(
      'contrato_id', v_id,
      'ies_id', p_ies_id,
      'ies_nome', v_ies_nome,
      'nome_contrato', v_nome,
      'simulados_contratados', p_simulados_contratados,
      'vigencia_inicio', p_vigencia_inicio,
      'vigencia_fim', p_vigencia_fim,
      'slots_atuais', v_slots_atuais
    )
  );

  RETURN jsonb_build_object(
    'contrato_id', v_id,
    'criado', NOT v_existia,
    'ies_id', p_ies_id,
    'nome_contrato', v_nome,
    'simulados_contratados', p_simulados_contratados,
    'vigencia_inicio', p_vigencia_inicio,
    'vigencia_fim', p_vigencia_fim
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_ies_contrato(uuid,text,int,date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_ies_contrato(uuid,text,int,date,date) TO authenticated, service_role;

-- 2) admin_delete_ies_contrato — apaga o contrato (cascade nos slots).
--    Recusa se algum slot já aponta para um simulado real: apagar levaria embora
--    o vínculo do cronograma sem o operador perceber.
CREATE OR REPLACE FUNCTION public.admin_delete_ies_contrato(
  p_contrato_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_contrato record;
  v_slots_total int;
  v_slots_vinculados int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  SELECT id, ies_id, nome_contrato, simulados_contratados
    INTO v_contrato
  FROM public.ies_contrato_simulados
  WHERE id = p_contrato_id;

  IF v_contrato.id IS NULL THEN
    RAISE EXCEPTION 'contrato % não encontrado', p_contrato_id;
  END IF;

  SELECT count(*), count(simulado_id)
    INTO v_slots_total, v_slots_vinculados
  FROM public.ies_simulado_previsto
  WHERE contrato_id = p_contrato_id;

  IF v_slots_vinculados > 0 THEN
    RAISE EXCEPTION
      'contrato tem % slot(s) vinculados a simulado; desvincule antes de excluir',
      v_slots_vinculados;
  END IF;

  DELETE FROM public.ies_contrato_simulados WHERE id = p_contrato_id;

  INSERT INTO public.admin_audit_log(admin_id, action, metadata)
  VALUES (
    auth.uid(),
    'ies_contrato_delete',
    jsonb_build_object(
      'contrato_id', p_contrato_id,
      'ies_id', v_contrato.ies_id,
      'nome_contrato', v_contrato.nome_contrato,
      'simulados_contratados', v_contrato.simulados_contratados,
      'slots_removidos', v_slots_total
    )
  );

  RETURN jsonb_build_object(
    'contrato_id', p_contrato_id,
    'slots_removidos', v_slots_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_ies_contrato(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_ies_contrato(uuid) TO authenticated, service_role;
```

- [ ] **Step 3: Aplicar em produção e verificar**

Aplique o conteúdo do arquivo via MCP do Supabase (`apply_migration`, name `admin_contrato_simulados_write`), **com o ref gvqv já confirmado no Step 1**. Alternativa: `send_message` ao agente do Lovable pedindo para executar o SQL — o banco NÃO é gerenciado pelo Lovable, então DDL vai por `send_message` mesmo.

Verificação 1 — as duas funções existem com `SECURITY DEFINER` e `search_path` fixo:

```sql
select p.proname,
       p.prosecdef                as security_definer,
       p.proconfig                as config,
       p.provolatile              as volatile
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('admin_upsert_ies_contrato', 'admin_delete_ies_contrato')
order by p.proname;
```

Expected: 2 linhas, `security_definer = true`, `config = {search_path=public, pg_temp}` nas duas.

Verificação 2 — `anon` NÃO pode executar, `authenticated` pode:

```sql
select has_function_privilege('anon',          'public.admin_upsert_ies_contrato(uuid,text,int,date,date)', 'EXECUTE') as anon_upsert,
       has_function_privilege('authenticated', 'public.admin_upsert_ies_contrato(uuid,text,int,date,date)', 'EXECUTE') as auth_upsert,
       has_function_privilege('anon',          'public.admin_delete_ies_contrato(uuid)', 'EXECUTE') as anon_delete,
       has_function_privilege('authenticated', 'public.admin_delete_ies_contrato(uuid)', 'EXECUTE') as auth_delete;
```

Expected: `anon_upsert = false`, `auth_upsert = true`, `anon_delete = false`, `auth_delete = true`.

Verificação 3 — o guard de admin dispara. Rode como `anon` (via `execute_sql` com role trocada, ou pelo app deslogado):

```sql
set local role anon;
select public.admin_upsert_ies_contrato(
  '00000000-0000-0000-0000-000000000000'::uuid, 'Teste', 1, '2026-01-01', '2026-12-31'
);
reset role;
```

Expected: `ERROR: permission denied for function admin_upsert_ies_contrato` (o REVOKE barra antes do guard). Se por acaso o REVOKE não pegou, o erro esperado é `ERROR: admin role required` — nesse caso, **reaplique o REVOKE** e investigue.

- [ ] **Step 4: Regenerar os tipos do Supabase**

As RPCs novas entram na seção `Functions` de `src/integrations/supabase/types.ts`. Regenere via MCP do Supabase (`generate_typescript_types`, **ref gvqv confirmado**) e sobrescreva o arquivo.

Se o MCP estiver apontando para lljn e você não conseguir trocar, **não regenere** — o arquivo ficaria com o schema do projeto errado, que é pior que ficar desatualizado. Nesse caso os wrappers da Task 12 continuam com o cast documentado (`(supabase.rpc as CallableFunction)`), exatamente como `src/services/admin/simulados.ts` faz hoje, e você anota isso no commit.

Depois:

Run: `npm run type-check`
Expected: exit 0, sem erros.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260726120000_admin_contrato_simulados_write.sql src/integrations/supabase/types.ts
git commit -m "Fase 0b: RPCs admin_upsert_ies_contrato e admin_delete_ies_contrato (spec 6.3)"
```

---

### Task 10: RPCs de escrita dos slots e da agenda do simulado

**Files:**
- Create: `supabase/migrations/20260726121000_admin_slots_e_agenda_write.sql`

**Interfaces:**
- Consumes: `public.ies_contrato_simulados` e `public.ies_simulado_previsto` (Fase 0a); `simulados_admin.modalidade` / `.data_realizacao` / `.data_agendada_original` (Fase 0a); `public.has_role`; `public.admin_audit_log`.
- Produces: `public.admin_set_ies_simulados_previstos(uuid, jsonb) → jsonb` e `public.admin_set_simulado_agenda(uuid, text, timestamptz, timestamptz, timestamptz, boolean) → jsonb`. Consumidas pela Task 12 (`setIesSimuladosPrevistos`, `setSimuladoAgenda`).

**Formato do `p_slots` (contrato exato do jsonb):**

```json
[
  { "ordem": 1, "nome_previsto": "Simulado 1 — Diagnóstico", "simulado_id": "8f1c...-uuid" },
  { "ordem": 2, "nome_previsto": "Simulado 2",               "simulado_id": null },
  { "ordem": 3, "nome_previsto": null,                        "simulado_id": null }
]
```

Semântica (spec §6.2): array **completo e autoritativo** — é um *sync*, não um append. `ordem` é a chave de identidade do slot dentro do contrato (inteiro >= 1, único no array). `simulado_id` nulo = slot **"A definir"**, que é justamente o caso que dá ao gestor "visibilidade de quantos simulados a IES tem direito". Slot cuja `ordem` não aparece no array é **removido**.

**Duas adições minhas, declaradas:**
1. O spec §6.2 não define índice único em `ies_simulado_previsto`. Sem ele o sync por `(contrato_id, ordem)` não é idempotente (duas chamadas duplicariam slots). A migration cria `ies_simulado_previsto_contrato_ordem_uidx`.
2. `admin_set_simulado_agenda` não está na lista de nomes canônicos do handoff — introduzo aqui porque a Task 13 pede "modalidade e datas" e nenhuma das outras RPCs escreve em `simulados_admin`. Divergência do repo: escrita em `simulados_admin` hoje é `.from().update()` direto (`src/components/admin/simulados/SimuladoConfigDialog.tsx:514`); vai por RPC porque a derivação de `data_agendada_original` (§6.4) é regra de negócio e precisa auditoria.

- [ ] **Step 1: Reconfirmar o project ref**

Mesma checagem do Step 1 da Task 9: `get_project_url` deve devolver `https://gvqvrmkizemwsasmupmo.supabase.co`. Confirme também que as colunas da Fase 0a existem:

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'simulados_admin'
  and column_name in ('modalidade', 'data_realizacao', 'data_agendada_original')
order by column_name;
```

Expected: 3 linhas — `data_agendada_original | timestamp with time zone | YES`, `data_realizacao | timestamp with time zone | YES`, `modalidade | text | YES`. Se vier menos de 3, volte para a Fase 0a.

- [ ] **Step 2: Escrever o SQL do sync de slots**

Crie `supabase/migrations/20260726121000_admin_slots_e_agenda_write.sql` começando com:

```sql
-- Fase 0b · Task 10 — sync dos slots do contrato + agenda do simulado (spec §6.2/§6.3/§6.4).

-- Índice único que torna o sync por (contrato_id, ordem) idempotente.
-- ADIÇÃO ao modelo do spec §6.2, que não define unicidade nessa tabela.
CREATE UNIQUE INDEX IF NOT EXISTS ies_simulado_previsto_contrato_ordem_uidx
  ON public.ies_simulado_previsto (contrato_id, ordem);

-- 1) admin_set_ies_simulados_previstos — sincroniza a lista COMPLETA de slots
--    do contrato: cria o que falta, atualiza o que mudou, remove o que saiu.
CREATE OR REPLACE FUNCTION public.admin_set_ies_simulados_previstos(
  p_contrato_id uuid,
  p_slots jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_contrato record;
  v_qtd int;
  v_ordens int[];
  v_simulado_invalido uuid;
  v_criados int := 0;
  v_atualizados int := 0;
  v_removidos int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  IF p_slots IS NULL OR jsonb_typeof(p_slots) <> 'array' THEN
    RAISE EXCEPTION 'p_slots deve ser um array jsonb';
  END IF;

  SELECT id, ies_id, nome_contrato, simulados_contratados
    INTO v_contrato
  FROM public.ies_contrato_simulados
  WHERE id = p_contrato_id;

  IF v_contrato.id IS NULL THEN
    RAISE EXCEPTION 'contrato % não encontrado', p_contrato_id;
  END IF;

  v_qtd := jsonb_array_length(p_slots);

  -- Regra do spec §6.2: o contrato declara QUANTOS simulados a IES tem direito.
  -- Mais slots que isso quebraria o KPI "3 de 7".
  IF v_qtd > v_contrato.simulados_contratados THEN
    RAISE EXCEPTION
      '% slot(s) excedem os % simulado(s) contratado(s)',
      v_qtd, v_contrato.simulados_contratados;
  END IF;

  -- Normaliza o payload uma única vez.
  CREATE TEMP TABLE _slots_in ON COMMIT DROP AS
  SELECT (s->>'ordem')::int          AS ordem,
         NULLIF(btrim(COALESCE(s->>'nome_previsto', '')), '') AS nome_previsto,
         NULLIF(s->>'simulado_id', '')::uuid                  AS simulado_id
  FROM jsonb_array_elements(COALESCE(p_slots, '[]'::jsonb)) s;

  IF EXISTS (SELECT 1 FROM _slots_in WHERE ordem IS NULL OR ordem < 1) THEN
    RAISE EXCEPTION 'cada slot precisa de "ordem" inteira maior ou igual a 1';
  END IF;

  SELECT array_agg(ordem ORDER BY ordem) INTO v_ordens FROM _slots_in;
  IF (SELECT count(DISTINCT ordem) FROM _slots_in) <> v_qtd THEN
    RAISE EXCEPTION '"ordem" duplicada em p_slots: %', v_ordens;
  END IF;

  -- Um slot só pode apontar para simulado que existe E pertence à IES do contrato.
  SELECT si.simulado_id INTO v_simulado_invalido
  FROM _slots_in si
  WHERE si.simulado_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.simulados_admin sa
      WHERE sa.id = si.simulado_id
        AND v_contrato.ies_id = ANY(sa.ies_ids)
    )
  LIMIT 1;

  IF v_simulado_invalido IS NOT NULL THEN
    RAISE EXCEPTION
      'simulado % não existe ou não está liberado para a IES % do contrato',
      v_simulado_invalido, v_contrato.ies_id;
  END IF;

  IF (SELECT count(DISTINCT simulado_id) FROM _slots_in WHERE simulado_id IS NOT NULL)
     <> (SELECT count(simulado_id) FROM _slots_in) THEN
    RAISE EXCEPTION 'o mesmo simulado foi vinculado a mais de um slot do contrato';
  END IF;

  -- Remove os slots que saíram do payload.
  WITH del AS (
    DELETE FROM public.ies_simulado_previsto p
    WHERE p.contrato_id = p_contrato_id
      AND NOT EXISTS (SELECT 1 FROM _slots_in si WHERE si.ordem = p.ordem)
    RETURNING 1
  )
  SELECT count(*) INTO v_removidos FROM del;

  -- Cria/atualiza pela chave (contrato_id, ordem).
  WITH ups AS (
    INSERT INTO public.ies_simulado_previsto (contrato_id, ies_id, ordem, nome_previsto, simulado_id)
    SELECT p_contrato_id, v_contrato.ies_id, si.ordem, si.nome_previsto, si.simulado_id
    FROM _slots_in si
    ON CONFLICT (contrato_id, ordem) DO UPDATE
      SET nome_previsto = EXCLUDED.nome_previsto,
          simulado_id   = EXCLUDED.simulado_id
    RETURNING (xmax = 0) AS inserido
  )
  SELECT count(*) FILTER (WHERE inserido),
         count(*) FILTER (WHERE NOT inserido)
    INTO v_criados, v_atualizados
  FROM ups;

  INSERT INTO public.admin_audit_log(admin_id, action, metadata)
  VALUES (
    auth.uid(),
    'ies_simulados_previstos_set',
    jsonb_build_object(
      'contrato_id', p_contrato_id,
      'ies_id', v_contrato.ies_id,
      'nome_contrato', v_contrato.nome_contrato,
      'simulados_contratados', v_contrato.simulados_contratados,
      'slots_enviados', v_qtd,
      'criados', v_criados,
      'atualizados', v_atualizados,
      'removidos', v_removidos,
      'payload', p_slots
    )
  );

  RETURN jsonb_build_object(
    'contrato_id', p_contrato_id,
    'slots', v_qtd,
    'criados', v_criados,
    'atualizados', v_atualizados,
    'removidos', v_removidos
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_ies_simulados_previstos(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_ies_simulados_previstos(uuid,jsonb) TO authenticated, service_role;
```

- [ ] **Step 3: Escrever o SQL da agenda do simulado (mesmo arquivo)**

Continue o MESMO arquivo `20260726121000_admin_slots_e_agenda_write.sql` com:

```sql
-- 2) admin_set_simulado_agenda — modalidade + datas do simulado, com a
--    derivação de data_agendada_original do spec §6.4.
--
--    Datas por modalidade (§6.4): ONLINE tem data de início (quando aparece
--    pro aluno = data_liberacao) + encerramento; PRESENCIAL tem só a data de
--    realização (data_realizacao).
--
--    data_agendada_original guarda a 1ª data marcada, e é o que permite
--    derivar "reagendado" (§6.4: agendado = original nula ou igual à atual;
--    reagendado = original difere da atual). O spec diz que "a tag Reagendado
--    some automaticamente quando a data é alterada para uma NOVA DATA
--    DEFINITIVA — o campo data_agendada_original é atualizado junto".
--    "Definitiva" é uma decisão do operador, não algo derivável do banco:
--    por isso p_definitiva. Com p_definitiva=false, mudar a data mantém a
--    original e o cronograma mostra "Reagendado"; com true, a original é
--    sincronizada com a nova data e a tag some.
CREATE OR REPLACE FUNCTION public.admin_set_simulado_agenda(
  p_simulado_id uuid,
  p_modalidade text DEFAULT NULL,
  p_data_realizacao timestamptz DEFAULT NULL,
  p_data_liberacao timestamptz DEFAULT NULL,
  p_data_encerramento timestamptz DEFAULT NULL,
  p_definitiva boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_antes record;
  v_modalidade text := NULLIF(btrim(COALESCE(p_modalidade, '')), '');
  v_data_efetiva_antes timestamptz;
  v_data_efetiva_depois timestamptz;
  v_original timestamptz;
  v_depois record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  SELECT id, nome, modalidade, data_realizacao, data_liberacao,
         data_encerramento, data_agendada_original
    INTO v_antes
  FROM public.simulados_admin
  WHERE id = p_simulado_id;

  IF v_antes.id IS NULL THEN
    RAISE EXCEPTION 'simulado % não encontrado', p_simulado_id;
  END IF;

  IF v_modalidade IS NOT NULL AND v_modalidade NOT IN ('online', 'presencial') THEN
    RAISE EXCEPTION 'modalidade inválida: % (esperado online ou presencial)', v_modalidade;
  END IF;

  IF v_modalidade = 'presencial' AND p_data_realizacao IS NULL THEN
    RAISE EXCEPTION 'simulado presencial exige data_realizacao';
  END IF;
  IF v_modalidade = 'online' AND p_data_liberacao IS NULL THEN
    RAISE EXCEPTION 'simulado online exige data_liberacao (data de início)';
  END IF;
  IF p_data_encerramento IS NOT NULL AND p_data_liberacao IS NOT NULL
     AND p_data_encerramento < p_data_liberacao THEN
    RAISE EXCEPTION 'data_encerramento é anterior a data_liberacao';
  END IF;

  -- "Data do simulado" no cronograma = realização (presencial) ou início (online).
  v_data_efetiva_antes  := COALESCE(v_antes.data_realizacao, v_antes.data_liberacao);
  v_data_efetiva_depois := COALESCE(p_data_realizacao, p_data_liberacao);

  IF v_data_efetiva_depois IS NULL THEN
    -- Sem data nenhuma o slot é "previsto"/"A definir" (§6.4) — zera a original
    -- para não deixar resíduo que faria o cronograma dizer "reagendado".
    v_original := NULL;
  ELSIF v_antes.data_agendada_original IS NULL THEN
    v_original := v_data_efetiva_depois;                 -- 1º agendamento
  ELSIF p_definitiva THEN
    v_original := v_data_efetiva_depois;                 -- nova data definitiva → tag some
  ELSE
    v_original := v_antes.data_agendada_original;        -- remarcação → "Reagendado"
  END IF;

  UPDATE public.simulados_admin
     SET modalidade             = v_modalidade,
         data_realizacao        = p_data_realizacao,
         data_liberacao         = p_data_liberacao,
         data_encerramento      = p_data_encerramento,
         data_agendada_original = v_original,
         updated_at             = now()
   WHERE id = p_simulado_id
  RETURNING id, nome, modalidade, data_realizacao, data_liberacao,
            data_encerramento, data_agendada_original
    INTO v_depois;

  INSERT INTO public.admin_audit_log(admin_id, action, metadata)
  VALUES (
    auth.uid(),
    'simulado_agenda_set',
    jsonb_build_object(
      'simulado_id', p_simulado_id,
      'simulado_nome', v_antes.nome,
      'definitiva', p_definitiva,
      'antes', jsonb_build_object(
        'modalidade', v_antes.modalidade,
        'data_realizacao', v_antes.data_realizacao,
        'data_liberacao', v_antes.data_liberacao,
        'data_encerramento', v_antes.data_encerramento,
        'data_agendada_original', v_antes.data_agendada_original
      ),
      'depois', jsonb_build_object(
        'modalidade', v_depois.modalidade,
        'data_realizacao', v_depois.data_realizacao,
        'data_liberacao', v_depois.data_liberacao,
        'data_encerramento', v_depois.data_encerramento,
        'data_agendada_original', v_depois.data_agendada_original
      ),
      'reagendado', v_depois.data_agendada_original IS NOT NULL
                    AND v_data_efetiva_depois IS NOT NULL
                    AND v_depois.data_agendada_original <> v_data_efetiva_depois
    )
  );

  RETURN jsonb_build_object(
    'simulado_id', v_depois.id,
    'nome', v_depois.nome,
    'modalidade', v_depois.modalidade,
    'data_realizacao', v_depois.data_realizacao,
    'data_liberacao', v_depois.data_liberacao,
    'data_encerramento', v_depois.data_encerramento,
    'data_agendada_original', v_depois.data_agendada_original,
    'reagendado', v_depois.data_agendada_original IS NOT NULL
                  AND v_data_efetiva_depois IS NOT NULL
                  AND v_depois.data_agendada_original <> v_data_efetiva_depois
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_simulado_agenda(uuid,text,timestamptz,timestamptz,timestamptz,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_simulado_agenda(uuid,text,timestamptz,timestamptz,timestamptz,boolean) TO authenticated, service_role;
```

- [ ] **Step 4: Aplicar em produção e verificar**

Aplique via MCP do Supabase (`apply_migration`, name `admin_slots_e_agenda_write`) com **gvqv confirmado**, ou via `send_message` ao Lovable.

Verificação 1 — índice único criado:

```sql
select indexname from pg_indexes
where schemaname = 'public' and tablename = 'ies_simulado_previsto';
```

Expected: entre as linhas, `ies_simulado_previsto_contrato_ordem_uidx`.

Verificação 2 — funções com SECURITY DEFINER e search_path:

```sql
select p.proname, p.prosecdef, p.proconfig
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('admin_set_ies_simulados_previstos', 'admin_set_simulado_agenda')
order by p.proname;
```

Expected: 2 linhas, `prosecdef = true`, `proconfig = {search_path=public, pg_temp}`.

Verificação 3 — grants:

```sql
select has_function_privilege('anon','public.admin_set_ies_simulados_previstos(uuid,jsonb)','EXECUTE') as anon_slots,
       has_function_privilege('authenticated','public.admin_set_ies_simulados_previstos(uuid,jsonb)','EXECUTE') as auth_slots,
       has_function_privilege('anon','public.admin_set_simulado_agenda(uuid,text,timestamptz,timestamptz,timestamptz,boolean)','EXECUTE') as anon_agenda,
       has_function_privilege('authenticated','public.admin_set_simulado_agenda(uuid,text,timestamptz,timestamptz,timestamptz,boolean)','EXECUTE') as auth_agenda;
```

Expected: `anon_slots = false`, `auth_slots = true`, `anon_agenda = false`, `auth_agenda = true`.

Verificação 4 — o limite de slots dispara. Use um contrato real de teste (crie um com `simulados_contratados = 2` pela RPC da Task 9, com sessão de admin) e mande 3 slots:

```sql
select public.admin_set_ies_simulados_previstos(
  '<contrato_id_de_teste>'::uuid,
  '[{"ordem":1,"nome_previsto":"A","simulado_id":null},
    {"ordem":2,"nome_previsto":"B","simulado_id":null},
    {"ordem":3,"nome_previsto":"C","simulado_id":null}]'::jsonb
);
```

Expected: `ERROR: 3 slot(s) excedem os 2 simulado(s) contratado(s)`.

Verificação 5 — idempotência do sync. Mande 2 slots, rode a MESMA chamada duas vezes:

```sql
select public.admin_set_ies_simulados_previstos(
  '<contrato_id_de_teste>'::uuid,
  '[{"ordem":1,"nome_previsto":"A","simulado_id":null},
    {"ordem":2,"nome_previsto":"B","simulado_id":null}]'::jsonb
);
select count(*) from public.ies_simulado_previsto where contrato_id = '<contrato_id_de_teste>'::uuid;
```

Expected: 1ª chamada `{"criados": 2, "atualizados": 0, "removidos": 0, ...}`; 2ª chamada `{"criados": 0, "atualizados": 2, "removidos": 0, ...}`; `count = 2` (não 4).

Limpe o contrato de teste: `select public.admin_set_ies_simulados_previstos('<contrato_id_de_teste>'::uuid, '[]'::jsonb);` e depois `select public.admin_delete_ies_contrato('<contrato_id_de_teste>'::uuid);`

- [ ] **Step 5: Regenerar tipos e commitar**

Regenere `src/integrations/supabase/types.ts` via MCP (**gvqv confirmado**); se não for possível, mantenha o cast documentado (mesma nota da Task 9 Step 4).

Run: `npm run type-check`
Expected: exit 0.

```bash
git add supabase/migrations/20260726121000_admin_slots_e_agenda_write.sql src/integrations/supabase/types.ts
git commit -m "Fase 0b: sync de slots previstos e agenda do simulado (spec 6.2/6.4)"
```

---

### Task 11: RPC de leitura do contrato para o admin

**Files:**
- Create: `supabase/migrations/20260726122000_admin_get_ies_contratos.sql`

**Interfaces:**
- Consumes: `public.ies_contrato_simulados`, `public.ies_simulado_previsto`, `public.simulados_admin` (com as colunas novas da Fase 0a), `public.ies`, `public.has_role`.
- Produces: `public.admin_get_ies_contratos(uuid) → jsonb`. Consumida pela Task 12 (`fetchIesContratos`) e pela Task 13 (tela).

**Adição minha, declarada:** o enunciado pede "contrato + slots + o simulado vinculado de cada slot". Devolvo TAMBÉM `simulados_disponiveis` (os simulados da IES, para popular o `<select>` de vínculo da Task 13). Sem isso a tela precisaria de um segundo roundtrip com `.from('simulados_admin')` filtrado por `ies_ids` — mais código no front e mais uma superfície de RLS para conferir. Um payload, uma chamada.

**Não é STABLE.** As RPCs do gestor são `STABLE` por contrato; esta é `VOLATILE` (default) porque segue o padrão das leituras de admin já em prod (`admin_command_center`, `admin_get_audit_log` — nenhuma declara `STABLE`). Consistência com o repo ganha aqui.

- [ ] **Step 1: Reconfirmar o project ref**

`get_project_url` → `https://gvqvrmkizemwsasmupmo.supabase.co`. Se não for gvqv, PARE.

- [ ] **Step 2: Escrever o SQL**

Crie `supabase/migrations/20260726122000_admin_get_ies_contratos.sql`:

```sql
-- Fase 0b · Task 11 — leitura do contrato de simulados para a tela de admin (spec §6.3).
-- VOLATILE (default) por consistência com admin_command_center/admin_get_audit_log
-- (20260707172740), que também não declaram STABLE.
CREATE OR REPLACE FUNCTION public.admin_get_ies_contratos(
  p_ies_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_ies record;
  v_contratos jsonb;
  v_simulados jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  SELECT id, nome INTO v_ies FROM public.ies WHERE id = p_ies_id;
  IF v_ies.id IS NULL THEN
    RAISE EXCEPTION 'IES % não encontrada', p_ies_id;
  END IF;

  SELECT COALESCE(jsonb_agg(c ORDER BY c->>'nome_contrato'), '[]'::jsonb)
    INTO v_contratos
  FROM (
    SELECT jsonb_build_object(
             'id', ct.id,
             'nome_contrato', ct.nome_contrato,
             'simulados_contratados', ct.simulados_contratados,
             'vigencia_inicio', ct.vigencia_inicio,
             'vigencia_fim', ct.vigencia_fim,
             'created_at', ct.created_at,
             'slots', COALESCE((
               SELECT jsonb_agg(
                        jsonb_build_object(
                          'id', sp.id,
                          'ordem', sp.ordem,
                          'nome_previsto', sp.nome_previsto,
                          'simulado_id', sp.simulado_id,
                          'simulado', CASE WHEN sa.id IS NULL THEN NULL ELSE jsonb_build_object(
                            'id', sa.id,
                            'nome', sa.nome,
                            'status', sa.status,
                            'modalidade', sa.modalidade,
                            'data_realizacao', sa.data_realizacao,
                            'data_liberacao', sa.data_liberacao,
                            'data_encerramento', sa.data_encerramento,
                            'data_agendada_original', sa.data_agendada_original
                          ) END
                        ) ORDER BY sp.ordem
                      )
               FROM public.ies_simulado_previsto sp
               LEFT JOIN public.simulados_admin sa ON sa.id = sp.simulado_id
               WHERE sp.contrato_id = ct.id
             ), '[]'::jsonb)
           ) AS c
    FROM public.ies_contrato_simulados ct
    WHERE ct.ies_id = p_ies_id
  ) t;

  -- Simulados da IES, para o select de vínculo de slot na tela de admin.
  SELECT COALESCE(jsonb_agg(
           jsonb_build_object(
             'id', sa.id,
             'nome', sa.nome,
             'status', sa.status,
             'modalidade', sa.modalidade,
             'data_realizacao', sa.data_realizacao,
             'data_liberacao', sa.data_liberacao,
             'data_encerramento', sa.data_encerramento,
             'data_agendada_original', sa.data_agendada_original
           ) ORDER BY COALESCE(sa.data_realizacao, sa.data_liberacao, sa.created_at) DESC NULLS LAST
         ), '[]'::jsonb)
    INTO v_simulados
  FROM public.simulados_admin sa
  WHERE p_ies_id = ANY(sa.ies_ids);

  RETURN jsonb_build_object(
    'ies', jsonb_build_object('id', v_ies.id, 'nome', v_ies.nome),
    'contratos', v_contratos,
    'simulados_disponiveis', v_simulados
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_ies_contratos(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_ies_contratos(uuid) TO authenticated, service_role;
```

- [ ] **Step 3: Aplicar em produção e verificar**

Aplique via MCP (`apply_migration`, name `admin_get_ies_contratos`) com **gvqv confirmado**, ou via `send_message` ao Lovable.

Verificação 1 — função e grants:

```sql
select p.prosecdef, p.proconfig,
       has_function_privilege('anon','public.admin_get_ies_contratos(uuid)','EXECUTE') as anon_exec,
       has_function_privilege('authenticated','public.admin_get_ies_contratos(uuid)','EXECUTE') as auth_exec
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'admin_get_ies_contratos';
```

Expected: 1 linha — `prosecdef = true`, `proconfig = {search_path=public, pg_temp}`, `anon_exec = false`, `auth_exec = true`.

Verificação 2 — o shape do payload em uma IES sem contrato (com sessão de admin):

```sql
select jsonb_pretty(public.admin_get_ies_contratos((select id from public.ies order by nome limit 1)));
```

Expected: objeto com as 3 chaves `ies`, `contratos`, `simulados_disponiveis`. `contratos` é `[]` se a IES não tem contrato (nunca `null`). `simulados_disponiveis` traz os simulados cuja `ies_ids` contém essa IES (pode ser `[]`).

- [ ] **Step 4: Regenerar tipos**

Regenere `src/integrations/supabase/types.ts` via MCP (**gvqv confirmado**), ou mantenha o cast documentado.

Run: `npm run type-check`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260726122000_admin_get_ies_contratos.sql src/integrations/supabase/types.ts
git commit -m "Fase 0b: RPC admin_get_ies_contratos (contrato + slots + simulados da IES)"
```

---

### Task 12: Wrappers de serviço do contrato de simulados

**Files:**
- Create: `src/services/admin/contratoSimulados.ts`
- Test: `src/test/unit/contratoSimulados.test.ts`

**Interfaces:**
- Consumes: as 5 RPCs das Tasks 9–11 (`admin_upsert_ies_contrato`, `admin_delete_ies_contrato`, `admin_set_ies_simulados_previstos`, `admin_set_simulado_agenda`, `admin_get_ies_contratos`); `supabase` de `@/integrations/supabase/client`; `Logger` de `@/utils/logger`.
- Produces (consumido pela Task 13):
  ```ts
  export type Modalidade = 'online' | 'presencial';
  export interface SimuladoAgenda { id: string; nome: string; status?: string; modalidade: Modalidade | null; data_realizacao: string | null; data_liberacao: string | null; data_encerramento: string | null; data_agendada_original: string | null; }
  export interface SlotPrevisto { id: string; ordem: number; nome_previsto: string | null; simulado_id: string | null; simulado: SimuladoAgenda | null; }
  export interface IesContrato { id: string; nome_contrato: string; simulados_contratados: number; vigencia_inicio: string; vigencia_fim: string; created_at: string; slots: SlotPrevisto[]; }
  export interface IesContratosPayload { ies: { id: string; nome: string }; contratos: IesContrato[]; simulados_disponiveis: SimuladoAgenda[]; }
  export interface UpsertIesContratoInput { iesId: string; nome: string; simuladosContratados: number; vigenciaInicio: string; vigenciaFim: string; }
  export interface UpsertIesContratoResult { contrato_id: string; criado: boolean; }
  export interface DeleteIesContratoResult { contrato_id: string; slots_removidos: number; }
  export interface SlotPrevistoInput { ordem: number; nome_previsto: string | null; simulado_id: string | null; }
  export interface SetSlotsResult { contrato_id: string; slots: number; criados: number; atualizados: number; removidos: number; }
  export interface SetSimuladoAgendaInput { simuladoId: string; modalidade: Modalidade | null; dataRealizacao: string | null; dataLiberacao: string | null; dataEncerramento: string | null; definitiva?: boolean; }
  export async function fetchIesContratos(iesId: string): Promise<IesContratosPayload>;
  export async function upsertIesContrato(input: UpsertIesContratoInput): Promise<UpsertIesContratoResult>;
  export async function deleteIesContrato(contratoId: string): Promise<DeleteIesContratoResult>;
  export async function setIesSimuladosPrevistos(contratoId: string, slots: SlotPrevistoInput[]): Promise<SetSlotsResult>;
  export async function setSimuladoAgenda(input: SetSimuladoAgendaInput): Promise<SimuladoAgenda & { reagendado: boolean }>;
  ```

- [ ] **Step 1: Escrever o teste que falha**

Crie `src/test/unit/contratoSimulados.test.ts`. O `vi.mock` local do client **sobrescreve** o mock global de `src/test/setup.ts` (que não tem `rpc`) — mesmo truque de `src/test/unit/featureCatalog.test.ts:3-6`.

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));
vi.mock('@/utils/logger', () => ({
  Logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import {
  fetchIesContratos,
  upsertIesContrato,
  deleteIesContrato,
  setIesSimuladosPrevistos,
  setSimuladoAgenda,
} from '@/services/admin/contratoSimulados';

const ok = (data: unknown) => Promise.resolve({ data, error: null });
const fail = (message: string) => Promise.resolve({ data: null, error: { message } });

describe('services/admin/contratoSimulados', () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it('fetchIesContratos chama admin_get_ies_contratos com p_ies_id e devolve o payload', async () => {
    const payload = {
      ies: { id: 'ies-1', nome: 'Faculdade Alpha' },
      contratos: [],
      simulados_disponiveis: [],
    };
    mockRpc.mockReturnValue(ok(payload));

    await expect(fetchIesContratos('ies-1')).resolves.toEqual(payload);
    expect(mockRpc).toHaveBeenCalledWith('admin_get_ies_contratos', { p_ies_id: 'ies-1' });
  });

  it('upsertIesContrato chama admin_upsert_ies_contrato com os 5 parâmetros p_*', async () => {
    mockRpc.mockReturnValue(ok({ contrato_id: 'ct-1', criado: true }));

    const result = await upsertIesContrato({
      iesId: 'ies-1',
      nome: 'Contrato 2026',
      simuladosContratados: 7,
      vigenciaInicio: '2026-01-01',
      vigenciaFim: '2026-12-31',
    });

    expect(result).toEqual({ contrato_id: 'ct-1', criado: true });
    expect(mockRpc).toHaveBeenCalledWith('admin_upsert_ies_contrato', {
      p_ies_id: 'ies-1',
      p_nome: 'Contrato 2026',
      p_simulados_contratados: 7,
      p_vigencia_inicio: '2026-01-01',
      p_vigencia_fim: '2026-12-31',
    });
  });

  it('deleteIesContrato chama admin_delete_ies_contrato com p_contrato_id', async () => {
    mockRpc.mockReturnValue(ok({ contrato_id: 'ct-1', slots_removidos: 3 }));

    await expect(deleteIesContrato('ct-1')).resolves.toEqual({ contrato_id: 'ct-1', slots_removidos: 3 });
    expect(mockRpc).toHaveBeenCalledWith('admin_delete_ies_contrato', { p_contrato_id: 'ct-1' });
  });

  it('setIesSimuladosPrevistos envia os slots como array no p_slots, na ordem recebida', async () => {
    mockRpc.mockReturnValue(ok({ contrato_id: 'ct-1', slots: 2, criados: 2, atualizados: 0, removidos: 0 }));

    await setIesSimuladosPrevistos('ct-1', [
      { ordem: 1, nome_previsto: 'Simulado 1', simulado_id: 'sim-1' },
      { ordem: 2, nome_previsto: null, simulado_id: null },
    ]);

    expect(mockRpc).toHaveBeenCalledWith('admin_set_ies_simulados_previstos', {
      p_contrato_id: 'ct-1',
      p_slots: [
        { ordem: 1, nome_previsto: 'Simulado 1', simulado_id: 'sim-1' },
        { ordem: 2, nome_previsto: null, simulado_id: null },
      ],
    });
  });

  it('setSimuladoAgenda chama admin_set_simulado_agenda e default de p_definitiva é false', async () => {
    mockRpc.mockReturnValue(
      ok({
        simulado_id: 'sim-1',
        nome: 'Simulado 1',
        modalidade: 'presencial',
        data_realizacao: '2026-08-10T13:00:00.000Z',
        data_liberacao: null,
        data_encerramento: null,
        data_agendada_original: '2026-08-01T13:00:00.000Z',
        reagendado: true,
      }),
    );

    const result = await setSimuladoAgenda({
      simuladoId: 'sim-1',
      modalidade: 'presencial',
      dataRealizacao: '2026-08-10T13:00:00.000Z',
      dataLiberacao: null,
      dataEncerramento: null,
    });

    expect(result.reagendado).toBe(true);
    expect(result.id).toBe('sim-1');
    expect(mockRpc).toHaveBeenCalledWith('admin_set_simulado_agenda', {
      p_simulado_id: 'sim-1',
      p_modalidade: 'presencial',
      p_data_realizacao: '2026-08-10T13:00:00.000Z',
      p_data_liberacao: null,
      p_data_encerramento: null,
      p_definitiva: false,
    });
  });

  it('propaga p_definitiva=true quando a data nova é definitiva', async () => {
    mockRpc.mockReturnValue(ok({ simulado_id: 'sim-1', nome: 'Simulado 1', modalidade: 'online', data_realizacao: null, data_liberacao: '2026-09-01T12:00:00.000Z', data_encerramento: null, data_agendada_original: '2026-09-01T12:00:00.000Z', reagendado: false }));

    await setSimuladoAgenda({
      simuladoId: 'sim-1',
      modalidade: 'online',
      dataRealizacao: null,
      dataLiberacao: '2026-09-01T12:00:00.000Z',
      dataEncerramento: null,
      definitiva: true,
    });

    expect(mockRpc).toHaveBeenCalledWith(
      'admin_set_simulado_agenda',
      expect.objectContaining({ p_definitiva: true }),
    );
  });

  it('erro da RPC vira Error com a mensagem do banco', async () => {
    mockRpc.mockReturnValue(fail('3 slot(s) excedem os 2 simulado(s) contratado(s)'));

    await expect(setIesSimuladosPrevistos('ct-1', [])).rejects.toThrow(
      '3 slot(s) excedem os 2 simulado(s) contratado(s)',
    );
  });
});
```

- [ ] **Step 2: Rodar o teste para ver falhar**

Run: `npx vitest run src/test/unit/contratoSimulados.test.ts`

Expected: FAIL — todos os testes com erro de resolução do módulo: `Failed to resolve import "@/services/admin/contratoSimulados"` (ou `Cannot find module`), porque o arquivo ainda não existe.

- [ ] **Step 3: Escrever a implementação mínima**

Crie `src/services/admin/contratoSimulados.ts`:

```ts
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/utils/logger';

/**
 * Wrappers das 5 RPCs da superfície de admin do cronograma (spec §6.3):
 * `admin_get_ies_contratos`, `admin_upsert_ies_contrato`,
 * `admin_delete_ies_contrato`, `admin_set_ies_simulados_previstos` e
 * `admin_set_simulado_agenda`.
 *
 * Assim como `src/services/admin/simulados.ts`, estas RPCs podem ainda não
 * estar nos tipos gerados (`src/integrations/supabase/types.ts`) — daí o cast
 * `(supabase.rpc as CallableFunction)`, documentado e idêntico ao padrão já
 * usado em `logAction.ts` / `useAdminAttention.ts`. Quando os tipos forem
 * regenerados contra o projeto gvqv, trocar o cast pelo tipo gerado.
 */

export type Modalidade = 'online' | 'presencial';

/** Agenda de um simulado (§6.4): online usa data_liberacao; presencial, data_realizacao. */
export interface SimuladoAgenda {
  id: string;
  nome: string;
  status?: string;
  modalidade: Modalidade | null;
  data_realizacao: string | null;
  data_liberacao: string | null;
  data_encerramento: string | null;
  /** 1ª data marcada — é o que permite derivar "reagendado" (§6.4). */
  data_agendada_original: string | null;
}

/** Slot do contrato. `simulado_id` nulo = "A definir" (§6.2). */
export interface SlotPrevisto {
  id: string;
  ordem: number;
  nome_previsto: string | null;
  simulado_id: string | null;
  simulado: SimuladoAgenda | null;
}

export interface IesContrato {
  id: string;
  nome_contrato: string;
  simulados_contratados: number;
  vigencia_inicio: string;
  vigencia_fim: string;
  created_at: string;
  slots: SlotPrevisto[];
}

export interface IesContratosPayload {
  ies: { id: string; nome: string };
  contratos: IesContrato[];
  /** Simulados cuja `ies_ids` contém a IES — popula o select de vínculo de slot. */
  simulados_disponiveis: SimuladoAgenda[];
}

export interface UpsertIesContratoInput {
  iesId: string;
  nome: string;
  simuladosContratados: number;
  /** `yyyy-MM-dd` (tipo `date` no banco). */
  vigenciaInicio: string;
  /** `yyyy-MM-dd` (tipo `date` no banco). */
  vigenciaFim: string;
}

export interface UpsertIesContratoResult {
  contrato_id: string;
  criado: boolean;
}

export interface DeleteIesContratoResult {
  contrato_id: string;
  slots_removidos: number;
}

export interface SlotPrevistoInput {
  ordem: number;
  nome_previsto: string | null;
  simulado_id: string | null;
}

export interface SetSlotsResult {
  contrato_id: string;
  slots: number;
  criados: number;
  atualizados: number;
  removidos: number;
}

export interface SetSimuladoAgendaInput {
  simuladoId: string;
  modalidade: Modalidade | null;
  /** ISO 8601. */
  dataRealizacao: string | null;
  dataLiberacao: string | null;
  dataEncerramento: string | null;
  /**
   * `true` = a data nova é definitiva → a RPC sincroniza
   * `data_agendada_original` e a tag "Reagendado" some (§6.4). Default `false`.
   */
  definitiva?: boolean;
}

async function callRpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase.rpc as CallableFunction)(fn, args);
  if (error) {
    Logger.error(`[services/admin/contratoSimulados] ${fn} falhou:`, error);
    throw new Error(error.message ?? `Falha ao executar ${fn}.`);
  }
  return data as T;
}

/** Contrato(s), slots e simulados de uma IES — via `admin_get_ies_contratos`. */
export async function fetchIesContratos(iesId: string): Promise<IesContratosPayload> {
  return callRpc<IesContratosPayload>('admin_get_ies_contratos', { p_ies_id: iesId });
}

/** Cria ou atualiza o contrato (idempotente por `ies_id` + nome) — `admin_upsert_ies_contrato`. */
export async function upsertIesContrato(input: UpsertIesContratoInput): Promise<UpsertIesContratoResult> {
  return callRpc<UpsertIesContratoResult>('admin_upsert_ies_contrato', {
    p_ies_id: input.iesId,
    p_nome: input.nome,
    p_simulados_contratados: input.simuladosContratados,
    p_vigencia_inicio: input.vigenciaInicio,
    p_vigencia_fim: input.vigenciaFim,
  });
}

/** Apaga o contrato (a RPC recusa se algum slot está vinculado) — `admin_delete_ies_contrato`. */
export async function deleteIesContrato(contratoId: string): Promise<DeleteIesContratoResult> {
  return callRpc<DeleteIesContratoResult>('admin_delete_ies_contrato', { p_contrato_id: contratoId });
}

/**
 * Sincroniza a lista COMPLETA de slots do contrato — `admin_set_ies_simulados_previstos`.
 * É sync, não append: slot cuja `ordem` não está no array é removido no banco.
 */
export async function setIesSimuladosPrevistos(
  contratoId: string,
  slots: SlotPrevistoInput[],
): Promise<SetSlotsResult> {
  return callRpc<SetSlotsResult>('admin_set_ies_simulados_previstos', {
    p_contrato_id: contratoId,
    p_slots: slots,
  });
}

/** Modalidade + datas do simulado, com a derivação de "reagendado" — `admin_set_simulado_agenda`. */
export async function setSimuladoAgenda(
  input: SetSimuladoAgendaInput,
): Promise<SimuladoAgenda & { reagendado: boolean }> {
  const raw = await callRpc<Record<string, unknown>>('admin_set_simulado_agenda', {
    p_simulado_id: input.simuladoId,
    p_modalidade: input.modalidade,
    p_data_realizacao: input.dataRealizacao,
    p_data_liberacao: input.dataLiberacao,
    p_data_encerramento: input.dataEncerramento,
    p_definitiva: input.definitiva ?? false,
  });

  // A RPC devolve `simulado_id`; o tipo do front usa `id` (igual aos slots).
  return {
    id: raw.simulado_id as string,
    nome: raw.nome as string,
    modalidade: (raw.modalidade ?? null) as Modalidade | null,
    data_realizacao: (raw.data_realizacao ?? null) as string | null,
    data_liberacao: (raw.data_liberacao ?? null) as string | null,
    data_encerramento: (raw.data_encerramento ?? null) as string | null,
    data_agendada_original: (raw.data_agendada_original ?? null) as string | null,
    reagendado: Boolean(raw.reagendado),
  };
}
```

- [ ] **Step 4: Rodar o teste para ver passar**

Run: `npx vitest run src/test/unit/contratoSimulados.test.ts`
Expected: PASS — `Test Files 1 passed (1)`, `Tests 7 passed (7)`.

Depois:

Run: `npm run lint`
Expected: exit 0 (sem novos erros em `src/services/admin/contratoSimulados.ts`; o CI do Actions está morto, então o lint local é a única barreira).

Run: `npm run type-check`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/services/admin/contratoSimulados.ts src/test/unit/contratoSimulados.test.ts
git commit -m "Fase 0b: wrappers de servico do contrato de simulados (5 RPCs)"
```

---

### Task 13: Seção de admin "Contratos & cronograma"

**Files:**
- Create: `src/experiences/admin/pages/ContratosPage.tsx`
- Create: `src/components/admin/contratos/ContratoSimuladosBoard.tsx`
- Create: `src/components/admin/contratos/ContratoForm.tsx`
- Create: `src/components/admin/contratos/SlotsEditor.tsx`
- Modify: `src/experiences/admin/adminRoutes.tsx`
- Modify: `src/experiences/admin/AdminNav.ts`
- Modify: `src/test/unit/adminNav.test.ts`
- Modify: `src/test/unit/buildAppRoutes.test.ts`
- Test: `src/test/components/admin/ContratoSimuladosBoard.test.tsx`

**Interfaces:**
- Consumes: da Task 12 — `fetchIesContratos`, `upsertIesContrato`, `deleteIesContrato`, `setIesSimuladosPrevistos`, `setSimuladoAgenda` e os tipos `IesContratosPayload`, `IesContrato`, `SlotPrevisto`, `SlotPrevistoInput`, `SimuladoAgenda`, `Modalidade`. Do repo — `AdminSectionHeader`, `AdminLoading`, `AdminError`, `AdminEmpty`, `AdminTable`, `adminTableHeadClass`, `adminTableCellClass` de `@/experiences/admin/ui`; `Input`/`Button`/`Label`/`Card` de `@/components/ui/*`; `toast` de `sonner`; `Logger` de `@/utils/logger`; `supabase` para a lista de IES.
- Produces: rota `/admin/contratos` e o item de nav homônimo (capability `ies.manage`).

**Decisões de padrão, explícitas:**
- Registro em DOIS arquivos (`adminRoutes.tsx` + `AdminNav.ts`), como todas as outras 11 seções. Não há registro automático.
- Capability `ies.manage` — a mesma de `/admin/ies`. Nenhuma capability nova.
- Lista de IES por `supabase.from('ies').select('id, nome').order('nome')`, idêntico a `IesFeaturesBoard.tsx:36` e `ProvasTab.tsx:117`.
- **`<select>` nativo** em vez de `@/components/ui/select` (Radix), com as classes do trigger shadcn. Motivo: `IesFeaturesBoard.test.tsx:170-184` mostra o custo de testar Radix Select no jsdom (stub de `hasPointerCapture` + `scrollIntoView` + caça à opção portalizada). Com N selects por linha de tabela isso fica intratável.
- Salvamento explícito com botão + `toast.success`/`toast.error` e `Logger.error` no catch — mesmo fluxo de `IesFeaturesBoard.saveChanges` (linhas 112-159).

- [ ] **Step 1: Escrever o teste que falha** *(~4 min)*

Crie `src/test/components/admin/ContratoSimuladosBoard.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { render } from '../../utils';
import { ContratoSimuladosBoard } from '@/components/admin/contratos/ContratoSimuladosBoard';
import { supabase } from '@/integrations/supabase/client';
import {
  fetchIesContratos,
  upsertIesContrato,
  setIesSimuladosPrevistos,
} from '@/services/admin/contratoSimulados';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock('@/services/admin/contratoSimulados', () => ({
  fetchIesContratos: vi.fn(),
  upsertIesContrato: vi.fn().mockResolvedValue({ contrato_id: 'ct-1', criado: true }),
  deleteIesContrato: vi.fn().mockResolvedValue({ contrato_id: 'ct-1', slots_removidos: 0 }),
  setIesSimuladosPrevistos: vi.fn().mockResolvedValue({
    contrato_id: 'ct-1', slots: 2, criados: 0, atualizados: 2, removidos: 0,
  }),
  setSimuladoAgenda: vi.fn(),
}));

const IES_ROWS = [
  { id: 'ies-1', nome: 'Faculdade Alpha' },
  { id: 'ies-2', nome: 'Faculdade Beta' },
];

const SIMULADO_1 = {
  id: 'sim-1',
  nome: 'Simulado Diagnóstico',
  status: 'ativo',
  modalidade: 'presencial' as const,
  data_realizacao: '2026-08-10T13:00:00.000Z',
  data_liberacao: null,
  data_encerramento: null,
  data_agendada_original: '2026-08-01T13:00:00.000Z',
};

/** IES sem contrato nenhum. */
const PAYLOAD_VAZIO = {
  ies: { id: 'ies-1', nome: 'Faculdade Alpha' },
  contratos: [],
  simulados_disponiveis: [SIMULADO_1],
};

/** Contrato de 2 simulados com os 2 slots já criados (1 vinculado, 1 "A definir"). */
const PAYLOAD_COM_SLOTS = {
  ies: { id: 'ies-1', nome: 'Faculdade Alpha' },
  contratos: [
    {
      id: 'ct-1',
      nome_contrato: 'Contrato 2026',
      simulados_contratados: 2,
      vigencia_inicio: '2026-01-01',
      vigencia_fim: '2026-12-31',
      created_at: '2026-07-01T00:00:00.000Z',
      slots: [
        { id: 'sl-1', ordem: 1, nome_previsto: 'Simulado 1', simulado_id: 'sim-1', simulado: SIMULADO_1 },
        { id: 'sl-2', ordem: 2, nome_previsto: null, simulado_id: null, simulado: null },
      ],
    },
  ],
  simulados_disponiveis: [SIMULADO_1],
};

/** Contrato de 2 simulados com 3 slots no banco — estado inválido que a tela precisa denunciar. */
const PAYLOAD_ACIMA_DO_CONTRATADO = {
  ...PAYLOAD_COM_SLOTS,
  contratos: [
    {
      ...PAYLOAD_COM_SLOTS.contratos[0],
      slots: [
        ...PAYLOAD_COM_SLOTS.contratos[0].slots,
        { id: 'sl-3', ordem: 3, nome_previsto: 'Extra', simulado_id: null, simulado: null },
      ],
    },
  ],
};

function mockIesList() {
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    if (table === 'ies') {
      return {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: IES_ROWS, error: null }),
      } as any;
    }
    return {} as any;
  });
}

describe('ContratoSimuladosBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIesList();
  });

  it('carrega a lista de IES e seleciona a primeira, buscando o contrato dela', async () => {
    vi.mocked(fetchIesContratos).mockResolvedValue(PAYLOAD_VAZIO as any);
    render(<ContratoSimuladosBoard />);

    await waitFor(() => {
      expect(fetchIesContratos).toHaveBeenCalledWith('ies-1');
    });
    expect(screen.getByLabelText('IES')).toHaveValue('ies-1');
  });

  it('estado vazio: IES sem contrato mostra o aviso e o formulário de novo contrato', async () => {
    vi.mocked(fetchIesContratos).mockResolvedValue(PAYLOAD_VAZIO as any);
    render(<ContratoSimuladosBoard />);

    await waitFor(() => {
      expect(screen.getByText('Nenhum contrato cadastrado')).toBeInTheDocument();
    });
    // O cronograma do gestor nasce vazio sem isso — o texto tem que dizer.
    expect(screen.getByText(/cronograma do gestor fica vazio/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Criar contrato/i })).toBeInTheDocument();
  });

  it('criar contrato chama upsertIesContrato com os campos do formulário e recarrega', async () => {
    vi.mocked(fetchIesContratos).mockResolvedValue(PAYLOAD_VAZIO as any);
    render(<ContratoSimuladosBoard />);
    await waitFor(() => screen.getByRole('button', { name: /Criar contrato/i }));

    fireEvent.change(screen.getByLabelText('Nome do contrato'), { target: { value: 'Contrato 2026' } });
    fireEvent.change(screen.getByLabelText('Simulados contratados'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Vigência — início'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('Vigência — fim'), { target: { value: '2026-12-31' } });
    fireEvent.click(screen.getByRole('button', { name: /Criar contrato/i }));

    await waitFor(() => {
      expect(upsertIesContrato).toHaveBeenCalledWith({
        iesId: 'ies-1',
        nome: 'Contrato 2026',
        simuladosContratados: 7,
        vigenciaInicio: '2026-01-01',
        vigenciaFim: '2026-12-31',
      });
    });
    // Recarrega depois de salvar: 1ª chamada no mount + 1ª depois do upsert.
    await waitFor(() => expect(fetchIesContratos).toHaveBeenCalledTimes(2));
  });

  it('contrato com slots: renderiza uma linha por slot, com "A definir" no slot sem simulado', async () => {
    vi.mocked(fetchIesContratos).mockResolvedValue(PAYLOAD_COM_SLOTS as any);
    render(<ContratoSimuladosBoard />);

    await waitFor(() => expect(screen.getByText('Contrato 2026')).toBeInTheDocument());
    expect(screen.getByText('2 slot(s) de 2 contratado(s)')).toBeInTheDocument();
    expect(screen.getByLabelText('Simulado do slot 1')).toHaveValue('sim-1');
    expect(screen.getByLabelText('Simulado do slot 2')).toHaveValue('');
    expect(screen.getByText('A definir')).toBeInTheDocument();
  });

  it('contrato lotado: "Adicionar slot" fica desabilitado e explica o limite', async () => {
    vi.mocked(fetchIesContratos).mockResolvedValue(PAYLOAD_COM_SLOTS as any);
    render(<ContratoSimuladosBoard />);
    await waitFor(() => screen.getByText('Contrato 2026'));

    expect(screen.getByRole('button', { name: /Adicionar slot/i })).toBeDisabled();
    expect(screen.getByText(/Limite de 2 slot\(s\) do contrato atingido/i)).toBeInTheDocument();
  });

  it('slots acima do contratado: mostra o alerta e bloqueia o salvamento', async () => {
    vi.mocked(fetchIesContratos).mockResolvedValue(PAYLOAD_ACIMA_DO_CONTRATADO as any);
    render(<ContratoSimuladosBoard />);
    await waitFor(() => screen.getByText('Contrato 2026'));

    expect(screen.getByText(/3 slot\(s\) para 2 simulado\(s\) contratado\(s\)/i)).toBeInTheDocument();

    const salvar = screen.getByRole('button', { name: /Salvar slots/i });
    expect(salvar).toBeDisabled();
    fireEvent.click(salvar);
    expect(setIesSimuladosPrevistos).not.toHaveBeenCalled();
  });

  it('vincular um simulado a um slot e salvar envia o array completo de slots', async () => {
    vi.mocked(fetchIesContratos).mockResolvedValue(PAYLOAD_COM_SLOTS as any);
    render(<ContratoSimuladosBoard />);
    await waitFor(() => screen.getByText('Contrato 2026'));

    // Desvincula o slot 1 (volta para "A definir") — mudança suficiente para habilitar o salvar.
    fireEvent.change(screen.getByLabelText('Simulado do slot 1'), { target: { value: '' } });

    const salvar = screen.getByRole('button', { name: /Salvar slots/i });
    await waitFor(() => expect(salvar).not.toBeDisabled());
    fireEvent.click(salvar);

    await waitFor(() => {
      expect(setIesSimuladosPrevistos).toHaveBeenCalledWith('ct-1', [
        { ordem: 1, nome_previsto: 'Simulado 1', simulado_id: null },
        { ordem: 2, nome_previsto: null, simulado_id: null },
      ]);
    });
  });

  it('erro no carregamento mostra AdminError com a mensagem e permite tentar de novo', async () => {
    vi.mocked(fetchIesContratos).mockRejectedValueOnce(new Error('admin role required'));
    render(<ContratoSimuladosBoard />);

    await waitFor(() => expect(screen.getByText('admin role required')).toBeInTheDocument());

    vi.mocked(fetchIesContratos).mockResolvedValue(PAYLOAD_VAZIO as any);
    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/i }));
    await waitFor(() => expect(screen.getByText('Nenhum contrato cadastrado')).toBeInTheDocument());
  });
});
```

Nota: o rótulo do botão de retry no teste é `/Tentar novamente/i`. **Antes do Step 2, abra `src/experiences/admin/ui/AdminError.tsx` e confirme o texto real do botão** — se for diferente (ex.: "Recarregar"), ajuste o regex do teste para o texto do componente. Não mude o componente para caber no teste.

- [ ] **Step 2: Rodar o teste para ver falhar** *(~1 min)*

Run: `npx vitest run src/test/components/admin/ContratoSimuladosBoard.test.tsx`

Expected: FAIL — `Failed to resolve import "@/components/admin/contratos/ContratoSimuladosBoard"`. Os 8 testes falham no import, antes de qualquer assert.

- [ ] **Step 3: Escrever o `ContratoForm`** *(~4 min)*

Crie `src/components/admin/contratos/ContratoForm.tsx`:

```tsx
import * as React from 'react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { IesContrato, UpsertIesContratoInput } from '@/services/admin/contratoSimulados';

export interface ContratoFormProps {
  iesId: string;
  /** `undefined` = formulário de criação; preenchido = edição. */
  contrato?: IesContrato;
  saving: boolean;
  onSubmit: (input: UpsertIesContratoInput) => void;
  /** Só aparece em modo edição. */
  onDelete?: () => void;
}

/**
 * Formulário do contrato de simulados de uma IES (spec §6.2/§6.3): nome,
 * quantos simulados a IES tem direito e vigência. Em modo edição o "nome do
 * contrato" é a chave natural do upsert (`ies_id` + nome) — mudar o nome CRIA
 * outro contrato em vez de renomear, e o campo avisa isso.
 */
export const ContratoForm: React.FC<ContratoFormProps> = ({ iesId, contrato, saving, onSubmit, onDelete }) => {
  const [nome, setNome] = useState(contrato?.nome_contrato ?? '');
  const [contratados, setContratados] = useState(String(contrato?.simulados_contratados ?? ''));
  const [inicio, setInicio] = useState(contrato?.vigencia_inicio ?? '');
  const [fim, setFim] = useState(contrato?.vigencia_fim ?? '');

  // Troca de IES/contrato recarrega o formulário com os dados novos.
  useEffect(() => {
    setNome(contrato?.nome_contrato ?? '');
    setContratados(String(contrato?.simulados_contratados ?? ''));
    setInicio(contrato?.vigencia_inicio ?? '');
    setFim(contrato?.vigencia_fim ?? '');
  }, [contrato, iesId]);

  const qtd = Number.parseInt(contratados, 10);
  const erro =
    nome.trim().length === 0
      ? 'Informe o nome do contrato.'
      : !Number.isFinite(qtd) || qtd <= 0
        ? 'Simulados contratados deve ser maior que zero.'
        : inicio === '' || fim === ''
          ? 'Informe a vigência (início e fim).'
          : fim < inicio
            ? 'A vigência termina antes de começar.'
            : contrato && qtd < contrato.slots.length
              ? `O contrato já tem ${contrato.slots.length} slot(s); remova slots antes de reduzir para ${qtd}.`
              : null;

  return (
    <div className="space-y-4 rounded-xl border p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="contrato-nome">Nome do contrato</Label>
          <Input
            id="contrato-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Contrato 2026"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contrato-qtd">Simulados contratados</Label>
          <Input
            id="contrato-qtd"
            type="number"
            min={1}
            value={contratados}
            onChange={(e) => setContratados(e.target.value)}
            placeholder="7"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contrato-inicio">Vigência — início</Label>
          <Input id="contrato-inicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contrato-fim">Vigência — fim</Label>
          <Input id="contrato-fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
        </div>
      </div>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={saving || erro !== null}
          onClick={() =>
            onSubmit({
              iesId,
              nome: nome.trim(),
              simuladosContratados: qtd,
              vigenciaInicio: inicio,
              vigenciaFim: fim,
            })
          }
        >
          {contrato ? 'Salvar contrato' : 'Criar contrato'}
        </Button>
        {contrato && onDelete && (
          <Button variant="outline" disabled={saving} onClick={onDelete}>
            Excluir contrato
          </Button>
        )}
        {contrato && (
          <span className="text-xs text-muted-foreground">
            O nome é a chave do contrato — alterá-lo cria um contrato novo em vez de renomear.
          </span>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Escrever o `SlotsEditor`** *(~5 min)*

Crie `src/components/admin/contratos/SlotsEditor.tsx`:

```tsx
import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AdminTable, adminTableCellClass, adminTableHeadClass } from '@/experiences/admin/ui';
import type {
  IesContrato,
  Modalidade,
  SimuladoAgenda,
  SlotPrevistoInput,
} from '@/services/admin/contratoSimulados';

/**
 * `<select>` NATIVO com as classes do trigger shadcn. Divergência deliberada
 * do Radix Select usado no resto do admin: testar Radix no jsdom exige stub de
 * `hasPointerCapture`/`scrollIntoView` e caçar a opção portalizada no body
 * (ver `src/test/components/admin/IesFeaturesBoard.test.tsx:170-184`) — com
 * vários selects por linha de tabela isso fica intratável.
 */
const selectClass =
  'h-9 w-full rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

export interface SlotsEditorProps {
  contrato: IesContrato;
  simuladosDisponiveis: SimuladoAgenda[];
  saving: boolean;
  onSalvarSlots: (slots: SlotPrevistoInput[]) => void;
  onSalvarAgenda: (simuladoId: string, modalidade: Modalidade | null, dataRealizacao: string | null, dataLiberacao: string | null, definitiva: boolean) => void;
}

interface SlotDraft extends SlotPrevistoInput {
  simulado: SimuladoAgenda | null;
}

const toDraft = (contrato: IesContrato): SlotDraft[] =>
  contrato.slots.map((s) => ({
    ordem: s.ordem,
    nome_previsto: s.nome_previsto,
    simulado_id: s.simulado_id,
    simulado: s.simulado,
  }));

/** ISO → valor de `<input type="datetime-local">` (`yyyy-MM-ddTHH:mm`), em hora local. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Editor dos slots de um contrato (spec §6.2): cada linha é um slot; slot sem
 * `simulado_id` é "A definir" e existe só para o gestor ver quantos simulados
 * a IES tem direito. Salva o array COMPLETO via `admin_set_ies_simulados_previstos`
 * (é sync, não append).
 */
export const SlotsEditor: React.FC<SlotsEditorProps> = ({
  contrato,
  simuladosDisponiveis,
  saving,
  onSalvarSlots,
  onSalvarAgenda,
}) => {
  const [slots, setSlots] = useState<SlotDraft[]>(() => toDraft(contrato));

  useEffect(() => {
    setSlots(toDraft(contrato));
  }, [contrato]);

  const limite = contrato.simulados_contratados;
  const acimaDoContratado = slots.length > limite;
  const lotado = slots.length >= limite;

  const sujo = useMemo(
    () => JSON.stringify(slots.map(({ simulado, ...s }) => s)) !== JSON.stringify(toDraft(contrato).map(({ simulado, ...s }) => s)),
    [slots, contrato],
  );

  const vincular = (ordem: number, simuladoId: string) =>
    setSlots((prev) =>
      prev.map((s) =>
        s.ordem === ordem
          ? {
              ...s,
              simulado_id: simuladoId === '' ? null : simuladoId,
              simulado: simuladosDisponiveis.find((sim) => sim.id === simuladoId) ?? null,
            }
          : s,
      ),
    );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          {slots.length} slot(s) de {limite} contratado(s)
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={lotado || saving}
            onClick={() =>
              setSlots((prev) => [
                ...prev,
                {
                  ordem: prev.reduce((max, s) => Math.max(max, s.ordem), 0) + 1,
                  nome_previsto: null,
                  simulado_id: null,
                  simulado: null,
                },
              ])
            }
          >
            Adicionar slot
          </Button>
          <Button
            size="sm"
            disabled={saving || acimaDoContratado || !sujo}
            onClick={() => onSalvarSlots(slots.map(({ simulado, ...s }) => s))}
          >
            Salvar slots
          </Button>
        </div>
      </div>

      {acimaDoContratado && (
        <p className="text-sm text-destructive">
          {slots.length} slot(s) para {limite} simulado(s) contratado(s) — remova slots ou aumente o contrato antes de salvar.
        </p>
      )}
      {!acimaDoContratado && lotado && (
        <p className="text-xs text-muted-foreground">
          Limite de {limite} slot(s) do contrato atingido. Aumente “Simulados contratados” para criar mais.
        </p>
      )}

      <AdminTable>
        <TableHeader>
          <TableRow>
            <TableHead className={adminTableHeadClass}>#</TableHead>
            <TableHead className={adminTableHeadClass}>Nome previsto</TableHead>
            <TableHead className={adminTableHeadClass}>Simulado vinculado</TableHead>
            <TableHead className={adminTableHeadClass}>Modalidade e datas</TableHead>
            <TableHead className={adminTableHeadClass} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {slots.map((slot) => (
            <TableRow key={slot.ordem}>
              <TableCell className={`${adminTableCellClass} font-mono`}>{slot.ordem}</TableCell>
              <TableCell className={adminTableCellClass}>
                <Input
                  aria-label={`Nome previsto do slot ${slot.ordem}`}
                  value={slot.nome_previsto ?? ''}
                  placeholder="Simulado 1"
                  onChange={(e) =>
                    setSlots((prev) =>
                      prev.map((s) =>
                        s.ordem === slot.ordem
                          ? { ...s, nome_previsto: e.target.value === '' ? null : e.target.value }
                          : s,
                      ),
                    )
                  }
                />
              </TableCell>
              <TableCell className={adminTableCellClass}>
                <select
                  aria-label={`Simulado do slot ${slot.ordem}`}
                  className={selectClass}
                  value={slot.simulado_id ?? ''}
                  onChange={(e) => vincular(slot.ordem, e.target.value)}
                >
                  <option value="">A definir</option>
                  {simuladosDisponiveis.map((sim) => (
                    <option key={sim.id} value={sim.id}>
                      {sim.nome}
                    </option>
                  ))}
                </select>
              </TableCell>
              <TableCell className={adminTableCellClass}>
                {slot.simulado_id == null ? (
                  <span className="text-xs text-muted-foreground">
                    Vincule um simulado para definir modalidade e datas.
                  </span>
                ) : (
                  <AgendaFields
                    simulado={slot.simulado}
                    simuladoId={slot.simulado_id}
                    saving={saving}
                    onSalvar={onSalvarAgenda}
                  />
                )}
              </TableCell>
              <TableCell className={adminTableCellClass}>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={saving}
                  onClick={() => setSlots((prev) => prev.filter((s) => s.ordem !== slot.ordem))}
                >
                  Remover
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </AdminTable>
    </div>
  );
};

interface AgendaFieldsProps {
  simulado: SimuladoAgenda | null;
  simuladoId: string;
  saving: boolean;
  onSalvar: SlotsEditorProps['onSalvarAgenda'];
}

/**
 * Modalidade + datas do simulado do slot (spec §6.4): ONLINE tem data de
 * início (quando aparece pro aluno); PRESENCIAL tem só data de realização.
 * "Data definitiva" sincroniza `data_agendada_original` e faz a tag
 * "Reagendado" sumir — sem marcar, remarcar mantém a tag.
 */
const AgendaFields: React.FC<AgendaFieldsProps> = ({ simulado, simuladoId, saving, onSalvar }) => {
  const [modalidade, setModalidade] = useState<Modalidade | ''>(simulado?.modalidade ?? '');
  const [data, setData] = useState(
    toLocalInput(simulado?.data_realizacao ?? simulado?.data_liberacao ?? null),
  );
  const [definitiva, setDefinitiva] = useState(false);

  useEffect(() => {
    setModalidade(simulado?.modalidade ?? '');
    setData(toLocalInput(simulado?.data_realizacao ?? simulado?.data_liberacao ?? null));
    setDefinitiva(false);
  }, [simulado]);

  const iso = data === '' ? null : new Date(data).toISOString();
  const invalido = modalidade === '' || iso === null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label={`Modalidade do simulado ${simulado?.nome ?? simuladoId}`}
          className={`${selectClass} max-w-[9rem]`}
          value={modalidade}
          onChange={(e) => setModalidade(e.target.value as Modalidade | '')}
        >
          <option value="">Sem modalidade</option>
          <option value="online">Online</option>
          <option value="presencial">Presencial</option>
        </select>
        <Input
          aria-label={
            modalidade === 'online'
              ? `Data de início do simulado ${simulado?.nome ?? simuladoId}`
              : `Data de realização do simulado ${simulado?.nome ?? simuladoId}`
          }
          type="datetime-local"
          className="max-w-[13rem]"
          value={data}
          onChange={(e) => setData(e.target.value)}
        />
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={definitiva}
          onChange={(e) => setDefinitiva(e.target.checked)}
          aria-label={`Data definitiva do simulado ${simulado?.nome ?? simuladoId}`}
        />
        Data definitiva (remove a tag “Reagendado”)
      </label>
      <Button
        variant="outline"
        size="sm"
        disabled={saving || invalido}
        onClick={() =>
          onSalvar(
            simuladoId,
            modalidade === '' ? null : modalidade,
            modalidade === 'presencial' ? iso : null,
            modalidade === 'online' ? iso : null,
            definitiva,
          )
        }
      >
        Salvar agenda
      </Button>
    </div>
  );
};
```

- [ ] **Step 5: Escrever o `ContratoSimuladosBoard`** *(~5 min)*

Crie `src/components/admin/contratos/ContratoSimuladosBoard.tsx`:

```tsx
import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/utils/logger';
import { Label } from '@/components/ui/label';
import { AdminEmpty, AdminError, AdminLoading } from '@/experiences/admin/ui';
import {
  deleteIesContrato,
  fetchIesContratos,
  setIesSimuladosPrevistos,
  setSimuladoAgenda,
  upsertIesContrato,
  type IesContratosPayload,
  type Modalidade,
  type SlotPrevistoInput,
  type UpsertIesContratoInput,
} from '@/services/admin/contratoSimulados';
import { ContratoForm } from '@/components/admin/contratos/ContratoForm';
import { SlotsEditor } from '@/components/admin/contratos/SlotsEditor';

const selectClass =
  'h-9 w-full rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

/**
 * Orquestrador de `/admin/contratos` (spec §6.3): seletor de IES, formulário do
 * contrato e editor de slots. É a superfície que o CX/cadastros usa para popular
 * o cronograma — sem ela o Início do gestor nasce sem âncora.
 *
 * Toda escrita vai por RPC de admin (Tasks 9 e 10), nunca `.from().update()`:
 * a derivação de `data_agendada_original` (§6.4) é regra de negócio e precisa
 * de auditoria em `admin_audit_log`.
 */
export const ContratoSimuladosBoard: React.FC = () => {
  const [iesList, setIesList] = useState<{ id: string; nome: string }[]>([]);
  const [iesId, setIesId] = useState<string | null>(null);
  const [payload, setPayload] = useState<IesContratosPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Lista de IES — mesmo acesso direto usado em IesFeaturesBoard e ProvasTab.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const { data, error: iesError } = await supabase.from('ies').select('id, nome').order('nome');
      if (cancelado) return;
      if (iesError) {
        Logger.error('[ContratoSimuladosBoard] falha ao listar IES:', iesError);
        setError(iesError.message);
        setLoading(false);
        return;
      }
      const rows = data ?? [];
      setIesList(rows);
      setIesId(rows[0]?.id ?? null);
      if (rows.length === 0) setLoading(false);
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const load = useCallback(async () => {
    if (!iesId) return;
    setLoading(true);
    setError(null);
    try {
      setPayload(await fetchIesContratos(iesId));
    } catch (err) {
      Logger.error('[ContratoSimuladosBoard] falha ao carregar contratos:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar contratos da IES');
    } finally {
      setLoading(false);
    }
  }, [iesId]);

  useEffect(() => {
    load();
  }, [load]);

  const runSave = async (label: string, fn: () => Promise<unknown>) => {
    setSaving(true);
    try {
      await fn();
      toast.success(`${label} salvo com sucesso.`);
      await load();
    } catch (err) {
      Logger.error(`[ContratoSimuladosBoard] ${label} falhou:`, err);
      toast.error(err instanceof Error ? err.message : `Erro ao salvar ${label.toLowerCase()}.`);
    } finally {
      setSaving(false);
    }
  };

  const handleUpsert = (input: UpsertIesContratoInput) =>
    runSave('Contrato', () => upsertIesContrato(input));

  const handleDelete = (contratoId: string) =>
    runSave('Exclusão do contrato', () => deleteIesContrato(contratoId));

  const handleSlots = (contratoId: string, slots: SlotPrevistoInput[]) =>
    runSave('Slots', () => setIesSimuladosPrevistos(contratoId, slots));

  const handleAgenda = (
    simuladoId: string,
    modalidade: Modalidade | null,
    dataRealizacao: string | null,
    dataLiberacao: string | null,
    definitiva: boolean,
  ) =>
    runSave('Agenda do simulado', () =>
      setSimuladoAgenda({
        simuladoId,
        modalidade,
        dataRealizacao,
        dataLiberacao,
        dataEncerramento: null,
        definitiva,
      }),
    );

  const seletorIes = (
    <div className="max-w-sm space-y-1.5">
      <Label htmlFor="contratos-ies">IES</Label>
      <select
        id="contratos-ies"
        className={selectClass}
        value={iesId ?? ''}
        disabled={saving}
        onChange={(e) => setIesId(e.target.value)}
      >
        {iesList.map((ies) => (
          <option key={ies.id} value={ies.id}>
            {ies.nome}
          </option>
        ))}
      </select>
    </div>
  );

  if (!loading && iesList.length === 0 && !error) {
    return <AdminEmpty title="Nenhuma IES cadastrada" description="Cadastre uma IES antes de criar contratos." />;
  }

  return (
    <div className="space-y-6">
      {seletorIes}

      {loading && <AdminLoading rows={2} rowHeight="h-40" />}
      {!loading && error && <AdminError message={error} onRetry={load} />}

      {!loading && !error && payload && payload.contratos.length === 0 && (
        <div className="space-y-4">
          <AdminEmpty
            title="Nenhum contrato cadastrado"
            description="Sem contrato o cronograma do gestor fica vazio: não há quantos simulados a IES tem direito, nem datas. Crie o contrato abaixo."
          />
          {iesId && <ContratoForm iesId={iesId} saving={saving} onSubmit={handleUpsert} />}
        </div>
      )}

      {!loading && !error && payload &&
        payload.contratos.map((contrato) => (
          <div key={contrato.id} className="space-y-4 rounded-xl border p-4">
            <h2 className="text-lg font-semibold">{contrato.nome_contrato}</h2>
            <ContratoForm
              iesId={payload.ies.id}
              contrato={contrato}
              saving={saving}
              onSubmit={handleUpsert}
              onDelete={() => handleDelete(contrato.id)}
            />
            <SlotsEditor
              contrato={contrato}
              simuladosDisponiveis={payload.simulados_disponiveis}
              saving={saving}
              onSalvarSlots={(slots) => handleSlots(contrato.id, slots)}
              onSalvarAgenda={handleAgenda}
            />
          </div>
        ))}

      {!loading && !error && payload && payload.contratos.length > 0 && iesId && (
        <details className="rounded-xl border p-4">
          <summary className="cursor-pointer text-sm font-medium">Adicionar outro contrato</summary>
          <div className="pt-4">
            <ContratoForm iesId={iesId} saving={saving} onSubmit={handleUpsert} />
          </div>
        </details>
      )}
    </div>
  );
};
```

- [ ] **Step 6: Registrar a seção (página + rota + nav) e atualizar os dois testes que travam a contagem** *(~4 min)*

Crie `src/experiences/admin/pages/ContratosPage.tsx`:

```tsx
import * as React from 'react';
import { AdminSectionHeader } from '@/experiences/admin/ui';
import { ContratoSimuladosBoard } from '@/components/admin/contratos/ContratoSimuladosBoard';

/**
 * Seção "Contratos & cronograma" do Portal do Admin (`/admin/contratos`) —
 * spec §6.3. É onde o CX/cadastros declara quantos simulados a IES tem
 * direito, cria os slots, vincula cada slot a um simulado e marca modalidade
 * e datas. Sem isso o cronograma do gestor nasce vazio.
 */
const ContratosPage: React.FC = () => (
  <div className="space-y-6">
    <AdminSectionHeader
      title="Contratos & cronograma"
      subtitle="Quantos simulados cada IES tem direito, quais slots já têm simulado vinculado e as datas de cada um. Alimenta o cronograma do Portal do Gestor."
    />
    <ContratoSimuladosBoard />
  </div>
);

export default ContratosPage;
```

Em `src/experiences/admin/adminRoutes.tsx`, adicione o lazy import depois da linha do `IesPage`:

```tsx
const ContratosPage = lazy(() => import('@/experiences/admin/pages/ContratosPage'));
```

e a rota-filha imediatamente depois de `{ path: 'ies', ... }`:

```tsx
      { path: 'contratos', element: <ContratosPage /> },
```

Em `src/experiences/admin/AdminNav.ts`, adicione `FileSignature` ao import de `lucide-react` e o item ao grupo **"Contas & acesso"**, depois do item IES:

```ts
      {
        title: 'Contratos & cronograma',
        url: '/admin/contratos',
        icon: FileSignature,
        capability: 'ies.manage',
      },
```

Atualize também o JSDoc do `ADMIN_NAV_GROUPS` (linha 40): "4 grupos, 12 itens" e "Contas & acesso: Usuários, IES, Contratos & cronograma".

Agora os **dois testes que travam a contagem** (se você não mexer neles, `npm run test:run` quebra):

Em `src/test/unit/adminNav.test.ts`:
- título do 1º teste: `'expõe os 4 grupos e as 12 seções do Portal do Admin nas URLs /admin/*'`; adicione `'/admin/contratos'` na lista esperada, logo depois de `'/admin/ies'`.
- título do 3º teste: `'as demais 11 seções declaram capability'`; troque `expect(items).toHaveLength(10)` por `expect(items).toHaveLength(11)`.
- título do 4º teste: `'admin vê todas as 12 seções (tem todas as capabilities)'`; troque `toHaveLength(11)` por `toHaveLength(12)`.

Em `src/test/unit/buildAppRoutes.test.ts` (bloco `experiences/buildAppRoutes — admin`, linha ~316):
- título: `'expõe a rota-layout /admin com as 12 seções como filhas (index = Command Center)'`.
- adicione `'contratos'` ao array `childPaths` esperado, logo depois de `'ies'`.

- [ ] **Step 7: Rodar os testes para ver passar** *(~2 min)*

Run: `npx vitest run src/test/components/admin/ContratoSimuladosBoard.test.tsx`
Expected: PASS — `Test Files 1 passed (1)`, `Tests 8 passed (8)`.

Run: `npx vitest run src/test/unit/adminNav.test.ts src/test/unit/buildAppRoutes.test.ts`
Expected: PASS nos dois arquivos. Se algum falhar com contagem (`expected 12 to be 11`), você editou o teste mas esqueceu o `AdminNav.ts`/`adminRoutes.tsx` (ou vice-versa) — corrija o código, não o número.

- [ ] **Step 8: Verificação completa antes de commitar** *(~3 min)*

Run: `npm run lint`
Expected: exit 0. Atenção: o CI do GitHub Actions está morto neste repo (o lint falha sempre lá), então **este é o único lint que conta**. Nenhum erro novo nos 4 arquivos criados.

Run: `npm run type-check`
Expected: exit 0.

Run: `npm run test:run`
Expected: exit 0, nenhuma suíte falhando. Confirme no sumário que o total de testes SUBIU (8 novos do board + 7 da Task 12) e que nada mais quebrou — especialmente `adminNav`, `buildAppRoutes`, `route-gates` e `experiences`.

Run: `npm run build`
Expected: exit 0 (`vite build` conclui). Isso importa porque prod sobe por push na main via Vercel — build quebrado = deploy quebrado.

- [ ] **Step 9: Commit** *(~1 min)*

```bash
git add src/components/admin/contratos/ContratoSimuladosBoard.tsx \
        src/components/admin/contratos/ContratoForm.tsx \
        src/components/admin/contratos/SlotsEditor.tsx \
        src/experiences/admin/pages/ContratosPage.tsx \
        src/experiences/admin/adminRoutes.tsx \
        src/experiences/admin/AdminNav.ts \
        src/test/components/admin/ContratoSimuladosBoard.test.tsx \
        src/test/unit/adminNav.test.ts \
        src/test/unit/buildAppRoutes.test.ts
git commit -m "Fase 0b: secao de admin Contratos & cronograma (/admin/contratos, spec 6.3)"
```

**Saída da Fase 0b (o que desbloqueia a Fase 1):** com as 5 RPCs em prod no gvqv e `/admin/contratos` no ar, o CX consegue criar o contrato da IES-piloto, criar os slots, vincular os simulados existentes e marcar modalidade/datas — de modo que `get_gestor_cronograma(p_ies_id)` (Fase 1) tenha o que devolver e o KPI "3 de 7" do `get_gestor_visao_geral` tenha denominador. **Antes de começar a Fase 1, popule a IES-piloto por esta tela e confirme que `select public.admin_get_ies_contratos('<ies_piloto>')` devolve contrato com slots.**

---

## Fase 1 — Backend: RPCs `get_gestor_*`

**Pré-condições desta fase (entregues na Fase 0):** tabelas `public.ies_contrato_simulados` e `public.ies_simulado_previsto` criadas; colunas `simulados_admin.modalidade`, `simulados_admin.data_realizacao`, `simulados_admin.data_agendada_original` e `announcements.publico_alvo` criadas; chave `gestao.portal_v2` inserida em `feature_catalog` (experience `gestao`, sob o master `gestao.enabled`) e ligada para a IES de teste via `admin_set_ies_features`.

**Bloco de impersonação usado em todas as verificações desta fase** (o MCP/SQL editor roda como `postgres`, então `auth.uid()` é nulo e todo guard falharia; a impersonação é a única forma de exercitar a RPC como gestor real):

```sql
-- Descobrir um gestor de teste e sua IES (rodar como postgres):
SELECT u.id AS gestor_id, u.id_ies, i.nome
FROM public.users u
JOIN public.user_roles ur ON ur.user_id = u.id AND ur.role = 'gestor'
JOIN public.ies i ON i.id = u.id_ies
LIMIT 5;

-- Conferir que a feature está ligada para essa IES:
SELECT feature_key, enabled FROM public.ies_features
WHERE ies_id = '<IES_ID>' AND feature_key IN ('gestao.enabled','gestao.portal_v2');
-- Esperado: as duas linhas com enabled = true.
```

Ao longo da fase, `<GESTOR_ID>` = `users.id` do gestor de teste, `<IES_ID>` = `users.id_ies` dele, `<IES_OUTRA>` = id de qualquer outra IES, `<GESTOR_OUTRA_IES>` = gestor de `<IES_OUTRA>`.

---

### Task 14: RPC `get_gestor_contexto`

**Files:**
- Create: `supabase/migrations/20260726100000_get_gestor_contexto.sql`
- Modify: nenhum
- Test: n/a (não existe framework de teste SQL no projeto; a verificação é a query do Step 3)

**Interfaces:**
- Consumes: `public.user_has_feature(text)`, `public.has_role(uuid, app_role)`, `public.get_accessible_ies(uuid)`, `public.user_can_access_ies(uuid, uuid)`, tabelas `users`, `ies`, `ies_contrato_simulados`
- Produces: `public.get_gestor_contexto()` → `jsonb` na forma exata:
```json
{
  "data": {
    "usuario": { "id": "uuid", "nome": "text", "papel": "admin|gestor_grupo|gestor" },
    "iesDisponiveis": [ { "id": "uuid", "nome": "text" } ],
    "iesAtual": { "id": "uuid", "nome": "text" },
    "contrato": { "nome": "text", "simuladosContratados": 7, "vigencia": "01/02/2026 — 31/12/2026" },
    "podeTrocarIes": true,
    "podeExportar": true
  },
  "meta": { "periodo": "text", "fonte": "text", "atualizadoEm": "ISO-8601", "criterio": "text", "partial": false, "lowSample": false }
}
```
`contrato` é `null` quando a IES não tem linha em `ies_contrato_simulados`. Espelha `ContextoGestor` de `src/features/gestor/api/types.ts`.

- [ ] **Step 1: Escrever o SQL completo**

```sql
-- 20260726100000_get_gestor_contexto.sql
CREATE OR REPLACE FUNCTION public.get_gestor_contexto()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid       uuid := auth.uid();
  v_papel     text;
  v_ies_list  uuid[];
  v_ies_atual uuid;
  v_result    jsonb;
BEGIN
  IF NOT public.user_has_feature('gestao.portal_v2') THEN
    RAISE EXCEPTION 'feature_not_enabled' USING ERRCODE = '42501';
  END IF;

  IF NOT (
       has_role(v_uid,'admin'::app_role)
    OR has_role(v_uid,'gestor'::app_role)
    OR has_role(v_uid,'gestor_grupo'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF has_role(v_uid,'admin'::app_role) THEN
    v_papel := 'admin';
  ELSIF has_role(v_uid,'gestor_grupo'::app_role) THEN
    v_papel := 'gestor_grupo';
  ELSE
    v_papel := 'gestor';
  END IF;

  IF v_papel = 'admin' THEN
    SELECT COALESCE(array_agg(i.id ORDER BY i.nome), ARRAY[]::uuid[])
      INTO v_ies_list
    FROM public.ies i;
  ELSE
    v_ies_list := COALESCE(public.get_accessible_ies(v_uid), ARRAY[]::uuid[]);
  END IF;

  SELECT u.id_ies INTO v_ies_atual FROM public.users u WHERE u.id = v_uid;
  IF v_ies_atual IS NULL THEN
    v_ies_atual := v_ies_list[1];
  END IF;
  IF v_ies_atual IS NULL THEN
    RAISE EXCEPTION 'IES not resolved';
  END IF;

  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'usuario', jsonb_build_object(
        'id',    v_uid,
        'nome',  COALESCE((SELECT u.nome FROM public.users u WHERE u.id = v_uid), 'Usuário'),
        'papel', v_papel
      ),
      'iesDisponiveis', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', i.id, 'nome', i.nome) ORDER BY i.nome)
        FROM public.ies i
        WHERE i.id = ANY (v_ies_list)
      ), '[]'::jsonb),
      'iesAtual', (
        SELECT jsonb_build_object('id', i.id, 'nome', i.nome)
        FROM public.ies i WHERE i.id = v_ies_atual
      ),
      'contrato', (
        SELECT jsonb_build_object(
                 'nome',                 c.nome_contrato,
                 'simuladosContratados', c.simulados_contratados,
                 'vigencia',             to_char(c.vigencia_inicio,'DD/MM/YYYY') || ' — ' || to_char(c.vigencia_fim,'DD/MM/YYYY')
               )
        FROM public.ies_contrato_simulados c
        WHERE c.ies_id = v_ies_atual
        ORDER BY (current_date BETWEEN c.vigencia_inicio AND c.vigencia_fim) DESC,
                 c.vigencia_fim DESC
        LIMIT 1
      ),
      'podeTrocarIes', (v_papel IN ('admin','gestor_grupo')),
      'podeExportar',  true
    ),
    'meta', jsonb_build_object(
      'periodo',     COALESCE((
                       SELECT to_char(c.vigencia_inicio,'DD/MM/YYYY') || ' — ' || to_char(c.vigencia_fim,'DD/MM/YYYY')
                       FROM public.ies_contrato_simulados c
                       WHERE c.ies_id = v_ies_atual
                       ORDER BY (current_date BETWEEN c.vigencia_inicio AND c.vigencia_fim) DESC, c.vigencia_fim DESC
                       LIMIT 1
                     ), 'sem contrato cadastrado'),
      'fonte',       'users · user_roles · ies · educational_groups · ies_contrato_simulados',
      'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'criterio',    'Papel derivado de user_roles (admin > gestor_grupo > gestor). IES acessíveis: todas para admin, get_accessible_ies para gestor_grupo, users.id_ies para gestor. Contrato: o vigente na data de hoje; se não houver vigente, o de vigência mais recente. podeExportar é true para os três papéis do portal.',
      'partial',     false,
      'lowSample',   false
    )
  ) INTO v_result;

  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_gestor_contexto() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_contexto() TO authenticated;
```

- [ ] **Step 2: Aplicar em produção (project ref gvqv CONFIRMADO)**

Run: `mcp__supabase__get_project_url`
Expected: `https://gvqvrmkizemwsasmupmo.supabase.co`. Se a URL contiver `lljn`, **PARE** — o MCP está apontando para o projeto errado; nesse caso aplique pelo agente do Lovable com `mcp__7677056b-401a-4430-a17b-26243f22f5f2__send_message`, colando o SQL do Step 1 e pedindo para executar como migration.

Run: `mcp__supabase__apply_migration` com `name: "get_gestor_contexto"` e `query` = SQL do Step 1.
Expected: sucesso, sem erro. Depois:

```sql
SELECT proname, prosecdef, provolatile, pg_get_function_identity_arguments(oid) AS args
FROM pg_proc WHERE proname = 'get_gestor_contexto' AND pronamespace = 'public'::regnamespace;
```
Expected: 1 linha, `prosecdef = true`, `provolatile = 's'`, `args` vazio.

```sql
SELECT position('feature_not_enabled' IN pg_get_functiondef(p.oid)) > 0 AS tem_guard
FROM pg_proc p WHERE p.proname = 'get_gestor_contexto' AND p.pronamespace = 'public'::regnamespace;
```
Expected: `tem_guard = true`.

- [ ] **Step 3: Verificar como gestor real**

```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<GESTOR_ID>","role":"authenticated"}';
SELECT jsonb_pretty(public.get_gestor_contexto());
ROLLBACK;
```
Expected: envelope com `data.usuario.papel = "gestor"`, `data.iesAtual.id = <IES_ID>`, `data.iesDisponiveis` com exatamente 1 item (a própria IES), `data.podeTrocarIes = false`, `data.contrato` preenchido se houver linha em `ies_contrato_simulados` para a IES (senão `null`), `meta.criterio` não vazio.

Repetir com um `admin`:
```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<ADMIN_ID>","role":"authenticated"}';
SELECT (public.get_gestor_contexto() -> 'data' -> 'podeTrocarIes'),
       jsonb_array_length(public.get_gestor_contexto() -> 'data' -> 'iesDisponiveis');
ROLLBACK;
```
Expected: `true` e um número igual a `SELECT count(*) FROM public.ies`.

- [ ] **Step 4: Verificar anon e IES alheia**

```sql
BEGIN;
SET LOCAL ROLE anon;
SELECT public.get_gestor_contexto();
ROLLBACK;
```
Expected: erro `42501 permission denied for function get_gestor_contexto` (via PostgREST anônimo, HTTP 401).

```sql
-- Aluno (sem role de gestor) → Access denied
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<ALUNO_ID>","role":"authenticated"}';
SELECT public.get_gestor_contexto();
ROLLBACK;
```
Expected: erro. Se a IES do aluno tiver a feature ligada, a mensagem é `Access denied`; se não tiver, é `feature_not_enabled` — ambos aceitáveis (nenhum revela dado).

```sql
-- Gestor de outra IES não vê a IES alvo na lista
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<GESTOR_OUTRA_IES>","role":"authenticated"}';
SELECT public.get_gestor_contexto() -> 'data' -> 'iesDisponiveis';
ROLLBACK;
```
Expected: array sem `<IES_ID>`.

- [ ] **Step 5: Salvar o .sql e commitar**

```bash
git add supabase/migrations/20260726100000_get_gestor_contexto.sql
git commit -m "feat(gestor): RPC get_gestor_contexto com guard de feature no corpo"
```

---

### Task 15: RPC `get_gestor_cronograma`

**Files:**
- Create: `supabase/migrations/20260726100100_get_gestor_cronograma.sql`
- Test: n/a (verificação por query no Step 3)

**Interfaces:**
- Consumes: guards da Task 14; `ies_contrato_simulados`, `ies_simulado_previsto`, `simulados_admin` (com `modalidade`, `data_realizacao`, `data_agendada_original`), `simulados_finalizados`, `resultados_ies_tri`, `users`, `user_roles`
- Produces: `public.get_gestor_cronograma(p_ies_id uuid)` → `jsonb`:
```json
{ "data": [ { "id":"uuid", "nome":"text", "data":"ISO-8601|null",
              "status":"realizado|processing|agendado|reagendado|previsto",
              "modalidade":"online|presencial|null", "participantes": 0,
              "indisponivelPorque":"text|null" } ],
  "meta": { "...": "" } }
```
Espelha `ItemCronograma[]`. Ordenado por data (nulos ao fim) e depois por `ordem` do slot. `participantes` é `null` para item não realizado.

- [ ] **Step 1: Escrever o SQL completo**

```sql
-- 20260726100100_get_gestor_cronograma.sql
CREATE OR REPLACE FUNCTION public.get_gestor_cronograma(p_ies_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid    uuid := auth.uid();
  v_ies    uuid;
  v_result jsonb;
BEGIN
  IF NOT public.user_has_feature('gestao.portal_v2') THEN
    RAISE EXCEPTION 'feature_not_enabled' USING ERRCODE = '42501';
  END IF;

  IF NOT (
       has_role(v_uid,'admin'::app_role)
    OR has_role(v_uid,'gestor'::app_role)
    OR has_role(v_uid,'gestor_grupo'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_ies_id IS NOT NULL THEN
    IF NOT public.user_can_access_ies(v_uid, p_ies_id) THEN
      RAISE EXCEPTION 'Permission denied: cannot access this IES';
    END IF;
    v_ies := p_ies_id;
  ELSE
    SELECT u.id_ies INTO v_ies FROM public.users u WHERE u.id = v_uid;
    IF v_ies IS NULL THEN
      v_ies := (public.get_accessible_ies(v_uid))[1];
    END IF;
  END IF;
  IF v_ies IS NULL THEN
    RAISE EXCEPTION 'IES not resolved';
  END IF;

  WITH alunos AS (
    SELECT u.id
    FROM public.users u
    WHERE u.id_ies = v_ies
      AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
  ),
  -- simulados visíveis da IES (pais); cronograma inclui futuros, então NÃO filtra liberacao_desempenho
  sims AS (
    SELECT sa.id,
           sa.nome,
           sa.modalidade,
           sa.status,
           sa.data_encerramento,
           COALESCE(sa.data_realizacao, sa.data_liberacao) AS data_efetiva,
           sa.data_agendada_original
    FROM public.simulados_admin sa
    WHERE v_ies = ANY (sa.ies_ids)
      AND sa.simulado_pai_id IS NULL
      AND lower(sa.status) NOT IN ('rascunho','draft','arquivado','cancelado')
  ),
  grupo AS (
    SELECT sa.id AS simulado_id, COALESCE(sa.simulado_pai_id, sa.id) AS pai_id
    FROM public.simulados_admin sa
    WHERE COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims)
  ),
  participacao AS (
    SELECT g.pai_id, count(DISTINCT sf.user_id) AS n
    FROM public.simulados_finalizados sf
    JOIN grupo g ON g.simulado_id = sf.simulado_id
    WHERE sf.user_id IN (SELECT id FROM alunos)
    GROUP BY g.pai_id
  ),
  com_tri AS (
    SELECT DISTINCT COALESCE(sa.simulado_pai_id, sa.id) AS pai_id
    FROM public.resultados_ies_tri r
    JOIN public.simulados_admin sa ON sa.id = r.simulado_id
    WHERE r.college_id = v_ies
  ),
  sim_status AS (
    SELECT s.id, s.nome, s.modalidade, s.data_efetiva,
           COALESCE(p.n, 0) AS participantes,
           CASE
             WHEN (COALESCE(p.n,0) > 0 OR lower(s.status) = 'encerrado'
                   OR (s.data_encerramento IS NOT NULL AND s.data_encerramento < now()))
                  AND EXISTS (SELECT 1 FROM com_tri c WHERE c.pai_id = s.id)
               THEN 'realizado'
             WHEN (COALESCE(p.n,0) > 0 OR lower(s.status) = 'encerrado'
                   OR (s.data_encerramento IS NOT NULL AND s.data_encerramento < now()))
               THEN 'processing'
             WHEN s.data_efetiva IS NULL THEN 'previsto'
             WHEN s.data_agendada_original IS NOT NULL
                  AND s.data_agendada_original <> s.data_efetiva THEN 'reagendado'
             ELSE 'agendado'
           END AS status
    FROM sims s
    LEFT JOIN participacao p ON p.pai_id = s.id
  ),
  slots AS (
    SELECT sp.id        AS slot_id,
           sp.ordem     AS ordem,
           sp.nome_previsto,
           sp.simulado_id
    FROM public.ies_simulado_previsto sp
    WHERE sp.ies_id = v_ies
  ),
  itens AS (
    -- slots do contrato (com ou sem simulado vinculado)
    SELECT COALESCE(ss.id, sl.slot_id)                       AS id,
           COALESCE(ss.nome, sl.nome_previsto, 'A definir')  AS nome,
           ss.data_efetiva                                   AS data,
           COALESCE(ss.status, 'previsto')                   AS status,
           ss.modalidade                                     AS modalidade,
           CASE WHEN COALESCE(ss.status,'previsto') = 'realizado' THEN ss.participantes END AS participantes,
           sl.ordem                                          AS ordem
    FROM slots sl
    LEFT JOIN sim_status ss ON ss.id = sl.simulado_id
    UNION ALL
    -- simulados reais da IES que não estão em nenhum slot
    SELECT ss.id, ss.nome, ss.data_efetiva, ss.status, ss.modalidade,
           CASE WHEN ss.status = 'realizado' THEN ss.participantes END,
           NULL::int
    FROM sim_status ss
    WHERE NOT EXISTS (SELECT 1 FROM slots sl WHERE sl.simulado_id = ss.id)
  )
  SELECT jsonb_build_object(
    'data', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id',          i.id,
               'nome',        i.nome,
               'data',        CASE WHEN i.data IS NULL THEN NULL
                                   ELSE to_char(i.data AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') END,
               'status',      i.status,
               'modalidade',  i.modalidade,
               'participantes', i.participantes,
               'indisponivelPorque', CASE
                                       WHEN i.status = 'previsto'   THEN 'Data a definir pela Sanar'
                                       WHEN i.status = 'processing' THEN 'Gabarito em processamento'
                                       ELSE NULL
                                     END
             ) ORDER BY i.data NULLS LAST, i.ordem NULLS LAST, i.nome)
      FROM itens i
    ), '[]'::jsonb),
    'meta', jsonb_build_object(
      'periodo',      COALESCE((
                        SELECT to_char(c.vigencia_inicio,'DD/MM/YYYY') || ' — ' || to_char(c.vigencia_fim,'DD/MM/YYYY')
                        FROM public.ies_contrato_simulados c
                        WHERE c.ies_id = v_ies
                        ORDER BY (current_date BETWEEN c.vigencia_inicio AND c.vigencia_fim) DESC, c.vigencia_fim DESC
                        LIMIT 1
                      ), 'sem contrato cadastrado'),
      'fonte',        'ies_contrato_simulados · ies_simulado_previsto · simulados_admin · simulados_finalizados · resultados_ies_tri',
      'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'criterio',     'realizado = tem participação/encerrado E tem linha em resultados_ies_tri; processing = realizado sem TRI; reagendado = data_agendada_original difere da data efetiva; agendado = data futura sem reagendamento; previsto = slot sem simulado ou simulado sem data. Data efetiva = data_realizacao (presencial) ou data_liberacao (online). Participantes contam apenas alunos da IES sem role em user_roles.',
      'partial',      (SELECT count(*) FROM itens WHERE status IN ('previsto','processing')) > 0,
      'lowSample',    false
    )
  ) INTO v_result;

  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_gestor_cronograma(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_cronograma(uuid) TO authenticated;
```

- [ ] **Step 2: Aplicar em produção (project ref gvqv CONFIRMADO)**

Run: `mcp__supabase__get_project_url`
Expected: `https://gvqvrmkizemwsasmupmo.supabase.co` (se vier `lljn`, PARE e aplique via `send_message` do MCP do Lovable).

Run: `mcp__supabase__apply_migration` com `name: "get_gestor_cronograma"` e o SQL do Step 1.
Expected: sucesso.

```sql
SELECT position('feature_not_enabled' IN pg_get_functiondef(p.oid)) > 0 AS tem_guard,
       provolatile, prosecdef
FROM pg_proc p WHERE p.proname = 'get_gestor_cronograma' AND p.pronamespace = 'public'::regnamespace;
```
Expected: `tem_guard = true`, `provolatile = 's'`, `prosecdef = true`.

- [ ] **Step 3: Verificar como gestor real**

```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<GESTOR_ID>","role":"authenticated"}';
SELECT jsonb_pretty(public.get_gestor_cronograma('<IES_ID>'));
ROLLBACK;
```
Expected: `data` é array; cada item tem `status` em `('realizado','processing','agendado','reagendado','previsto')`; itens `previsto` têm `data = null`, `participantes = null` e `indisponivelPorque = 'Data a definir pela Sanar'`; itens `realizado` têm `participantes` inteiro > 0.

Conferência cruzada da contagem de itens:
```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<GESTOR_ID>","role":"authenticated"}';
SELECT jsonb_array_length(public.get_gestor_cronograma('<IES_ID>') -> 'data') AS itens_rpc;
ROLLBACK;

-- como postgres:
SELECT (SELECT count(*) FROM public.ies_simulado_previsto WHERE ies_id = '<IES_ID>')
     + (SELECT count(*) FROM public.simulados_admin sa
        WHERE '<IES_ID>' = ANY (sa.ies_ids) AND sa.simulado_pai_id IS NULL
          AND lower(sa.status) NOT IN ('rascunho','draft','arquivado','cancelado')
          AND NOT EXISTS (SELECT 1 FROM public.ies_simulado_previsto sp
                          WHERE sp.ies_id = '<IES_ID>' AND sp.simulado_id = sa.id)) AS itens_esperados;
```
Expected: `itens_rpc = itens_esperados`.

- [ ] **Step 4: Verificar anon e IES alheia**

```sql
BEGIN; SET LOCAL ROLE anon;
SELECT public.get_gestor_cronograma('<IES_ID>');
ROLLBACK;
```
Expected: `42501 permission denied for function get_gestor_cronograma` (HTTP 401 via PostgREST).

```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<GESTOR_OUTRA_IES>","role":"authenticated"}';
SELECT public.get_gestor_cronograma('<IES_ID>');
ROLLBACK;
```
Expected: erro `Permission denied: cannot access this IES`.

- [ ] **Step 5: Salvar o .sql e commitar**

```bash
git add supabase/migrations/20260726100100_get_gestor_cronograma.sql
git commit -m "feat(gestor): RPC get_gestor_cronograma com derivacao de status do contrato"
```

---

### Task 16: RPC `get_gestor_avisos`

**Files:**
- Create: `supabase/migrations/20260726100200_get_gestor_avisos.sql`
- Test: n/a (verificação por query no Step 3)

**Interfaces:**
- Consumes: guards da Task 14; `announcements` (com `publico_alvo text[]`), `announcements_viewed`
- Produces: `public.get_gestor_avisos(p_ies_id uuid)` → `jsonb`:
```json
{ "data": [ { "id":"uuid", "titulo":"text", "resumo":"text", "data":"ISO-8601", "lido": false } ],
  "meta": { "...": "" } }
```
Espelha `Aviso[]`. `resumo` = primeiros 180 caracteres de `descricao` (com `…` quando truncado). Não lidos primeiro, depois mais recentes primeiro.

- [ ] **Step 1: Escrever o SQL completo**

```sql
-- 20260726100200_get_gestor_avisos.sql
CREATE OR REPLACE FUNCTION public.get_gestor_avisos(p_ies_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid    uuid := auth.uid();
  v_ies    uuid;
  v_result jsonb;
BEGIN
  IF NOT public.user_has_feature('gestao.portal_v2') THEN
    RAISE EXCEPTION 'feature_not_enabled' USING ERRCODE = '42501';
  END IF;

  IF NOT (
       has_role(v_uid,'admin'::app_role)
    OR has_role(v_uid,'gestor'::app_role)
    OR has_role(v_uid,'gestor_grupo'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_ies_id IS NOT NULL THEN
    IF NOT public.user_can_access_ies(v_uid, p_ies_id) THEN
      RAISE EXCEPTION 'Permission denied: cannot access this IES';
    END IF;
    v_ies := p_ies_id;
  ELSE
    SELECT u.id_ies INTO v_ies FROM public.users u WHERE u.id = v_uid;
    IF v_ies IS NULL THEN
      v_ies := (public.get_accessible_ies(v_uid))[1];
    END IF;
  END IF;
  IF v_ies IS NULL THEN
    RAISE EXCEPTION 'IES not resolved';
  END IF;

  WITH visiveis AS (
    SELECT a.id, a.titulo, a.descricao, a.created_at,
           EXISTS (SELECT 1 FROM public.announcements_viewed av
                   WHERE av.announcement_id = a.id AND av.user_id = v_uid) AS lido
    FROM public.announcements a
    WHERE a.ativo = true
      AND (a.data_expiracao IS NULL OR a.data_expiracao > now())
      AND 'gestor' = ANY (COALESCE(a.publico_alvo, ARRAY['aluno']::text[]))
      AND (
            a.visibilidade = 'todas'
        OR (a.visibilidade = 'seletivo' AND v_ies = ANY (COALESCE(a.ies_selecionadas, ARRAY[]::uuid[])))
        OR (a.visibilidade = 'exceto'   AND NOT (v_ies = ANY (COALESCE(a.ies_excluidas, ARRAY[]::uuid[]))))
      )
  )
  SELECT jsonb_build_object(
    'data', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id',     v.id,
               'titulo', v.titulo,
               'resumo', CASE WHEN length(v.descricao) > 180
                              THEN left(v.descricao, 180) || '…'
                              ELSE v.descricao END,
               'data',   to_char(v.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
               'lido',   v.lido
             ) ORDER BY v.lido ASC, v.created_at DESC)
      FROM visiveis v
    ), '[]'::jsonb),
    'meta', jsonb_build_object(
      'periodo',      'avisos ativos e não expirados',
      'fonte',        'announcements · announcements_viewed',
      'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'criterio',     'Aviso ativo, não expirado, com ''gestor'' em publico_alvo e visível para a IES pelas regras de visibilidade (todas/seletivo/exceto). semestre_destino é ignorado: gestor não tem semestre. Não lidos primeiro, depois mais recentes.',
      'partial',      false,
      'lowSample',    false
    )
  ) INTO v_result;

  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_gestor_avisos(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_avisos(uuid) TO authenticated;
```

- [ ] **Step 2: Aplicar em produção (project ref gvqv CONFIRMADO)**

Run: `mcp__supabase__get_project_url`
Expected: `https://gvqvrmkizemwsasmupmo.supabase.co` (se vier `lljn`, PARE e use o `send_message` do Lovable).

Run: `mcp__supabase__apply_migration` com `name: "get_gestor_avisos"` e o SQL do Step 1.
Expected: sucesso.

```sql
SELECT position('feature_not_enabled' IN pg_get_functiondef(oid)) > 0 AS tem_guard
FROM pg_proc WHERE proname = 'get_gestor_avisos' AND pronamespace = 'public'::regnamespace;
```
Expected: `true`.

- [ ] **Step 3: Verificar como gestor real**

Semear um aviso de gestor (como postgres, dentro de transação descartável) e conferir que ele aparece e que um aviso de aluno **não** aparece:

```sql
-- como postgres
INSERT INTO public.announcements (titulo, descricao, visibilidade, publico_alvo, ativo)
VALUES ('Teste gestor v2', 'Aviso de verificacao da Task 16.', 'todas', ARRAY['gestor']::text[], true);
INSERT INTO public.announcements (titulo, descricao, visibilidade, publico_alvo, ativo)
VALUES ('Teste aluno v2', 'Nao deve aparecer para gestor.', 'todas', ARRAY['aluno']::text[], true);
```
```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<GESTOR_ID>","role":"authenticated"}';
SELECT jsonb_pretty(public.get_gestor_avisos('<IES_ID>'));
ROLLBACK;
```
Expected: `data` contém o item com `titulo = 'Teste gestor v2'` e `lido = false`; **não** contém `'Teste aluno v2'`.

Limpeza:
```sql
DELETE FROM public.announcements WHERE titulo IN ('Teste gestor v2','Teste aluno v2');
```

- [ ] **Step 4: Verificar anon e IES alheia**

```sql
BEGIN; SET LOCAL ROLE anon;
SELECT public.get_gestor_avisos('<IES_ID>');
ROLLBACK;
```
Expected: `42501 permission denied for function get_gestor_avisos`.

```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<GESTOR_OUTRA_IES>","role":"authenticated"}';
SELECT public.get_gestor_avisos('<IES_ID>');
ROLLBACK;
```
Expected: `Permission denied: cannot access this IES`.

- [ ] **Step 5: Salvar o .sql e commitar**

```bash
git add supabase/migrations/20260726100200_get_gestor_avisos.sql
git commit -m "feat(gestor): RPC get_gestor_avisos segmentada por publico_alvo"
```

---

### Task 17: RPC `get_gestor_visao_geral`

**Files:**
- Create: `supabase/migrations/20260726100300_get_gestor_visao_geral.sql`
- Test: n/a (verificação por query no Step 3)

**Interfaces:**
- Consumes: guards da Task 14; `simulados_admin`, `simulados_finalizados`, `answer_progress`, `questoes_simulado`, `resultados_alunos_tri`, `users`, `user_roles`, `ies_contrato_simulados`
- Produces: `public.get_gestor_visao_geral(p_ies_id uuid, p_semestre text)` → `jsonb` com `data` na forma exata da interface `VisaoGeral`:
  - `kpis.enamedProjetado | proficientesPct | acertoPct` → `Kpi { valor, delta, serie: [{rotulo,valor}], criterio }`, com `serie` usando os rótulos `'primeiro' | 'anterior' | 'atual'` (1 a 3 pontos)
  - `kpis.simulados` → `{ realizados: int, contratados: int | null }` — **`contratados` é `null` quando a IES não tem contrato** (regra "nunca 0 onde não há dado"); a fatia de front deve renderizar `TRACO` nesse caso
  - `evolucao[]`, `evolucaoPorArea[]`, `diagnosticoResumo[]` (sempre 3 grupos, na ordem crítico/mediano/excelente), `distribuicaoAlunos[]` (sempre 3 grupos), `dispersao[]`, `insights[]` (sempre 2 itens: um `escopo:'area'`, um `escopo:'aluno'`)
  - envelope `meta` com `partial` = existe simulado realizado sem TRI, `lowSample` = maior amostra do recorte < 10

- [ ] **Step 1: Escrever o SQL completo**

```sql
-- 20260726100300_get_gestor_visao_geral.sql
CREATE OR REPLACE FUNCTION public.get_gestor_visao_geral(p_ies_id uuid, p_semestre text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid      uuid := auth.uid();
  v_ies      uuid;
  v_sems     int[];
  v_evid     int[];
  v_recorte  text;
  v_criterio text;
  v_result   jsonb;
BEGIN
  IF NOT public.user_has_feature('gestao.portal_v2') THEN
    RAISE EXCEPTION 'feature_not_enabled' USING ERRCODE = '42501';
  END IF;

  IF NOT (
       has_role(v_uid,'admin'::app_role)
    OR has_role(v_uid,'gestor'::app_role)
    OR has_role(v_uid,'gestor_grupo'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_ies_id IS NOT NULL THEN
    IF NOT public.user_can_access_ies(v_uid, p_ies_id) THEN
      RAISE EXCEPTION 'Permission denied: cannot access this IES';
    END IF;
    v_ies := p_ies_id;
  ELSE
    SELECT u.id_ies INTO v_ies FROM public.users u WHERE u.id = v_uid;
    IF v_ies IS NULL THEN
      v_ies := (public.get_accessible_ies(v_uid))[1];
    END IF;
  END IF;
  IF v_ies IS NULL THEN
    RAISE EXCEPTION 'IES not resolved';
  END IF;

  -- recorte de semestre: '6ano' => todos, 11 e 12 em evidência; 'geral' => todos; '1'..'12' => só aquele
  IF p_semestre IS NULL OR p_semestre = 'geral' THEN
    v_sems := NULL; v_evid := NULL; v_recorte := 'todos os semestres, sem evidência';
  ELSIF p_semestre = '6ano' THEN
    v_sems := NULL; v_evid := ARRAY[11,12]; v_recorte := 'todos os semestres, 11º e 12º em evidência';
  ELSIF p_semestre ~ '^(1[0-2]|[1-9])$' THEN
    v_sems := ARRAY[p_semestre::int]; v_evid := v_sems;
    v_recorte := format('somente o %sº semestre', p_semestre);
  ELSE
    RAISE EXCEPTION 'semestre_invalido' USING ERRCODE = '22023';
  END IF;

  v_criterio := format(
    'Proficiência = resultados_alunos_tri.score_proprio (0–100); proficiente >= 60. Desempenho por grande área em %% de acerto (crítico < 30, mediano 30–80, excelente >= 80). Última tentativa por aluno; questão anulada ignorada; usuários com role em user_roles fora do universo de alunos. Conceito ENAMED 1–5 derivado do %% de proficientes (>=90:5, >=75:4, >=60:3, >=40:2, senão 1), por simulado, nunca média. Recorte: %s.',
    v_recorte);

  WITH sims AS (
    SELECT sa.id, sa.nome,
           COALESCE(sa.data_realizacao, sa.data_encerramento, sa.data_liberacao, sa.created_at) AS data_ref
    FROM public.simulados_admin sa
    WHERE v_ies = ANY (sa.ies_ids)
      AND sa.simulado_pai_id IS NULL
      AND sa.status IN ('ativo','encerrado')
      AND (
        sa.liberacao_desempenho = 'imediato'
        OR (sa.liberacao_desempenho = 'agendado'
            AND sa.data_liberacao_desempenho IS NOT NULL
            AND sa.data_liberacao_desempenho <= now())
        OR (sa.liberacao_desempenho = 'ao_encerrar'
            AND (sa.status = 'encerrado'
                 OR (sa.data_encerramento IS NOT NULL AND sa.data_encerramento <= now())))
      )
  ),
  sims_ord AS (
    SELECT s.*, row_number() OVER (ORDER BY s.data_ref NULLS LAST, s.nome) AS ord
    FROM sims s
  ),
  grupo AS (
    SELECT sa.id AS simulado_id, COALESCE(sa.simulado_pai_id, sa.id) AS pai_id
    FROM public.simulados_admin sa
    WHERE COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims)
  ),
  alunos AS (
    SELECT u.id, u.semestre
    FROM public.users u
    WHERE u.id_ies = v_ies
      AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
      AND (v_sems IS NULL OR u.semestre = ANY (v_sems))
  ),
  ultima AS (
    SELECT DISTINCT ON (sf.user_id, g.pai_id) sf.user_id, g.pai_id, sf.simulado_id
    FROM public.simulados_finalizados sf
    JOIN grupo g ON g.simulado_id = sf.simulado_id
    WHERE sf.user_id IN (SELECT id FROM alunos)
    ORDER BY sf.user_id, g.pai_id, sf.finalizado_em DESC NULLS LAST
  ),
  ultima_fb AS (
    SELECT DISTINCT ON (ap.user_id, g.pai_id) ap.user_id, g.pai_id, ap.simulado AS simulado_id
    FROM public.answer_progress ap
    JOIN grupo g ON g.simulado_id = ap.simulado
    JOIN public.simulados_admin sa_ord ON sa_ord.id = ap.simulado
    WHERE ap.user_id IN (SELECT id FROM alunos)
      AND NOT EXISTS (SELECT 1 FROM ultima u WHERE u.user_id = ap.user_id AND u.pai_id = g.pai_id)
    ORDER BY ap.user_id, g.pai_id, sa_ord.created_at DESC NULLS LAST
  ),
  tentativas AS (
    SELECT * FROM ultima UNION ALL SELECT * FROM ultima_fb
  ),
  respostas AS (
    SELECT t.pai_id, t.user_id, ap.correct, q.grande_area
    FROM tentativas t
    JOIN public.answer_progress ap ON ap.user_id = t.user_id AND ap.simulado = t.simulado_id
    JOIN public.questoes_simulado q ON q.id = ap.question_id
    WHERE COALESCE(q.anulada,false) = false
  ),
  tri AS (
    SELECT COALESCE(sa.simulado_pai_id, sa.id) AS pai_id, r.student_id, a.semestre, r.score_proprio
    FROM public.resultados_alunos_tri r
    JOIN public.simulados_admin sa ON sa.id = r.simulado_id
    JOIN alunos a ON a.id = r.student_id
    WHERE r.college_id = v_ies
      AND COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims)
      AND r.score_proprio IS NOT NULL
  ),
  por_sim AS (
    SELECT s.id, s.nome, s.data_ref, s.ord,
           (SELECT count(DISTINCT t.student_id) FROM tri t WHERE t.pai_id = s.id)              AS n_tri,
           (SELECT avg(t.score_proprio)         FROM tri t WHERE t.pai_id = s.id)              AS prof_media,
           (SELECT count(*) FILTER (WHERE t.score_proprio >= 60) FROM tri t WHERE t.pai_id = s.id) AS n_prof,
           (SELECT count(DISTINCT r.user_id)    FROM respostas r WHERE r.pai_id = s.id)        AS n_resp,
           (SELECT count(*) FILTER (WHERE r.correct) FROM respostas r WHERE r.pai_id = s.id)   AS acertos,
           (SELECT count(*)                     FROM respostas r WHERE r.pai_id = s.id)        AS total
    FROM sims_ord s
  ),
  metricas AS (
    SELECT p.*,
           CASE WHEN p.n_tri > 0 THEN round(100.0 * p.n_prof / p.n_tri, 0) END AS prof_pct,
           CASE WHEN p.total > 0 THEN round(100.0 * p.acertos / p.total, 0) END AS acerto_pct,
           CASE WHEN p.n_tri = 0 THEN NULL
                WHEN 100.0 * p.n_prof / p.n_tri >= 90 THEN 5
                WHEN 100.0 * p.n_prof / p.n_tri >= 75 THEN 4
                WHEN 100.0 * p.n_prof / p.n_tri >= 60 THEN 3
                WHEN 100.0 * p.n_prof / p.n_tri >= 40 THEN 2
                ELSE 1 END AS concept
    FROM por_sim p
  ),
  realizados AS (
    SELECT * FROM metricas WHERE n_resp > 0 OR n_tri > 0
  ),
  regua AS (
    SELECT r.*, row_number() OVER (ORDER BY r.ord) AS i, count(*) OVER () AS k
    FROM realizados r
  ),
  pontos AS (
    SELECT g.*,
           CASE WHEN g.i = g.k     THEN 'atual'
                WHEN g.i = g.k - 1 THEN 'anterior'
                WHEN g.i = 1       THEN 'primeiro' END AS rotulo
    FROM regua g
    WHERE g.i = g.k OR g.i = g.k - 1 OR g.i = 1
  ),
  areas_sim AS (
    SELECT r.grande_area AS area, r.pai_id,
           count(*) AS total, count(*) FILTER (WHERE r.correct) AS acertos
    FROM respostas r
    WHERE r.grande_area IS NOT NULL
    GROUP BY 1, 2
  ),
  areas_tot AS (
    SELECT a.area, sum(a.total) AS total, sum(a.acertos) AS acertos,
           (SELECT count(DISTINCT r2.user_id) FROM respostas r2 WHERE r2.grande_area = a.area) AS amostra
    FROM areas_sim a GROUP BY a.area
  ),
  areas_nivel AS (
    SELECT t.area, t.amostra,
           round(100.0 * t.acertos / NULLIF(t.total,0), 0) AS acerto_pct,
           CASE WHEN t.total = 0 THEN NULL
                WHEN 100.0 * t.acertos / t.total <  30 THEN 'critico'
                WHEN 100.0 * t.acertos / t.total >= 80 THEN 'excelente'
                ELSE 'mediano' END AS nivel
    FROM areas_tot t
  ),
  aluno_prof AS (
    SELECT t.student_id,
           count(DISTINCT t.pai_id) AS n_sim,
           count(DISTINCT t.pai_id) FILTER (WHERE t.score_proprio >= 60) AS n_prof
    FROM tri t GROUP BY t.student_id
  ),
  aluno_grupo AS (
    SELECT ap.student_id,
           CASE WHEN ap.n_prof = ap.n_sim THEN 'consistentemente_proficiente'
                WHEN ap.n_prof = 0        THEN 'consistentemente_nao_proficiente'
                ELSE 'em_variacao' END AS grupo
    FROM aluno_prof ap
  ),
  dispersao AS (
    SELECT DISTINCT ON (t.student_id) t.student_id, t.semestre, t.score_proprio
    FROM tri t
    JOIN metricas m ON m.id = t.pai_id
    ORDER BY t.student_id, m.ord DESC
  )
  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'kpis', jsonb_build_object(
        'enamedProjetado', jsonb_build_object(
          'valor', (SELECT p.concept FROM pontos p WHERE p.rotulo = 'atual'),
          'delta', ((SELECT p.concept FROM pontos p WHERE p.rotulo = 'atual')
                    - (SELECT p.concept FROM pontos p WHERE p.rotulo = 'anterior')),
          'serie', COALESCE((SELECT jsonb_agg(jsonb_build_object('rotulo', p.rotulo, 'valor', p.concept) ORDER BY p.i)
                             FROM pontos p), '[]'::jsonb),
          'criterio', 'Conceito 1–5 do simulado atual, derivado do % de alunos proficientes. Nunca é média entre simulados.'
        ),
        'proficientesPct', jsonb_build_object(
          'valor', (SELECT p.prof_pct FROM pontos p WHERE p.rotulo = 'atual'),
          'delta', ((SELECT p.prof_pct FROM pontos p WHERE p.rotulo = 'atual')
                    - (SELECT p.prof_pct FROM pontos p WHERE p.rotulo = 'anterior')),
          'serie', COALESCE((SELECT jsonb_agg(jsonb_build_object('rotulo', p.rotulo, 'valor', p.prof_pct) ORDER BY p.i)
                             FROM pontos p), '[]'::jsonb),
          'criterio', 'Alunos com score_proprio >= 60 sobre o total de alunos com resultado no simulado.'
        ),
        'acertoPct', jsonb_build_object(
          'valor', (SELECT p.acerto_pct FROM pontos p WHERE p.rotulo = 'atual'),
          'delta', ((SELECT p.acerto_pct FROM pontos p WHERE p.rotulo = 'atual')
                    - (SELECT p.acerto_pct FROM pontos p WHERE p.rotulo = 'anterior')),
          'serie', COALESCE((SELECT jsonb_agg(jsonb_build_object('rotulo', p.rotulo, 'valor', p.acerto_pct) ORDER BY p.i)
                             FROM pontos p), '[]'::jsonb),
          'criterio', 'Respostas corretas sobre respostas válidas (questão anulada fora), na última tentativa de cada aluno.'
        ),
        'simulados', jsonb_build_object(
          'realizados',  (SELECT count(*) FROM realizados),
          'contratados', (SELECT c.simulados_contratados
                          FROM public.ies_contrato_simulados c
                          WHERE c.ies_id = v_ies
                          ORDER BY (current_date BETWEEN c.vigencia_inicio AND c.vigencia_fim) DESC, c.vigencia_fim DESC
                          LIMIT 1)
        )
      ),
      'evolucao', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'simuladoId',   m.id,
                 'nome',         m.nome,
                 'data',         to_char(m.data_ref AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                 'valor',        CASE WHEN m.prof_media IS NULL THEN NULL ELSE round(m.prof_media::numeric, 1) END,
                 'participantes', GREATEST(m.n_tri, m.n_resp)
               ) ORDER BY m.ord)
        FROM realizados m), '[]'::jsonb),
      'evolucaoPorArea', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'area',    t.area,
                 'pontos',  COALESCE((
                              SELECT jsonb_agg(jsonb_build_object(
                                       'rotulo', m.nome,
                                       'valor',  round(100.0 * a.acertos / NULLIF(a.total,0), 0)
                                     ) ORDER BY m.ord)
                              FROM areas_sim a JOIN metricas m ON m.id = a.pai_id
                              WHERE a.area = t.area), '[]'::jsonb),
                 'critica', COALESCE((100.0 * t.acertos / NULLIF(t.total,0)) < 30, false)
               ) ORDER BY t.area)
        FROM areas_tot t), '[]'::jsonb),
      'diagnosticoResumo', (
        SELECT jsonb_agg(jsonb_build_object(
                 'nivel', n.nivel,
                 'areas', COALESCE((
                            SELECT jsonb_agg(jsonb_build_object('id', an.area, 'nome', an.area, 'acertoPct', an.acerto_pct)
                                             ORDER BY an.acerto_pct, an.area)
                            FROM areas_nivel an WHERE an.nivel = n.nivel), '[]'::jsonb)
               ) ORDER BY n.pos)
        FROM (VALUES ('critico',1),('mediano',2),('excelente',3)) AS n(nivel,pos)),
      'distribuicaoAlunos', (
        SELECT jsonb_agg(jsonb_build_object(
                 'grupo',      g.grupo,
                 'quantidade', COALESCE(c.q, 0),
                 'percentual', CASE WHEN (SELECT count(*) FROM aluno_grupo) > 0
                                    THEN round(100.0 * COALESCE(c.q,0) / (SELECT count(*) FROM aluno_grupo), 0)
                               END
               ) ORDER BY g.pos)
        FROM (VALUES ('consistentemente_proficiente',1),
                     ('em_variacao',2),
                     ('consistentemente_nao_proficiente',3)) AS g(grupo,pos)
        LEFT JOIN (SELECT grupo, count(*) AS q FROM aluno_grupo GROUP BY grupo) c ON c.grupo = g.grupo),
      'dispersao', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'alunoId',  d.student_id,
                 'semestre', d.semestre,
                 'nota',     round(d.score_proprio::numeric, 1)))
        FROM dispersao d WHERE d.semestre IS NOT NULL), '[]'::jsonb),
      'insights', jsonb_build_array(
        jsonb_build_object('escopo','area','texto', COALESCE((
          SELECT format('%s é a grande área com o menor desempenho da instituição: %s%% de acerto no recorte analisado.',
                        an.area, an.acerto_pct)
          FROM areas_nivel an WHERE an.acerto_pct IS NOT NULL ORDER BY an.acerto_pct, an.area LIMIT 1),
          'Ainda não há respostas suficientes para gerar um insight por grande área.')),
        jsonb_build_object('escopo','aluno','texto', COALESCE((
          SELECT format('%s de %s alunos com resultado estão consistentemente abaixo do limiar de proficiência (60).',
                        x.nao_prof, x.tot)
          FROM (SELECT count(*) FILTER (WHERE grupo = 'consistentemente_nao_proficiente') AS nao_prof,
                       count(*) AS tot
                FROM aluno_grupo) x
          WHERE x.tot > 0),
          'Ainda não há resultado de proficiência para gerar um insight por aluno.'))
      )
    ),
    'meta', jsonb_build_object(
      'periodo',      COALESCE((SELECT to_char(min(m.data_ref),'DD/MM/YYYY') || ' — ' || to_char(max(m.data_ref),'DD/MM/YYYY')
                                FROM realizados m), 'sem simulado com resultado'),
      'fonte',        'resultados_alunos_tri · answer_progress · questoes_simulado · simulados_admin · simulados_finalizados · users',
      'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'criterio',     v_criterio,
      'partial',      (SELECT count(*) FROM realizados WHERE n_tri = 0) > 0,
      'lowSample',    COALESCE((SELECT max(GREATEST(m.n_tri, m.n_resp)) FROM realizados m), 0) < 10
    )
  ) INTO v_result;

  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_gestor_visao_geral(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_visao_geral(uuid, text) TO authenticated;
```

- [ ] **Step 2: Aplicar em produção (project ref gvqv CONFIRMADO)**

Run: `mcp__supabase__get_project_url`
Expected: `https://gvqvrmkizemwsasmupmo.supabase.co` (se vier `lljn`, PARE e use o `send_message` do Lovable).

Run: `mcp__supabase__apply_migration` com `name: "get_gestor_visao_geral"` e o SQL do Step 1.
Expected: sucesso.

```sql
SELECT position('feature_not_enabled' IN pg_get_functiondef(oid)) > 0 AS tem_guard, provolatile
FROM pg_proc WHERE proname = 'get_gestor_visao_geral' AND pronamespace = 'public'::regnamespace;
```
Expected: `true`, `s`.

- [ ] **Step 3: Verificar como gestor real**

```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<GESTOR_ID>","role":"authenticated"}';
SELECT jsonb_pretty(public.get_gestor_visao_geral('<IES_ID>', '6ano'));
ROLLBACK;
```
Expected, item por item:
- `data.kpis.enamedProjetado.valor` inteiro de 1 a 5, ou `null` se o último simulado não tem TRI; `serie` com 1 a 3 pontos e rótulos em `('primeiro','anterior','atual')`.
- `data.kpis.proficientesPct.valor` entre 0 e 100.
- `data.kpis.simulados.realizados` = número de simulados com participação; `contratados` = `simulados_contratados` do contrato vigente ou `null`.
- `data.diagnosticoResumo` com **exatamente 3** entradas, na ordem `critico`, `mediano`, `excelente`.
- `data.distribuicaoAlunos` com **exatamente 3** entradas; soma de `quantidade` = número de alunos com pelo menos um resultado de TRI.
- `data.insights` com **exatamente 2** entradas, uma `escopo:'area'` e uma `escopo:'aluno'`.
- `meta.criterio` termina com `Recorte: todos os semestres, 11º e 12º em evidência.`

Conferência de coerência do KPI de proficientes contra a fonte:
```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<GESTOR_ID>","role":"authenticated"}';
SELECT public.get_gestor_visao_geral('<IES_ID>','geral') #>> '{data,kpis,proficientesPct,valor}' AS rpc_pct;
ROLLBACK;

-- como postgres, para o último simulado com TRI da IES:
WITH ultimo AS (
  SELECT r.simulado_id
  FROM public.resultados_ies_tri r
  JOIN public.simulados_admin s ON s.id = r.simulado_id
  WHERE r.college_id = '<IES_ID>'
  ORDER BY COALESCE(s.data_realizacao, s.data_encerramento, s.data_liberacao, s.created_at) DESC
  LIMIT 1)
SELECT round(100.0 * count(*) FILTER (WHERE a.score_proprio >= 60) / NULLIF(count(*),0), 0) AS esperado
FROM public.resultados_alunos_tri a
JOIN ultimo u ON u.simulado_id = a.simulado_id
WHERE a.college_id = '<IES_ID>' AND a.score_proprio IS NOT NULL;
```
Expected: `rpc_pct = esperado`.

Recorte por semestre e semestre inválido:
```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<GESTOR_ID>","role":"authenticated"}';
SELECT public.get_gestor_visao_geral('<IES_ID>','11') #>> '{meta,criterio}';
ROLLBACK;
```
Expected: texto terminando em `Recorte: somente o 11º semestre.`

```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<GESTOR_ID>","role":"authenticated"}';
SELECT public.get_gestor_visao_geral('<IES_ID>','13');
ROLLBACK;
```
Expected: erro `22023 semestre_invalido`.

- [ ] **Step 4: Verificar anon e IES alheia**

```sql
BEGIN; SET LOCAL ROLE anon;
SELECT public.get_gestor_visao_geral('<IES_ID>','geral');
ROLLBACK;
```
Expected: `42501 permission denied for function get_gestor_visao_geral`.

```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<GESTOR_OUTRA_IES>","role":"authenticated"}';
SELECT public.get_gestor_visao_geral('<IES_ID>','geral');
ROLLBACK;
```
Expected: `Permission denied: cannot access this IES` — sem nenhum dado da IES alvo no retorno.

- [ ] **Step 5: Salvar o .sql e commitar**

```bash
git add supabase/migrations/20260726100300_get_gestor_visao_geral.sql
git commit -m "feat(gestor): RPC get_gestor_visao_geral com KPIs, series e diagnostico resumido"
```

---

### Task 18: RPC `get_gestor_diagnostico`

**Files:**
- Create: `supabase/migrations/20260726100400_get_gestor_diagnostico.sql`
- Test: n/a (verificação por query no Step 3)

**Interfaces:**
- Consumes: guards e CTEs de escopo da Task 17 (`sims`, `grupo`, `alunos`, `tentativas`, `respostas`)
- Produces: `public.get_gestor_diagnostico(p_ies_id uuid, p_semestre text, p_node text)` → `jsonb`:
```json
{ "data": [ { "id":"text", "nome":"text", "nivel":"grande_area|especialidade",
              "acertoPct": 0, "desempenho":"critico|mediano|excelente",
              "amostra": 0, "lowSample": false, "temFilhos": true } ],
  "meta": { "...": "" } }
```
Espelha `NoDiagnostico[]`. `p_node = NULL` devolve as grandes áreas; `p_node = '<nome da grande área>'` devolve as especialidades dela. `id` é o próprio nome do nó (é a chave que a cascata devolve como `p_node` / `p_especialidade`).

- [ ] **Step 1: Escrever o SQL completo**

```sql
-- 20260726100400_get_gestor_diagnostico.sql
CREATE OR REPLACE FUNCTION public.get_gestor_diagnostico(p_ies_id uuid, p_semestre text, p_node text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid      uuid := auth.uid();
  v_ies      uuid;
  v_sems     int[];
  v_recorte  text;
  v_nivel    text;
  v_result   jsonb;
BEGIN
  IF NOT public.user_has_feature('gestao.portal_v2') THEN
    RAISE EXCEPTION 'feature_not_enabled' USING ERRCODE = '42501';
  END IF;

  IF NOT (
       has_role(v_uid,'admin'::app_role)
    OR has_role(v_uid,'gestor'::app_role)
    OR has_role(v_uid,'gestor_grupo'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_ies_id IS NOT NULL THEN
    IF NOT public.user_can_access_ies(v_uid, p_ies_id) THEN
      RAISE EXCEPTION 'Permission denied: cannot access this IES';
    END IF;
    v_ies := p_ies_id;
  ELSE
    SELECT u.id_ies INTO v_ies FROM public.users u WHERE u.id = v_uid;
    IF v_ies IS NULL THEN
      v_ies := (public.get_accessible_ies(v_uid))[1];
    END IF;
  END IF;
  IF v_ies IS NULL THEN
    RAISE EXCEPTION 'IES not resolved';
  END IF;

  IF p_semestre IS NULL OR p_semestre = 'geral' THEN
    v_sems := NULL; v_recorte := 'todos os semestres, sem evidência';
  ELSIF p_semestre = '6ano' THEN
    v_sems := NULL; v_recorte := 'todos os semestres, 11º e 12º em evidência';
  ELSIF p_semestre ~ '^(1[0-2]|[1-9])$' THEN
    v_sems := ARRAY[p_semestre::int]; v_recorte := format('somente o %sº semestre', p_semestre);
  ELSE
    RAISE EXCEPTION 'semestre_invalido' USING ERRCODE = '22023';
  END IF;

  v_nivel := CASE WHEN p_node IS NULL THEN 'grande_area' ELSE 'especialidade' END;

  WITH sims AS (
    SELECT sa.id
    FROM public.simulados_admin sa
    WHERE v_ies = ANY (sa.ies_ids)
      AND sa.simulado_pai_id IS NULL
      AND sa.status IN ('ativo','encerrado')
      AND (
        sa.liberacao_desempenho = 'imediato'
        OR (sa.liberacao_desempenho = 'agendado'
            AND sa.data_liberacao_desempenho IS NOT NULL
            AND sa.data_liberacao_desempenho <= now())
        OR (sa.liberacao_desempenho = 'ao_encerrar'
            AND (sa.status = 'encerrado'
                 OR (sa.data_encerramento IS NOT NULL AND sa.data_encerramento <= now())))
      )
  ),
  grupo AS (
    SELECT sa.id AS simulado_id, COALESCE(sa.simulado_pai_id, sa.id) AS pai_id
    FROM public.simulados_admin sa
    WHERE COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims)
  ),
  alunos AS (
    SELECT u.id
    FROM public.users u
    WHERE u.id_ies = v_ies
      AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
      AND (v_sems IS NULL OR u.semestre = ANY (v_sems))
  ),
  ultima AS (
    SELECT DISTINCT ON (sf.user_id, g.pai_id) sf.user_id, g.pai_id, sf.simulado_id
    FROM public.simulados_finalizados sf
    JOIN grupo g ON g.simulado_id = sf.simulado_id
    WHERE sf.user_id IN (SELECT id FROM alunos)
    ORDER BY sf.user_id, g.pai_id, sf.finalizado_em DESC NULLS LAST
  ),
  ultima_fb AS (
    SELECT DISTINCT ON (ap.user_id, g.pai_id) ap.user_id, g.pai_id, ap.simulado AS simulado_id
    FROM public.answer_progress ap
    JOIN grupo g ON g.simulado_id = ap.simulado
    JOIN public.simulados_admin sa_ord ON sa_ord.id = ap.simulado
    WHERE ap.user_id IN (SELECT id FROM alunos)
      AND NOT EXISTS (SELECT 1 FROM ultima u WHERE u.user_id = ap.user_id AND u.pai_id = g.pai_id)
    ORDER BY ap.user_id, g.pai_id, sa_ord.created_at DESC NULLS LAST
  ),
  tentativas AS (
    SELECT * FROM ultima UNION ALL SELECT * FROM ultima_fb
  ),
  respostas AS (
    SELECT t.user_id, ap.correct, q.grande_area, q.especialidade, q.tema
    FROM tentativas t
    JOIN public.answer_progress ap ON ap.user_id = t.user_id AND ap.simulado = t.simulado_id
    JOIN public.questoes_simulado q ON q.id = ap.question_id
    WHERE COALESCE(q.anulada,false) = false
  ),
  base AS (
    SELECT CASE WHEN p_node IS NULL THEN r.grande_area ELSE r.especialidade END AS nome,
           r.user_id, r.correct
    FROM respostas r
    WHERE (p_node IS NULL AND r.grande_area IS NOT NULL)
       OR (p_node IS NOT NULL AND r.grande_area = p_node AND r.especialidade IS NOT NULL)
  ),
  agg AS (
    SELECT b.nome,
           count(*) AS total,
           count(*) FILTER (WHERE b.correct) AS acertos,
           count(DISTINCT b.user_id) AS amostra
    FROM base b GROUP BY b.nome
  ),
  nos AS (
    SELECT a.nome,
           round(100.0 * a.acertos / NULLIF(a.total,0), 0) AS acerto_pct,
           a.amostra,
           CASE WHEN a.total = 0 THEN NULL
                WHEN 100.0 * a.acertos / a.total <  30 THEN 'critico'
                WHEN 100.0 * a.acertos / a.total >= 80 THEN 'excelente'
                ELSE 'mediano' END AS desempenho,
           CASE
             WHEN p_node IS NULL THEN EXISTS (
               SELECT 1 FROM respostas r2 WHERE r2.grande_area = a.nome AND r2.especialidade IS NOT NULL)
             ELSE EXISTS (
               SELECT 1 FROM respostas r3 WHERE r3.especialidade = a.nome AND r3.tema IS NOT NULL)
           END AS tem_filhos
    FROM agg a
  )
  SELECT jsonb_build_object(
    'data', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id',         n.nome,
               'nome',       n.nome,
               'nivel',      v_nivel,
               'acertoPct',  n.acerto_pct,
               'desempenho', n.desempenho,
               'amostra',    n.amostra,
               'lowSample',  (n.amostra < 10),
               'temFilhos',  n.tem_filhos
             ) ORDER BY n.acerto_pct NULLS LAST, n.nome)
      FROM nos n), '[]'::jsonb),
    'meta', jsonb_build_object(
      'periodo',      'todos os simulados com desempenho liberado para a IES',
      'fonte',        'answer_progress · questoes_simulado · simulados_admin · users',
      'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'criterio',     format('Desempenho em %% de acerto (crítico < 30, mediano 30–80, excelente >= 80) sobre a última tentativa de cada aluno, questão anulada ignorada. Nível retornado: %s. Amostra = alunos distintos com resposta no nó; lowSample quando < 10. Recorte: %s.', v_nivel, v_recorte),
      'partial',      (SELECT count(*) FROM respostas r WHERE r.grande_area IS NULL) > 0,
      'lowSample',    COALESCE((SELECT max(n.amostra) FROM nos n), 0) < 10
    )
  ) INTO v_result;

  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_gestor_diagnostico(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_diagnostico(uuid, text, text) TO authenticated;
```

- [ ] **Step 2: Aplicar em produção (project ref gvqv CONFIRMADO)**

Run: `mcp__supabase__get_project_url`
Expected: `https://gvqvrmkizemwsasmupmo.supabase.co` (se vier `lljn`, PARE e use o `send_message` do Lovable).

Run: `mcp__supabase__apply_migration` com `name: "get_gestor_diagnostico"` e o SQL do Step 1.
Expected: sucesso.

```sql
SELECT position('feature_not_enabled' IN pg_get_functiondef(oid)) > 0 AS tem_guard
FROM pg_proc WHERE proname = 'get_gestor_diagnostico' AND pronamespace = 'public'::regnamespace;
```
Expected: `true`.

- [ ] **Step 3: Verificar como gestor real**

```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<GESTOR_ID>","role":"authenticated"}';
-- nível 1: grandes áreas
SELECT jsonb_pretty(public.get_gestor_diagnostico('<IES_ID>','6ano', NULL));
ROLLBACK;
```
Expected: um item por `grande_area` distinta com resposta na IES; todos com `nivel = 'grande_area'`, `desempenho` em `('critico','mediano','excelente')`, `lowSample = true` só onde `amostra < 10`, `temFilhos = true` quando existe especialidade preenchida.

```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<GESTOR_ID>","role":"authenticated"}';
-- nível 2: especialidades da primeira grande área devolvida acima
SELECT jsonb_pretty(public.get_gestor_diagnostico('<IES_ID>','6ano','<GRANDE_AREA>'));
ROLLBACK;
```
Expected: todos os itens com `nivel = 'especialidade'`; conferência da contagem contra a fonte (como postgres):
```sql
SELECT count(DISTINCT q.especialidade) AS esperado
FROM public.answer_progress ap
JOIN public.questoes_simulado q ON q.id = ap.question_id
JOIN public.users u ON u.id = ap.user_id
WHERE u.id_ies = '<IES_ID>' AND q.grande_area = '<GRANDE_AREA>'
  AND q.especialidade IS NOT NULL AND COALESCE(q.anulada,false) = false;
```
Expected: número de itens do `data` <= `esperado` (menor ou igual, porque a RPC considera apenas a última tentativa e exclui usuários com role).

- [ ] **Step 4: Verificar anon e IES alheia**

```sql
BEGIN; SET LOCAL ROLE anon;
SELECT public.get_gestor_diagnostico('<IES_ID>','geral', NULL);
ROLLBACK;
```
Expected: `42501 permission denied for function get_gestor_diagnostico`.

```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<GESTOR_OUTRA_IES>","role":"authenticated"}';
SELECT public.get_gestor_diagnostico('<IES_ID>','geral', NULL);
ROLLBACK;
```
Expected: `Permission denied: cannot access this IES`.

- [ ] **Step 5: Salvar o .sql e commitar**

```bash
git add supabase/migrations/20260726100400_get_gestor_diagnostico.sql
git commit -m "feat(gestor): RPC get_gestor_diagnostico com cascata lazy por no"
```

---

### Task 19: RPC `get_gestor_diagnostico_temas`

**Files:**
- Create: `supabase/migrations/20260726100500_get_gestor_diagnostico_temas.sql`
- Test: n/a (verificação por query no Step 3)

**Interfaces:**
- Consumes: guards e CTEs de escopo da Task 18
- Produces: `public.get_gestor_diagnostico_temas(p_ies_id uuid, p_semestre text, p_especialidade text)` → `jsonb`:
```json
{ "data": [ { "id":"text", "nome":"text", "acertoPct": 0, "amostra": 0, "lowSample": false } ],
  "meta": { "...": "" } }
```
Espelha `TemaCritico[]`, ordenado do pior para o melhor `acertoPct`. `p_especialidade` é obrigatório.

- [ ] **Step 1: Escrever o SQL completo**

```sql
-- 20260726100500_get_gestor_diagnostico_temas.sql
CREATE OR REPLACE FUNCTION public.get_gestor_diagnostico_temas(p_ies_id uuid, p_semestre text, p_especialidade text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid     uuid := auth.uid();
  v_ies     uuid;
  v_sems    int[];
  v_recorte text;
  v_result  jsonb;
BEGIN
  IF NOT public.user_has_feature('gestao.portal_v2') THEN
    RAISE EXCEPTION 'feature_not_enabled' USING ERRCODE = '42501';
  END IF;

  IF NOT (
       has_role(v_uid,'admin'::app_role)
    OR has_role(v_uid,'gestor'::app_role)
    OR has_role(v_uid,'gestor_grupo'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_especialidade IS NULL OR btrim(p_especialidade) = '' THEN
    RAISE EXCEPTION 'especialidade_obrigatoria' USING ERRCODE = '22023';
  END IF;

  IF p_ies_id IS NOT NULL THEN
    IF NOT public.user_can_access_ies(v_uid, p_ies_id) THEN
      RAISE EXCEPTION 'Permission denied: cannot access this IES';
    END IF;
    v_ies := p_ies_id;
  ELSE
    SELECT u.id_ies INTO v_ies FROM public.users u WHERE u.id = v_uid;
    IF v_ies IS NULL THEN
      v_ies := (public.get_accessible_ies(v_uid))[1];
    END IF;
  END IF;
  IF v_ies IS NULL THEN
    RAISE EXCEPTION 'IES not resolved';
  END IF;

  IF p_semestre IS NULL OR p_semestre = 'geral' THEN
    v_sems := NULL; v_recorte := 'todos os semestres, sem evidência';
  ELSIF p_semestre = '6ano' THEN
    v_sems := NULL; v_recorte := 'todos os semestres, 11º e 12º em evidência';
  ELSIF p_semestre ~ '^(1[0-2]|[1-9])$' THEN
    v_sems := ARRAY[p_semestre::int]; v_recorte := format('somente o %sº semestre', p_semestre);
  ELSE
    RAISE EXCEPTION 'semestre_invalido' USING ERRCODE = '22023';
  END IF;

  WITH sims AS (
    SELECT sa.id
    FROM public.simulados_admin sa
    WHERE v_ies = ANY (sa.ies_ids)
      AND sa.simulado_pai_id IS NULL
      AND sa.status IN ('ativo','encerrado')
      AND (
        sa.liberacao_desempenho = 'imediato'
        OR (sa.liberacao_desempenho = 'agendado'
            AND sa.data_liberacao_desempenho IS NOT NULL
            AND sa.data_liberacao_desempenho <= now())
        OR (sa.liberacao_desempenho = 'ao_encerrar'
            AND (sa.status = 'encerrado'
                 OR (sa.data_encerramento IS NOT NULL AND sa.data_encerramento <= now())))
      )
  ),
  grupo AS (
    SELECT sa.id AS simulado_id, COALESCE(sa.simulado_pai_id, sa.id) AS pai_id
    FROM public.simulados_admin sa
    WHERE COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims)
  ),
  alunos AS (
    SELECT u.id
    FROM public.users u
    WHERE u.id_ies = v_ies
      AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
      AND (v_sems IS NULL OR u.semestre = ANY (v_sems))
  ),
  ultima AS (
    SELECT DISTINCT ON (sf.user_id, g.pai_id) sf.user_id, g.pai_id, sf.simulado_id
    FROM public.simulados_finalizados sf
    JOIN grupo g ON g.simulado_id = sf.simulado_id
    WHERE sf.user_id IN (SELECT id FROM alunos)
    ORDER BY sf.user_id, g.pai_id, sf.finalizado_em DESC NULLS LAST
  ),
  ultima_fb AS (
    SELECT DISTINCT ON (ap.user_id, g.pai_id) ap.user_id, g.pai_id, ap.simulado AS simulado_id
    FROM public.answer_progress ap
    JOIN grupo g ON g.simulado_id = ap.simulado
    JOIN public.simulados_admin sa_ord ON sa_ord.id = ap.simulado
    WHERE ap.user_id IN (SELECT id FROM alunos)
      AND NOT EXISTS (SELECT 1 FROM ultima u WHERE u.user_id = ap.user_id AND u.pai_id = g.pai_id)
    ORDER BY ap.user_id, g.pai_id, sa_ord.created_at DESC NULLS LAST
  ),
  tentativas AS (
    SELECT * FROM ultima UNION ALL SELECT * FROM ultima_fb
  ),
  temas AS (
    SELECT q.tema AS nome,
           count(*) AS total,
           count(*) FILTER (WHERE ap.correct) AS acertos,
           count(DISTINCT t.user_id) AS amostra
    FROM tentativas t
    JOIN public.answer_progress ap ON ap.user_id = t.user_id AND ap.simulado = t.simulado_id
    JOIN public.questoes_simulado q ON q.id = ap.question_id
    WHERE COALESCE(q.anulada,false) = false
      AND q.especialidade = p_especialidade
      AND q.tema IS NOT NULL
    GROUP BY q.tema
  )
  SELECT jsonb_build_object(
    'data', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id',        t.nome,
               'nome',      t.nome,
               'acertoPct', round(100.0 * t.acertos / NULLIF(t.total,0), 0),
               'amostra',   t.amostra,
               'lowSample', (t.amostra < 10)
             ) ORDER BY round(100.0 * t.acertos / NULLIF(t.total,0), 0) NULLS LAST, t.nome)
      FROM temas t), '[]'::jsonb),
    'meta', jsonb_build_object(
      'periodo',      'todos os simulados com desempenho liberado para a IES',
      'fonte',        'answer_progress · questoes_simulado · simulados_admin · users',
      'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'criterio',     format('Tema em %% de acerto sobre a última tentativa de cada aluno, questão anulada ignorada. Proficiência não se aplica a tema. Especialidade: %s. Recorte: %s.', p_especialidade, v_recorte),
      'partial',      false,
      'lowSample',    COALESCE((SELECT max(t.amostra) FROM temas t), 0) < 10
    )
  ) INTO v_result;

  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_gestor_diagnostico_temas(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_diagnostico_temas(uuid, text, text) TO authenticated;
```

- [ ] **Step 2: Aplicar em produção (project ref gvqv CONFIRMADO)**

Run: `mcp__supabase__get_project_url`
Expected: `https://gvqvrmkizemwsasmupmo.supabase.co` (se vier `lljn`, PARE e use o `send_message` do Lovable).

Run: `mcp__supabase__apply_migration` com `name: "get_gestor_diagnostico_temas"` e o SQL do Step 1.
Expected: sucesso.

```sql
SELECT position('feature_not_enabled' IN pg_get_functiondef(oid)) > 0 AS tem_guard
FROM pg_proc WHERE proname = 'get_gestor_diagnostico_temas' AND pronamespace = 'public'::regnamespace;
```
Expected: `true`.

- [ ] **Step 3: Verificar como gestor real**

```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<GESTOR_ID>","role":"authenticated"}';
SELECT jsonb_pretty(public.get_gestor_diagnostico_temas('<IES_ID>','6ano','<ESPECIALIDADE>'));
ROLLBACK;
```
Expected: array ordenado crescente por `acertoPct` (o pior tema primeiro); nenhum item com campo de proficiência; `lowSample = true` só onde `amostra < 10`; `meta.criterio` cita a especialidade passada.

```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<GESTOR_ID>","role":"authenticated"}';
SELECT public.get_gestor_diagnostico_temas('<IES_ID>','6ano', NULL);
ROLLBACK;
```
Expected: erro `22023 especialidade_obrigatoria`.

- [ ] **Step 4: Verificar anon e IES alheia**

```sql
BEGIN; SET LOCAL ROLE anon;
SELECT public.get_gestor_diagnostico_temas('<IES_ID>','geral','<ESPECIALIDADE>');
ROLLBACK;
```
Expected: `42501 permission denied for function get_gestor_diagnostico_temas`.

```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<GESTOR_OUTRA_IES>","role":"authenticated"}';
SELECT public.get_gestor_diagnostico_temas('<IES_ID>','geral','<ESPECIALIDADE>');
ROLLBACK;
```
Expected: `Permission denied: cannot access this IES`.

- [ ] **Step 5: Salvar o .sql e commitar**

```bash
git add supabase/migrations/20260726100500_get_gestor_diagnostico_temas.sql
git commit -m "feat(gestor): RPC get_gestor_diagnostico_temas para o drawer de temas"
```

---

### Task 20: RPC `get_gestor_alunos`

**Files:**
- Create: `supabase/migrations/20260726100600_get_gestor_alunos.sql`
- Test: n/a (verificação por query no Step 3)

**Interfaces:**
- Consumes: guards e CTEs de escopo das Tasks 17/18; `resultados_alunos_tri`
- Produces: `public.get_gestor_alunos(p_ies_id uuid, p_semestre text, p_page int, p_page_size int, p_sort text, p_order text, p_q text)` → `jsonb`:
```json
{ "data": { "data": [ { "id":"uuid", "nome":"text", "semestre": 11,
                        "grupo":"consistentemente_proficiente|em_variacao|consistentemente_nao_proficiente",
                        "proficiencias": [72.5, null, 80.1],
                        "tendencia":"subindo|descendo|alternando|estavel" } ],
             "page": 1, "pageSize": 25, "total": 0, "totalPages": 0 },
  "meta": { "...": "" } }
```
Espelha `Envelope<Paginado<LinhaAluno>>`. `proficiencias` tem **um slot por simulado realizado da janela**, na ordem cronológica, com `null` onde o aluno não participou. `p_sort` aceita `'nome' | 'semestre' | 'proficiencia' | 'tendencia'`; `p_order` aceita `'asc' | 'desc'`; `p_page_size` é limitado a 100.

- [ ] **Step 1: Escrever o SQL completo**

```sql
-- 20260726100600_get_gestor_alunos.sql
CREATE OR REPLACE FUNCTION public.get_gestor_alunos(
  p_ies_id    uuid,
  p_semestre  text,
  p_page      int,
  p_page_size int,
  p_sort      text,
  p_order     text,
  p_q         text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid     uuid := auth.uid();
  v_ies     uuid;
  v_sems    int[];
  v_recorte text;
  v_sort    text;
  v_order   text;
  v_page    int;
  v_size    int;
  v_q       text;
  v_result  jsonb;
BEGIN
  IF NOT public.user_has_feature('gestao.portal_v2') THEN
    RAISE EXCEPTION 'feature_not_enabled' USING ERRCODE = '42501';
  END IF;

  IF NOT (
       has_role(v_uid,'admin'::app_role)
    OR has_role(v_uid,'gestor'::app_role)
    OR has_role(v_uid,'gestor_grupo'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_ies_id IS NOT NULL THEN
    IF NOT public.user_can_access_ies(v_uid, p_ies_id) THEN
      RAISE EXCEPTION 'Permission denied: cannot access this IES';
    END IF;
    v_ies := p_ies_id;
  ELSE
    SELECT u.id_ies INTO v_ies FROM public.users u WHERE u.id = v_uid;
    IF v_ies IS NULL THEN
      v_ies := (public.get_accessible_ies(v_uid))[1];
    END IF;
  END IF;
  IF v_ies IS NULL THEN
    RAISE EXCEPTION 'IES not resolved';
  END IF;

  IF p_semestre IS NULL OR p_semestre = 'geral' THEN
    v_sems := NULL; v_recorte := 'todos os semestres, sem evidência';
  ELSIF p_semestre = '6ano' THEN
    v_sems := NULL; v_recorte := 'todos os semestres, 11º e 12º em evidência';
  ELSIF p_semestre ~ '^(1[0-2]|[1-9])$' THEN
    v_sems := ARRAY[p_semestre::int]; v_recorte := format('somente o %sº semestre', p_semestre);
  ELSE
    RAISE EXCEPTION 'semestre_invalido' USING ERRCODE = '22023';
  END IF;

  v_sort  := lower(COALESCE(NULLIF(btrim(p_sort),''),  'nome'));
  v_order := lower(COALESCE(NULLIF(btrim(p_order),''), 'asc'));
  IF v_sort  NOT IN ('nome','semestre','proficiencia','tendencia') THEN
    RAISE EXCEPTION 'sort_invalido' USING ERRCODE = '22023';
  END IF;
  IF v_order NOT IN ('asc','desc') THEN
    RAISE EXCEPTION 'order_invalido' USING ERRCODE = '22023';
  END IF;
  v_page := GREATEST(COALESCE(p_page, 1), 1);
  v_size := LEAST(GREATEST(COALESCE(p_page_size, 25), 1), 100);
  v_q    := NULLIF(btrim(COALESCE(p_q,'')), '');

  WITH sims AS (
    SELECT sa.id, sa.nome,
           COALESCE(sa.data_realizacao, sa.data_encerramento, sa.data_liberacao, sa.created_at) AS data_ref
    FROM public.simulados_admin sa
    WHERE v_ies = ANY (sa.ies_ids)
      AND sa.simulado_pai_id IS NULL
      AND sa.status IN ('ativo','encerrado')
      AND (
        sa.liberacao_desempenho = 'imediato'
        OR (sa.liberacao_desempenho = 'agendado'
            AND sa.data_liberacao_desempenho IS NOT NULL
            AND sa.data_liberacao_desempenho <= now())
        OR (sa.liberacao_desempenho = 'ao_encerrar'
            AND (sa.status = 'encerrado'
                 OR (sa.data_encerramento IS NOT NULL AND sa.data_encerramento <= now())))
      )
  ),
  sims_ord AS (
    SELECT s.*, row_number() OVER (ORDER BY s.data_ref NULLS LAST, s.nome) AS ord
    FROM sims s
  ),
  alunos AS (
    SELECT u.id, u.nome, u.semestre
    FROM public.users u
    WHERE u.id_ies = v_ies
      AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
      AND (v_sems IS NULL OR u.semestre = ANY (v_sems))
      AND (v_q IS NULL OR u.nome ILIKE '%' || v_q || '%')
  ),
  tri AS (
    SELECT COALESCE(sa.simulado_pai_id, sa.id) AS pai_id, r.student_id, r.score_proprio
    FROM public.resultados_alunos_tri r
    JOIN public.simulados_admin sa ON sa.id = r.simulado_id
    WHERE r.college_id = v_ies
      AND COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims)
      AND r.score_proprio IS NOT NULL
  ),
  sims_com_tri AS (
    SELECT s.* FROM sims_ord s WHERE EXISTS (SELECT 1 FROM tri t WHERE t.pai_id = s.id)
  ),
  aluno_sim AS (
    SELECT a.id, s.ord,
           (SELECT avg(t.score_proprio) FROM tri t WHERE t.student_id = a.id AND t.pai_id = s.id) AS score
    FROM alunos a
    CROSS JOIN sims_com_tri s
  ),
  diffs AS (
    SELECT d.id, d.diff
    FROM (
      SELECT s.id, s.score - lag(s.score) OVER (PARTITION BY s.id ORDER BY s.ord) AS diff
      FROM aluno_sim s WHERE s.score IS NOT NULL
    ) d
    WHERE d.diff IS NOT NULL
  ),
  tend AS (
    SELECT x.id,
           CASE WHEN x.max_d <  1 AND x.min_d > -1 THEN 'estavel'
                WHEN x.min_d >=  1                 THEN 'subindo'
                WHEN x.max_d <= -1                 THEN 'descendo'
                ELSE 'alternando' END AS tendencia
    FROM (SELECT d.id, min(d.diff) AS min_d, max(d.diff) AS max_d FROM diffs d GROUP BY d.id) x
  ),
  agg AS (
    SELECT a.id, a.nome, a.semestre,
           COALESCE((
             SELECT jsonb_agg(CASE WHEN s.score IS NULL THEN 'null'::jsonb
                                   ELSE to_jsonb(round(s.score::numeric, 1)) END ORDER BY s.ord)
             FROM aluno_sim s WHERE s.id = a.id), '[]'::jsonb) AS proficiencias,
           (SELECT count(*) FROM aluno_sim s WHERE s.id = a.id AND s.score IS NOT NULL) AS n_com,
           (SELECT count(*) FROM aluno_sim s WHERE s.id = a.id AND s.score >= 60)       AS n_prof,
           (SELECT s.score FROM aluno_sim s WHERE s.id = a.id AND s.score IS NOT NULL
             ORDER BY s.ord DESC LIMIT 1)                                               AS prof_atual,
           COALESCE((SELECT t.tendencia FROM tend t WHERE t.id = a.id), 'estavel')      AS tendencia
    FROM alunos a
  ),
  linhas AS (
    SELECT g.*,
           CASE WHEN g.n_com = 0                 THEN 'em_variacao'
                WHEN g.n_prof = g.n_com          THEN 'consistentemente_proficiente'
                WHEN g.n_prof = 0                THEN 'consistentemente_nao_proficiente'
                ELSE 'em_variacao' END AS grupo
    FROM agg g
  ),
  ordenado AS (
    SELECT l.*, row_number() OVER (
             ORDER BY
               CASE WHEN v_sort='semestre'     AND v_order='asc'  THEN l.semestre    END ASC  NULLS LAST,
               CASE WHEN v_sort='semestre'     AND v_order='desc' THEN l.semestre    END DESC NULLS LAST,
               CASE WHEN v_sort='proficiencia' AND v_order='asc'  THEN l.prof_atual  END ASC  NULLS LAST,
               CASE WHEN v_sort='proficiencia' AND v_order='desc' THEN l.prof_atual  END DESC NULLS LAST,
               CASE WHEN v_sort='tendencia'    AND v_order='asc'  THEN l.tendencia   END ASC,
               CASE WHEN v_sort='tendencia'    AND v_order='desc' THEN l.tendencia   END DESC,
               CASE WHEN v_sort='nome'         AND v_order='desc' THEN l.nome        END DESC,
               l.nome ASC
           ) AS rn
    FROM linhas l
  ),
  totais AS (SELECT count(*) AS total FROM linhas)
  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'data', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'id',            o.id,
                 'nome',          o.nome,
                 'semestre',      o.semestre,
                 'grupo',         o.grupo,
                 'proficiencias', o.proficiencias,
                 'tendencia',     o.tendencia
               ) ORDER BY o.rn)
        FROM ordenado o
        WHERE o.rn > (v_page - 1) * v_size AND o.rn <= v_page * v_size), '[]'::jsonb),
      'page',       v_page,
      'pageSize',   v_size,
      'total',      (SELECT total FROM totais),
      'totalPages', CASE WHEN (SELECT total FROM totais) = 0 THEN 0
                         ELSE ceil((SELECT total FROM totais)::numeric / v_size)::int END
    ),
    'meta', jsonb_build_object(
      'periodo',      COALESCE((SELECT to_char(min(s.data_ref),'DD/MM/YYYY') || ' — ' || to_char(max(s.data_ref),'DD/MM/YYYY')
                                FROM sims_com_tri s), 'sem simulado com resultado'),
      'fonte',        'resultados_alunos_tri · simulados_admin · users',
      'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'criterio',     format('Uma posição em proficiencias por simulado com TRI na janela, em ordem cronológica; null onde o aluno não participou (nunca 0). Grupo: todas proficientes (>= 60) = consistentemente_proficiente; nenhuma = consistentemente_nao_proficiente; misto ou sem resultado = em_variacao. Tendência sobre variações consecutivas: todas >= +1 subindo, todas <= -1 descendo, |variação| < 1 estável, senão alternando. Ordenação: %s %s. Recorte: %s.', v_sort, v_order, v_recorte),
      'partial',      (SELECT count(*) FROM sims_ord) > (SELECT count(*) FROM sims_com_tri),
      'lowSample',    (SELECT total FROM totais) < 10
    )
  ) INTO v_result;

  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_gestor_alunos(uuid, text, int, int, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_alunos(uuid, text, int, int, text, text, text) TO authenticated;
```

- [ ] **Step 2: Aplicar em produção (project ref gvqv CONFIRMADO)**

Run: `mcp__supabase__get_project_url`
Expected: `https://gvqvrmkizemwsasmupmo.supabase.co` (se vier `lljn`, PARE e use o `send_message` do Lovable).

Run: `mcp__supabase__apply_migration` com `name: "get_gestor_alunos"` e o SQL do Step 1.
Expected: sucesso.

```sql
SELECT position('feature_not_enabled' IN pg_get_functiondef(oid)) > 0 AS tem_guard
FROM pg_proc WHERE proname = 'get_gestor_alunos' AND pronamespace = 'public'::regnamespace;
```
Expected: `true`.

- [ ] **Step 3: Verificar como gestor real**

```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<GESTOR_ID>","role":"authenticated"}';
SELECT jsonb_pretty(public.get_gestor_alunos('<IES_ID>','6ano', 1, 5, 'nome', 'asc', NULL));
ROLLBACK;
```
Expected: `data.data` com no máximo 5 linhas ordenadas por nome; `data.total` = total de alunos da IES sem role; `data.totalPages = ceil(total/5)`; em cada linha, `proficiencias` é um array com o mesmo comprimento para todos os alunos (um por simulado com TRI) e usa `null` — nunca `0` — onde não houve participação; `tendencia` em `('subindo','descendo','alternando','estavel')`.

Paginação e ordenação:
```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<GESTOR_ID>","role":"authenticated"}';
SELECT public.get_gestor_alunos('<IES_ID>','geral', 2, 5, 'proficiencia', 'desc', NULL) #>> '{data,page}'   AS page,
       public.get_gestor_alunos('<IES_ID>','geral', 2, 5, 'proficiencia', 'desc', NULL) #>> '{data,pageSize}' AS size;
ROLLBACK;
```
Expected: `page = 2`, `size = 5`, e nenhum id repetido entre página 1 e 2.

Busca e validação de parâmetro:
```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<GESTOR_ID>","role":"authenticated"}';
SELECT public.get_gestor_alunos('<IES_ID>','geral', 1, 25, 'nome', 'asc', 'ana') #>> '{data,total}';
SELECT public.get_gestor_alunos('<IES_ID>','geral', 1, 25, 'email', 'asc', NULL);
ROLLBACK;
```
Expected: primeira query devolve um total menor ou igual ao total sem busca; a segunda falha com `22023 sort_invalido`.

- [ ] **Step 4: Verificar anon e IES alheia**

```sql
BEGIN; SET LOCAL ROLE anon;
SELECT public.get_gestor_alunos('<IES_ID>','geral',1,25,'nome','asc',NULL);
ROLLBACK;
```
Expected: `42501 permission denied for function get_gestor_alunos`.

```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<GESTOR_OUTRA_IES>","role":"authenticated"}';
SELECT public.get_gestor_alunos('<IES_ID>','geral',1,25,'nome','asc',NULL);
ROLLBACK;
```
Expected: `Permission denied: cannot access this IES` — nenhum nome de aluno da IES alvo aparece.

- [ ] **Step 5: Salvar o .sql e commitar**

```bash
git add supabase/migrations/20260726100600_get_gestor_alunos.sql
git commit -m "feat(gestor): RPC get_gestor_alunos paginada no servidor com grupo e tendencia"
```

---

### Task 21: RPC `get_gestor_aluno`

**Files:**
- Create: `supabase/migrations/20260726100700_get_gestor_aluno.sql`
- Test: n/a (verificação por query no Step 3)

**Interfaces:**
- Consumes: guards e CTEs de escopo das Tasks 17/20
- Produces: `public.get_gestor_aluno(p_ies_id uuid, p_aluno_id uuid, p_simulados uuid[])` → `jsonb` com `data` = **array de uma entrada por simulado da janela**, cada entrada no formato `AlunoNoSimulado` acrescido de `simuladoId`, `simuladoNome` e `simuladoData` (a fatia de front tipa como `(AlunoNoSimulado & { simuladoId: string; simuladoNome: string; simuladoData: string })[]`):
```json
{ "data": [ { "id":"uuid-do-aluno", "nome":"text", "semestre": 11,
              "simuladoId":"uuid", "simuladoNome":"text", "simuladoData":"ISO-8601",
              "participou": true, "acertos": 42, "proficiencia": 71.3,
              "situacao":"proficiente|abaixo_do_limiar|nao_participou",
              "posicao": { "lugar": 12, "total": 88, "percentil": 86 },
              "acertoPorArea": [ { "area":"text", "acertoPct": 55, "critica": false } ],
              "variacao": 3.2 } ],
  "meta": { "...": "" } }
```
`p_simulados` `NULL` = todos os simulados elegíveis da janela. Quando `participou = false`: `acertos`, `proficiencia`, `posicao`, `acertoPorArea` e `variacao` são `null` e `situacao = 'nao_participou'`.
**Nota de conformidade (§7.7):** a trilha de auditoria de acesso a dado nominal **não** entra aqui — a função é `STABLE` e não pode escrever. A auditoria fica como evento de telemetria da fatia de front (`gestor_drawer_aberto`) ou como RPC `VOLATILE` própria, fora desta fase.

- [ ] **Step 1: Escrever o SQL completo**

```sql
-- 20260726100700_get_gestor_aluno.sql
CREATE OR REPLACE FUNCTION public.get_gestor_aluno(p_ies_id uuid, p_aluno_id uuid, p_simulados uuid[])
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid    uuid := auth.uid();
  v_ies    uuid;
  v_result jsonb;
BEGIN
  IF NOT public.user_has_feature('gestao.portal_v2') THEN
    RAISE EXCEPTION 'feature_not_enabled' USING ERRCODE = '42501';
  END IF;

  IF NOT (
       has_role(v_uid,'admin'::app_role)
    OR has_role(v_uid,'gestor'::app_role)
    OR has_role(v_uid,'gestor_grupo'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_ies_id IS NOT NULL THEN
    IF NOT public.user_can_access_ies(v_uid, p_ies_id) THEN
      RAISE EXCEPTION 'Permission denied: cannot access this IES';
    END IF;
    v_ies := p_ies_id;
  ELSE
    SELECT u.id_ies INTO v_ies FROM public.users u WHERE u.id = v_uid;
    IF v_ies IS NULL THEN
      v_ies := (public.get_accessible_ies(v_uid))[1];
    END IF;
  END IF;
  IF v_ies IS NULL THEN
    RAISE EXCEPTION 'IES not resolved';
  END IF;

  IF p_aluno_id IS NULL THEN
    RAISE EXCEPTION 'aluno_obrigatorio' USING ERRCODE = '22023';
  END IF;

  -- não revela existência de aluno fora da IES do gestor
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = p_aluno_id
      AND u.id_ies = v_ies
      AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
  ) THEN
    RAISE EXCEPTION 'aluno_nao_encontrado' USING ERRCODE = '42501';
  END IF;

  WITH sims AS (
    SELECT sa.id, sa.nome,
           COALESCE(sa.data_realizacao, sa.data_encerramento, sa.data_liberacao, sa.created_at) AS data_ref
    FROM public.simulados_admin sa
    WHERE v_ies = ANY (sa.ies_ids)
      AND sa.simulado_pai_id IS NULL
      AND sa.status IN ('ativo','encerrado')
      AND (
        sa.liberacao_desempenho = 'imediato'
        OR (sa.liberacao_desempenho = 'agendado'
            AND sa.data_liberacao_desempenho IS NOT NULL
            AND sa.data_liberacao_desempenho <= now())
        OR (sa.liberacao_desempenho = 'ao_encerrar'
            AND (sa.status = 'encerrado'
                 OR (sa.data_encerramento IS NOT NULL AND sa.data_encerramento <= now())))
      )
      AND (p_simulados IS NULL OR array_length(p_simulados,1) IS NULL OR sa.id = ANY (p_simulados))
  ),
  sims_ord AS (
    SELECT s.*, row_number() OVER (ORDER BY s.data_ref NULLS LAST, s.nome) AS ord FROM sims s
  ),
  grupo AS (
    SELECT sa.id AS simulado_id, COALESCE(sa.simulado_pai_id, sa.id) AS pai_id
    FROM public.simulados_admin sa
    WHERE COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims)
  ),
  alunos AS (
    SELECT u.id, u.nome, u.semestre
    FROM public.users u
    WHERE u.id_ies = v_ies
      AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
  ),
  ultima AS (
    SELECT DISTINCT ON (sf.user_id, g.pai_id) sf.user_id, g.pai_id, sf.simulado_id
    FROM public.simulados_finalizados sf
    JOIN grupo g ON g.simulado_id = sf.simulado_id
    WHERE sf.user_id IN (SELECT id FROM alunos)
    ORDER BY sf.user_id, g.pai_id, sf.finalizado_em DESC NULLS LAST
  ),
  ultima_fb AS (
    SELECT DISTINCT ON (ap.user_id, g.pai_id) ap.user_id, g.pai_id, ap.simulado AS simulado_id
    FROM public.answer_progress ap
    JOIN grupo g ON g.simulado_id = ap.simulado
    JOIN public.simulados_admin sa_ord ON sa_ord.id = ap.simulado
    WHERE ap.user_id IN (SELECT id FROM alunos)
      AND NOT EXISTS (SELECT 1 FROM ultima u WHERE u.user_id = ap.user_id AND u.pai_id = g.pai_id)
    ORDER BY ap.user_id, g.pai_id, sa_ord.created_at DESC NULLS LAST
  ),
  tentativas AS (SELECT * FROM ultima UNION ALL SELECT * FROM ultima_fb),
  tri AS (
    SELECT COALESCE(sa.simulado_pai_id, sa.id) AS pai_id, r.student_id, r.score_proprio, r.num_correct
    FROM public.resultados_alunos_tri r
    JOIN public.simulados_admin sa ON sa.id = r.simulado_id
    WHERE r.college_id = v_ies
      AND COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims)
  ),
  areas_ies AS (   -- áreas críticas da instituição na janela (para o flag `critica`)
    SELECT q.grande_area AS area,
           count(*) AS total, count(*) FILTER (WHERE ap.correct) AS acertos
    FROM tentativas t
    JOIN public.answer_progress ap ON ap.user_id = t.user_id AND ap.simulado = t.simulado_id
    JOIN public.questoes_simulado q ON q.id = ap.question_id
    WHERE COALESCE(q.anulada,false) = false AND q.grande_area IS NOT NULL
    GROUP BY q.grande_area
  ),
  linha AS (
    SELECT s.id AS pai_id, s.nome, s.data_ref, s.ord,
           EXISTS (SELECT 1 FROM tentativas t WHERE t.user_id = p_aluno_id AND t.pai_id = s.id) AS participou,
           (SELECT count(*) FILTER (WHERE ap.correct)
              FROM tentativas t
              JOIN public.answer_progress ap ON ap.user_id = t.user_id AND ap.simulado = t.simulado_id
              JOIN public.questoes_simulado q ON q.id = ap.question_id
             WHERE t.user_id = p_aluno_id AND t.pai_id = s.id AND COALESCE(q.anulada,false) = false) AS acertos_calc,
           (SELECT max(tr.score_proprio) FROM tri tr WHERE tr.student_id = p_aluno_id AND tr.pai_id = s.id) AS proficiencia,
           (SELECT count(*) FROM tri tr WHERE tr.pai_id = s.id AND tr.score_proprio IS NOT NULL) AS n_total,
           (SELECT count(*) FROM tri tr WHERE tr.pai_id = s.id AND tr.score_proprio >
                   COALESCE((SELECT max(t2.score_proprio) FROM tri t2 WHERE t2.student_id = p_aluno_id AND t2.pai_id = s.id), -1)) AS n_acima
    FROM sims_ord s
  ),
  linha_var AS (
    SELECT l.*,
           l.proficiencia - lag(l.proficiencia) OVER (ORDER BY l.ord) AS variacao
    FROM linha l
  )
  SELECT jsonb_build_object(
    'data', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id',           p_aluno_id,
               'nome',         (SELECT a.nome FROM alunos a WHERE a.id = p_aluno_id),
               'semestre',     (SELECT a.semestre FROM alunos a WHERE a.id = p_aluno_id),
               'simuladoId',   lv.pai_id,
               'simuladoNome', lv.nome,
               'simuladoData', to_char(lv.data_ref AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
               'participou',   lv.participou,
               'acertos',      CASE WHEN lv.participou THEN lv.acertos_calc END,
               'proficiencia', CASE WHEN lv.proficiencia IS NULL THEN NULL
                                    ELSE round(lv.proficiencia::numeric, 1) END,
               'situacao',     CASE WHEN NOT lv.participou           THEN 'nao_participou'
                                    WHEN lv.proficiencia IS NULL     THEN 'abaixo_do_limiar'
                                    WHEN lv.proficiencia >= 60       THEN 'proficiente'
                                    ELSE 'abaixo_do_limiar' END,
               'posicao',      CASE WHEN lv.proficiencia IS NOT NULL AND lv.n_total > 0
                                    THEN jsonb_build_object(
                                           'lugar',     lv.n_acima + 1,
                                           'total',     lv.n_total,
                                           'percentil', round(100.0 * (lv.n_total - lv.n_acima) / lv.n_total, 0))
                               END,
               'acertoPorArea', CASE WHEN lv.participou THEN COALESCE((
                                  SELECT jsonb_agg(jsonb_build_object(
                                           'area',      x.area,
                                           'acertoPct', round(100.0 * x.acertos / NULLIF(x.total,0), 0),
                                           'critica',   COALESCE((SELECT (100.0 * ai.acertos / NULLIF(ai.total,0)) < 30
                                                                  FROM areas_ies ai WHERE ai.area = x.area), false)
                                         ) ORDER BY x.area)
                                  FROM (
                                    SELECT q.grande_area AS area,
                                           count(*) AS total,
                                           count(*) FILTER (WHERE ap.correct) AS acertos
                                    FROM tentativas t
                                    JOIN public.answer_progress ap ON ap.user_id = t.user_id AND ap.simulado = t.simulado_id
                                    JOIN public.questoes_simulado q ON q.id = ap.question_id
                                    WHERE t.user_id = p_aluno_id AND t.pai_id = lv.pai_id
                                      AND COALESCE(q.anulada,false) = false AND q.grande_area IS NOT NULL
                                    GROUP BY q.grande_area
                                  ) x), '[]'::jsonb) END,
               'variacao',     CASE WHEN lv.variacao IS NULL THEN NULL ELSE round(lv.variacao::numeric, 1) END
             ) ORDER BY lv.ord)
      FROM linha_var lv), '[]'::jsonb),
    'meta', jsonb_build_object(
      'periodo',      COALESCE((SELECT to_char(min(s.data_ref),'DD/MM/YYYY') || ' — ' || to_char(max(s.data_ref),'DD/MM/YYYY')
                                FROM sims_ord s), 'sem simulado na seleção'),
      'fonte',        'resultados_alunos_tri · answer_progress · questoes_simulado · simulados_admin · users',
      'atualizadoEm', to_char(now() AT TIME ZONE 'UT
C',"YYYY-MM-DD\"T\"HH24:MI:SS\"Z\""),
      'criterio',    'Proficiência = score_proprio (0–100); proficiente >= 60. Aluno que não participou: participou=false e todas as métricas null, nunca 0. Posição calculada só entre alunos com proficiência no mesmo simulado. Variação = diferença de proficiência em relação ao simulado imediatamente anterior da seleção; null quando falta um dos dois valores. acertoPorArea em % de acerto, questão anulada ignorada.',
      'partial',     (SELECT count(*) FROM linha_var WHERE participou AND proficiencia IS NULL) > 0,
      'lowSample',   COALESCE((SELECT max(lv.n_total) FROM linha_var lv), 0) < 10
    )
  ) INTO v_result;

  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_gestor_aluno(uuid, uuid, uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_aluno(uuid, uuid, uuid[]) TO authenticated;
```

- [ ] **Step 2: Aplicar em produção (project ref gvqv CONFIRMADO)**

Run: `mcp__supabase__get_project_url`
Expected: `https://gvqvrmkizemwsasmupmo.supabase.co` (se vier `lljn`, PARE e aplique via `send_message` do MCP do Lovable com o SQL do Step 1).

Run: `mcp__supabase__apply_migration` com `name: "get_gestor_aluno"` e o SQL do Step 1.
Expected: sucesso.

```sql
SELECT position('feature_not_enabled' IN pg_get_functiondef(oid)) > 0 AS tem_guard, provolatile, prosecdef
FROM pg_proc WHERE proname = 'get_gestor_aluno' AND pronamespace = 'public'::regnamespace;
```
Expected: `true`, `s`, `true`.

- [ ] **Step 3: Verificar como gestor real**

Escolher um aluno da IES com resultado:
```sql
-- como postgres
SELECT a.student_id FROM public.resultados_alunos_tri a
WHERE a.college_id = '<IES_ID>' AND a.score_proprio IS NOT NULL LIMIT 1;
```
```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<GESTOR_ID>","role":"authenticated"}';
SELECT jsonb_pretty(public.get_gestor_aluno('<IES_ID>','<ALUNO_COM_TRI>', NULL));
ROLLBACK;
```
Expected: uma entrada por simulado da janela, em ordem cronológica; na entrada mais antiga `variacao = null`; onde `participou = false`, os campos `acertos`, `proficiencia`, `acertoPorArea` e `posicao` são `null` e `situacao = "nao_participou"`; onde há proficiência, `posicao.lugar <= posicao.total` e `percentil` entre 0 e 100; `situacao = "proficiente"` exatamente quando `proficiencia >= 60`.

Recorte por seleção de simulados:
```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<GESTOR_ID>","role":"authenticated"}';
SELECT jsonb_array_length(public.get_gestor_aluno('<IES_ID>','<ALUNO_COM_TRI>', ARRAY['<SIMULADO_ID>']::uuid[]) -> 'data');
ROLLBACK;
```
Expected: `1`.

Corte de proficiente (§4.3, caso de teste nº1) conferido contra a fonte:
```sql
-- como postgres: existe algum aluno com score exatamente 60?
SELECT student_id, simulado_id, score_proprio, is_proficient_proprio
FROM public.resultados_alunos_tri
WHERE college_id = '<IES_ID>' AND score_proprio BETWEEN 59.5 AND 60.5
LIMIT 5;
```
Expected: se houver linha com `score_proprio = 60`, a RPC devolve `situacao = "proficiente"` para ela; com `59.9`, devolve `"abaixo_do_limiar"`.

- [ ] **Step 4: Verificar anon, aluno de outra IES e IES alheia**

```sql
BEGIN; SET LOCAL ROLE anon;
SELECT public.get_gestor_aluno('<IES_ID>','<ALUNO_COM_TRI>', NULL);
ROLLBACK;
```
Expected: `42501 permission denied for function get_gestor_aluno`.

```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<GESTOR_ID>","role":"authenticated"}';
SELECT public.get_gestor_aluno('<IES_ID>','<ALUNO_DE_OUTRA_IES>', NULL);
ROLLBACK;
```
Expected: erro `42501 aluno_nao_encontrado` — mensagem idêntica para aluno inexistente e para aluno de outra IES (não revela existência).

```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<GESTOR_OUTRA_IES>","role":"authenticated"}';
SELECT public.get_gestor_aluno('<IES_ID>','<ALUNO_COM_TRI>', NULL);
ROLLBACK;
```
Expected: `Permission denied: cannot access this IES`.

- [ ] **Step 5: Salvar o .sql e commitar**

```bash
git add supabase/migrations/20260726100700_get_gestor_aluno.sql
git commit -m "feat(gestor): RPC get_gestor_aluno para o drawer nominal do aluno"
```

---

### Task 22: RPC `get_gestor_detalhamento`

**Files:**
- Create: `supabase/migrations/20260726100800_get_gestor_detalhamento.sql`
- Test: n/a (verificação por query no Step 3)

**Interfaces:**
- Consumes: guards e CTEs de escopo das Tasks 17/21
- Produces: `public.get_gestor_detalhamento(p_ies_id uuid, p_semestre text, p_simulados uuid[])` → `jsonb` com `data` na forma da interface `Detalhamento`:
```json
{ "data": {
    "metricas": [ { "simuladoId":"uuid", "nome":"text", "data":"ISO-8601", "participantes": 88,
                    "acertoMedioPct": 57, "enamedProjetado": 3, "proficienciaMedia": 62.4 } ],
    "acertoPorAreaESemestre": {
      "areas":    [ { "id":"text", "nome":"text", "acertoPct": 55, "critica": false } ],
      "semestres":[ { "semestre": 11, "acertoPct": 61, "emEvidencia": true } ] },
    "dispersao": [ { "alunoId":"uuid", "semestre": 11, "nota": 72.5 } ],
    "questoes":  { "data": [ /* Questao */ ], "page":1, "pageSize":20, "total":0, "totalPages":0 },
    "comparativoTemas": [ { "tema":"text", "porSimulado": [ { "simuladoId":"uuid", "acertoPct": 44 } ] } ] },
  "meta": { "...": "" } }
```
Invariantes garantidas no servidor: **sempre uma entrada em `metricas` por simulado selecionado, nunca média única**; `questoes` presente **somente** quando `array_length(p_simulados,1) = 1` (senão a chave vem `null`); `comparativoTemas` presente **somente** quando `>= 2` (senão `null`); `p_simulados` nulo/vazio → erro `selecao_de_simulados_obrigatoria`. `acertoPorAreaESemestre.recorte` não é devolvido (o clique cruzado é estado de front).

- [ ] **Step 1: Escrever o SQL completo**

```sql
-- 20260726100800_get_gestor_detalhamento.sql
CREATE OR REPLACE FUNCTION public.get_gestor_detalhamento(p_ies_id uuid, p_semestre text, p_simulados uuid[])
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid     uuid := auth.uid();
  v_ies     uuid;
  v_sems    int[];
  v_evid    int[];
  v_recorte text;
  v_n       int;
  v_result  jsonb;
BEGIN
  IF NOT public.user_has_feature('gestao.portal_v2') THEN
    RAISE EXCEPTION 'feature_not_enabled' USING ERRCODE = '42501';
  END IF;

  IF NOT (
       has_role(v_uid,'admin'::app_role)
    OR has_role(v_uid,'gestor'::app_role)
    OR has_role(v_uid,'gestor_grupo'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_simulados IS NULL OR array_length(p_simulados,1) IS NULL THEN
    RAISE EXCEPTION 'selecao_de_simulados_obrigatoria' USING ERRCODE = '22023';
  END IF;
  v_n := array_length(p_simulados,1);

  IF p_ies_id IS NOT NULL THEN
    IF NOT public.user_can_access_ies(v_uid, p_ies_id) THEN
      RAISE EXCEPTION 'Permission denied: cannot access this IES';
    END IF;
    v_ies := p_ies_id;
  ELSE
    SELECT u.id_ies INTO v_ies FROM public.users u WHERE u.id = v_uid;
    IF v_ies IS NULL THEN
      v_ies := (public.get_accessible_ies(v_uid))[1];
    END IF;
  END IF;
  IF v_ies IS NULL THEN
    RAISE EXCEPTION 'IES not resolved';
  END IF;

  IF p_semestre IS NULL OR p_semestre = 'geral' THEN
    v_sems := NULL; v_evid := NULL; v_recorte := 'todos os semestres, sem evidência';
  ELSIF p_semestre = '6ano' THEN
    v_sems := NULL; v_evid := ARRAY[11,12]; v_recorte := 'todos os semestres, 11º e 12º em evidência';
  ELSIF p_semestre ~ '^(1[0-2]|[1-9])$' THEN
    v_sems := ARRAY[p_semestre::int]; v_evid := v_sems;
    v_recorte := format('somente o %sº semestre', p_semestre);
  ELSE
    RAISE EXCEPTION 'semestre_invalido' USING ERRCODE = '22023';
  END IF;

  -- todo simulado pedido tem de ser elegível para esta IES
  IF EXISTS (
    SELECT 1 FROM unnest(p_simulados) AS pedido(id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.simulados_admin sa
      WHERE sa.id = pedido.id
        AND v_ies = ANY (sa.ies_ids)
        AND sa.simulado_pai_id IS NULL
        AND sa.status IN ('ativo','encerrado')
        AND (
          sa.liberacao_desempenho = 'imediato'
          OR (sa.liberacao_desempenho = 'agendado'
              AND sa.data_liberacao_desempenho IS NOT NULL
              AND sa.data_liberacao_desempenho <= now())
          OR (sa.liberacao_desempenho = 'ao_encerrar'
              AND (sa.status = 'encerrado'
                   OR (sa.data_encerramento IS NOT NULL AND sa.data_encerramento <= now())))
        )
    )
  ) THEN
    RAISE EXCEPTION 'simulado_fora_do_escopo' USING ERRCODE = '42501';
  END IF;

  WITH sims AS (
    SELECT sa.id, sa.nome,
           COALESCE(sa.data_realizacao, sa.data_encerramento, sa.data_liberacao, sa.created_at) AS data_ref
    FROM public.simulados_admin sa
    WHERE sa.id = ANY (p_simulados)
  ),
  sims_ord AS (
    SELECT s.*, row_number() OVER (ORDER BY s.data_ref NULLS LAST, s.nome) AS ord FROM sims s
  ),
  grupo AS (
    SELECT sa.id AS simulado_id, COALESCE(sa.simulado_pai_id, sa.id) AS pai_id
    FROM public.simulados_admin sa
    WHERE COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims)
  ),
  alunos AS (
    SELECT u.id, u.semestre
    FROM public.users u
    WHERE u.id_ies = v_ies
      AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
      AND (v_sems IS NULL OR u.semestre = ANY (v_sems))
  ),
  ultima AS (
    SELECT DISTINCT ON (sf.user_id, g.pai_id) sf.user_id, g.pai_id, sf.simulado_id
    FROM public.simulados_finalizados sf
    JOIN grupo g ON g.simulado_id = sf.simulado_id
    WHERE sf.user_id IN (SELECT id FROM alunos)
    ORDER BY sf.user_id, g.pai_id, sf.finalizado_em DESC NULLS LAST
  ),
  ultima_fb AS (
    SELECT DISTINCT ON (ap.user_id, g.pai_id) ap.user_id, g.pai_id, ap.simulado AS simulado_id
    FROM public.answer_progress ap
    JOIN grupo g ON g.simulado_id = ap.simulado
    JOIN public.simulados_admin sa_ord ON sa_ord.id = ap.simulado
    WHERE ap.user_id IN (SELECT id FROM alunos)
      AND NOT EXISTS (SELECT 1 FROM ultima u WHERE u.user_id = ap.user_id AND u.pai_id = g.pai_id)
    ORDER BY ap.user_id, g.pai_id, sa_ord.created_at DESC NULLS LAST
  ),
  tentativas AS (SELECT * FROM ultima UNION ALL SELECT * FROM ultima_fb),
  respostas AS (
    SELECT t.pai_id, t.user_id, a.semestre, ap.correct, ap.question_id,
           q.grande_area, q.tema
    FROM tentativas t
    JOIN alunos a ON a.id = t.user_id
    JOIN public.answer_progress ap ON ap.user_id = t.user_id AND ap.simulado = t.simulado_id
    JOIN public.questoes_simulado q ON q.id = ap.question_id
    WHERE COALESCE(q.anulada,false) = false
  ),
  tri AS (
    SELECT COALESCE(sa.simulado_pai_id, sa.id) AS pai_id, r.student_id, a.semestre, r.score_proprio
    FROM public.resultados_alunos_tri r
    JOIN public.simulados_admin sa ON sa.id = r.simulado_id
    JOIN alunos a ON a.id = r.student_id
    WHERE r.college_id = v_ies
      AND COALESCE(sa.simulado_pai_id, sa.id) IN (SELECT id FROM sims)
      AND r.score_proprio IS NOT NULL
  ),
  metricas AS (
    SELECT s.id, s.nome, s.data_ref, s.ord,
           (SELECT count(DISTINCT r.user_id) FROM respostas r WHERE r.pai_id = s.id) AS n_resp,
           (SELECT count(*) FILTER (WHERE r.correct) FROM respostas r WHERE r.pai_id = s.id) AS acertos,
           (SELECT count(*) FROM respostas r WHERE r.pai_id = s.id) AS total,
           (SELECT count(*) FROM tri t WHERE t.pai_id = s.id) AS n_tri,
           (SELECT count(*) FILTER (WHERE t.score_proprio >= 60) FROM tri t WHERE t.pai_id = s.id) AS n_prof,
           (SELECT avg(t.score_proprio) FROM tri t WHERE t.pai_id = s.id) AS prof_media
    FROM sims_ord s
  ),
  areas AS (
    SELECT r.grande_area AS area,
           count(*) AS total, count(*) FILTER (WHERE r.correct) AS acertos
    FROM respostas r WHERE r.grande_area IS NOT NULL GROUP BY r.grande_area
  ),
  semestres AS (
    SELECT r.semestre,
           count(*) AS total, count(*) FILTER (WHERE r.correct) AS acertos
    FROM respostas r WHERE r.semestre IS NOT NULL GROUP BY r.semestre
  ),
  dispersao AS (
    SELECT DISTINCT ON (t.student_id) t.student_id, t.semestre, t.score_proprio
    FROM tri t JOIN metricas m ON m.id = t.pai_id
    ORDER BY t.student_id, m.ord DESC
  ),
  -- questões: só quando exatamente 1 simulado (primeira página, 20 itens)
  q_base AS (
    SELECT q.id, COALESCE(q.numero_questao, q.ordem) AS numero,
           q.grande_area, q.especialidade, q.tema, q.enunciado, upper(q.correta) AS correta,
           q.alternativa_a, q.alternativa_b, q.alternativa_c, q.alternativa_d, q.alternativa_e
    FROM public.questoes_simulado q
    WHERE v_n = 1
      AND q.simulado_id IN (SELECT g.simulado_id FROM grupo g)
      AND COALESCE(q.anulada,false) = false
  ),
  q_resp AS (
    SELECT ap.question_id,
           count(*) AS total,
           count(*) FILTER (WHERE ap.correct) AS acertos,
           count(*) FILTER (WHERE upper(ap.resposta_usuario) IN ('A','B','C','D','E')) AS marcadas,
           count(*) FILTER (WHERE upper(ap.resposta_usuario) = 'A') AS m_a,
           count(*) FILTER (WHERE upper(ap.resposta_usuario) = 'B') AS m_b,
           count(*) FILTER (WHERE upper(ap.resposta_usuario) = 'C') AS m_c,
           count(*) FILTER (WHERE upper(ap.resposta_usuario) = 'D') AS m_d,
           count(*) FILTER (WHERE upper(ap.resposta_usuario) = 'E') AS m_e
    FROM tentativas t
    JOIN public.answer_progress ap ON ap.user_id = t.user_id AND ap.simulado = t.simulado_id
    GROUP BY ap.question_id
  ),
  q_full AS (
    SELECT b.*, COALESCE(r.total,0) AS total, COALESCE(r.acertos,0) AS acertos,
           COALESCE(r.marcadas,0) AS marcadas,
           COALESCE(r.m_a,0) AS m_a, COALESCE(r.m_b,0) AS m_b, COALESCE(r.m_c,0) AS m_c,
           COALESCE(r.m_d,0) AS m_d, COALESCE(r.m_e,0) AS m_e,
           CASE WHEN COALESCE(r.total,0) > 0 THEN round(100.0 * r.acertos / r.total, 0) END AS acerto_pct
    FROM q_base b LEFT JOIN q_resp r ON r.question_id = b.id
  ),
  q_alts AS (
    SELECT f.id,
           jsonb_agg(jsonb_build_object(
             'letra',      a.letra,
             'texto',      a.texto,
             'correta',    (a.letra = f.correta),
             'marcadaPct', CASE WHEN f.marcadas > 0 THEN round(100.0 * a.n / f.marcadas, 0) END
           ) ORDER BY a.letra) AS alternativas,
           (SELECT d.letra FROM (VALUES ('A',f.m_a),('B',f.m_b),('C',f.m_c),('D',f.m_d),('E',f.m_e)) AS d(letra,n)
             WHERE d.letra <> f.correta AND d.n > 0 ORDER BY d.n DESC, d.letra LIMIT 1) AS distrator
    FROM q_full f
    CROSS JOIN LATERAL (VALUES
      ('A', f.alternativa_a, f.m_a), ('B', f.alternativa_b, f.m_b), ('C', f.alternativa_c, f.m_c),
      ('D', f.alternativa_d, f.m_d), ('E', f.alternativa_e, f.m_e)
    ) AS a(letra, texto, n)
    WHERE a.texto IS NOT NULL
    GROUP BY f.id, f.correta, f.marcadas, f.m_a, f.m_b, f.m_c, f.m_d, f.m_e
  ),
  q_page AS (
    SELECT f.*, al.alternativas, al.distrator,
           row_number() OVER (ORDER BY f.numero) AS rn
    FROM q_full f JOIN q_alts al ON al.id = f.id
  ),
  temas_cmp AS (
    SELECT r.tema, r.pai_id,
           count(*) AS total, count(*) FILTER (WHERE r.correct) AS acertos
    FROM respostas r
    WHERE v_n >= 2 AND r.tema IS NOT NULL
    GROUP BY r.tema, r.pai_id
  )
  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'metricas', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'simuladoId',        m.id,
                 'nome',              m.nome,
                 'data',              to_char(m.data_ref AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                 'participantes',     GREATEST(m.n_resp, m.n_tri),
                 'acertoMedioPct',    CASE WHEN m.total > 0 THEN round(100.0 * m.acertos / m.total, 0) END,
                 'enamedProjetado',   CASE WHEN m.n_tri = 0 THEN NULL
                                           WHEN 100.0 * m.n_prof / m.n_tri >= 90 THEN 5
                                           WHEN 100.0 * m.n_prof / m.n_tri >= 75 THEN 4
                                           WHEN 100.0 * m.n_prof / m.n_tri >= 60 THEN 3
                                           WHEN 100.0 * m.n_prof / m.n_tri >= 40 THEN 2
                                           ELSE 1 END,
                 'proficienciaMedia', CASE WHEN m.prof_media IS NULL THEN NULL
                                           ELSE round(m.prof_media::numeric, 1) END
               ) ORDER BY m.ord)
        FROM metricas m), '[]'::jsonb),
      'acertoPorAreaESemestre', jsonb_build_object(
        'areas', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
                   'id',        a.area,
                   'nome',      a.area,
                   'acertoPct', round(100.0 * a.acertos / NULLIF(a.total,0), 0),
                   'critica',   COALESCE((100.0 * a.acertos / NULLIF(a.total,0)) < 30, false)
                 ) ORDER BY a.area)
          FROM areas a), '[]'::jsonb),
        'semestres', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
                   'semestre',    s.semestre,
                   'acertoPct',   round(100.0 * s.acertos / NULLIF(s.total,0), 0),
                   'emEvidencia', COALESCE(s.semestre = ANY (v_evid), false)
                 ) ORDER BY s.semestre)
          FROM semestres s), '[]'::jsonb)
      ),
      'dispersao', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'alunoId',  d.student_id,
                 'semestre', d.semestre,
                 'nota',     round(d.score_proprio::numeric, 1)))
        FROM dispersao d WHERE d.semestre IS NOT NULL), '[]'::jsonb),
      'questoes', CASE WHEN v_n = 1 THEN jsonb_build_object(
        'data', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
                   'numero',       p.numero,
                   'grandeArea',   p.grande_area,
                   'especialidade',p.especialidade,
                   'tema',         p.tema,
                   'acertoPct',    p.acerto_pct,
                   'enunciado',    p.enunciado,
                   'alternativas', p.alternativas,
                   'distratorDominante', p.distrator
                 ) ORDER BY p.rn)
          FROM q_page p WHERE p.rn <= 20), '[]'::jsonb),
        'page',       1,
        'pageSize',   20,
        'total',      (SELECT count(*) FROM q_page),
        'totalPages', CASE WHEN (SELECT count(*) FROM q_page) = 0 THEN 0
                           ELSE ceil((SELECT count(*) FROM q_page)::numeric / 20)::int END
      ) END,
      'comparativoTemas', CASE WHEN v_n >= 2 THEN COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'tema', t.tema,
                 'porSimulado', COALESCE((
                   SELECT jsonb_agg(jsonb_build_object(
                            'simuladoId', m.id,
                            'acertoPct',  round(100.0 * c.acertos / NULLIF(c.total,0), 0)
                          ) ORDER BY m.ord)
                   FROM temas_cmp c JOIN metricas m ON m.id = c.pai_id
                   WHERE c.tema = t.tema), '[]'::jsonb)
               ) ORDER BY t.tema)
        FROM (SELECT DISTINCT tema FROM temas_cmp) t), '[]'::jsonb) END
    ),
    'meta', jsonb_build_object(
      'periodo',      COALESCE((SELECT to_char(min(m.data_ref),'DD/MM/YYYY') || ' — ' || to_char(max(m.data_ref),'DD/MM/YYYY')
                                FROM metricas m), 'seleção sem data'),
      'fonte',        'resultados_alunos_tri · answer_progress · questoes_simulado · simulados_admin · simulados_finalizados · users',
      'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'criterio',     format('Uma entrada em metricas por simulado selecionado; nenhuma média entre simulados. Conceito ENAMED por simulado, derivado do %% de proficientes (>= 60). %% de acerto sobre a última tentativa de cada aluno, questão anulada ignorada. Questões só com 1 simulado selecionado; comparativo por tema só com 2 ou mais. Simulados selecionados: %s. Recorte: %s.', v_n, v_recorte),
      'partial',      (SELECT count(*) FROM metricas WHERE n_tri = 0) > 0,
      'lowSample',    COALESCE((SELECT min(GREATEST(m.n_resp, m.n_tri)) FROM metricas m), 0) < 10
    )
  ) INTO v_result;

  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_gestor_detalhamento(uuid, text, uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_detalhamento(uuid, text, uuid[]) TO authenticated;
```

- [ ] **Step 2: Aplicar em produção (project ref gvqv CONFIRMADO)**

Run: `mcp__supabase__get_project_url`
Expected: `https://gvqvrmkizemwsasmupmo.supabase.co` (se vier `lljn`, PARE e aplique via `send_message` do MCP do Lovable).

Run: `mcp__supabase__apply_migration` com `name: "get_gestor_detalhamento"` e o SQL do Step 1.
Expected: sucesso.

```sql
SELECT position('feature_not_enabled' IN pg_get_functiondef(oid)) > 0 AS tem_guard,
       position('selecao_de_simulados_obrigatoria' IN pg_get_functiondef(oid)) > 0 AS tem_regra_selecao
FROM pg_proc WHERE proname = 'get_gestor_detalhamento' AND pronamespace = 'public'::regnamespace;
```
Expected: `true`, `true`.

- [ ] **Step 3: Verificar como gestor real**

Pegar dois simulados elegíveis da IES:
```sql
-- como postgres
SELECT sa.id, sa.nome
FROM public.simulados_admin sa
WHERE '<IES_ID>' = ANY (sa.ies_ids) AND sa.simulado_pai_id IS NULL
  AND sa.status IN ('ativo','encerrado')
ORDER BY COALESCE(sa.data_realizacao, sa.data_encerramento, sa.data_liberacao, sa.created_at) DESC
LIMIT 2;
```

1 simulado (leitura completa, com questões):
```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<GESTOR_ID>","role":"authenticated"}';
SELECT jsonb_array_length(public.get_gestor_detalhamento('<IES_ID>','6ano', ARRAY['<SIM_1>']::uuid[]) #> '{data,metricas}')            AS n_metricas,
       public.get_gestor_detalhamento('<IES_ID>','6ano', ARRAY['<SIM_1>']::uuid[]) #> '{data,questoes,total}'                          AS q_total,
       public.get_gestor_detalhamento('<IES_ID>','6ano', ARRAY['<SIM_1>']::uuid[]) #> '{data,comparativoTemas}'                        AS comparativo;
ROLLBACK;
```
Expected: `n_metricas = 1`; `q_total` > 0 (número de questões não anuladas do simulado); `comparativo` = `null`.

2 simulados (modo comparativo, sem questões):
```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<GESTOR_ID>","role":"authenticated"}';
SELECT jsonb_array_length(public.get_gestor_detalhamento('<IES_ID>','6ano', ARRAY['<SIM_1>','<SIM_2>']::uuid[]) #> '{data,metricas}') AS n_metricas,
       public.get_gestor_detalhamento('<IES_ID>','6ano', ARRAY['<SIM_1>','<SIM_2>']::uuid[]) #> '{data,questoes}'                     AS questoes,
       jsonb_typeof(public.get_gestor_detalhamento('<IES_ID>','6ano', ARRAY['<SIM_1>','<SIM_2>']::uuid[]) #> '{data,comparativoTemas}') AS tipo_comparativo;
ROLLBACK;
```
Expected: `n_metricas = 2` (nunca 1 média); `questoes = null`; `tipo_comparativo = 'array'`.

Evidência de semestre e seleção vazia:
```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<GESTOR_ID>","role":"authenticated"}';
SELECT public.get_gestor_detalhamento('<IES_ID>','6ano', ARRAY['<SIM_1>']::uuid[]) #> '{data,acertoPorAreaESemestre,semestres}';
ROLLBACK;
```
Expected: `emEvidencia = true` apenas nos semestres 11 e 12.

```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<GESTOR_ID>","role":"authenticated"}';
SELECT public.get_gestor_detalhamento('<IES_ID>','6ano', NULL);
SELECT public.get_gestor_detalhamento('<IES_ID>','6ano', ARRAY[]::uuid[]);
ROLLBACK;
```
Expected: as duas falham com `22023 selecao_de_simulados_obrigatoria`.

- [ ] **Step 4: Verificar anon, simulado alheio e IES alheia**

```sql
BEGIN; SET LOCAL ROLE anon;
SELECT public.get_gestor_detalhamento('<IES_ID>','geral', ARRAY['<SIM_1>']::uuid[]);
ROLLBACK;
```
Expected: `42501 permission denied for function get_gestor_detalhamento`.

```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<GESTOR_ID>","role":"authenticated"}';
SELECT public.get_gestor_detalhamento('<IES_ID>','geral', ARRAY['<SIMULADO_DE_OUTRA_IES>']::uuid[]);
ROLLBACK;
```
Expected: `42501 simulado_fora_do_escopo`.

```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<GESTOR_OUTRA_IES>","role":"authenticated"}';
SELECT public.get_gestor_detalhamento('<IES_ID>','geral', ARRAY['<SIM_1>']::uuid[]);
ROLLBACK;
```
Expected: `Permission denied: cannot access this IES`.

- [ ] **Step 5: Salvar o .sql e commitar**

```bash
git add supabase/migrations/20260726100800_get_gestor_detalhamento.sql
git commit -m "feat(gestor): RPC get_gestor_detalhamento com uma entrada por simulado e sem media unica"
```

---

### Task 23: RPC `get_gestor_questoes` e regeneração do `types.ts`

**Files:**
- Create: `supabase/migrations/20260726100900_get_gestor_questoes.sql`
- Modify: `src/integrations/supabase/types.ts` (regenerado no Step 6)
- Test: n/a (verificação por query no Step 3)

**Interfaces:**
- Consumes: guards e CTEs de escopo da Task 22
- Produces: `public.get_gestor_questoes(p_ies_id uuid, p_simulado_id uuid, p_page int, p_page_size int, p_sort text, p_area text)` → `jsonb`:
```json
{ "data": { "data": [ { "numero": 1, "grandeArea":"text", "especialidade":"text", "tema":"text",
                        "acertoPct": 42, "enunciado":"text",
                        "alternativas": [ { "letra":"A", "texto":"text", "correta": false, "marcadaPct": 31 } ],
                        "distratorDominante":"C" } ],
             "page":1, "pageSize":20, "total":0, "totalPages":0 },
  "meta": { "...": "" } }
```
Espelha `Envelope<Paginado<Questao>>`. `p_sort` aceita `'numero' | 'acerto'` (ordem crescente de `acertoPct` — pior primeiro); `p_area` filtra `grande_area` (`NULL` = todas); `p_page_size` limitado a 100. Questões anuladas **não** são listadas. `acertoPct` e `marcadaPct` são `null` quando ninguém respondeu (nunca 0) — a fatia de front renderiza `TRACO`.

- [ ] **Step 1: Escrever o SQL completo**

```sql
-- 20260726100900_get_gestor_questoes.sql
CREATE OR REPLACE FUNCTION public.get_gestor_questoes(
  p_ies_id     uuid,
  p_simulado_id uuid,
  p_page       int,
  p_page_size  int,
  p_sort       text,
  p_area       text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid    uuid := auth.uid();
  v_ies    uuid;
  v_sort   text;
  v_page   int;
  v_size   int;
  v_result jsonb;
BEGIN
  IF NOT public.user_has_feature('gestao.portal_v2') THEN
    RAISE EXCEPTION 'feature_not_enabled' USING ERRCODE = '42501';
  END IF;

  IF NOT (
       has_role(v_uid,'admin'::app_role)
    OR has_role(v_uid,'gestor'::app_role)
    OR has_role(v_uid,'gestor_grupo'::app_role)
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_simulado_id IS NULL THEN
    RAISE EXCEPTION 'simulado_obrigatorio' USING ERRCODE = '22023';
  END IF;

  IF p_ies_id IS NOT NULL THEN
    IF NOT public.user_can_access_ies(v_uid, p_ies_id) THEN
      RAISE EXCEPTION 'Permission denied: cannot access this IES';
    END IF;
    v_ies := p_ies_id;
  ELSE
    SELECT u.id_ies INTO v_ies FROM public.users u WHERE u.id = v_uid;
    IF v_ies IS NULL THEN
      v_ies := (public.get_accessible_ies(v_uid))[1];
    END IF;
  END IF;
  IF v_ies IS NULL THEN
    RAISE EXCEPTION 'IES not resolved';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.simulados_admin sa
    WHERE sa.id = p_simulado_id
      AND v_ies = ANY (sa.ies_ids)
      AND sa.simulado_pai_id IS NULL
      AND sa.status IN ('ativo','encerrado')
      AND (
        sa.liberacao_desempenho = 'imediato'
        OR (sa.liberacao_desempenho = 'agendado'
            AND sa.data_liberacao_desempenho IS NOT NULL
            AND sa.data_liberacao_desempenho <= now())
        OR (sa.liberacao_desempenho = 'ao_encerrar'
            AND (sa.status = 'encerrado'
                 OR (sa.data_encerramento IS NOT NULL AND sa.data_encerramento <= now())))
      )
  ) THEN
    RAISE EXCEPTION 'simulado_fora_do_escopo' USING ERRCODE = '42501';
  END IF;

  v_sort := lower(COALESCE(NULLIF(btrim(p_sort),''), 'numero'));
  IF v_sort NOT IN ('numero','acerto') THEN
    RAISE EXCEPTION 'sort_invalido' USING ERRCODE = '22023';
  END IF;
  v_page := GREATEST(COALESCE(p_page, 1), 1);
  v_size := LEAST(GREATEST(COALESCE(p_page_size, 20), 1), 100);

  WITH grupo AS (
    SELECT sa.id AS simulado_id
    FROM public.simulados_admin sa
    WHERE sa.id = p_simulado_id OR sa.simulado_pai_id = p_simulado_id
  ),
  alunos AS (
    SELECT u.id
    FROM public.users u
    WHERE u.id_ies = v_ies
      AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
  ),
  ultima AS (
    SELECT DISTINCT ON (sf.user_id) sf.user_id, sf.simulado_id
    FROM public.simulados_finalizados sf
    WHERE sf.simulado_id IN (SELECT simulado_id FROM grupo)
      AND sf.user_id IN (SELECT id FROM alunos)
    ORDER BY sf.user_id, sf.finalizado_em DESC NULLS LAST
  ),
  ultima_fb AS (
    SELECT DISTINCT ON (ap.user_id) ap.user_id, ap.simulado AS simulado_id
    FROM public.answer_progress ap
    JOIN public.simulados_admin sa_ord ON sa_ord.id = ap.simulado
    WHERE ap.simulado IN (SELECT simulado_id FROM grupo)
      AND ap.user_id IN (SELECT id FROM alunos)
      AND ap.user_id NOT IN (SELECT user_id FROM ultima)
    ORDER BY ap.user_id, sa_ord.created_at DESC NULLS LAST
  ),
  tentativas AS (SELECT * FROM ultima UNION ALL SELECT * FROM ultima_fb),
  q_base AS (
    SELECT q.id, COALESCE(q.numero_questao, q.ordem) AS numero,
           q.grande_area, q.especialidade, q.tema, q.enunciado, upper(q.correta) AS correta,
           q.alternativa_a, q.alternativa_b, q.alternativa_c, q.alternativa_d, q.alternativa_e
    FROM public.questoes_simulado q
    WHERE q.simulado_id IN (SELECT simulado_id FROM grupo)
      AND COALESCE(q.anulada,false) = false
      AND (p_area IS NULL OR q.grande_area = p_area)
  ),
  q_resp AS (
    SELECT ap.question_id,
           count(*) AS total,
           count(*) FILTER (WHERE ap.correct) AS acertos,
           count(*) FILTER (WHERE upper(ap.resposta_usuario) IN ('A','B','C','D','E')) AS marcadas,
           count(*) FILTER (WHERE upper(ap.resposta_usuario) = 'A') AS m_a,
           count(*) FILTER (WHERE upper(ap.resposta_usuario) = 'B') AS m_b,
           count(*) FILTER (WHERE upper(ap.resposta_usuario) = 'C') AS m_c,
           count(*) FILTER (WHERE upper(ap.resposta_usuario) = 'D') AS m_d,
           count(*) FILTER (WHERE upper(ap.resposta_usuario) = 'E') AS m_e
    FROM tentativas t
    JOIN public.answer_progress ap ON ap.user_id = t.user_id AND ap.simulado = t.simulado_id
    GROUP BY ap.question_id
  ),
  q_full AS (
    SELECT b.*, COALESCE(r.total,0) AS total, COALESCE(r.acertos,0) AS acertos,
           COALESCE(r.marcadas,0) AS marcadas,
           COALESCE(r.m_a,0) AS m_a, COALESCE(r.m_b,0) AS m_b, COALESCE(r.m_c,0) AS m_c,
           COALESCE(r.m_d,0) AS m_d, COALESCE(r.m_e,0) AS m_e,
           CASE WHEN COALESCE(r.total,0) > 0 THEN round(100.0 * r.acertos / r.total, 0) END AS acerto_pct
    FROM q_base b LEFT JOIN q_resp r ON r.question_id = b.id
  ),
  q_alts AS (
    SELECT f.id,
           jsonb_agg(jsonb_build_object(
             'letra',      a.letra,
             'texto',      a.texto,
             'correta',    (a.letra = f.correta),
             'marcadaPct', CASE WHEN f.marcadas > 0 THEN round(100.0 * a.n / f.marcadas, 0) END
           ) ORDER BY a.letra) AS alternativas,
           (SELECT d.letra FROM (VALUES ('A',f.m_a),('B',f.m_b),('C',f.m_c),('D',f.m_d),('E',f.m_e)) AS d(letra,n)
             WHERE d.letra <> f.correta AND d.n > 0 ORDER BY d.n DESC, d.letra LIMIT 1) AS distrator
    FROM q_full f
    CROSS JOIN LATERAL (VALUES
      ('A', f.alternativa_a, f.m_a), ('B', f.alternativa_b, f.m_b), ('C', f.alternativa_c, f.m_c),
      ('D', f.alternativa_d, f.m_d), ('E', f.alternativa_e, f.m_e)
    ) AS a(letra, texto, n)
    WHERE a.texto IS NOT NULL
    GROUP BY f.id, f.correta, f.marcadas, f.m_a, f.m_b, f.m_c, f.m_d, f.m_e
  ),
  ordenado AS (
    SELECT f.*, al.alternativas, al.distrator,
           row_number() OVER (
             ORDER BY
               CASE WHEN v_sort = 'acerto' THEN f.acerto_pct END ASC NULLS LAST,
               f.numero ASC
           ) AS rn
    FROM q_full f JOIN q_alts al ON al.id = f.id
  ),
  totais AS (SELECT count(*) AS total FROM ordenado)
  SELECT jsonb_build_object(
    'data', jsonb_build_object(
      'data', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'numero',             o.numero,
                 'grandeArea',         o.grande_area,
                 'especialidade',      o.especialidade,
                 'tema',               o.tema,
                 'acertoPct',          o.acerto_pct,
                 'enunciado',          o.enunciado,
                 'alternativas',       o.alternativas,
                 'distratorDominante', o.distrator
               ) ORDER BY o.rn)
        FROM ordenado o
        WHERE o.rn > (v_page - 1) * v_size AND o.rn <= v_page * v_size), '[]'::jsonb),
      'page',       v_page,
      'pageSize',   v_size,
      'total',      (SELECT total FROM totais),
      'totalPages', CASE WHEN (SELECT total FROM totais) = 0 THEN 0
                         ELSE ceil((SELECT total FROM totais)::numeric / v_size)::int END
    ),
    'meta', jsonb_build_object(
      'periodo',      COALESCE((SELECT to_char(COALESCE(sa.data_realizacao, sa.data_encerramento, sa.data_liberacao, sa.created_at),'DD/MM/YYYY')
                                FROM public.simulados_admin sa WHERE sa.id = p_simulado_id), 'sem data'),
      'fonte',        'answer_progress · questoes_simulado · simulados_admin · users',
      'atualizadoEm', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'criterio',     format('Índice de acerto da questão = respostas corretas / respostas na última tentativa de cada aluno da IES. marcadaPct = distribuição entre quem marcou alguma alternativa. Questão anulada não é listada. Distrator dominante = alternativa incorreta mais marcada. Ordenação: %s. Filtro de grande área: %s.', v_sort, COALESCE(p_area, 'todas')),
      'partial',      (SELECT count(*) FROM q_full WHERE total = 0) > 0,
      'lowSample',    COALESCE((SELECT max(f.total) FROM q_full f), 0) < 10
    )
  ) INTO v_result;

  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_gestor_questoes(uuid, uuid, int, int, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_gestor_questoes(uuid, uuid, int, int, text, text) TO authenticated;
```

- [ ] **Step 2: Aplicar em produção (project ref gvqv CONFIRMADO)**

Run: `mcp__supabase__get_project_url`
Expected: `https://gvqvrmkizemwsasmupmo.supabase.co` (se vier `lljn`, PARE e aplique via `send_message` do MCP do Lovable).

Run: `mcp__supabase__apply_migration` com `name: "get_gestor_questoes"` e o SQL do Step 1.
Expected: sucesso.

Auditoria final das 10 RPCs da fase:
```sql
SELECT p.proname,
       p.prosecdef,
       p.provolatile,
       position('feature_not_enabled' IN pg_get_functiondef(p.oid)) > 0 AS tem_guard_feature,
       position('user_can_access_ies' IN pg_get_functiondef(p.oid)) > 0 AS tem_escopo_ies,
       has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon_pode,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_pode
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname LIKE 'get_gestor_%'
ORDER BY p.proname;
```
Expected: **10 linhas** (`get_gestor_aluno`, `get_gestor_alunos`, `get_gestor_avisos`, `get_gestor_contexto`, `get_gestor_cronograma`, `get_gestor_detalhamento`, `get_gestor_diagnostico`, `get_gestor_diagnostico_temas`, `get_gestor_questoes`, `get_gestor_visao_geral`); todas com `prosecdef = true`, `provolatile = 's'`, `tem_guard_feature = true`, `anon_pode = false`, `auth_pode = true`. `tem_escopo_ies = true` em todas menos `get_gestor_contexto` (que não recebe `p_ies_id`).

Confirmar que nenhuma das 19 RPCs com guard injetado foi tocada:
```sql
SELECT p.proname, position('feature_not_enabled' IN pg_get_functiondef(p.oid)) > 0 AS guard_intacto
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname IN ('get_institutional_tri','get_institutional_evolution_tri','get_institutional_performance',
                    'get_institutional_student_scores','get_institutional_evolution','get_institutional_simulados',
                    'get_theme_evolution','get_ies_student_count','get_simulado_tem_tri')
ORDER BY p.proname;
```
Expected: todas com `guard_intacto = true`.

- [ ] **Step 3: Verificar como gestor real**

```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<GESTOR_ID>","role":"authenticated"}';
SELECT jsonb_pretty(public.get_gestor_questoes('<IES_ID>','<SIM_1>', 1, 5, 'numero', NULL));
ROLLBACK;
```
Expected: `data.data` com 5 questões ordenadas por `numero`; cada uma com `alternativas` de 4 ou 5 itens, exatamente **um** com `correta = true`; soma dos `marcadaPct` de uma questão respondida ≈ 100 (arredondamento de ±2 aceitável); `distratorDominante` é uma letra diferente da correta, ou `null` se ninguém marcou alternativa errada.

Conferência do total contra a fonte:
```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<GESTOR_ID>","role":"authenticated"}';
SELECT public.get_gestor_questoes('<IES_ID>','<SIM_1>',1,5,'numero',NULL) #>> '{data,total}' AS total_rpc;
ROLLBACK;

-- como postgres:
SELECT count(*) AS esperado
FROM public.questoes_simulado q
JOIN public.simulados_admin sa ON sa.id = q.simulado_id
WHERE (sa.id = '<SIM_1>' OR sa.simulado_pai_id = '<SIM_1>')
  AND COALESCE(q.anulada,false) = false;
```
Expected: `total_rpc = esperado`.

Ordenação por pior acerto e filtro de área:
```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<GESTOR_ID>","role":"authenticated"}';
SELECT jsonb_path_query_array(public.get_gestor_questoes('<IES_ID>','<SIM_1>',1,5,'acerto',NULL),
                              '$.data.data[*].acertoPct') AS acertos_pagina_1;
SELECT public.get_gestor_questoes('<IES_ID>','<SIM_1>',1,50,'numero','<GRANDE_AREA>') #>> '{data,total}' AS total_area;
SELECT public.get_gestor_questoes('<IES_ID>','<SIM_1>',1,50,'dificuldade',NULL);
ROLLBACK;
```
Expected: `acertos_pagina_1` em ordem crescente (pior primeiro); `total_area` menor que o total geral; a última query falha com `22023 sort_invalido`.

- [ ] **Step 4: Verificar anon, simulado alheio e IES alheia**

```sql
BEGIN; SET LOCAL ROLE anon;
SELECT public.get_gestor_questoes('<IES_ID>','<SIM_1>',1,20,'numero',NULL);
ROLLBACK;
```
Expected: `42501 permission denied for function get_gestor_questoes`.

```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<GESTOR_ID>","role":"authenticated"}';
SELECT public.get_gestor_questoes('<IES_ID>','<SIMULADO_DE_OUTRA_IES>',1,20,'numero',NULL);
ROLLBACK;
```
Expected: `42501 simulado_fora_do_escopo` — nenhum enunciado é revelado.

```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<GESTOR_OUTRA_IES>","role":"authenticated"}';
SELECT public.get_gestor_questoes('<IES_ID>','<SIM_1>',1,20,'numero',NULL);
ROLLBACK;
```
Expected: `Permission denied: cannot access this IES`.

- [ ] **Step 5: Salvar o .sql e commitar**

```bash
git add supabase/migrations/20260726100900_get_gestor_questoes.sql
git commit -m "feat(gestor): RPC get_gestor_questoes paginada com distribuicao de alternativas"
```

- [ ] **Step 6: Regenerar `src/integrations/supabase/types.ts` e commitar**

Run: `mcp__supabase__generate_typescript_types` (com o project ref gvqv já confirmado no Step 2) e gravar a saída **inteira** em `src/integrations/supabase/types.ts`.

Verificar que as 10 RPCs entraram no bloco `Functions`:
```bash
grep -c "get_gestor_" "src/integrations/supabase/types.ts"
```
Expected: pelo menos 10 ocorrências, incluindo uma linha para cada um de `get_gestor_aluno`, `get_gestor_alunos`, `get_gestor_avisos`, `get_gestor_contexto`, `get_gestor_cronograma`, `get_gestor_detalhamento`, `get_gestor_diagnostico`, `get_gestor_diagnostico_temas`, `get_gestor_questoes`, `get_gestor_visao_geral`, todas com `Returns: Json`.

Run: `npm run type-check`
Expected: sem erro (o `types.ts` novo é aditivo; nenhuma tela antiga referencia as RPCs novas ainda).

Run: `npm run lint`
Expected: sem erro novo em `src/integrations/supabase/types.ts`.

```bash
git add src/integrations/supabase/types.ts
git commit -m "chore(supabase): regenera types.ts com as 10 RPCs get_gestor_*"
```

---

## Fase 2 — Fundação do front: shell, rotas e filtros

> **Contexto verificado antes de escrever esta fase** (não repetir a investigação):
> - `buildAppRoutes(user, accessRules, access)` é **puro e síncrono** — não conhece `ies_features` (que são assíncronas via `useEffectiveFeatures`). Logo o switch da flag `gestao.portal_v2` **não pode** viver em `buildAppRoutes`: ele vive em componentes de rota. Duas árvores irmãs no mesmo path `/gestor` também não servem (o react-router resolve por especificidade e a primeira ganha o empate — a árvore perdedora fica inalcançável). A solução desta fase é **uma árvore só**, com o *shell* e os *filhos* decidindo pela flag.
> - `src/test/setup.ts` faz `vi.mock('react-router-dom')` **global** substituindo `useLocation` por `() => ({ pathname: '/' })`. Medido empiricamente nesta investigação: `useSearchParams` continua funcionando (lê a URL real, porque internamente importa de `react-router`, que não está mockado), mas `useLocation` importado de `react-router-dom` devolve `/`. **Todo teste desta fase que dependa de pathname/search precisa da linha** `vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));` — verificado: o mock do arquivo de teste sobrescreve o do setup (sem a linha, a asserção de pathname falha com `expected '/' to be '/gestor/visao-geral'`).
> - `npm run lint` **já falha no projeto todo** por configuração (`@typescript-eslint/prefer-nullish-coalescing` exige `strictNullChecks`, que está `false` em `tsconfig.app.json`) — 26 erros pré-existentes. O critério de verificação de lint desta fase é **arquivo por arquivo com a regra quebrada desligada**: `npx eslint <arquivos> --rule '{"@typescript-eslint/prefer-nullish-coalescing":"off"}'` (testado: sai limpo, exit 0). Use `??` em vez de `||` de qualquer forma.
> - `npm run type-check` (`tsc --noEmit`) hoje sai **sem output, exit 0** (o tsconfig raiz é solution-style com `files: []`).
> - Precedente de teste de Radix `Select` em jsdom existe e funciona: `src/test/components/admin/IesFeaturesBoard.test.tsx:170-185` (shims `Element.prototype.hasPointerCapture` + `scrollIntoView`, `fireEvent.click` no `combobox`, opção portalizada no body).
> - `src/experiences/shared/navActive.ts` já tem `isRouteActive`; `AdminLayout.tsx` já trata "raiz do console" com igualdade exata — mesmo problema do `/gestor` index.

---

### Task 24: Rotas e gate do portal v2

**Files:**
- Create: `src/features/gestor/api/types.ts`
- Create: `src/features/gestor/portalV2Gates.tsx`
- Create: `src/features/gestor/gestorV2Routes.tsx`
- Create: `src/features/gestor/shell/GestorShell.tsx` (versão mínima; a Task 25 troca o corpo)
- Create: `src/features/gestor/routes/Inicio.tsx`
- Create: `src/features/gestor/routes/VisaoGeral.tsx`
- Create: `src/features/gestor/routes/Detalhamento.tsx`
- Modify: `src/experiences/buildAppRoutes.tsx`
- Modify: `src/test/unit/buildAppRoutes.test.ts`
- Modify: `src/test/unit/route-gates.test.tsx`
- Test: `src/features/gestor/__tests__/gestorV2Routes.test.tsx`

**Interfaces:**
- Consumes: `ExperienceGuard` (`src/experiences/shared/ExperienceGuard.tsx`), `gestorRoutes()` (`src/experiences/gestor/gestorRoutes.tsx`, **não modificado**), `GestorIndexRedirect` (`src/experiences/gestor/GestorFeatureGate.tsx`), `useEffectiveFeatures()` → `{ hasFeature(key): boolean; loading: boolean }`.
- Produces:
  - `src/features/gestor/api/types.ts` — todos os tipos do contrato (`FiltroSemestre`, `Envelope<T>`, `Meta`, `ContextoGestor`, …) usados por **todas** as tarefas seguintes desta fase e das próximas.
  - `gestorV2Routes(): RouteObject[]`
  - `PORTAL_V2_FEATURE = 'gestao.portal_v2'`, `GestorPortalShell`, `GestorIndexSwitch`, `PortalV2Gate`, `LegacyGestorGate`
  - `GestorShell` (React.FC) — a Task 25 preenche
  - `Inicio`, `VisaoGeral`, `Detalhamento` — **default export** em cada arquivo de `routes/`; as Fases 3–5 substituem o corpo mantendo o default export.

- [ ] **Step 1: Contrato de tipos (preparação — não é passo TDD)**

Este é o único arquivo da fase sem teste próprio: é declaração de tipo pura, verificada por `tsc`. Ele existe primeiro porque **todas** as tarefas seguintes o importam. Conteúdo = bloco canônico, literal, mais dois tipos de agregação de parâmetros que os hooks da Task 28 precisam (`FiltrosGestor`, `PaginacaoGestor`).

`src/features/gestor/api/types.ts`:
```ts
/**
 * Contrato de dados do Portal do Gestor v2 — espelha `contracts/types.ts` do
 * handoff de design, com as divergências já resolvidas na spec
 * (docs/superpowers/specs/2026-07-25-portal-gestor-v2-design.md).
 *
 * NOTA (§4.1): NÃO existe campo `notaTri`. "Nota TRI" foi eliminada como
 * métrica separada — o rótulo único é "Proficiência".
 */

export type FiltroSemestre =
  | '6ano' | 'geral'
  | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12';

export type NivelDesempenho = 'excelente' | 'mediano' | 'critico';

export type GrupoEvolucao =
  | 'consistentemente_proficiente'
  | 'em_variacao'
  | 'consistentemente_nao_proficiente';

export type StatusSimulado =
  | 'realizado' | 'agendado' | 'reagendado' | 'previsto' | 'processing';

export type Tendencia = 'subindo' | 'descendo' | 'alternando' | 'estavel';

export type ModoGrafico = 'geral' | 'area' | 'aluno';

export interface Meta {
  periodo: string;
  fonte: string;
  atualizadoEm: string;
  criterio: string;
  partial: boolean;
  lowSample: boolean;
}

export interface Envelope<T> {
  data: T;
  meta: Meta;
}

export interface Paginado<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ContextoGestor {
  usuario: { id: string; nome: string; papel: 'admin' | 'gestor_grupo' | 'gestor' };
  iesDisponiveis: { id: string; nome: string }[];
  iesAtual: { id: string; nome: string };
  contrato: { nome: string; simuladosContratados: number; vigencia: string } | null;
  podeTrocarIes: boolean;
  podeExportar: boolean;
}

export interface ItemCronograma {
  id: string;
  nome: string;
  data: string | null;
  status: StatusSimulado;
  modalidade: 'online' | 'presencial' | null;
  participantes?: number;
  indisponivelPorque?: string;
}

export interface Aviso {
  id: string;
  titulo: string;
  resumo: string;
  data: string;
  lido: boolean;
}

export interface PontoSerie {
  rotulo: string;
  valor: number | null;
}

export interface Kpi {
  valor: number | null;
  delta: number | null;
  serie: PontoSerie[];
  criterio: string;
}

export interface VisaoGeral {
  kpis: {
    enamedProjetado: Kpi;
    proficientesPct: Kpi;
    acertoPct: Kpi;
    simulados: { realizados: number; contratados: number };
  };
  evolucao: {
    simuladoId: string;
    nome: string;
    data: string;
    valor: number | null;
    participantes: number;
  }[];
  evolucaoPorArea: { area: string; pontos: PontoSerie[]; critica: boolean }[];
  diagnosticoResumo: {
    nivel: NivelDesempenho;
    areas: { id: string; nome: string; acertoPct: number }[];
  }[];
  distribuicaoAlunos: { grupo: GrupoEvolucao; quantidade: number; percentual: number }[];
  dispersao: { alunoId: string; semestre: number; nota: number }[];
  insights: { escopo: 'area' | 'aluno'; texto: string }[];
}

export interface NoDiagnostico {
  id: string;
  nome: string;
  nivel: 'grande_area' | 'especialidade';
  acertoPct: number;
  desempenho: NivelDesempenho;
  amostra: number;
  lowSample: boolean;
  temFilhos: boolean;
}

export interface TemaCritico {
  id: string;
  nome: string;
  acertoPct: number;
  amostra: number;
  lowSample: boolean;
}

export interface LinhaAluno {
  id: string;
  nome: string;
  semestre: number;
  grupo: GrupoEvolucao;
  proficiencias: (number | null)[];
  tendencia: Tendencia;
}

export interface AlunoNoSimulado {
  id: string;
  nome: string;
  semestre: number;
  participou: boolean;
  acertos: number | null;
  proficiencia: number | null;
  situacao: 'proficiente' | 'abaixo_do_limiar' | 'nao_participou';
  posicao?: { lugar: number; total: number; percentil: number };
  acertoPorArea?: { area: string; acertoPct: number; critica: boolean }[];
  variacao?: number | null;
}

export interface MetricasSimulado {
  simuladoId: string;
  nome: string;
  data: string;
  participantes: number;
  acertoMedioPct: number | null;
  enamedProjetado: number | null;
  proficienciaMedia: number | null;
}

export interface Alternativa {
  letra: 'A' | 'B' | 'C' | 'D' | 'E';
  texto: string;
  correta: boolean;
  marcadaPct: number;
}

export interface Questao {
  numero: number;
  grandeArea: string;
  especialidade: string;
  tema: string;
  acertoPct: number;
  enunciado: string;
  alternativas: Alternativa[];
  distratorDominante?: Alternativa['letra'];
}

export interface AcertoPorAreaESemestre {
  areas: { id: string; nome: string; acertoPct: number; critica: boolean }[];
  semestres: { semestre: number; acertoPct: number; emEvidencia: boolean }[];
  recorte?: { tipo: 'area' | 'semestre'; id: string };
}

export interface Detalhamento {
  metricas: MetricasSimulado[];
  acertoPorAreaESemestre: AcertoPorAreaESemestre;
  dispersao: { alunoId: string; semestre: number; nota: number }[];
  questoes?: Paginado<Questao>;
  comparativoTemas?: {
    tema: string;
    porSimulado: { simuladoId: string; acertoPct: number }[];
  }[];
}

/** Recorte global da tela — o que `useFiltrosGestor` devolve, na forma que as RPCs consomem. */
export interface FiltrosGestor {
  iesId: string | null;
  semestre: FiltroSemestre;
  simulados: string[];
}

/** Paginação/ordenação das listas paginadas no servidor (alunos, questões). */
export interface PaginacaoGestor {
  page: number;
  pageSize: number;
  sort?: string;
  order?: 'asc' | 'desc';
  q?: string;
  area?: string;
}
```

Verificar: `npm run type-check` → sem output, exit 0.

- [ ] **Step 2: Escrever o teste que falha**

`src/features/gestor/__tests__/gestorV2Routes.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, type RouteObject } from 'react-router-dom';

// O setup global troca useLocation por () => ({ pathname: '/' }); aqui
// precisamos do router real (medido: sem esta linha o pathname vira '/').
vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

// Os dois shells são stubados: esta suíte verifica QUAL shell a flag escolhe,
// não o conteúdo de cada um (e evita arrastar o módulo de analytics legado).
vi.mock('@/features/gestor/shell/GestorShell', () => ({
  GestorShell: () => <div>shell v2</div>,
}));
vi.mock('@/experiences/gestor/GestorLayout', () => ({
  GestorLayout: () => <div>layout legado</div>,
}));

const mockUseEffectiveFeatures = vi.fn();
vi.mock('@/hooks/useEffectiveFeatures', () => ({
  useEffectiveFeatures: () => mockUseEffectiveFeatures(),
}));

import {
  gestorV2Routes,
} from '@/features/gestor/gestorV2Routes';
import {
  GestorPortalShell,
  PortalV2Gate,
  LegacyGestorGate,
  PORTAL_V2_FEATURE,
} from '@/features/gestor/portalV2Gates';

const comFlag = (ligada: boolean, loading = false) =>
  mockUseEffectiveFeatures.mockReturnValue({
    loading,
    hasFeature: (key: string) => ligada && key === PORTAL_V2_FEATURE,
  });

const pathsDosFilhos = (rotas: RouteObject[]): string[] =>
  (rotas.find((r) => r.path === '/gestor')?.children ?? []).map((c) =>
    c.index ? 'index' : (c.path ?? ''),
  );

describe('gestorV2Routes — forma da árvore', () => {
  it('serve as 3 rotas novas e mantém as 5 legadas como filhas de /gestor', () => {
    expect(pathsDosFilhos(gestorV2Routes())).toEqual([
      'index',
      'visao-geral',
      'detalhamento',
      'visao-institucional',
      'diagnostico-curricular',
      'alunos',
      'insights-pedagogicos',
      'inteligencia-decisoria',
    ]);
  });

  it('preserva os redirects de compatibilidade do Desempenho Institucional', () => {
    const rotas = gestorV2Routes();
    const alvo = (path: string) =>
      (rotas.find((r) => r.path === path)?.element as React.ReactElement<{ to?: string }>)
        ?.props?.to;
    expect(alvo('/desempenho-institucional')).toBe('/gestor');
    expect(alvo('/desempenho-institucional-v2')).toBe('/gestor');
  });

  it('toda rota-filha não-index declara um gate (PortalV2Gate ou LegacyGestorGate)', () => {
    const filhas = gestorV2Routes().find((r) => r.path === '/gestor')?.children ?? [];
    for (const filha of filhas) {
      if (filha.index) continue;
      const tipo = (filha.element as React.ReactElement).type;
      expect(
        [PortalV2Gate, LegacyGestorGate].includes(tipo as never),
        `rota /gestor/${filha.path} montada sem gate`,
      ).toBe(true);
    }
  });
});

describe('GestorPortalShell — escolha do shell pela feature', () => {
  beforeEach(() => vi.clearAllMocks());

  it('flag ligada → shell do portal v2', async () => {
    comFlag(true);
    render(
      <MemoryRouter initialEntries={['/gestor']}>
        <GestorPortalShell />
      </MemoryRouter>,
    );
    expect(await screen.findByText('shell v2')).toBeInTheDocument();
    expect(screen.queryByText('layout legado')).not.toBeInTheDocument();
  });

  it('flag desligada → layout legado (comportamento atual, intacto)', async () => {
    comFlag(false);
    render(
      <MemoryRouter initialEntries={['/gestor']}>
        <GestorPortalShell />
      </MemoryRouter>,
    );
    expect(await screen.findByText('layout legado')).toBeInTheDocument();
    expect(screen.queryByText('shell v2')).not.toBeInTheDocument();
  });

  it('features carregando → não decide nada ainda', () => {
    comFlag(false, true);
    const { container } = render(
      <MemoryRouter initialEntries={['/gestor']}>
        <GestorPortalShell />
      </MemoryRouter>,
    );
    expect(container.textContent).toBe('');
  });
});

describe('gates das rotas exclusivas', () => {
  beforeEach(() => vi.clearAllMocks());

  const renderizarGate = (gate: React.ReactElement) =>
    render(
      <MemoryRouter initialEntries={['/gestor/alvo']}>
        <Routes>
          <Route path="/gestor/alvo" element={gate} />
          <Route path="/gestor" element={<div>index gestor</div>} />
        </Routes>
      </MemoryRouter>,
    );

  it('PortalV2Gate: flag ligada renderiza; desligada volta para /gestor', () => {
    comFlag(true);
    renderizarGate(<PortalV2Gate><div>tela nova</div></PortalV2Gate>);
    expect(screen.getByText('tela nova')).toBeInTheDocument();

    comFlag(false);
    renderizarGate(<PortalV2Gate><div>tela nova 2</div></PortalV2Gate>);
    expect(screen.queryByText('tela nova 2')).not.toBeInTheDocument();
    expect(screen.getByText('index gestor')).toBeInTheDocument();
  });

  it('LegacyGestorGate: flag desligada renderiza a tela antiga; ligada volta para /gestor', () => {
    comFlag(false);
    renderizarGate(<LegacyGestorGate><div>tela antiga</div></LegacyGestorGate>);
    expect(screen.getByText('tela antiga')).toBeInTheDocument();

    comFlag(true);
    renderizarGate(<LegacyGestorGate><div>tela antiga 2</div></LegacyGestorGate>);
    expect(screen.queryByText('tela antiga 2')).not.toBeInTheDocument();
    expect(screen.getByText('index gestor')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Rodar o teste para ver falhar**

Run: `npx vitest run src/features/gestor/__tests__/gestorV2Routes.test.tsx`

Expected: FAIL na coleta, com `Failed to resolve import "@/features/gestor/gestorV2Routes"`.

- [ ] **Step 4: Escrever a implementação mínima**

`src/features/gestor/routes/Inicio.tsx` (as Fases 3–5 substituem o corpo, mantendo o `export default`):
```tsx
import * as React from 'react';

/** Início do Portal do Gestor v2 — "O que está acontecendo e o que eu faço agora?" (spec §2.1). */
const Inicio: React.FC = () => (
  <div className="p-8">
    <h1 className="text-2xl font-semibold tracking-tight">Início</h1>
  </div>
);

export default Inicio;
```

`src/features/gestor/routes/VisaoGeral.tsx`:
```tsx
import * as React from 'react';

/** Visão Geral — "Como estamos e onde dói?" (spec §2.1, §4.8). */
const VisaoGeral: React.FC = () => (
  <div className="p-8">
    <h1 className="text-2xl font-semibold tracking-tight">Visão Geral</h1>
  </div>
);

export default VisaoGeral;
```

`src/features/gestor/routes/Detalhamento.tsx`:
```tsx
import * as React from 'react';

/** Detalhamento por Simulados — "O que exatamente aconteceu neste simulado?" (spec §2.1, §4.7). */
const Detalhamento: React.FC = () => (
  <div className="p-8">
    <h1 className="text-2xl font-semibold tracking-tight">Detalhamento por Simulados</h1>
  </div>
);

export default Detalhamento;
```

`src/features/gestor/shell/GestorShell.tsx` (mínimo — a Task 25 troca o corpo pela sidebar de 240px):
```tsx
import * as React from 'react';
import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';

/** Shell do Portal do Gestor v2 (spec §8.3). */
export const GestorShell: React.FC = () => (
  <div className="min-h-screen bg-background">
    <Suspense fallback={<div className="min-h-[60vh]" aria-busy="true" />}>
      <Outlet />
    </Suspense>
  </div>
);
```

`src/features/gestor/portalV2Gates.tsx`:
```tsx
import * as React from 'react';
import { Suspense, lazy } from 'react';
import { Navigate } from 'react-router-dom';
import { useEffectiveFeatures } from '@/hooks/useEffectiveFeatures';
import { GestorIndexRedirect } from '@/experiences/gestor/GestorFeatureGate';
import { GestorShell } from '@/features/gestor/shell/GestorShell';

/** Chave nova do `feature_catalog`, sob o master `gestao.enabled` (spec §9). */
export const PORTAL_V2_FEATURE = 'gestao.portal_v2';

// O layout legado é lazy de propósito: quem tem o portal v2 ligado nunca
// baixa o bundle de `components/analytics/v2` (orçamento da spec §8.5).
const GestorLayoutLegado = lazy(() =>
  import('@/experiences/gestor/GestorLayout').then((m) => ({ default: m.GestorLayout })),
);
const Inicio = lazy(() => import('@/features/gestor/routes/Inicio'));

const Espera: React.FC = () => (
  <div className="min-h-screen bg-background" aria-busy="true" />
);

/**
 * Shell da árvore `/gestor`: com `gestao.portal_v2` ligada serve o portal novo
 * (sidebar de 240px); sem ela mantém EXATAMENTE o layout atual (spec §7.5, §9).
 *
 * Uma árvore só, porque `buildAppRoutes` é síncrono e não conhece features —
 * duas árvores irmãs no mesmo path deixariam a segunda inalcançável.
 */
export const GestorPortalShell: React.FC = () => {
  const { hasFeature, loading } = useEffectiveFeatures();
  if (loading) return null;
  return (
    <Suspense fallback={<Espera />}>
      {hasFeature(PORTAL_V2_FEATURE) ? <GestorShell /> : <GestorLayoutLegado />}
    </Suspense>
  );
};

/** Rota exclusiva do portal v2: sem a flag, volta ao index de `/gestor`. */
export const PortalV2Gate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { hasFeature, loading } = useEffectiveFeatures();
  if (loading) return null;
  if (!hasFeature(PORTAL_V2_FEATURE)) return <Navigate to="/gestor" replace />;
  return <>{children}</>;
};

/**
 * Rota exclusiva das 5 telas legadas: com o portal v2 ligado elas saem do ar
 * para essa IES (o shell novo não monta o GestorFiltersProvider que elas exigem).
 */
export const LegacyGestorGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { hasFeature, loading } = useEffectiveFeatures();
  if (loading) return null;
  if (hasFeature(PORTAL_V2_FEATURE)) return <Navigate to="/gestor" replace />;
  return <>{children}</>;
};

/** Index de `/gestor`: Início novo com a flag; `GestorIndexRedirect` atual sem ela (spec §9). */
export const GestorIndexSwitch: React.FC = () => {
  const { hasFeature, loading } = useEffectiveFeatures();
  if (loading) return null;
  if (!hasFeature(PORTAL_V2_FEATURE)) return <GestorIndexRedirect />;
  return (
    <Suspense fallback={<div className="min-h-[60vh]" aria-busy="true" />}>
      <Inicio />
    </Suspense>
  );
};
```

`src/features/gestor/gestorV2Routes.tsx`:
```tsx
import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { ExperienceGuard } from '@/experiences/shared/ExperienceGuard';
import { gestorRoutes } from '@/experiences/gestor/gestorRoutes';
import {
  GestorPortalShell,
  GestorIndexSwitch,
  LegacyGestorGate,
  PortalV2Gate,
} from '@/features/gestor/portalV2Gates';

const VisaoGeral = lazy(() => import('@/features/gestor/routes/VisaoGeral'));
const Detalhamento = lazy(() => import('@/features/gestor/routes/Detalhamento'));

/**
 * Árvore de rotas da experiência Gestão durante a coexistência (spec §7.5, §9).
 *
 * Um único `/gestor`, protegido por {@link ExperienceGuard}. O shell e cada
 * filha decidem pela feature `gestao.portal_v2`:
 *  - ligada  → Início/Visão Geral/Detalhamento dentro do `GestorShell`;
 *  - desligada → as 5 telas atuais dentro do `GestorLayout`, com os gates de
 *    feature originais (reusados de `gestorRoutes()`, que fica INTACTO).
 */
export const gestorV2Routes = (): RouteObject[] => {
  const legado = gestorRoutes();
  const portalLegado = legado.find((rota) => rota.path === '/gestor');
  const compat = legado.filter((rota) => rota.path !== '/gestor');

  const telasLegadas: RouteObject[] = (portalLegado?.children ?? [])
    .filter((filha) => !filha.index)
    .map((filha) => ({
      ...filha,
      element: <LegacyGestorGate>{filha.element}</LegacyGestorGate>,
    }));

  return [
    {
      path: '/gestor',
      element: (
        <ExperienceGuard experience="gestao">
          <GestorPortalShell />
        </ExperienceGuard>
      ),
      children: [
        { index: true, element: <GestorIndexSwitch /> },
        { path: 'visao-geral', element: <PortalV2Gate><VisaoGeral /></PortalV2Gate> },
        { path: 'detalhamento', element: <PortalV2Gate><Detalhamento /></PortalV2Gate> },
        ...telasLegadas,
      ],
    },
    ...compat,
  ];
};
```

`src/experiences/buildAppRoutes.tsx` — duas edições cirúrgicas:
```diff
-import { gestorRoutes } from '@/experiences/gestor/gestorRoutes';
+import { gestorV2Routes } from '@/features/gestor/gestorV2Routes';
```
```diff
-    ...(hasExperience(access, 'gestao') ? gestorRoutes() : deniedPortal('/gestor')),
+    ...(hasExperience(access, 'gestao') ? gestorV2Routes() : deniedPortal('/gestor')),
```

`src/test/unit/buildAppRoutes.test.ts` — o teste de forma da árvore de gestão passa a esperar 8 filhas:
```diff
-  it('expõe a rota-layout /gestor com os 5 módulos como filhas', () => {
+  it('expõe a rota-layout /gestor com as 3 telas novas + os 5 módulos legados como filhas', () => {
     const routes = routesForRoles(['gestor'], gestorRules);
     const gestorRoute = routes.get('/gestor');
     expect(gestorRoute).toBeDefined();
 
     const childPaths = (gestorRoute?.children ?? []).map((c) =>
       c.index ? 'index' : c.path,
     );
     expect(childPaths).toEqual([
       'index',
+      'visao-geral',
+      'detalhamento',
       'visao-institucional',
       'diagnostico-curricular',
       'alunos',
       'insights-pedagogicos',
       'inteligencia-decisoria',
     ]);
   });
```

`src/test/unit/route-gates.test.tsx` — a guarda canônica passa a cobrir as 3 rotas novas (spec §9: "rota sem gate quebra a suíte por construção"). Acrescentar o import e um `describe` novo ao final do arquivo:
```diff
 import { alunoRoutes } from '@/experiences/aluno/alunoRoutes';
 import { GESTOR_NAV } from '@/experiences/gestor/GestorNav';
+import { gestorV2Routes } from '@/features/gestor/gestorV2Routes';
+import { PortalV2Gate, LegacyGestorGate } from '@/features/gestor/portalV2Gates';
 import type { AccessRules, User } from '@/types';
```
```tsx
describe('guarda de regressão: rotas do portal do gestor v2', () => {
  const filhasDeGestor = () =>
    gestorV2Routes().find((rota) => rota.path === '/gestor')?.children ?? [];

  it('as 3 rotas do portal v2 existem e declaram gate de feature', () => {
    const filhas = filhasDeGestor();
    const novas = ['visao-geral', 'detalhamento'];
    for (const path of novas) {
      const rota = filhas.find((f) => f.path === path);
      expect(rota, `rota /gestor/${path} não montada`).toBeDefined();
      expect(
        (rota!.element as React.ReactElement).type,
        `rota /gestor/${path} sem PortalV2Gate`,
      ).toBe(PortalV2Gate);
    }
    // A index (/gestor) é gated pelo próprio switch de árvore.
    expect(filhas.some((f) => f.index)).toBe(true);
  });

  it('nenhuma filha de /gestor fica sem gate (nova ou legada)', () => {
    for (const filha of filhasDeGestor()) {
      if (filha.index) continue;
      const tipo = (filha.element as React.ReactElement).type;
      expect(
        [PortalV2Gate, LegacyGestorGate].includes(tipo as never),
        `rota /gestor/${filha.path} montada sem gate — adicione o gate`,
      ).toBe(true);
    }
  });
});
```

- [ ] **Step 5: Rodar os testes para ver passar**

Run: `npx vitest run src/features/gestor/__tests__/gestorV2Routes.test.tsx src/test/unit/route-gates.test.tsx src/test/unit/buildAppRoutes.test.ts`

Expected: PASS — 3 arquivos, todos os testes verdes (8 novos em `gestorV2Routes.test.tsx`, 2 novos em `route-gates.test.tsx`).

Depois: `npx eslint src/features/gestor src/experiences/buildAppRoutes.tsx --rule '{"@typescript-eslint/prefer-nullish-coalescing":"off"}'` → sem output, exit 0. E `npm run type-check` → sem output, exit 0.

- [ ] **Step 6: Commit**
```bash
git add src/features/gestor/api/types.ts src/features/gestor/portalV2Gates.tsx src/features/gestor/gestorV2Routes.tsx src/features/gestor/shell/GestorShell.tsx src/features/gestor/routes src/features/gestor/__tests__/gestorV2Routes.test.tsx src/experiences/buildAppRoutes.tsx src/test/unit/route-gates.test.tsx src/test/unit/buildAppRoutes.test.ts
git commit -m "feat(gestor-v2): rotas e gate do portal v2 sob gestao.portal_v2

Uma arvore /gestor so: com a flag ligada serve Inicio/Visao Geral/
Detalhamento no GestorShell; sem ela mantem as 5 telas atuais no
GestorLayout (lazy, fora do bundle de quem tem o v2). gestorRoutes()
fica intacto e e reusado. Guarda de rotas cobre as rotas novas.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 25: GestorShell — sidebar fixa de 240px

**Files:**
- Create: `src/features/gestor/shell/SidebarNav.tsx`
- Create: `src/features/gestor/shell/SidebarIes.tsx` (rótulo estático; a Task 26 generaliza para os 3 papéis)
- Modify: `src/features/gestor/shell/GestorShell.tsx`
- Test: `src/features/gestor/__tests__/GestorShell.test.tsx`

**Interfaces:**
- Consumes: `useAuth()` → `{ user: User | null; logout(): void }`, `cn` (`@/lib/utils`), `ThemeToggle` (`@/components/ThemeToggle`).
- Produces: `GESTOR_V2_NAV: GestorV2NavItem[]` (3 itens), `SidebarNav`, `SidebarIes`, `GestorShell` (versão final do shell).

**Decisão de componente — por que NÃO usar `src/components/ui/sidebar.tsx` (shadcn):** o componente existe e é usado pelo `ConsoleShell` do admin, mas ele é uma sidebar *colapsável*: `SidebarProvider` persiste estado em cookie (`sidebar:state`), registra atalho global `Ctrl/Cmd+B`, injeta `TooltipProvider` próprio, troca para um `Sheet` off-canvas quando `useIsMobile()`, e sua largura é `min(16rem, 20vw)` — 256px, não 240px. A spec §8.3 pede **sidebar fixa de 240px, sem colapso**, e §2.2 exclui versão mobile de produto. Nada do que o shadcn agrega é desejado aqui e três dos seus comportamentos (cookie, atalho global, off-canvas) seriam débito a desligar. O shell é um `<aside className="w-60">` (`w-60` = 240px, token do Tailwind — nenhum px solto) com `<main>` rolável ao lado.

- [ ] **Step 1: Escrever o teste que falha**

`src/features/gestor/__tests__/GestorShell.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

const mockUseAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));

import { GestorShell } from '@/features/gestor/shell/GestorShell';
import { GESTOR_V2_NAV } from '@/features/gestor/shell/SidebarNav';

const renderizar = (rota: string) =>
  render(
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <MemoryRouter initialEntries={[rota]}>
        <Routes>
          <Route path="/gestor" element={<GestorShell />}>
            <Route index element={<div>conteúdo do início</div>} />
            <Route path="visao-geral" element={<div>conteúdo da visão geral</div>} />
            <Route path="detalhamento" element={<div>conteúdo do detalhamento</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );

describe('GestorShell (spec §8.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', nome: 'Ana Gestora', email: 'ana@ies.edu.br', ies_nome: 'IES Alfa' },
      logout: vi.fn(),
    });
  });

  it('a nav tem exatamente os 3 itens do portal v2', () => {
    renderizar('/gestor');
    expect(GESTOR_V2_NAV.map((i) => i.title)).toEqual([
      'Início',
      'Visão Geral',
      'Detalhamento',
    ]);
    const nav = screen.getByRole('navigation', { name: /seções do portal/i });
    expect(nav.querySelectorAll('a')).toHaveLength(3);
    expect(screen.getByRole('link', { name: 'Início' })).toHaveAttribute('href', '/gestor');
    expect(screen.getByRole('link', { name: 'Visão Geral' })).toHaveAttribute('href', '/gestor/visao-geral');
    expect(screen.getByRole('link', { name: 'Detalhamento' })).toHaveAttribute('href', '/gestor/detalhamento');
  });

  it('marca o item ativo pela rota — e /gestor só fica ativo em correspondência exata', () => {
    renderizar('/gestor/visao-geral');
    expect(screen.getByRole('link', { name: 'Visão Geral' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Início' })).not.toHaveAttribute('aria-current');

    renderizar('/gestor');
    const inicios = screen.getAllByRole('link', { name: 'Início' });
    expect(inicios[inicios.length - 1]).toHaveAttribute('aria-current', 'page');
  });

  it('NÃO tem header no topo do conteúdo', () => {
    const { container } = renderizar('/gestor');
    expect(container.querySelector('header')).toBeNull();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  });

  it('sidebar de 240px com lockup de altura mínima 48px (claro e escuro) e conteúdo rolável', () => {
    const { container } = renderizar('/gestor');

    const aside = container.querySelector('aside');
    expect(aside).not.toBeNull();
    expect(aside).toHaveClass('w-60'); // 240px via token, sem px solto

    const lockup = screen.getByAltText('SanarFlix Academy');
    expect(lockup).toHaveAttribute('src', '/sanarflix-academy-lockup.svg');
    expect(lockup).toHaveClass('h-12'); // 48px (spec §8.3)
    expect(lockup).toHaveClass('dark:hidden');

    const lockupDark = container.querySelector('img[src="/sanarflix-academy-lockup-white.svg"]');
    expect(lockupDark).not.toBeNull();
    expect(lockupDark).toHaveClass('dark:block');
    // Nunca filter: invert() na marca (spec §8.3).
    expect(container.innerHTML).not.toContain('invert');

    const main = container.querySelector('main');
    expect(main).toHaveClass('overflow-y-auto');
    expect(main?.textContent).toContain('conteúdo do início');
  });

  it('rodapé traz o perfil do usuário', () => {
    renderizar('/gestor');
    expect(screen.getByText('Ana Gestora')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sair/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar o teste para ver falhar**

Run: `npx vitest run src/features/gestor/__tests__/GestorShell.test.tsx`

Expected: FAIL na coleta — `Failed to resolve import "@/features/gestor/shell/SidebarNav"`.

- [ ] **Step 3: Escrever a implementação**

`src/features/gestor/shell/SidebarNav.tsx`:
```tsx
import * as React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { BarChart3, FileSearch, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface GestorV2NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
}

/** Navegação canônica do Portal do Gestor v2 — 3 itens, nada mais (spec §2.1, §8.3). */
export const GESTOR_V2_NAV: GestorV2NavItem[] = [
  { title: 'Início', url: '/gestor', icon: Home },
  { title: 'Visão Geral', url: '/gestor/visao-geral', icon: BarChart3 },
  { title: 'Detalhamento', url: '/gestor/detalhamento', icon: FileSearch },
];

/**
 * Navegação da sidebar. Cada link carrega a query string atual, para que o
 * recorte global (semestre/simulados/IES) sobreviva à troca de tela — caso de
 * teste 12 da spec §12.
 *
 * `end` no item raiz (`/gestor`) evita que o Início fique sempre ativo — mesmo
 * cuidado que o `isConsoleRoot` do ConsoleShell do admin.
 */
export const SidebarNav: React.FC = () => {
  const location = useLocation();

  return (
    <nav aria-label="Seções do portal do gestor" className="flex flex-col gap-1 px-3">
      {GESTOR_V2_NAV.map(({ title, url, icon: Icon }) => (
        <NavLink
          key={url}
          to={{ pathname: url, search: location.search }}
          end={url === '/gestor'}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
              isActive
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
            )
          }
        >
          <Icon className="h-4 w-4 shrink-0" />
          {title}
        </NavLink>
      ))}
    </nav>
  );
};
```

`src/features/gestor/shell/SidebarIes.tsx`:
```tsx
import * as React from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Instituição em foco na sidebar.
 *
 * Nesta versão é sempre rótulo estático — o caso do papel `gestor` (spec §3).
 * A Task 26 generaliza para `admin` e `gestor_grupo` (dropdown), lendo
 * `podeTrocarIes` do servidor em vez de checar role no cliente.
 */
export const SidebarIes: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="px-1">
      <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        Instituição
      </p>
      <p
        className="truncate text-sm font-semibold text-sidebar-foreground"
        title={user?.ies_nome ?? ''}
      >
        {user?.ies_nome ?? '—'}
      </p>
    </div>
  );
};
```

`src/features/gestor/shell/GestorShell.tsx` (substitui o corpo mínimo da Task 24):
```tsx
import * as React from 'react';
import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarIes } from '@/features/gestor/shell/SidebarIes';
import { SidebarNav } from '@/features/gestor/shell/SidebarNav';

/** Iniciais do nome (até 2), para o avatar do rodapé. */
const iniciaisDe = (nome: string | undefined): string =>
  (nome ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? '')
    .join('');

/**
 * Shell do Portal do Gestor v2 (spec §8.3).
 *
 * Sidebar fixa de 240px (`w-60`), SEM header no topo do conteúdo. De cima para
 * baixo: lockup SanarFlix Academy (48px) → instituição → nav de 3 itens →
 * rodapé com tema, perfil e sair. A área de conteúdo é a única que rola.
 *
 * Marca: duas `<img>` (clara/branca) alternadas por `dark:` — nunca
 * `filter: invert()`, nunca redesenho, nunca sombra colorida.
 */
export const GestorShell: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="flex h-full w-60 shrink-0 flex-col gap-4 border-r border-sidebar-border bg-sidebar py-4 text-sidebar-foreground">
        <div className="flex min-h-[3.5rem] items-center px-4">
          <img
            src="/sanarflix-academy-lockup.svg"
            alt="SanarFlix Academy"
            className="h-12 w-auto dark:hidden"
          />
          <img
            src="/sanarflix-academy-lockup-white.svg"
            alt=""
            aria-hidden="true"
            className="hidden h-12 w-auto dark:block"
          />
        </div>

        <div className="px-3">
          <SidebarIes />
        </div>

        <SidebarNav />

        <div className="mt-auto space-y-2 border-t border-sidebar-border px-3 pt-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
              >
                {iniciaisDe(user?.nome)}
              </span>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-sm font-medium">{user?.nome ?? '—'}</p>
                <p className="truncate text-[11px] text-muted-foreground">{user?.email ?? ''}</p>
              </div>
            </div>
            <ThemeToggle />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-full justify-start gap-2 text-xs text-muted-foreground"
            onClick={() => logout()}
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </Button>
        </div>
      </aside>

      <main className="h-full flex-1 overflow-y-auto">
        <Suspense fallback={<div className="min-h-[60vh]" aria-busy="true" />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
};
```

- [ ] **Step 4: Rodar o teste para ver passar**

Run: `npx vitest run src/features/gestor/__tests__/GestorShell.test.tsx src/features/gestor/__tests__/gestorV2Routes.test.tsx`

Expected: PASS — 5 testes novos em `GestorShell.test.tsx`, e os 8 da Task 24 continuam verdes.

- [ ] **Step 5: Commit** (resolve também a pendência nº7 da spec §13 — os assets estão *untracked* hoje; sem este `git add` o lockup 404 em produção)
```bash
git add public/sanarflix-academy-lockup.svg public/sanarflix-academy-lockup-white.svg public/sanarflix-academy-symbol.svg public/sanarflix-academy-symbol-white.svg public/sanarflix-academy-appicon.svg public/sanarflix-academy-appicon-192.png public/sanarflix-academy-appicon-512.png public/sanarflix-academy-favicon-64.png
git add src/features/gestor/shell src/features/gestor/__tests__/GestorShell.test.tsx
git commit -m "feat(gestor-v2): GestorShell com sidebar fixa de 240px

Sidebar w-60 sem header no conteudo, lockup 48px com variante branca no
dark (sem filter: invert), nav de 3 itens que preserva a query string e
rodape com perfil/tema/sair. Nao usa o shadcn sidebar: ele e colapsavel,
com cookie, atalho global e sheet mobile — nada disso e desejado aqui.
Commita os assets do Academy (pendencia 7 da spec).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 26: SidebarIes — seletor de instituição por papel

**Files:**
- Create: `src/features/gestor/api/queries.ts` (helper de RPC + `useGestorContexto`; a Task 28 acrescenta os outros 9 hooks)
- Modify: `src/features/gestor/shell/SidebarIes.tsx`
- Test: `src/features/gestor/__tests__/SidebarIes.test.tsx`

**Interfaces:**
- Consumes: `ContextoGestor`, `Envelope<T>`, `Meta` de `@/features/gestor/api/types`; `supabase` de `@/integrations/supabase/client`; RPC `get_gestor_contexto()` (Fase 1).
- Produces:
  - `chamarRpcGestor<T>(fn: string, args?: Record<string, unknown>): Promise<Envelope<T>>`
  - `GESTOR_STALE_TIME = 5 * 60 * 1000`
  - `useGestorContexto(): { data: ContextoGestor | undefined; meta: Meta | undefined; isLoading: boolean; isError: boolean; refetch: () => void }`
  - `SidebarIes` na forma final (dropdown quando `podeTrocarIes`, rótulo estático quando não).

**Decisão de autorização:** o switch é `contexto.podeTrocarIes`, decidido no servidor — **não** `usuario.papel`. Spec §3: "Nenhum componente checa role literal". O `papel` fica no payload apenas para rótulo/telemetria. Os testes cobrem os 3 papéis com o `podeTrocarIes` que o servidor devolve para cada um.

- [ ] **Step 1: Escrever o teste que falha**

`src/features/gestor/__tests__/SidebarIes.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import * as React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { ContextoGestor } from '@/features/gestor/api/types';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

const mockUseGestorContexto = vi.fn();
vi.mock('@/features/gestor/api/queries', () => ({
  useGestorContexto: () => mockUseGestorContexto(),
}));

import { SidebarIes } from '@/features/gestor/shell/SidebarIes';

const Sonda = () => <span data-testid="search">{useLocation().search}</span>;

const contexto = (
  papel: ContextoGestor['usuario']['papel'],
  podeTrocarIes: boolean,
  iesDisponiveis: { id: string; nome: string }[],
): ContextoGestor => ({
  usuario: { id: 'u1', nome: 'Ana Gestora', papel },
  iesDisponiveis,
  iesAtual: { id: 'ies-1', nome: 'IES Alfa' },
  contrato: null,
  podeTrocarIes,
  podeExportar: true,
});

const TRES_IES = [
  { id: 'ies-1', nome: 'IES Alfa' },
  { id: 'ies-2', nome: 'IES Beta' },
  { id: 'ies-3', nome: 'IES Gama' },
];

const renderizar = () =>
  render(
    <MemoryRouter initialEntries={['/gestor']}>
      <SidebarIes />
      <Sonda />
    </MemoryRouter>,
  );

describe('SidebarIes (spec §3)', () => {
  beforeAll(() => {
    // Radix Select precisa de scrollIntoView/hasPointerCapture, ausentes no
    // jsdom (mesmo padrão de src/test/components/admin/IesFeaturesBoard.test.tsx).
    Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
    Element.prototype.scrollIntoView = vi.fn();
  });

  beforeEach(() => vi.clearAllMocks());

  const comContexto = (ctx: ContextoGestor) =>
    mockUseGestorContexto.mockReturnValue({
      data: ctx,
      meta: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

  it('admin: dropdown com todas as IES', () => {
    comContexto(contexto('admin', true, TRES_IES));
    renderizar();
    expect(screen.getByRole('combobox', { name: /instituição/i })).toBeInTheDocument();
    expect(screen.getByText('IES Alfa')).toBeInTheDocument();
  });

  it('gestor_grupo: dropdown com as IES do grupo', () => {
    comContexto(contexto('gestor_grupo', true, TRES_IES.slice(0, 2)));
    renderizar();
    expect(screen.getByRole('combobox', { name: /instituição/i })).toBeInTheDocument();
  });

  it('gestor: rótulo estático — NENHUM elemento clicável (caso de teste 13 da spec §12)', () => {
    comContexto(contexto('gestor', false, [{ id: 'ies-1', nome: 'IES Alfa' }]));
    renderizar();
    expect(screen.getByText('IES Alfa')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    // Nem desabilitado: simplesmente não é um controle.
    expect(document.querySelector('[disabled]')).toBeNull();
  });

  it('trocar de IES escreve a chave `ies` na URL', async () => {
    comContexto(contexto('admin', true, TRES_IES));
    renderizar();

    fireEvent.click(screen.getByRole('combobox', { name: /instituição/i }));
    const opcao = await screen.findByText('IES Beta', {
      selector: '[role="option"] *, [role="option"]',
    });
    fireEvent.click(opcao);

    await waitFor(() => {
      expect(screen.getByTestId('search').textContent).toBe('?ies=ies-2');
    });
  });

  it('carregando: reserva a altura do controle, sem número nem rótulo falso', () => {
    mockUseGestorContexto.mockReturnValue({
      data: undefined,
      meta: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });
    renderizar();
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('combobox')).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar o teste para ver falhar**

Run: `npx vitest run src/features/gestor/__tests__/SidebarIes.test.tsx`

Expected: FAIL na coleta — `Cannot find module '@/features/gestor/api/queries'` (o `vi.mock` não resolve um módulo inexistente).

- [ ] **Step 3: Escrever a implementação**

`src/features/gestor/api/queries.ts` (primeira versão — helper + o hook do shell; a Task 28 completa os 10):
```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ContextoGestor, Envelope, Meta } from '@/features/gestor/api/types';

/** Dado do gestor é fresco por 5 minutos (spec §8.2). */
export const GESTOR_STALE_TIME = 5 * 60 * 1000;

type ArgsRpc = Record<string, unknown>;

/**
 * Chama uma RPC `get_gestor_*` e devolve o envelope `{ data, meta }`.
 *
 * As RPCs novas ainda não estão nos tipos gerados do Supabase — cast local
 * documentado, mesmo padrão de `src/hooks/useEffectiveFeatures.ts`.
 */
export async function chamarRpcGestor<T>(fn: string, args?: ArgsRpc): Promise<Envelope<T>> {
  const { data, error } = await (supabase.rpc as (
    fn: string,
    args?: ArgsRpc,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>)(fn, args);

  if (error) throw new Error(`${fn}: ${error.message}`);
  if (data == null) throw new Error(`${fn}: resposta vazia`);
  return data as Envelope<T>;
}

/** Resultado padrão de todo hook do portal: envelope desembrulhado. */
export interface ResultadoGestor<T> {
  data: T | undefined;
  meta: Meta | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

/** Contexto do shell: usuário, papel, IES acessíveis, contrato e permissões (spec §5.2). */
export function useGestorContexto(): ResultadoGestor<ContextoGestor> {
  const query = useQuery({
    queryKey: ['gestor', 'contexto'],
    queryFn: () => chamarRpcGestor<ContextoGestor>('get_gestor_contexto'),
    staleTime: GESTOR_STALE_TIME,
    placeholderData: (anterior) => anterior,
  });

  return {
    data: query.data?.data,
    meta: query.data?.meta,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => void query.refetch(),
  };
}
```

`src/features/gestor/shell/SidebarIes.tsx` (substitui a versão da Task 25):
```tsx
import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useGestorContexto } from '@/features/gestor/api/queries';

const Rotulo: React.FC = () => (
  <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
    Instituição
  </p>
);

/**
 * Instituição em foco na sidebar (spec §3).
 *
 * `admin` e `gestor_grupo` trocam de IES por dropdown; `gestor` vê rótulo
 * estático — sem afordância de clique, nem controle desabilitado.
 *
 * O switch é `podeTrocarIes`, decidido no servidor: nenhum componente checa
 * role literal. E o `iesId` na URL é hint de UI — a autorização é da RPC.
 */
export const SidebarIes: React.FC = () => {
  const { data: contexto, isLoading } = useGestorContexto();
  const [, setSearchParams] = useSearchParams();

  if (isLoading) {
    return (
      <div className="px-1">
        <Rotulo />
        <div
          role="status"
          aria-busy="true"
          aria-label="Carregando instituição"
          className="mt-1 h-9 animate-pulse rounded-lg bg-muted"
        />
      </div>
    );
  }

  if (!contexto) return null;

  if (!contexto.podeTrocarIes) {
    return (
      <div className="px-1">
        <Rotulo />
        <p
          className="truncate text-sm font-semibold text-sidebar-foreground"
          title={contexto.iesAtual.nome}
        >
          {contexto.iesAtual.nome}
        </p>
      </div>
    );
  }

  // A Task 27 troca esta escrita direta pelo `setIesId` de useFiltrosGestor.
  const trocarIes = (id: string) =>
    setSearchParams((anteriores) => {
      const proximos = new URLSearchParams(anteriores);
      proximos.set('ies', id);
      return proximos;
    });

  return (
    <div className="space-y-1 px-1">
      <Rotulo />
      <Select value={contexto.iesAtual.id} onValueChange={trocarIes}>
        <SelectTrigger aria-label="Instituição em foco" className="h-9 w-full text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {contexto.iesDisponiveis.map((ies) => (
            <SelectItem key={ies.id} value={ies.id}>
              {ies.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
```

- [ ] **Step 4: Rodar o teste para ver passar**

Run: `npx vitest run src/features/gestor/__tests__/SidebarIes.test.tsx src/features/gestor/__tests__/GestorShell.test.tsx`

Expected: PASS nos 5 testes de `SidebarIes.test.tsx`.

⚠️ `GestorShell.test.tsx` vai **falhar** neste ponto: o shell agora renderiza um `SidebarIes` que consome `useGestorContexto`. Corrigir o teste da Task 25 acrescentando o mock do módulo de queries (o shell não é responsável por buscar dado de IES):
```diff
 const mockUseAuth = vi.fn();
 vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));
+
+// O shell não busca dado de IES — o SidebarIes busca. Aqui ele é neutralizado.
+vi.mock('@/features/gestor/shell/SidebarIes', () => ({
+  SidebarIes: () => <div>IES Alfa</div>,
+}));
```
Rodar de novo os dois arquivos → PASS em ambos.

- [ ] **Step 5: Commit**
```bash
git add src/features/gestor/api/queries.ts src/features/gestor/shell/SidebarIes.tsx src/features/gestor/__tests__/SidebarIes.test.tsx src/features/gestor/__tests__/GestorShell.test.tsx
git commit -m "feat(gestor-v2): SidebarIes por papel e cliente de get_gestor_contexto

Dropdown para quem o servidor marca podeTrocarIes (admin, gestor_grupo);
rotulo estatico para gestor — sem botao, sem combobox, sem controle
desabilitado. Nenhuma checagem de role no cliente. Helper chamarRpcGestor
desembrulha o envelope {data, meta}.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 27: `useFiltrosGestor` — recorte global na URL

**Files:**
- Create: `src/features/gestor/hooks/useFiltrosGestor.ts`
- Modify: `src/features/gestor/shell/SidebarIes.tsx` (passa a usar `setIesId`)
- Test: `src/features/gestor/__tests__/useFiltrosGestor.test.tsx`

**Interfaces:**
- Consumes: `FiltroSemestre` de `@/features/gestor/api/types`; `SidebarNav` (Task 25) no teste de troca de rota.
- Produces (assinatura canônica, literal):
  ```ts
  export function useFiltrosGestor(): {
    semestre: FiltroSemestre;
    setSemestre(s: FiltroSemestre): void;
    simulados: string[];
    setSimulados(ids: string[]): void;
    iesId: string | null;
    setIesId(id: string): void;
  }
  ```
  Mais `SEMESTRE_PADRAO: FiltroSemestre = '6ano'` e `SEMESTRES_VALIDOS`.

- [ ] **Step 1: Escrever o teste que falha**

`src/features/gestor/__tests__/useFiltrosGestor.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { render, renderHook, act, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

import { useFiltrosGestor } from '@/features/gestor/hooks/useFiltrosGestor';
import { SidebarNav } from '@/features/gestor/shell/SidebarNav';

const Sonda = () => {
  const { pathname, search } = useLocation();
  return (
    <>
      <span data-testid="path">{pathname}</span>
      <span data-testid="search">{search}</span>
    </>
  );
};

const comUrl = (url: string) => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>
      {children}
      <Sonda />
    </MemoryRouter>
  );
  return renderHook(() => useFiltrosGestor(), { wrapper });
};

describe('useFiltrosGestor (spec §4.5, §8.2)', () => {
  it('semestre default é 6ano quando a URL não diz nada', () => {
    const { result } = comUrl('/gestor/visao-geral');
    expect(result.current.semestre).toBe('6ano');
    expect(result.current.simulados).toEqual([]);
    expect(result.current.iesId).toBeNull();
  });

  it('lê uma URL preexistente', () => {
    const { result } = comUrl('/gestor/detalhamento?semestre=11&simulados=s1,s2&ies=ies-9');
    expect(result.current.semestre).toBe('11');
    expect(result.current.simulados).toEqual(['s1', 's2']);
    expect(result.current.iesId).toBe('ies-9');
  });

  it('valor inválido de semestre cai no default, sem quebrar', () => {
    const { result } = comUrl('/gestor?semestre=13');
    expect(result.current.semestre).toBe('6ano');
  });

  it('setSemestre reflete na URL', () => {
    const { result } = comUrl('/gestor/visao-geral');
    act(() => result.current.setSemestre('geral'));
    expect(screen.getByTestId('search').textContent).toBe('?semestre=geral');
    act(() => result.current.setSemestre('7'));
    expect(screen.getByTestId('search').textContent).toBe('?semestre=7');
    expect(result.current.semestre).toBe('7');
  });

  it('simulados vão e voltam como csv; lista vazia remove a chave', () => {
    const { result } = comUrl('/gestor/detalhamento');
    act(() => result.current.setSimulados(['s1', 's2', 's3']));
    expect(screen.getByTestId('search').textContent).toBe('?simulados=s1%2Cs2%2Cs3');
    expect(result.current.simulados).toEqual(['s1', 's2', 's3']);

    act(() => result.current.setSimulados([]));
    expect(screen.getByTestId('search').textContent).toBe('');
    expect(result.current.simulados).toEqual([]);
  });

  it('setIesId preserva os outros filtros', () => {
    const { result } = comUrl('/gestor/visao-geral?semestre=geral');
    act(() => result.current.setIesId('ies-2'));
    expect(result.current.semestre).toBe('geral');
    expect(result.current.iesId).toBe('ies-2');
  });

  it('trocar de rota pela nav preserva os filtros (caso de teste 12 da spec §12)', () => {
    const Tela = () => {
      const { semestre, simulados } = useFiltrosGestor();
      return <span data-testid="filtros">{`${semestre}|${simulados.join('+')}`}</span>;
    };

    render(
      <MemoryRouter initialEntries={['/gestor/visao-geral?semestre=11&simulados=s1,s2']}>
        <SidebarNav />
        <Routes>
          <Route path="/gestor/visao-geral" element={<Tela />} />
          <Route path="/gestor/detalhamento" element={<Tela />} />
        </Routes>
        <Sonda />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('filtros').textContent).toBe('11|s1+s2');
    fireEvent.click(screen.getByRole('link', { name: 'Detalhamento' }));
    expect(screen.getByTestId('path').textContent).toBe('/gestor/detalhamento');
    expect(screen.getByTestId('filtros').textContent).toBe('11|s1+s2');
  });
});
```

- [ ] **Step 2: Rodar o teste para ver falhar**

Run: `npx vitest run src/features/gestor/__tests__/useFiltrosGestor.test.tsx`

Expected: FAIL na coleta — `Failed to resolve import "@/features/gestor/hooks/useFiltrosGestor"`.

- [ ] **Step 3: Escrever a implementação**

`src/features/gestor/hooks/useFiltrosGestor.ts`:
```ts
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { FiltroSemestre } from '@/features/gestor/api/types';

/** "6º ano" é o recorte padrão do portal (spec §4.5). */
export const SEMESTRE_PADRAO: FiltroSemestre = '6ano';

export const SEMESTRES_VALIDOS: readonly FiltroSemestre[] = [
  '6ano', 'geral',
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12',
];

const ehSemestreValido = (valor: string | null): valor is FiltroSemestre =>
  valor !== null && (SEMESTRES_VALIDOS as readonly string[]).includes(valor);

/** Chaves do recorte global na query string. */
const CHAVE = { semestre: 'semestre', simulados: 'simulados', ies: 'ies' } as const;

export interface FiltrosGestorControl {
  semestre: FiltroSemestre;
  setSemestre(s: FiltroSemestre): void;
  simulados: string[];
  setSimulados(ids: string[]): void;
  iesId: string | null;
  setIesId(id: string): void;
}

/**
 * Recorte global do portal do gestor, com estado na URL (spec §8.2).
 *
 * Link colável, voltar/avançar e refresh preservam o recorte; a troca de tela
 * também, porque a nav carrega a query string (SidebarNav). Valor inválido de
 * semestre degrada para o padrão em vez de quebrar a tela.
 */
export function useFiltrosGestor(): FiltrosGestorControl {
  const [searchParams, setSearchParams] = useSearchParams();

  const bruto = searchParams.get(CHAVE.semestre);
  const semestre: FiltroSemestre = ehSemestreValido(bruto) ? bruto : SEMESTRE_PADRAO;

  const simulados = (searchParams.get(CHAVE.simulados) ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  const iesId = searchParams.get(CHAVE.ies);

  const escrever = useCallback(
    (mudanca: (params: URLSearchParams) => void) => {
      setSearchParams((anteriores) => {
        const proximos = new URLSearchParams(anteriores);
        mudanca(proximos);
        return proximos;
      });
    },
    [setSearchParams],
  );

  const setSemestre = useCallback(
    (valor: FiltroSemestre) => escrever((params) => params.set(CHAVE.semestre, valor)),
    [escrever],
  );

  const setSimulados = useCallback(
    (ids: string[]) =>
      escrever((params) => {
        if (ids.length === 0) params.delete(CHAVE.simulados);
        else params.set(CHAVE.simulados, ids.join(','));
      }),
    [escrever],
  );

  const setIesId = useCallback(
    (id: string) => escrever((params) => params.set(CHAVE.ies, id)),
    [escrever],
  );

  return { semestre, setSemestre, simulados, setSimulados, iesId, setIesId };
}
```

`src/features/gestor/shell/SidebarIes.tsx` — remove a escrita direta da chave `ies` (a duplicação que a Task 26 deixou anotada):
```diff
-import { useSearchParams } from 'react-router-dom';
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from '@/components/ui/select';
 import { useGestorContexto } from '@/features/gestor/api/queries';
+import { useFiltrosGestor } from '@/features/gestor/hooks/useFiltrosGestor';
```
```diff
   const { data: contexto, isLoading } = useGestorContexto();
-  const [, setSearchParams] = useSearchParams();
+  const { setIesId } = useFiltrosGestor();
```
```diff
-  // A Task 27 troca esta escrita direta pelo `setIesId` de useFiltrosGestor.
-  const trocarIes = (id: string) =>
-    setSearchParams((anteriores) => {
-      const proximos = new URLSearchParams(anteriores);
-      proximos.set('ies', id);
-      return proximos;
-    });
-
   return (
     <div className="space-y-1 px-1">
       <Rotulo />
-      <Select value={contexto.iesAtual.id} onValueChange={trocarIes}>
+      <Select value={contexto.iesAtual.id} onValueChange={setIesId}>
```
(Atenção: os hooks têm de ser chamados antes de qualquer `return` condicional — `useFiltrosGestor()` fica na primeira linha, junto de `useGestorContexto()`, senão `react-hooks/rules-of-hooks` quebra.)

- [ ] **Step 4: Rodar os testes para ver passar**

Run: `npx vitest run src/features/gestor/__tests__/useFiltrosGestor.test.tsx src/features/gestor/__tests__/SidebarIes.test.tsx`

Expected: PASS — 7 testes em `useFiltrosGestor.test.tsx` e os 5 de `SidebarIes.test.tsx` (o teste "trocar de IES escreve a chave `ies` na URL" continua verde, agora passando por `setIesId`).

- [ ] **Step 5: Commit**
```bash
git add src/features/gestor/hooks/useFiltrosGestor.ts src/features/gestor/shell/SidebarIes.tsx src/features/gestor/__tests__/useFiltrosGestor.test.tsx
git commit -m "feat(gestor-v2): useFiltrosGestor com recorte global na URL

semestre/simulados/ies em query string: link colavel, refresh e troca de
tela preservam o recorte. Semestre invalido degrada para 6ano. SidebarIes
passa a escrever a IES pelo hook, sem duplicar a chave.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 28: `queries.ts` — os 10 hooks de dados

**Files:**
- Modify: `src/features/gestor/api/queries.ts` (acrescenta os 9 hooks restantes ao arquivo criado na Task 26)
- Test: `src/features/gestor/__tests__/queries.test.tsx`

**Interfaces:**
- Consumes: `chamarRpcGestor`, `GESTOR_STALE_TIME`, `ResultadoGestor<T>` (Task 26); todos os tipos de `api/types.ts`; `useFiltrosGestor` (Task 27, usado por `useAluno` para derivar a IES em foco).
- Produces, com estas assinaturas exatas:
  ```ts
  useGestorContexto(): ResultadoGestor<ContextoGestor>
  useCronograma(iesId: string | null): ResultadoGestor<ItemCronograma[]>
  useAvisos(iesId: string | null): ResultadoGestor<Aviso[]>
  useVisaoGeral(filtros: FiltrosGestor): ResultadoGestor<VisaoGeral>
  useDiagnostico(filtros: FiltrosGestor, node: string | null): ResultadoGestor<NoDiagnostico[]>
  useDiagnosticoTemas(filtros: FiltrosGestor, especialidade: string | null): ResultadoGestor<TemaCritico[]>
  useAlunos(filtros: FiltrosGestor, paginacao: PaginacaoGestor): ResultadoGestor<Paginado<LinhaAluno>>
  useAluno(alunoId: string | null, simulados: string[]): ResultadoGestor<AlunoNoSimulado>
  useDetalhamento(filtros: FiltrosGestor): ResultadoGestor<Detalhamento>
  useQuestoes(filtros: FiltrosGestor, paginacao: PaginacaoGestor): ResultadoGestor<Paginado<Questao>>
  ```
  `queryKey` sempre `['gestor', <recurso>, ...params]`.

- [ ] **Step 1: Escrever o teste que falha**

`src/features/gestor/__tests__/queries.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { FiltrosGestor, PaginacaoGestor } from '@/features/gestor/api/types';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

const mockRpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

import {
  useGestorContexto,
  useCronograma,
  useAvisos,
  useVisaoGeral,
  useDiagnostico,
  useDiagnosticoTemas,
  useAlunos,
  useAluno,
  useDetalhamento,
  useQuestoes,
} from '@/features/gestor/api/queries';

const META = {
  periodo: '2026.1',
  fonte: 'resultados_alunos_tri',
  atualizadoEm: '2026-07-26T10:00:00Z',
  criterio: 'proficiência >= 60',
  partial: false,
  lowSample: false,
};

const envelope = (data: unknown) => ({ data: { data, meta: META }, error: null });

let queryClient: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <MemoryRouter initialEntries={['/gestor?ies=ies-1']}>{children}</MemoryRouter>
  </QueryClientProvider>
);

const FILTROS: FiltrosGestor = { iesId: 'ies-1', semestre: '6ano', simulados: [] };
const PAGINACAO: PaginacaoGestor = { page: 1, pageSize: 25, sort: 'nome', order: 'asc', q: 'ana' };

const chaves = () => queryClient.getQueryCache().getAll().map((q) => q.queryKey);

describe('queries do gestor (spec §5.2, §8.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('desembrulha o envelope: data e meta separados', async () => {
    mockRpc.mockResolvedValue(envelope({ usuario: { id: 'u1', nome: 'Ana', papel: 'gestor' } }));
    const { result } = renderHook(() => useGestorContexto(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({ usuario: { id: 'u1', nome: 'Ana', papel: 'gestor' } });
    expect(result.current.meta?.criterio).toBe('proficiência >= 60');
    expect(mockRpc).toHaveBeenCalledWith('get_gestor_contexto', undefined);
    expect(chaves()).toEqual([['gestor', 'contexto']]);
  });

  it('cada hook chama a sua RPC com os parâmetros p_* e a queryKey canônica', async () => {
    mockRpc.mockResolvedValue(envelope([]));

    const casos: Array<[() => unknown, string, unknown, unknown[]]> = [
      [() => useCronograma('ies-1'), 'get_gestor_cronograma', { p_ies_id: 'ies-1' }, ['gestor', 'cronograma', 'ies-1']],
      [() => useAvisos('ies-1'), 'get_gestor_avisos', { p_ies_id: 'ies-1' }, ['gestor', 'avisos', 'ies-1']],
      [
        () => useVisaoGeral(FILTROS),
        'get_gestor_visao_geral',
        { p_ies_id: 'ies-1', p_semestre: '6ano' },
        ['gestor', 'visao-geral', 'ies-1', '6ano'],
      ],
      [
        () => useDiagnostico(FILTROS, 'cirurgia'),
        'get_gestor_diagnostico',
        { p_ies_id: 'ies-1', p_semestre: '6ano', p_node: 'cirurgia' },
        ['gestor', 'diagnostico', 'ies-1', '6ano', 'cirurgia'],
      ],
      [
        () => useDiagnosticoTemas(FILTROS, 'cardiologia'),
        'get_gestor_diagnostico_temas',
        { p_ies_id: 'ies-1', p_semestre: '6ano', p_especialidade: 'cardiologia' },
        ['gestor', 'diagnostico-temas', 'ies-1', '6ano', 'cardiologia'],
      ],
      [
        () => useAlunos(FILTROS, PAGINACAO),
        'get_gestor_alunos',
        {
          p_ies_id: 'ies-1', p_semestre: '6ano', p_page: 1, p_page_size: 25,
          p_sort: 'nome', p_order: 'asc', p_q: 'ana',
        },
        ['gestor', 'alunos', 'ies-1', '6ano', 1, 25, 'nome', 'asc', 'ana'],
      ],
      [
        () => useDetalhamento({ ...FILTROS, simulados: ['s2', 's1'] }),
        'get_gestor_detalhamento',
        { p_ies_id: 'ies-1', p_semestre: '6ano', p_simulados: ['s1', 's2'] },
        ['gestor', 'detalhamento', 'ies-1', '6ano', ['s1', 's2']],
      ],
      [
        () => useQuestoes({ ...FILTROS, simulados: ['s1'] }, { page: 2, pageSize: 10, sort: 'numero', area: 'clinica' }),
        'get_gestor_questoes',
        {
          p_ies_id: 'ies-1', p_simulado_id: 's1', p_page: 2, p_page_size: 10,
          p_sort: 'numero', p_area: 'clinica',
        },
        ['gestor', 'questoes', 'ies-1', 's1', 2, 10, 'numero', 'clinica'],
      ],
      [
        () => useAluno('aluno-7', ['s2', 's1']),
        'get_gestor_aluno',
        { p_ies_id: 'ies-1', p_aluno_id: 'aluno-7', p_simulados: ['s1', 's2'] },
        ['gestor', 'aluno', 'ies-1', 'aluno-7', ['s1', 's2']],
      ],
    ];

    for (const [hook, fn, args, chave] of casos) {
      mockRpc.mockClear();
      queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const { result } = renderHook(hook as () => { isLoading: boolean }, { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(mockRpc, `RPC de ${fn}`).toHaveBeenCalledWith(fn, args);
      expect(chaves(), `queryKey de ${fn}`).toEqual([chave]);
    }
  });

  it('detalhamento com 0 simulados NÃO faz requisição (caso de teste 4 da spec §12)', async () => {
    mockRpc.mockResolvedValue(envelope({}));
    const { result } = renderHook(() => useDetalhamento({ ...FILTROS, simulados: [] }), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockRpc).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });

  it('questões só com EXATAMENTE 1 simulado (spec §4.7)', async () => {
    mockRpc.mockResolvedValue(envelope({ data: [], page: 1, pageSize: 10, total: 0, totalPages: 0 }));
    const { result } = renderHook(
      () => useQuestoes({ ...FILTROS, simulados: ['s1', 's2'] }, { page: 1, pageSize: 10 }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('sem IES em foco, nenhum hook de IES dispara', async () => {
    mockRpc.mockResolvedValue(envelope([]));
    const { result } = renderHook(() => useCronograma(null), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('propaga erro da RPC (ex.: feature_not_enabled) como isError', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'feature_not_enabled' } });
    const { result } = renderHook(() => useVisaoGeral(FILTROS), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it('mantém o dado anterior na troca de filtro (placeholderData, React Query v5)', async () => {
    mockRpc.mockResolvedValue(envelope({ kpis: 'primeiro' }));
    const { result, rerender } = renderHook(
      ({ semestre }: { semestre: FiltrosGestor['semestre'] }) =>
        useVisaoGeral({ ...FILTROS, semestre }),
      { wrapper, initialProps: { semestre: '6ano' as const } },
    );
    await waitFor(() => expect(result.current.data).toEqual({ kpis: 'primeiro' }));

    let liberar: (v: unknown) => void = () => undefined;
    mockRpc.mockReturnValue(new Promise((resolve) => { liberar = resolve; }));
    rerender({ semestre: 'geral' as never });

    // Durante o fetch do novo recorte, a tela continua com o dado anterior.
    expect(result.current.data).toEqual({ kpis: 'primeiro' });
    liberar(envelope({ kpis: 'segundo' }));
    await waitFor(() => expect(result.current.data).toEqual({ kpis: 'segundo' }));
  });
});
```

- [ ] **Step 2: Rodar o teste para ver falhar**

Run: `npx vitest run src/features/gestor/__tests__/queries.test.tsx`

Expected: FAIL na coleta — `"useCronograma" is not exported by src/features/gestor/api/queries.ts`.

- [ ] **Step 3: Escrever a implementação**

Acrescentar em `src/features/gestor/api/queries.ts` (o topo do arquivo — imports, `GESTOR_STALE_TIME`, `chamarRpcGestor`, `ResultadoGestor`, `useGestorContexto` — fica como está; `useGestorContexto` é reescrito sobre o helper `useEnvelope`):
```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useFiltrosGestor } from '@/features/gestor/hooks/useFiltrosGestor';
import type {
  AlunoNoSimulado,
  Aviso,
  ContextoGestor,
  Detalhamento,
  Envelope,
  FiltrosGestor,
  ItemCronograma,
  LinhaAluno,
  Meta,
  NoDiagnostico,
  Paginado,
  PaginacaoGestor,
  Questao,
  TemaCritico,
  VisaoGeral,
} from '@/features/gestor/api/types';

/* ... GESTOR_STALE_TIME, ArgsRpc, chamarRpcGestor, ResultadoGestor: inalterados ... */

/**
 * Base de todo hook do portal: uma RPC agregadora por tela, envelope
 * desembrulhado, cache de 5min e o dado anterior preservado na troca de filtro.
 *
 * `placeholderData: (anterior) => anterior` — `keepPreviousData` não existe
 * mais no React Query v5.
 */
function useEnvelope<T>(
  queryKey: readonly unknown[],
  fn: string,
  args?: ArgsRpc,
  habilitado = true,
): ResultadoGestor<T> {
  const query = useQuery({
    queryKey,
    queryFn: () => chamarRpcGestor<T>(fn, args),
    staleTime: GESTOR_STALE_TIME,
    placeholderData: (anterior) => anterior,
    enabled: habilitado,
  });

  return {
    data: query.data?.data,
    meta: query.data?.meta,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => void query.refetch(),
  };
}

/** Ordem estável da lista de simulados — queryKey determinística. */
const ordenados = (ids: string[]): string[] => [...ids].sort();

/** Contexto do shell (spec §5.2). */
export function useGestorContexto(): ResultadoGestor<ContextoGestor> {
  return useEnvelope<ContextoGestor>(['gestor', 'contexto'], 'get_gestor_contexto');
}

/** Cronograma de simulados contratados — âncora do Início (spec §6.4). */
export function useCronograma(iesId: string | null): ResultadoGestor<ItemCronograma[]> {
  return useEnvelope<ItemCronograma[]>(
    ['gestor', 'cronograma', iesId],
    'get_gestor_cronograma',
    { p_ies_id: iesId },
    iesId !== null,
  );
}

/** Avisos da Sanar para o público "gestor" (spec §6.2). */
export function useAvisos(iesId: string | null): ResultadoGestor<Aviso[]> {
  return useEnvelope<Aviso[]>(
    ['gestor', 'avisos', iesId],
    'get_gestor_avisos',
    { p_ies_id: iesId },
    iesId !== null,
  );
}

/**
 * Visão Geral inteira em um round-trip: 4 KPIs + as 3 séries do gráfico
 * protagonista + resumo do diagnóstico + distribuição + dispersão (spec §4.8).
 * Trocar o modo do gráfico NÃO refaz requisição (caso de teste 15).
 */
export function useVisaoGeral(filtros: FiltrosGestor): ResultadoGestor<VisaoGeral> {
  return useEnvelope<VisaoGeral>(
    ['gestor', 'visao-geral', filtros.iesId, filtros.semestre],
    'get_gestor_visao_geral',
    { p_ies_id: filtros.iesId, p_semestre: filtros.semestre },
    filtros.iesId !== null,
  );
}

/** Um nível da cascata do Diagnóstico Curricular, lazy por nó (spec §4.8). */
export function useDiagnostico(
  filtros: FiltrosGestor,
  node: string | null,
): ResultadoGestor<NoDiagnostico[]> {
  return useEnvelope<NoDiagnostico[]>(
    ['gestor', 'diagnostico', filtros.iesId, filtros.semestre, node],
    'get_gestor_diagnostico',
    { p_ies_id: filtros.iesId, p_semestre: filtros.semestre, p_node: node },
    filtros.iesId !== null,
  );
}

/** Temas de uma especialidade — % de acerto, nunca proficiência (spec §4.1). */
export function useDiagnosticoTemas(
  filtros: FiltrosGestor,
  especialidade: string | null,
): ResultadoGestor<TemaCritico[]> {
  return useEnvelope<TemaCritico[]>(
    ['gestor', 'diagnostico-temas', filtros.iesId, filtros.semestre, especialidade],
    'get_gestor_diagnostico_temas',
    {
      p_ies_id: filtros.iesId,
      p_semestre: filtros.semestre,
      p_especialidade: especialidade,
    },
    filtros.iesId !== null && especialidade !== null,
  );
}

/** Tabela de alunos, paginada no servidor (spec §4.8). */
export function useAlunos(
  filtros: FiltrosGestor,
  paginacao: PaginacaoGestor,
): ResultadoGestor<Paginado<LinhaAluno>> {
  return useEnvelope<Paginado<LinhaAluno>>(
    [
      'gestor', 'alunos', filtros.iesId, filtros.semestre,
      paginacao.page, paginacao.pageSize, paginacao.sort, paginacao.order, paginacao.q,
    ],
    'get_gestor_alunos',
    {
      p_ies_id: filtros.iesId,
      p_semestre: filtros.semestre,
      p_page: paginacao.page,
      p_page_size: paginacao.pageSize,
      p_sort: paginacao.sort,
      p_order: paginacao.order,
      p_q: paginacao.q,
    },
    filtros.iesId !== null,
  );
}

/**
 * Drawer do aluno. A IES em foco vem do recorte global (URL) — assinatura
 * canônica do handoff é `(alunoId, simulados)`, então não a recebe por
 * parâmetro. Lembrar: `iesId` é hint de UI; a RPC escopa pelo token.
 */
export function useAluno(
  alunoId: string | null,
  simulados: string[],
): ResultadoGestor<AlunoNoSimulado> {
  const { iesId } = useFiltrosGestor();
  const lista = ordenados(simulados);
  return useEnvelope<AlunoNoSimulado>(
    ['gestor', 'aluno', iesId, alunoId, lista],
    'get_gestor_aluno',
    { p_ies_id: iesId, p_aluno_id: alunoId, p_simulados: lista },
    iesId !== null && alunoId !== null,
  );
}

/** Detalhamento por simulados — nunca "todos": exige seleção explícita (spec §4.7). */
export function useDetalhamento(filtros: FiltrosGestor): ResultadoGestor<Detalhamento> {
  const lista = ordenados(filtros.simulados);
  return useEnvelope<Detalhamento>(
    ['gestor', 'detalhamento', filtros.iesId, filtros.semestre, lista],
    'get_gestor_detalhamento',
    { p_ies_id: filtros.iesId, p_semestre: filtros.semestre, p_simulados: lista },
    filtros.iesId !== null && lista.length > 0,
  );
}

/** Detalhamento das Questões — só com EXATAMENTE 1 simulado (spec §4.7). */
export function useQuestoes(
  filtros: FiltrosGestor,
  paginacao: PaginacaoGestor,
): ResultadoGestor<Paginado<Questao>> {
  const simuladoId = filtros.simulados.length === 1 ? filtros.simulados[0] : null;
  return useEnvelope<Paginado<Questao>>(
    [
      'gestor', 'questoes', filtros.iesId, simuladoId,
      paginacao.page, paginacao.pageSize, paginacao.sort, paginacao.area,
    ],
    'get_gestor_questoes',
    {
      p_ies_id: filtros.iesId,
      p_simulado_id: simuladoId,
      p_page: paginacao.page,
      p_page_size: paginacao.pageSize,
      p_sort: paginacao.sort,
      p_area: paginacao.area,
    },
    filtros.iesId !== null && simuladoId !== null,
  );
}
```

- [ ] **Step 4: Rodar o teste para ver passar**

Run: `npx vitest run src/features/gestor/__tests__/queries.test.tsx src/features/gestor/__tests__/SidebarIes.test.tsx`

Expected: PASS — 8 testes em `queries.test.tsx` (o caso "cada hook chama a sua RPC" exercita os 9 restantes) e os 5 de `SidebarIes.test.tsx`.

Depois: `npx eslint src/features/gestor --rule '{"@typescript-eslint/prefer-nullish-coalescing":"off"}'` → sem output.

- [ ] **Step 5: Commit**
```bash
git add src/features/gestor/api/queries.ts src/features/gestor/__tests__/queries.test.tsx
git commit -m "feat(gestor-v2): 10 hooks de dados sobre as RPCs get_gestor_*

Um round-trip por tela, envelope {data, meta} desembrulhado, queryKey
['gestor', recurso, ...params], staleTime 5min e placeholderData (v5, sem
keepPreviousData). Detalhamento com 0 simulados e questoes com 2+ nao
disparam requisicao.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 29: `FiltroSemestre` — controle segmentado

**Files:**
- Create: `src/features/gestor/components/FiltroSemestre.tsx`
- Test: `src/features/gestor/__tests__/FiltroSemestre.test.tsx`

**Interfaces:**
- Consumes: `useFiltrosGestor()` (Task 27), `FiltroSemestre` (tipo, de `api/types`), `Select` de `@/components/ui/select`, `cn`.
- Produces: `FiltroSemestre` (componente — **atenção ao nome colidir com o tipo**: o componente é exportado como `FiltroSemestre` de `components/FiltroSemestre.tsx` e o tipo é `FiltroSemestre` de `api/types.ts`; dentro do arquivo do componente o tipo é importado com alias `type ValorSemestre`), `OPCOES_SEMESTRE`, `SEMESTRES_NUMERICOS`.

- [ ] **Step 1: Escrever o teste que falha**

`src/features/gestor/__tests__/FiltroSemestre.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

import { FiltroSemestre } from '@/features/gestor/components/FiltroSemestre';

const Sonda = () => <span data-testid="search">{useLocation().search}</span>;

const renderizar = (url = '/gestor/visao-geral') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <FiltroSemestre />
      <Sonda />
    </MemoryRouter>,
  );

const indicador = () => screen.getByTestId('filtro-semestre-indicador');

describe('FiltroSemestre (spec §4.5)', () => {
  beforeAll(() => {
    Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('tem as 3 opções, seleção única, com 6º ano marcada por padrão', () => {
    renderizar();
    const grupo = screen.getByRole('radiogroup', { name: /semestre/i });
    const opcoes = screen.getAllByRole('radio');
    expect(grupo).toBeInTheDocument();
    expect(opcoes.map((o) => o.textContent)).toEqual([
      '6º ano (Padrão)',
      'Geral',
      'Por semestre',
    ]);
    expect(screen.getByRole('radio', { name: '6º ano (Padrão)' })).toHaveAttribute('aria-checked', 'true');
    expect(opcoes.filter((o) => o.getAttribute('aria-checked') === 'true')).toHaveLength(1);
  });

  it('o indicador DESLIZA por transform (não pisca): 0% → 100% → 200%', () => {
    renderizar();
    expect(indicador().style.transform).toBe('translateX(0%)');
    expect(indicador().className).toContain('transition-transform');

    fireEvent.click(screen.getByRole('radio', { name: 'Geral' }));
    expect(indicador().style.transform).toBe('translateX(100%)');

    fireEvent.click(screen.getByRole('radio', { name: 'Por semestre' }));
    expect(indicador().style.transform).toBe('translateX(200%)');
  });

  it('escreve a escolha na URL', () => {
    renderizar();
    fireEvent.click(screen.getByRole('radio', { name: 'Geral' }));
    expect(screen.getByTestId('search').textContent).toBe('?semestre=geral');
    fireEvent.click(screen.getByRole('radio', { name: '6º ano (Padrão)' }));
    expect(screen.getByTestId('search').textContent).toBe('?semestre=6ano');
  });

  it('"Por semestre" revela o dropdown 1º…12º e escolher escreve o número na URL', async () => {
    renderizar();
    expect(screen.queryByRole('combobox')).toBeNull();

    fireEvent.click(screen.getByRole('radio', { name: 'Por semestre' }));
    const combo = screen.getByRole('combobox', { name: /semestre específico/i });
    expect(combo).toBeInTheDocument();
    expect(screen.getByTestId('search').textContent).toBe('?semestre=1');

    fireEvent.click(combo);
    const opcao = await screen.findByText('3º', { selector: '[role="option"] *, [role="option"]' });
    fireEvent.click(opcao);
    await waitFor(() => {
      expect(screen.getByTestId('search').textContent).toBe('?semestre=3');
    });
  });

  it('URL com semestre numérico já abre no 3º segmento com o dropdown visível', () => {
    renderizar('/gestor/visao-geral?semestre=11');
    expect(screen.getByRole('radio', { name: 'Por semestre' })).toHaveAttribute('aria-checked', 'true');
    expect(indicador().style.transform).toBe('translateX(200%)');
    expect(screen.getByRole('combobox', { name: /semestre específico/i })).toBeInTheDocument();
  });

  it('navegação por teclado: setas movem a seleção e o foco (roving tabIndex)', () => {
    renderizar();
    const seisAno = screen.getByRole('radio', { name: '6º ano (Padrão)' });
    expect(seisAno).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'Geral' })).toHaveAttribute('tabindex', '-1');

    seisAno.focus();
    fireEvent.keyDown(seisAno, { key: 'ArrowRight' });
    const geral = screen.getByRole('radio', { name: 'Geral' });
    expect(geral).toHaveAttribute('aria-checked', 'true');
    expect(geral).toHaveFocus();
    expect(screen.getByTestId('search').textContent).toBe('?semestre=geral');

    fireEvent.keyDown(geral, { key: 'ArrowLeft' });
    expect(screen.getByRole('radio', { name: '6º ano (Padrão)' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('search').textContent).toBe('?semestre=6ano');
  });

  it('disabled: nada é clicável e a URL não muda', () => {
    render(
      <MemoryRouter initialEntries={['/gestor/visao-geral']}>
        <FiltroSemestre disabled />
        <Sonda />
      </MemoryRouter>,
    );
    const geral = screen.getByRole('radio', { name: 'Geral' });
    expect(geral).toBeDisabled();
    fireEvent.click(geral);
    expect(screen.getByTestId('search').textContent).toBe('');
  });
});
```

- [ ] **Step 2: Rodar o teste para ver falhar**

Run: `npx vitest run src/features/gestor/__tests__/FiltroSemestre.test.tsx`

Expected: FAIL na coleta — `Failed to resolve import "@/features/gestor/components/FiltroSemestre"`.

- [ ] **Step 3: Escrever a implementação**

`src/features/gestor/components/FiltroSemestre.tsx`:
```tsx
import * as React from 'react';
import { useRef } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { FiltroSemestre as ValorSemestre } from '@/features/gestor/api/types';
import { useFiltrosGestor } from '@/features/gestor/hooks/useFiltrosGestor';

type IdOpcao = '6ano' | 'geral' | 'por-semestre';

export const OPCOES_SEMESTRE: { id: IdOpcao; rotulo: string }[] = [
  { id: '6ano', rotulo: '6º ano (Padrão)' },
  { id: 'geral', rotulo: 'Geral' },
  { id: 'por-semestre', rotulo: 'Por semestre' },
];

export const SEMESTRES_NUMERICOS: ValorSemestre[] = [
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12',
];

/** Semestre numérico assumido ao entrar em "Por semestre". */
const PRIMEIRO_NUMERICO: ValorSemestre = '1';

const ehNumerico = (valor: ValorSemestre): boolean =>
  valor !== '6ano' && valor !== 'geral';

const indiceDe = (valor: ValorSemestre): number =>
  valor === '6ano' ? 0 : valor === 'geral' ? 1 : 2;

/**
 * Filtro global de semestre (spec §4.5) — idêntico na Visão Geral e no
 * Detalhamento, persistido na URL, seleção ÚNICA em toda a página.
 *
 * Controle segmentado com indicador que DESLIZA por `transform` (não pisca);
 * o 3º segmento revela o dropdown 1º…12º. Semântica de `radiogroup` com
 * roving tabIndex: setas movem seleção e foco juntos.
 */
export const FiltroSemestre: React.FC<{ disabled?: boolean }> = ({ disabled = false }) => {
  const { semestre, setSemestre } = useFiltrosGestor();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const indiceAtivo = indiceDe(semestre);
  const mostrarDropdown = indiceAtivo === 2;

  const selecionar = (indice: number) => {
    if (disabled) return;
    if (indice === 0) setSemestre('6ano');
    else if (indice === 1) setSemestre('geral');
    else setSemestre(ehNumerico(semestre) ? semestre : PRIMEIRO_NUMERICO);
  };

  const aoTeclar = (evento: React.KeyboardEvent<HTMLButtonElement>) => {
    const total = OPCOES_SEMESTRE.length;
    let proximo: number | null = null;
    if (evento.key === 'ArrowRight' || evento.key === 'ArrowDown') {
      proximo = (indiceAtivo + 1) % total;
    } else if (evento.key === 'ArrowLeft' || evento.key === 'ArrowUp') {
      proximo = (indiceAtivo - 1 + total) % total;
    } else if (evento.key === 'Home') {
      proximo = 0;
    } else if (evento.key === 'End') {
      proximo = total - 1;
    }
    if (proximo === null) return;
    evento.preventDefault();
    selecionar(proximo);
    refs.current[proximo]?.focus();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="radiogroup"
        aria-label="Recorte de semestre"
        className={cn(
          'relative flex w-fit items-center rounded-lg bg-muted p-1',
          disabled && 'opacity-50',
        )}
      >
        <span
          aria-hidden="true"
          data-testid="filtro-semestre-indicador"
          className="pointer-events-none absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-md bg-background shadow-sm transition-transform duration-200 ease-out"
          style={{ transform: `translateX(${indiceAtivo * 100}%)` }}
        />
        {OPCOES_SEMESTRE.map((opcao, indice) => {
          const ativo = indice === indiceAtivo;
          return (
            <button
              key={opcao.id}
              ref={(elemento) => { refs.current[indice] = elemento; }}
              type="button"
              role="radio"
              aria-checked={ativo}
              tabIndex={ativo ? 0 : -1}
              disabled={disabled}
              onClick={() => selecionar(indice)}
              onKeyDown={aoTeclar}
              className={cn(
                'relative z-10 whitespace-nowrap rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'disabled:cursor-not-allowed',
                ativo
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground/80',
              )}
            >
              {opcao.rotulo}
            </button>
          );
        })}
      </div>

      {mostrarDropdown && (
        <Select
          value={semestre}
          disabled={disabled}
          onValueChange={(valor) => setSemestre(valor as ValorSemestre)}
        >
          <SelectTrigger aria-label="Semestre específico" className="h-8 w-[7.5rem] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SEMESTRES_NUMERICOS.map((numero) => (
              <SelectItem key={numero} value={numero}>
                {`${numero}º`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Rodar o teste para ver passar**

Run: `npx vitest run src/features/gestor/__tests__/FiltroSemestre.test.tsx`

Expected: PASS — 7 testes.

- [ ] **Step 5: Commit**
```bash
git add src/features/gestor/components/FiltroSemestre.tsx src/features/gestor/__tests__/FiltroSemestre.test.tsx
git commit -m "feat(gestor-v2): controle segmentado do filtro de semestre

Tres opcoes (6o ano (Padrao) | Geral | Por semestre), selecao unica,
indicador que desliza por transform, dropdown 1o..12o no terceiro
segmento e escrita na URL. Radiogroup com roving tabIndex: setas movem
selecao e foco.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 30: Primitivas de estado e rastreabilidade

**Files:**
- Create: `src/features/gestor/components/GestorSkeleton.tsx`
- Create: `src/features/gestor/components/EstadoVazio.tsx`
- Create: `src/features/gestor/components/EstadoErro.tsx`
- Create: `src/features/gestor/components/BadgeStatus.tsx`
- Create: `src/features/gestor/components/ChipNivel.tsx`
- Create: `src/features/gestor/components/TooltipRastreabilidade.tsx`
- Create: `src/features/gestor/components/BlocoErrorBoundary.tsx`
- Test: `src/features/gestor/__tests__/primitivas.test.tsx`

**Interfaces:**
- Consumes: `Meta`, `NivelDesempenho`, `StatusSimulado` de `@/features/gestor/api/types`; `Badge`, `Button`, `Tooltip*` de `@/components/ui/*`; `ErrorBoundary` de `react-error-boundary` (já é dependência, `^6.0.0`, usada em `src/components/ErrorBoundary.tsx`); `Logger` de `@/utils/logger`.
- Produces:
  ```ts
  GestorSkeleton({ altura, rotulo? })            // reserva a altura final
  EstadoVazio({ titulo, descricao?, altura? })
  EstadoErro({ titulo?, descricao?, onRetry, altura? })
  BadgeStatus({ status })                        // StatusSimulado → rótulo textual
  ChipNivel({ nivel })                           // cor semântica + rótulo textual
  TooltipRastreabilidade({ meta, children? })
  BlocoErrorBoundary({ bloco, children })        // error boundary POR BLOCO
  ```
  Mais os mapas `ROTULO_STATUS: Record<StatusSimulado, string>` e `ROTULO_NIVEL: Record<NivelDesempenho, string>`.

- [ ] **Step 1: Escrever o teste do ciclo A (estados: skeleton, vazio, erro)**

`src/features/gestor/__tests__/primitivas.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { Meta } from '@/features/gestor/api/types';

import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';

describe('GestorSkeleton (spec §8.4 — reserva a altura final)', () => {
  it('reserva a altura recebida e se anuncia como carregando', () => {
    render(<GestorSkeleton altura={320} rotulo="Carregando evolução" />);
    const status = screen.getByRole('status', { name: 'Carregando evolução' });
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status.style.minHeight).toBe('320px');
  });

  it('aceita altura em unidade CSS', () => {
    render(<GestorSkeleton altura="20rem" />);
    expect(screen.getByRole('status').style.minHeight).toBe('20rem');
  });
});

describe('EstadoVazio', () => {
  it('mostra título e descrição, e nunca inventa número', () => {
    render(<EstadoVazio titulo="Sem simulados realizados" descricao="Escolha outro recorte." altura={200} />);
    expect(screen.getByText('Sem simulados realizados')).toBeInTheDocument();
    expect(screen.getByText('Escolha outro recorte.')).toBeInTheDocument();
    expect(screen.getByText('Sem simulados realizados').closest('div')?.textContent).not.toMatch(/\d/);
  });
});

describe('EstadoErro (spec §8.4 — retry por bloco)', () => {
  it('o botão "Tentar novamente" chama onRetry', () => {
    const onRetry = vi.fn();
    render(<EstadoErro onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('usa role=alert para anunciar a falha', () => {
    render(<EstadoErro titulo="Falha ao carregar a evolução" onRetry={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Falha ao carregar a evolução');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/features/gestor/__tests__/primitivas.test.tsx`

Expected: FAIL na coleta — `Failed to resolve import "@/features/gestor/components/GestorSkeleton"`.

- [ ] **Step 3: Implementar o ciclo A**

`src/features/gestor/components/GestorSkeleton.tsx`:
```tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

interface GestorSkeletonProps {
  /** Altura final do bloco — reservada agora para não haver salto (CLS < 0,1, spec §8.5). */
  altura: number | string;
  rotulo?: string;
  className?: string;
}

/** Carregamento de um bloco, com a altura do conteúdo final já reservada (spec §8.4). */
export const GestorSkeleton: React.FC<GestorSkeletonProps> = ({
  altura,
  rotulo = 'Carregando',
  className,
}) => (
  <div
    role="status"
    aria-busy="true"
    aria-label={rotulo}
    style={{ minHeight: typeof altura === 'number' ? `${altura}px` : altura }}
    className={cn('w-full animate-pulse rounded-xl bg-muted/60', className)}
  />
);
```

`src/features/gestor/components/EstadoVazio.tsx`:
```tsx
import * as React from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EstadoVazioProps {
  titulo: string;
  descricao?: string;
  altura?: number | string;
  className?: string;
}

/**
 * Bloco sem dado. Nunca preenche lacuna com zero, média ou estimativa
 * (spec §4.10) — diz que não há dado e para de falar.
 */
export const EstadoVazio: React.FC<EstadoVazioProps> = ({
  titulo,
  descricao,
  altura,
  className,
}) => (
  <div
    style={altura ? { minHeight: typeof altura === 'number' ? `${altura}px` : altura } : undefined}
    className={cn(
      'flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-6 text-center',
      className,
    )}
  >
    <Inbox className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
    <p className="text-sm font-medium text-foreground">{titulo}</p>
    {descricao && <p className="max-w-sm text-xs text-muted-foreground">{descricao}</p>}
  </div>
);
```

`src/features/gestor/components/EstadoErro.tsx`:
```tsx
import * as React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EstadoErroProps {
  titulo?: string;
  descricao?: string;
  /** Refaz APENAS a query deste bloco (spec §8.4). */
  onRetry: () => void;
  altura?: number | string;
  className?: string;
}

/** Falha de um bloco, com retry local — a tela inteira continua utilizável. */
export const EstadoErro: React.FC<EstadoErroProps> = ({
  titulo = 'Não foi possível carregar este bloco',
  descricao,
  onRetry,
  altura,
  className,
}) => (
  <div
    role="alert"
    style={altura ? { minHeight: typeof altura === 'number' ? `${altura}px` : altura } : undefined}
    className={cn(
      'flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center',
      className,
    )}
  >
    <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
    <p className="text-sm font-medium text-foreground">{titulo}</p>
    {descricao && <p className="max-w-sm text-xs text-muted-foreground">{descricao}</p>}
    <Button variant="outline" size="sm" className="mt-1 gap-1.5 text-xs" onClick={onRetry}>
      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
      Tentar novamente
    </Button>
  </div>
);
```

Run: `npx vitest run src/features/gestor/__tests__/primitivas.test.tsx` → Expected: PASS (5 testes).

- [ ] **Step 4: Escrever o teste do ciclo B (rastreabilidade: BadgeStatus, ChipNivel, TooltipRastreabilidade)**

Acrescentar ao final de `src/features/gestor/__tests__/primitivas.test.tsx`:
```tsx
import { BadgeStatus } from '@/features/gestor/components/BadgeStatus';
import { ChipNivel } from '@/features/gestor/components/ChipNivel';
import { TooltipRastreabilidade } from '@/features/gestor/components/TooltipRastreabilidade';

const META: Meta = {
  periodo: '2026.1 · 3 simulados',
  fonte: 'resultados_alunos_tri',
  atualizadoEm: '2026-07-26T10:00:00Z',
  criterio: 'proficiência >= 60',
  partial: false,
  lowSample: false,
};

describe('BadgeStatus (spec §6.4)', () => {
  it('cada status tem rótulo textual em português; previsto é "A definir"', () => {
    const casos: Array<[Parameters<typeof BadgeStatus>[0]['status'], string]> = [
      ['realizado', 'Realizado'],
      ['agendado', 'Agendado'],
      ['reagendado', 'Reagendado'],
      ['previsto', 'A definir'],
      ['processing', 'Em processamento'],
    ];
    for (const [status, rotulo] of casos) {
      const { unmount } = render(<BadgeStatus status={status} />);
      expect(screen.getByText(rotulo)).toBeInTheDocument();
      unmount();
    }
  });
});

describe('ChipNivel (spec §4.4)', () => {
  it('nunca comunica só por cor: sempre há rótulo textual', () => {
    const casos: Array<[Parameters<typeof ChipNivel>[0]['nivel'], string]> = [
      ['excelente', 'Excelente'],
      ['mediano', 'Mediano'],
      ['critico', 'Crítico'],
    ];
    for (const [nivel, rotulo] of casos) {
      const { unmount } = render(<ChipNivel nivel={nivel} />);
      expect(screen.getByText(rotulo)).toBeInTheDocument();
      unmount();
    }
  });

  it('a cor vem de token, nunca de hex solto', () => {
    const { container } = render(<ChipNivel nivel="excelente" />);
    expect(container.innerHTML).toContain('hsl(var(--chart-1))');
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{6}/);
  });
});

describe('TooltipRastreabilidade (spec §4.1)', () => {
  it('expõe Período · Fonte · Atualizado em · Critério, com o critério vindo do servidor', async () => {
    render(
      <TooltipProvider>
        <TooltipRastreabilidade meta={META} />
      </TooltipProvider>,
    );

    const gatilho = screen.getByRole('button', { name: /rastreabilidade/i });
    fireEvent.focus(gatilho);

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Período');
    expect(tooltip).toHaveTextContent('2026.1 · 3 simulados');
    expect(tooltip).toHaveTextContent('Fonte');
    expect(tooltip).toHaveTextContent('resultados_alunos_tri');
    expect(tooltip).toHaveTextContent('Atualizado em');
    expect(tooltip).toHaveTextContent('26/07/2026');
    expect(tooltip).toHaveTextContent('Critério');
    expect(tooltip).toHaveTextContent('proficiência >= 60');
  });
});
```

Run: `npx vitest run src/features/gestor/__tests__/primitivas.test.tsx` → Expected: FAIL na coleta — `Failed to resolve import "@/features/gestor/components/BadgeStatus"`.

- [ ] **Step 5: Implementar o ciclo B**

`src/features/gestor/components/BadgeStatus.tsx`:
```tsx
import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import type { StatusSimulado } from '@/features/gestor/api/types';

/** Rótulos de status do cronograma (spec §6.4). `previsto` = slot sem data. */
export const ROTULO_STATUS: Record<StatusSimulado, string> = {
  realizado: 'Realizado',
  agendado: 'Agendado',
  reagendado: 'Reagendado',
  previsto: 'A definir',
  processing: 'Em processamento',
};

const VARIANTE: Record<StatusSimulado, 'default' | 'secondary' | 'outline'> = {
  realizado: 'default',
  agendado: 'secondary',
  reagendado: 'secondary',
  previsto: 'outline',
  processing: 'outline',
};

/** Status de um simulado no cronograma — sempre com rótulo textual. */
export const BadgeStatus: React.FC<{ status: StatusSimulado }> = ({ status }) => (
  <Badge variant={VARIANTE[status]} className="text-[10px] font-medium">
    {ROTULO_STATUS[status]}
  </Badge>
);
```

`src/features/gestor/components/ChipNivel.tsx`:
```tsx
import * as React from 'react';
import { cn } from '@/lib/utils';
import type { NivelDesempenho } from '@/features/gestor/api/types';

/** Níveis de desempenho sobre % de acerto (spec §4.4). */
export const ROTULO_NIVEL: Record<NivelDesempenho, string> = {
  excelente: 'Excelente',
  mediano: 'Mediano',
  critico: 'Crítico',
};

/** Cor semântica por token do projeto — nenhum hex solto (spec §11). */
const COR_NIVEL: Record<NivelDesempenho, string> = {
  excelente: 'hsl(var(--chart-1))',
  mediano: 'hsl(var(--chart-3))',
  critico: 'hsl(var(--destructive))',
};

/**
 * Nível de desempenho de uma grande área / especialidade / tema.
 * A cor é reforço, nunca o único canal: o rótulo textual está sempre presente.
 */
export const ChipNivel: React.FC<{ nivel: NivelDesempenho; className?: string }> = ({
  nivel,
  className,
}) => (
  <span
    className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium',
      className,
    )}
    style={{
      borderColor: `color-mix(in srgb, ${COR_NIVEL[nivel]} 40%, transparent)`,
      backgroundColor: `color-mix(in srgb, ${COR_NIVEL[nivel]} 12%, transparent)`,
    }}
  >
    <span
      aria-hidden="true"
      className="h-1.5 w-1.5 rounded-full"
      style={{ backgroundColor: COR_NIVEL[nivel] }}
    />
    {ROTULO_NIVEL[nivel]}
  </span>
);
```

`src/features/gestor/components/TooltipRastreabilidade.tsx`:
```tsx
import * as React from 'react';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Meta } from '@/features/gestor/api/types';

const formatarData = (iso: string): string => {
  const data = new Date(iso);
  return Number.isNaN(data.getTime())
    ? '—'
    : data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/**
 * Rastreabilidade de um indicador: Período · Fonte · Atualizado em · Critério
 * (spec §4.1). O texto do critério vem do servidor (`meta.criterio`) para não
 * divergir entre telas.
 */
export const TooltipRastreabilidade: React.FC<{
  meta: Meta;
  children?: React.ReactNode;
}> = ({ meta, children }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      {children ?? (
        <button
          type="button"
          aria-label="Rastreabilidade do indicador"
          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </TooltipTrigger>
    <TooltipContent className="max-w-xs">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
        <dt className="font-medium text-muted-foreground">Período</dt>
        <dd>{meta.periodo}</dd>
        <dt className="font-medium text-muted-foreground">Fonte</dt>
        <dd>{meta.fonte}</dd>
        <dt className="font-medium text-muted-foreground">Atualizado em</dt>
        <dd>{formatarData(meta.atualizadoEm)}</dd>
        <dt className="font-medium text-muted-foreground">Critério</dt>
        <dd>{meta.criterio}</dd>
      </dl>
    </TooltipContent>
  </Tooltip>
);
```

Run: `npx vitest run src/features/gestor/__tests__/primitivas.test.tsx` → Expected: PASS (9 testes).

- [ ] **Step 6: Escrever o teste do ciclo C (BlocoErrorBoundary)**

Acrescentar ao final de `src/features/gestor/__tests__/primitivas.test.tsx`:
```tsx
import { BlocoErrorBoundary } from '@/features/gestor/components/BlocoErrorBoundary';

describe('BlocoErrorBoundary (spec §8.4 — boundary POR BLOCO)', () => {
  beforeEach(() => {
    // react-error-boundary loga a exceção; silenciado para não poluir a saída.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  const Explode = ({ quebrar }: { quebrar: boolean }) => {
    if (quebrar) throw new Error('gráfico quebrou');
    return <div>gráfico ok</div>;
  };

  it('isola a falha: o bloco vizinho continua na tela', () => {
    render(
      <>
        <BlocoErrorBoundary bloco="evolucao">
          <Explode quebrar />
        </BlocoErrorBoundary>
        <BlocoErrorBoundary bloco="areas">
          <div>bloco vizinho intacto</div>
        </BlocoErrorBoundary>
      </>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('bloco vizinho intacto')).toBeInTheDocument();
    expect(screen.queryByText('gráfico ok')).not.toBeInTheDocument();
  });

  it('"Tentar novamente" remonta o bloco', () => {
    const Instavel = () => {
      const [quebrar, setQuebrar] = React.useState(true);
      // O reset do boundary remonta os filhos; o segundo render não quebra.
      React.useEffect(() => setQuebrar(false), []);
      return <Explode quebrar={quebrar} />;
    };

    render(
      <BlocoErrorBoundary bloco="evolucao">
        <Instavel />
      </BlocoErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(screen.getByText('gráfico ok')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
```

Run: `npx vitest run src/features/gestor/__tests__/primitivas.test.tsx` → Expected: FAIL na coleta — `Failed to resolve import "@/features/gestor/components/BlocoErrorBoundary"`.

- [ ] **Step 7: Implementar o ciclo C**

`src/features/gestor/components/BlocoErrorBoundary.tsx`:
```tsx
import * as React from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import Logger from '@/utils/logger';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';

interface BlocoErrorBoundaryProps {
  /** Identificador do bloco para telemetria (`gestor_erro_bloco`, spec §10) — sem PII. */
  bloco: string;
  children: React.ReactNode;
}

/**
 * Error boundary POR BLOCO (spec §8.4): um gráfico quebrado não derruba a tela.
 * O fallback é o mesmo `EstadoErro` do erro de query — do ponto de vista da
 * gestora, "este bloco falhou, tente de novo" é um estado só.
 */
export const BlocoErrorBoundary: React.FC<BlocoErrorBoundaryProps> = ({ bloco, children }) => (
  <ErrorBoundary
    onError={(erro) => Logger.error(`[gestor] erro no bloco ${bloco}`, erro.message)}
    fallbackRender={({ resetErrorBoundary }) => (
      <EstadoErro
        titulo="Não foi possível exibir este bloco"
        descricao="O resto da página continua disponível."
        onRetry={resetErrorBoundary}
      />
    )}
  >
    {children}
  </ErrorBoundary>
);
```

Verificar a assinatura de `Logger.error` antes de rodar: `npx tsc --noEmit -p tsconfig.app.json` (se `Logger.error` não aceitar `(string, string)`, usar `Logger.error(\`[gestor] erro no bloco ${bloco}: ${erro.message}\`)`).

- [ ] **Step 8: Rodar a suíte completa da fase**

Run: `npx vitest run src/features/gestor src/test/unit/route-gates.test.tsx src/test/unit/buildAppRoutes.test.ts`

Expected: PASS — 6 arquivos, todos verdes (11 testes em `primitivas.test.tsx`).

Depois, os 4 comandos de fechamento da fase:
- `npx eslint src/features/gestor --rule '{"@typescript-eslint/prefer-nullish-coalescing":"off"}'` → sem output, exit 0.
- `npm run type-check` → sem output, exit 0.
- `npm run test:run` → suíte inteira verde (nenhuma regressão fora de `src/features/gestor`).
- `npm run build` → `✓ built in …`, exit 0.

- [ ] **Step 9: Commit**
```bash
git add src/features/gestor/components src/features/gestor/__tests__/primitivas.test.tsx
git commit -m "feat(gestor-v2): primitivas de estado e rastreabilidade

GestorSkeleton (reserva a altura final), EstadoVazio, EstadoErro com
retry local, BadgeStatus, ChipNivel (cor de token + rotulo textual,
nunca so cor), TooltipRastreabilidade (Periodo/Fonte/Atualizado em/
Criterio lendo o Meta do servidor) e BlocoErrorBoundary — boundary por
bloco: grafico quebrado nao derruba a tela.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 30b: Glossário "Entenda as métricas"

> **Pertence à Fase 2.** É primitiva transversal consumida pela Visão Geral e pelo Detalhamento; precisa existir antes das telas para o link "Entenda as métricas" não nascer quebrado. Fecha a lacuna do handoff `docs/04-componentes.md` §7 e do spec §4.1 (a entrada "Nota TRI" some do glossário).

**Files:**
- Create: `src/features/gestor/components/Glossario.tsx`
- Test: `src/features/gestor/__tests__/Glossario.test.tsx`

**Interfaces:**
- Consumes: `PROFICIENCIA_MINIMA` de `src/features/gestor/lib/regras.ts` (Task 8); `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogTrigger` de `@/components/ui/dialog`.
- Produces: `export function Glossario(): JSX.Element` — botão-link "Entenda as métricas" que abre o diálogo. Consumido pela Task 46 (Visão Geral) e pela Task 56 (Detalhamento). Também `export const ENTRADAS_GLOSSARIO: { termo: string; definicao: string }[]`, usada pelo teste de regressão da Task 57.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/gestor/__tests__/Glossario.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Glossario, ENTRADAS_GLOSSARIO } from '../components/Glossario';

describe('Glossario', () => {
  it('lista as 5 entradas de escala', () => {
    expect(ENTRADAS_GLOSSARIO.map((e) => e.termo)).toEqual([
      'Proficiência (0 a 100)',
      'Conceito ENAMED projetado (1 a 5)',
      'Percentual de acerto',
      'Cobertura parcial',
      'Proficiente',
    ]);
  });

  it('NÃO contém a métrica "Nota TRI" (spec §4.1)', () => {
    const texto = JSON.stringify(ENTRADAS_GLOSSARIO);
    expect(texto).not.toMatch(/Nota TRI/i);
    expect(texto).not.toMatch(/\bTRI\b/);
  });

  it('define proficiente com o corte de 60 inclusivo', () => {
    const proficiente = ENTRADAS_GLOSSARIO.find((e) => e.termo === 'Proficiente');
    expect(proficiente?.definicao).toContain('60 ou mais');
  });

  it('abre pelo link e mostra as definições', async () => {
    const user = userEvent.setup();
    render(<Glossario />);

    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Entenda as métricas' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Entenda as métricas')).toBeInTheDocument();
    for (const entrada of ENTRADAS_GLOSSARIO) {
      expect(screen.getByText(entrada.termo)).toBeInTheDocument();
    }
  });

  it('fecha com ESC', async () => {
    const user = userEvent.setup();
    render(<Glossario />);

    await user.click(screen.getByRole('button', { name: 'Entenda as métricas' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/gestor/__tests__/Glossario.test.tsx`

Expected: FAIL com `Failed to resolve import "../components/Glossario"` (o arquivo ainda não existe).

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/features/gestor/components/Glossario.tsx
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { PROFICIENCIA_MINIMA } from '../lib/regras';

/**
 * Lista definitiva das escalas do portal — handoff docs/04-componentes.md §7.
 *
 * NÃO existe entrada "Nota TRI": a métrica foi eliminada como conceito separado
 * de proficiência (spec §4.1). O rótulo único é "Proficiência". Um teste de
 * regressão garante que a string não volte.
 */
export const ENTRADAS_GLOSSARIO: { termo: string; definicao: string }[] = [
  {
    termo: 'Proficiência (0 a 100)',
    definicao:
      'Desempenho estimado do aluno considerando a dificuldade das questões respondidas.',
  },
  {
    termo: 'Conceito ENAMED projetado (1 a 5)',
    definicao:
      'Projeção institucional a partir dos simulados. Não é o conceito oficial do MEC.',
  },
  {
    termo: 'Percentual de acerto',
    definicao:
      'Questões certas sobre questões respondidas, no recorte selecionado. É a única métrica válida para grande área, especialidade e tema.',
  },
  {
    termo: 'Cobertura parcial',
    definicao:
      'Recorte com poucos participantes ou poucas questões. Leia com cautela.',
  },
  {
    termo: 'Proficiente',
    definicao: `Proficiência de ${PROFICIENCIA_MINIMA} ou mais. O corte é do produto, não do MEC.`,
  },
];

export function Glossario() {
  const [aberto, setAberto] = useState(false);

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
        >
          Entenda as métricas
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Entenda as métricas</DialogTitle>
        </DialogHeader>

        <dl className="space-y-4">
          {ENTRADAS_GLOSSARIO.map((entrada) => (
            <div key={entrada.termo} className="space-y-1">
              <dt className="text-sm font-semibold text-foreground">
                {entrada.termo}
              </dt>
              <dd className="text-sm leading-5 text-muted-foreground">
                {entrada.definicao}
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/gestor/__tests__/Glossario.test.tsx`

Expected: PASS — 5 testes.

Depois: `npm run type-check` e `npm run lint`, ambos sem erro.

- [ ] **Step 5: Commit**

```bash
git add src/features/gestor/components/Glossario.tsx src/features/gestor/__tests__/Glossario.test.tsx
git commit -m "feat(gestor): glossario 'Entenda as metricas' sem a entrada Nota TRI

Lista definitiva das escalas (handoff docs/04 §7). A entrada 'Nota TRI' foi
eliminada por decisao da spec §4.1 — o rotulo unico e 'Proficiencia' — e um
teste de regressao garante que a string nao volte ao glossario.

Proficiente e definido com corte inclusivo importado de regras.ts, nao
hardcoded."
```

---

## Fase 3 — Tela 1: Início do Gestor

> Escopo desta fase: spec §2.1 (rota `/gestor`), §6.4 (derivação de status do cronograma), §8.2 (estado e prefetch), §8.4 (estados obrigatórios por bloco), §7.7 (sem PII em `localStorage`), handoff `docs/05-telas.md` tela 1 e `docs/04-componentes.md` §6.
>
> **Propósito da tela: ORIENTAR. Nenhum indicador de desempenho vive aqui** — sem proficiência, sem % de acerto, sem conceito ENAMED, sem TRI. A Task 35 tem um teste que falha se qualquer um desses aparecer.
>
> **Armadilhas confirmadas no repo, válidas para todas as tarefas desta fase:**
> 1. `src/test/setup.ts:29-38` mocka `react-router-dom` globalmente com `useNavigate: () => vi.fn()` e `useLocation: () => ({ pathname: '/' })`. **Qualquer teste que observe navegação real precisa sobrescrever esse mock com o módulo de verdade** (convenção já usada em `src/test/components/ExperienceGuard.test.tsx:22-32`).
> 2. `src/test/utils.tsx` usa `BrowserRouter` e cria o `QueryClient` internamente — **inservível** para os testes desta fase (precisamos de `MemoryRouter` e de acesso ao `queryClient`). Cada teste monta seu próprio wrapper; a duplicação de ~10 linhas é deliberada, para não criar acoplamento com as fatias paralelas.
> 3. Toda referência a variável de topo de arquivo dentro de uma factory de `vi.mock` usa `vi.hoisted` (a factory é içada acima das declarações e cair em TDZ é erro silencioso e confuso).
> 4. Não existe `EstadoVazio`/`EstadoErro` compartilhado no repo. Cada componente desta fase implementa seus estados inline com `Card` + `Button` + `Skeleton` de `src/components/ui/`.

---

### Task 31: CronogramaSimulados — componente e os 5 status

**Files:**
- Create: `src/features/gestor/components/CronogramaSimulados.tsx`
- Test: `src/features/gestor/__tests__/CronogramaSimulados.test.tsx`

**Interfaces:**
- Consumes:
  - `useCronograma(iesId: string)` de `src/features/gestor/api/queries.ts` — retorna `UseQueryResult<Envelope<ItemCronograma[]>, Error>`; portanto `query.data?.data` é `ItemCronograma[] | undefined`.
  - `ItemCronograma`, `StatusSimulado`, `ContextoGestor`, `Meta`, `Envelope<T>` de `src/features/gestor/api/types.ts`.
  - `formatData(iso: string | null): string` e `TRACO` de `src/features/gestor/lib/formatters.ts`.
  - `Card`, `CardContent`, `CardHeader`, `CardTitle` (`@/components/ui/card`), `Badge` (`@/components/ui/badge`), `Button` (`@/components/ui/button`), `Skeleton` (`@/components/ui/skeleton`), `cn` (`@/lib/utils`).
- Produces:
  - `CronogramaSimulados` (componente) e `CronogramaSimuladosProps { iesId: string; iesNome: string; contrato: ContextoGestor['contrato'] }` — consumidos pela Task 35.
  - `proximoSimulado(itens: ItemCronograma[]): string | null` — helper puro, exportado, consumido pelos testes.
  - `WHATSAPP_SANAR`, `MSG_AGENDAR(iesNome: string): string`, `MSG_CONSULTOR(iesNome: string): string` — exportados para o teste asserir os dois textos placeholder distintos (decisão 24/07).

**Decisões travadas nesta tarefa (não reabrir nas tarefas seguintes):**
- O rótulo do status `previsto` **é literalmente `"A definir"`** (spec §6.4); o item previsto não renderiza data nenhuma.
- O bloco "contratados sem data" **é o grupo de itens com `status === 'previsto'`** — não há segunda fonte de dado.
- `ItemCronograma` tem **um só** campo `data`. A regra de datas por modalidade (§6.4: online = início + liberação do resultado; presencial = realização) é implementada como **rótulo da data dependente da modalidade** (`Início:` / `Realização:`). A segunda data do online (liberação do resultado) **não existe no contrato canônico `ItemCronograma`** e é responsabilidade da superfície de admin (§6.3, pendência nº2) — fora desta fase, por decisão, não por omissão.
- O contrato do rodapé vem de `useGestorContexto()` (campo `ContextoGestor.contrato`) e entra como **prop**, não como segundo hook dentro do componente — mantém o componente com uma única dependência de dado.

- [ ] **Step 1: Write the failing test**

`src/features/gestor/__tests__/CronogramaSimulados.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  CronogramaSimulados,
  proximoSimulado,
  MSG_AGENDAR,
  MSG_CONSULTOR,
  WHATSAPP_SANAR,
} from '@/features/gestor/components/CronogramaSimulados';
import type { ContextoGestor, ItemCronograma, Meta } from '@/features/gestor/api/types';

const mocks = vi.hoisted(() => ({ useCronograma: vi.fn() }));

vi.mock('@/features/gestor/api/queries', () => ({
  useCronograma: mocks.useCronograma,
}));

const META: Meta = {
  periodo: '2026',
  fonte: 'ies_contrato_simulados',
  atualizadoEm: '2026-07-26T10:00:00Z',
  criterio: 'Slots do contrato vigente',
  partial: false,
  lowSample: false,
};

const CONTRATO: ContextoGestor['contrato'] = {
  nome: 'Academy 2026',
  simuladosContratados: 7,
  vigencia: '01/01/2026 a 31/12/2026',
};

/** Um item por status. s4 (18/08) é o próximo: vence s3 (20/09) na ordenação. */
const ITENS: ItemCronograma[] = [
  { id: 's1', nome: 'Simulado 1', data: '2026-03-10T12:00:00Z', status: 'realizado', modalidade: 'online', participantes: 88 },
  { id: 's2', nome: 'Simulado 2', data: '2026-05-12T12:00:00Z', status: 'processing', modalidade: 'presencial', indisponivelPorque: 'Gabarito em fechamento' },
  { id: 's3', nome: 'Simulado 3', data: '2026-09-20T12:00:00Z', status: 'agendado', modalidade: 'online' },
  { id: 's4', nome: 'Simulado 4', data: '2026-08-18T12:00:00Z', status: 'reagendado', modalidade: 'presencial' },
  { id: 's5', nome: 'Simulado 5', data: null, status: 'previsto', modalidade: null, indisponivelPorque: 'Data ainda não definida' },
];

const resultado = (over: Record<string, unknown> = {}) => ({
  isPending: false,
  isError: false,
  data: undefined,
  refetch: vi.fn(),
  ...over,
});

const montar = (props?: Partial<React.ComponentProps<typeof CronogramaSimulados>>) =>
  render(
    <CronogramaSimulados
      iesId="ies-1"
      iesNome="UEA"
      contrato={CONTRATO}
      {...props}
    />,
  );

beforeEach(() => {
  mocks.useCronograma.mockReturnValue(
    resultado({ data: { data: ITENS, meta: META } }),
  );
});

describe('proximoSimulado', () => {
  it('devolve o agendado/reagendado com a data mais próxima', () => {
    expect(proximoSimulado(ITENS)).toBe('s4');
  });

  it('ignora realizado, em processamento e previsto', () => {
    const soPassado: ItemCronograma[] = [ITENS[0], ITENS[1], ITENS[4]];
    expect(proximoSimulado(soPassado)).toBeNull();
  });

  it('devolve null com lista vazia', () => {
    expect(proximoSimulado([])).toBeNull();
  });
});

describe('CronogramaSimulados — os 5 status (spec §6.4)', () => {
  it('rotula cada um dos 5 status', () => {
    montar();
    expect(screen.getByTestId('cronograma-item-s1')).toHaveTextContent('Realizado');
    expect(screen.getByTestId('cronograma-item-s2')).toHaveTextContent('Em processamento');
    expect(screen.getByTestId('cronograma-item-s3')).toHaveTextContent('Agendado');
    expect(screen.getByTestId('cronograma-item-s4')).toHaveTextContent('Reagendado');
    expect(screen.getByTestId('cronograma-item-s5')).toHaveTextContent('A definir');
  });

  it('previsto exibe "A definir" e nenhuma data', () => {
    montar();
    const previsto = screen.getByTestId('cronograma-item-s5');
    expect(previsto).toHaveTextContent('A definir');
    expect(previsto.textContent).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it('rotula a data conforme a modalidade: online = Início, presencial = Realização', () => {
    montar();
    expect(screen.getByTestId('cronograma-item-s1')).toHaveTextContent('Início: 10/03/2026');
    expect(screen.getByTestId('cronograma-item-s4')).toHaveTextContent('Realização: 18/08/2026');
  });

  it('mostra o motivo de indisponibilidade quando o servidor manda', () => {
    montar();
    expect(screen.getByTestId('cronograma-item-s2')).toHaveTextContent('Gabarito em fechamento');
  });

  it('destaca o próximo simulado e só ele', () => {
    montar();
    expect(screen.getByTestId('cronograma-item-s4')).toHaveAttribute('data-destaque', 'true');
    expect(screen.getByTestId('cronograma-item-s3')).toHaveAttribute('data-destaque', 'false');
    expect(screen.getByText('Próximo simulado')).toBeInTheDocument();
  });
});

describe('CronogramaSimulados — bloco de contratados sem data', () => {
  it('agrupa os previstos com a contagem', () => {
    montar();
    const bloco = screen.getByTestId('cronograma-sem-data');
    expect(bloco).toHaveTextContent('Contratados sem data (1)');
    expect(bloco).toContainElement(screen.getByTestId('cronograma-item-s5'));
  });

  it('Agendar e Falar com consultor abrem o WhatsApp com textos diferentes', async () => {
    const abrir = vi.fn();
    vi.stubGlobal('open', abrir);
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByRole('button', { name: /agendar/i }));
    await user.click(screen.getByRole('button', { name: /falar com consultor/i }));

    expect(abrir).toHaveBeenCalledTimes(2);
    const [urlAgendar] = abrir.mock.calls[0] as [string];
    const [urlConsultor] = abrir.mock.calls[1] as [string];

    expect(urlAgendar).toBe(
      `https://wa.me/${WHATSAPP_SANAR}?text=${encodeURIComponent(MSG_AGENDAR('UEA'))}`,
    );
    expect(urlConsultor).toBe(
      `https://wa.me/${WHATSAPP_SANAR}?text=${encodeURIComponent(MSG_CONSULTOR('UEA'))}`,
    );
    expect(urlAgendar).not.toBe(urlConsultor);
  });

  it('não renderiza o bloco quando todo simulado tem data', () => {
    mocks.useCronograma.mockReturnValue(
      resultado({ data: { data: ITENS.slice(0, 4), meta: META } }),
    );
    montar();
    expect(screen.queryByTestId('cronograma-sem-data')).not.toBeInTheDocument();
  });
});

describe('CronogramaSimulados — proveniência e estados (§8.4)', () => {
  it('mostra o contrato e a vigência no rodapé', () => {
    montar();
    expect(screen.getByTestId('cronograma-proveniencia')).toHaveTextContent(
      'Academy 2026 · vigência 01/01/2026 a 31/12/2026',
    );
  });

  it('omite o rodapé quando não há contrato', () => {
    montar({ contrato: null });
    expect(screen.queryByTestId('cronograma-proveniencia')).not.toBeInTheDocument();
  });

  it('loading: skeleton que reserva altura, sem itens', () => {
    mocks.useCronograma.mockReturnValue(resultado({ isPending: true }));
    montar();
    expect(screen.getAllByTestId('cronograma-skeleton')).toHaveLength(4);
    expect(screen.queryByTestId('cronograma-item-s1')).not.toBeInTheDocument();
  });

  it('empty: nenhum simulado contratado', () => {
    mocks.useCronograma.mockReturnValue(resultado({ data: { data: [], meta: META } }));
    montar();
    expect(screen.getByText(/nenhum simulado contratado/i)).toBeInTheDocument();
  });

  it('error: mensagem + Tentar novamente refaz só esta query', async () => {
    const refetch = vi.fn();
    mocks.useCronograma.mockReturnValue(resultado({ isError: true, refetch }));
    const user = userEvent.setup();
    montar();

    expect(screen.getByText(/não foi possível carregar o cronograma/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/gestor/__tests__/CronogramaSimulados.test.tsx`

Expected: FAIL com `Failed to resolve import "@/features/gestor/components/CronogramaSimulados"` (o arquivo ainda não existe).

- [ ] **Step 3: Write minimal implementation**

`src/features/gestor/components/CronogramaSimulados.tsx`

```tsx
import { CalendarPlus, MessageCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useCronograma } from '@/features/gestor/api/queries';
import { formatData } from '@/features/gestor/lib/formatters';
import type {
  ContextoGestor,
  ItemCronograma,
  StatusSimulado,
} from '@/features/gestor/api/types';

/** Mesmo número já usado nos fluxos de suporte do app (QuickActionsDock, SanarClass). */
export const WHATSAPP_SANAR = '5571993120049';

/**
 * Textos placeholder distintos por ação (decisão 24/07): as duas ações são
 * redirects simples para o WhatsApp, sem fluxo de agendamento no produto.
 */
export const MSG_AGENDAR = (iesNome: string): string =>
  `Olá! Sou gestor(a) da ${iesNome} no SanarFlix Academy e quero definir a data de um simulado já contratado.`;

export const MSG_CONSULTOR = (iesNome: string): string =>
  `Olá! Sou gestor(a) da ${iesNome} no SanarFlix Academy e gostaria de falar com um consultor sobre o contrato de simulados.`;

/** Rótulos de status — spec §6.4. `previsto` exibe literalmente "A definir". */
const STATUS_LABEL: Record<StatusSimulado, string> = {
  realizado: 'Realizado',
  processing: 'Em processamento',
  agendado: 'Agendado',
  reagendado: 'Reagendado',
  previsto: 'A definir',
};

const STATUS_VARIANT: Record<StatusSimulado, 'default' | 'secondary' | 'outline'> = {
  realizado: 'secondary',
  processing: 'outline',
  agendado: 'default',
  reagendado: 'default',
  previsto: 'outline',
};

/**
 * Datas por modalidade (§6.4): online tem data de início; presencial, data de
 * realização. A liberação do resultado do online não existe em `ItemCronograma`
 * e depende da superfície de admin (§6.3) — fora desta fase.
 */
const ROTULO_DATA: Record<'online' | 'presencial', string> = {
  online: 'Início',
  presencial: 'Realização',
};

/** Próximo simulado = agendado/reagendado com a data mais próxima (§6.4). */
export function proximoSimulado(itens: ItemCronograma[]): string | null {
  const candidatos = itens
    .filter(
      (item) =>
        (item.status === 'agendado' || item.status === 'reagendado') &&
        item.data !== null,
    )
    .sort((a, b) => (a.data as string).localeCompare(b.data as string));

  return candidatos[0]?.id ?? null;
}

function abrirWhatsApp(texto: string): void {
  window.open(
    `https://wa.me/${WHATSAPP_SANAR}?text=${encodeURIComponent(texto)}`,
    '_blank',
    'noopener,noreferrer',
  );
}

export interface CronogramaSimuladosProps {
  iesId: string;
  iesNome: string;
  contrato: ContextoGestor['contrato'];
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <Card data-testid="cronograma">
      <CardHeader>
        <CardTitle className="text-base">Cronograma de Simulados</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function CronogramaSimulados({
  iesId,
  iesNome,
  contrato,
}: CronogramaSimuladosProps) {
  const query = useCronograma(iesId);

  if (query.isPending) {
    return (
      <Moldura>
        <div className="space-y-3">
          {[0, 1, 2, 3].map((linha) => (
            <Skeleton
              key={linha}
              data-testid="cronograma-skeleton"
              className="h-16 w-full"
            />
          ))}
        </div>
      </Moldura>
    );
  }

  if (query.isError) {
    return (
      <Moldura>
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar o cronograma.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => void query.refetch()}
        >
          Tentar novamente
        </Button>
      </Moldura>
    );
  }

  const itens = query.data?.data ?? [];

  if (itens.length === 0) {
    return (
      <Moldura>
        <p className="text-sm font-medium text-foreground">
          Nenhum simulado contratado
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Quando a Sanar registrar o contrato da instituição, o cronograma
          aparece aqui.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => abrirWhatsApp(MSG_CONSULTOR(iesNome))}
        >
          <MessageCircle aria-hidden="true" />
          Falar com consultor
        </Button>
      </Moldura>
    );
  }

  const previstos = itens.filter((item) => item.status === 'previsto');
  const comData = itens.filter((item) => item.status !== 'previsto');
  const destaqueId = proximoSimulado(itens);

  return (
    <Moldura>
      <ul className="divide-y divide-border">
        {comData.map((item) => {
          const destaque = item.id === destaqueId;
          return (
            <li key={item.id} className="py-1">
              <div
                data-testid={`cronograma-item-${item.id}`}
                data-destaque={destaque ? 'true' : 'false'}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-md px-3 py-3',
                  destaque && 'border border-primary bg-primary/5',
                )}
              >
                <div className="min-w-0">
                  {destaque && (
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                      Próximo simulado
                    </p>
                  )}
                  <p className="truncate text-sm font-medium text-foreground">
                    {item.nome}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.modalidade ? `${ROTULO_DATA[item.modalidade]}: ` : ''}
                    {formatData(item.data)}
                    {typeof item.participantes === 'number'
                      ? ` · ${item.participantes} participantes`
                      : ''}
                  </p>
                  {item.indisponivelPorque && (
                    <p className="text-xs text-muted-foreground">
                      {item.indisponivelPorque}
                    </p>
                  )}
                </div>
                <Badge variant={STATUS_VARIANT[item.status]}>
                  {STATUS_LABEL[item.status]}
                </Badge>
              </div>
            </li>
          );
        })}
      </ul>

      {previstos.length > 0 && (
        <div
          data-testid="cronograma-sem-data"
          className="mt-4 rounded-md border border-dashed border-border p-3"
        >
          <p className="text-sm font-medium text-foreground">
            {`Contratados sem data (${previstos.length})`}
          </p>
          <ul className="mt-2 space-y-1">
            {previstos.map((item) => (
              <li key={item.id}>
                <div
                  data-testid={`cronograma-item-${item.id}`}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="truncate text-foreground">{item.nome}</span>
                  <Badge variant={STATUS_VARIANT.previsto}>
                    {STATUS_LABEL.previsto}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => abrirWhatsApp(MSG_AGENDAR(iesNome))}
            >
              <CalendarPlus aria-hidden="true" />
              Agendar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => abrirWhatsApp(MSG_CONSULTOR(iesNome))}
            >
              <MessageCircle aria-hidden="true" />
              Falar com consultor
            </Button>
          </div>
        </div>
      )}

      {contrato && (
        <p
          data-testid="cronograma-proveniencia"
          className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground"
        >
          {`${contrato.nome} · vigência ${contrato.vigencia}`}
        </p>
      )}
    </Moldura>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/gestor/__tests__/CronogramaSimulados.test.tsx`

Expected: PASS — 15 testes passando (`Test Files 1 passed`).

- [ ] **Step 5: Commit**

```bash
git add src/features/gestor/components/CronogramaSimulados.tsx src/features/gestor/__tests__/CronogramaSimulados.test.tsx
git commit -m "feat(gestor): CronogramaSimulados com os 5 status e bloco de contratados sem data"
```

---

### Task 32: Navegação do cronograma para o Detalhamento já filtrado

**Files:**
- Modify: `src/features/gestor/components/CronogramaSimulados.tsx`
- Test: `src/features/gestor/__tests__/CronogramaNavegacao.test.tsx`

**Interfaces:**
- Consumes: tudo da Task 31 + `useNavigate` de `react-router-dom`.
- Produces: nenhum símbolo novo. Contrato de comportamento: **simulado `realizado` navega para `/gestor/detalhamento?simulados=<id>`**; qualquer outro status é botão `disabled`. A chave de query `simulados` é a mesma que `useFiltrosGestor` lê (contexto canônico: chaves `semestre`, `simulados` csv, `ies`), então o Detalhamento nasce filtrado naquele simulado.

**Por que só `realizado` navega:** `processing`, `agendado`, `reagendado` e `previsto` não têm resultado no banco — o Detalhamento abriria vazio. Spec §4.7.1: simulado previsto ou em processamento aparece desabilitado com o motivo. Estendemos a mesma regra a agendado/reagendado, que igualmente não têm dado.

- [ ] **Step 1: Write the failing test**

`src/features/gestor/__tests__/CronogramaNavegacao.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { CronogramaSimulados } from '@/features/gestor/components/CronogramaSimulados';
import type { ContextoGestor, ItemCronograma, Meta } from '@/features/gestor/api/types';

const mocks = vi.hoisted(() => ({ useCronograma: vi.fn() }));

vi.mock('@/features/gestor/api/queries', () => ({
  useCronograma: mocks.useCronograma,
}));

/**
 * src/test/setup.ts mocka react-router-dom com useNavigate: () => vi.fn(),
 * o que torna impossível observar navegação. Aqui devolvemos o módulo real
 * (mesma convenção de src/test/components/ExperienceGuard.test.tsx).
 */
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  );
  return actual;
});

const META: Meta = {
  periodo: '2026',
  fonte: 'ies_contrato_simulados',
  atualizadoEm: '2026-07-26T10:00:00Z',
  criterio: 'Slots do contrato vigente',
  partial: false,
  lowSample: false,
};

const CONTRATO: ContextoGestor['contrato'] = {
  nome: 'Academy 2026',
  simuladosContratados: 7,
  vigencia: '01/01/2026 a 31/12/2026',
};

const ITENS: ItemCronograma[] = [
  { id: 's1', nome: 'Simulado 1', data: '2026-03-10T12:00:00Z', status: 'realizado', modalidade: 'online', participantes: 88 },
  { id: 's2', nome: 'Simulado 2', data: '2026-05-12T12:00:00Z', status: 'processing', modalidade: 'presencial', indisponivelPorque: 'Gabarito em fechamento' },
  { id: 's3', nome: 'Simulado 3', data: '2026-09-20T12:00:00Z', status: 'agendado', modalidade: 'online' },
  { id: 's5', nome: 'Simulado 5', data: null, status: 'previsto', modalidade: null, indisponivelPorque: 'Data ainda não definida' },
];

function SondaDeRota() {
  const location = useLocation();
  return <div data-testid="rota">{`${location.pathname}${location.search}`}</div>;
}

const montar = () =>
  render(
    <MemoryRouter initialEntries={['/gestor']}>
      <SondaDeRota />
      <CronogramaSimulados iesId="ies-1" iesNome="UEA" contrato={CONTRATO} />
    </MemoryRouter>,
  );

beforeEach(() => {
  mocks.useCronograma.mockReturnValue({
    isPending: false,
    isError: false,
    data: { data: ITENS, meta: META },
    refetch: vi.fn(),
  });
});

describe('CronogramaSimulados — navegação para o Detalhamento (spec §2.1, §4.7)', () => {
  it('parte de /gestor', () => {
    montar();
    expect(screen.getByTestId('rota')).toHaveTextContent('/gestor');
  });

  it('clique em simulado realizado abre o Detalhamento já filtrado naquele simulado', async () => {
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByTestId('cronograma-item-s1'));

    expect(screen.getByTestId('rota')).toHaveTextContent(
      '/gestor/detalhamento?simulados=s1',
    );
  });

  it('simulado em processamento não é clicável e mostra o motivo', async () => {
    const user = userEvent.setup();
    montar();

    const item = screen.getByTestId('cronograma-item-s2');
    expect(item).toBeDisabled();
    expect(item).toHaveTextContent('Gabarito em fechamento');

    await user.click(item);
    expect(screen.getByTestId('rota')).toHaveTextContent('/gestor');
    expect(screen.getByTestId('rota').textContent).not.toContain('detalhamento');
  });

  it('simulado agendado não é clicável', async () => {
    const user = userEvent.setup();
    montar();

    const item = screen.getByTestId('cronograma-item-s3');
    expect(item).toBeDisabled();

    await user.click(item);
    expect(screen.getByTestId('rota').textContent).not.toContain('detalhamento');
  });

  it('simulado previsto não é clicável e mostra o motivo', async () => {
    const user = userEvent.setup();
    montar();

    const item = screen.getByTestId('cronograma-item-s5');
    expect(item).toBeDisabled();
    expect(item).toHaveTextContent('Data ainda não definida');

    await user.click(item);
    expect(screen.getByTestId('rota').textContent).not.toContain('detalhamento');
  });

  it('só o realizado é habilitado', () => {
    montar();
    expect(screen.getByTestId('cronograma-item-s1')).toBeEnabled();
    for (const id of ['s2', 's3', 's5']) {
      expect(screen.getByTestId(`cronograma-item-${id}`)).toBeDisabled();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/gestor/__tests__/CronogramaNavegacao.test.tsx`

Expected: FAIL. O primeiro erro é em `expect(item).toBeDisabled()` / no clique: `received element is not disabled` e a sonda continua em `/gestor` — os itens ainda são `<div>`, não `<button>`, e não existe `navigate`.

- [ ] **Step 3: Write minimal implementation**

Três edições em `src/features/gestor/components/CronogramaSimulados.tsx`.

3.1 — adicionar o import do router no topo, logo acima do import de `lucide-react`:

```tsx
import { useNavigate } from 'react-router-dom';
```

3.2 — obter o `navigate` no início do componente, substituindo a linha `const query = useCronograma(iesId);` por:

```tsx
  const navigate = useNavigate();
  const query = useCronograma(iesId);
```

3.3 — substituir o `<div data-testid={...}>` de cada item com data por um `<button>`. Trocar todo o bloco `{comData.map((item) => { ... })}` por:

```tsx
        {comData.map((item) => {
          const destaque = item.id === destaqueId;
          // Só realizado tem resultado no banco; o resto abriria vazio (§4.7.1).
          const navegavel = item.status === 'realizado';
          return (
            <li key={item.id} className="py-1">
              <button
                type="button"
                disabled={!navegavel}
                data-testid={`cronograma-item-${item.id}`}
                data-destaque={destaque ? 'true' : 'false'}
                onClick={() =>
                  navigate(`/gestor/detalhamento?simulados=${item.id}`)
                }
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-md px-3 py-3 text-left transition-colors',
                  navegavel &&
                    'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  !navegavel && 'cursor-default',
                  destaque && 'border border-primary bg-primary/5',
                )}
              >
                <div className="min-w-0">
                  {destaque && (
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                      Próximo simulado
                    </p>
                  )}
                  <p className="truncate text-sm font-medium text-foreground">
                    {item.nome}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.modalidade ? `${ROTULO_DATA[item.modalidade]}: ` : ''}
                    {formatData(item.data)}
                    {typeof item.participantes === 'number'
                      ? ` · ${item.participantes} participantes`
                      : ''}
                  </p>
                  {item.indisponivelPorque && (
                    <p className="text-xs text-muted-foreground">
                      {item.indisponivelPorque}
                    </p>
                  )}
                </div>
                <Badge variant={STATUS_VARIANT[item.status]}>
                  {STATUS_LABEL[item.status]}
                </Badge>
              </button>
            </li>
          );
        })}
```

O `data-testid` e o `data-destaque` **mudam de elemento** (do `div` para o `button`) — não são duplicados, então os testes da Task 31 continuam válidos.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/gestor/__tests__/CronogramaNavegacao.test.tsx src/features/gestor/__tests__/CronogramaSimulados.test.tsx`

Expected: PASS nos dois arquivos — `Test Files 2 passed`, 21 testes. (Rodar os dois juntos é obrigatório: a Task 32 reescreve o markup coberto pela Task 31.)

- [ ] **Step 5: Commit**

```bash
git add src/features/gestor/components/CronogramaSimulados.tsx src/features/gestor/__tests__/CronogramaNavegacao.test.tsx
git commit -m "feat(gestor): simulado realizado no cronograma abre o Detalhamento ja filtrado"
```

---

### Task 33: AvisosSanar com marcação de lido otimista e rollback

**Files:**
- Create: `src/features/gestor/hooks/useMarcarAvisoLido.ts`
- Create: `src/features/gestor/components/AvisosSanar.tsx`
- Test: `src/features/gestor/__tests__/AvisosSanar.test.tsx`

**Interfaces:**
- Consumes:
  - `useAvisos(iesId: string)` de `src/features/gestor/api/queries.ts` — `UseQueryResult<Envelope<Aviso[]>, Error>`, queryKey canônica `['gestor', 'avisos', iesId]`.
  - `Aviso`, `Envelope<T>`, `Meta` de `src/features/gestor/api/types.ts`.
  - `formatData` de `src/features/gestor/lib/formatters.ts`.
  - `supabase` de `@/integrations/supabase/client` (tabela `announcements_viewed`, `Insert` exige `announcement_id` + `user_id` — conferido em `src/integrations/supabase/types.ts:233-238`).
- Produces:
  - `avisosQueryKey(iesId: string): readonly ['gestor', 'avisos', string]` — **a queryKey canônica dos avisos**. `queries.ts` deve usar exatamente esta tupla em `useAvisos`; se usar outra, o update otimista não encontra o cache. O Step 6 verifica isso.
  - `useMarcarAvisoLido(iesId: string): UseMutationResult<void, Error, string, ContextoRollback>`.
  - `AvisosSanar` + `AvisosSanarProps { iesId: string }` e `AVISOS_VISIVEIS = 3` — consumidos pela Task 35.

**Decisões travadas:**
- A marcação de lido é **escrita direta em `announcements_viewed`**, não uma 11ª RPC — é o padrão já em produção no app (`src/hooks/home/useAnnouncements.ts:150-155`, `src/components/home/AnnouncementsCard.tsx:100`), a RLS da tabela já permite, e as 10 RPCs canônicas do portal são todas de leitura.
- **Sem `invalidateQueries` no `onSettled`**: o valor otimista (`lido: true`) é exatamente o estado final no servidor, então invalidar só geraria um refetch a cada abertura de aviso. O rollback do `onError` cobre a falha.
- **"Ver todos" expande a lista no lugar** (`Ver todos` ⇄ `Ver menos`). Não existe rota de avisos no escopo desta entrega e uma prop de callback sem destino seria código morto.
- Nada de aviso vai para `localStorage` (§7.7) — cache só em memória, via React Query.

- [ ] **Step 1: Write the failing test**

`src/features/gestor/__tests__/AvisosSanar.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AvisosSanar, AVISOS_VISIVEIS } from '@/features/gestor/components/AvisosSanar';
import { avisosQueryKey } from '@/features/gestor/hooks/useMarcarAvisoLido';
import type { Aviso, Envelope, Meta } from '@/features/gestor/api/types';

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: mocks.getUser },
    from: (tabela: string) => {
      mocks.from(tabela);
      return { insert: mocks.insert };
    },
  },
}));

/**
 * useAvisos real leria a RPC. Aqui ele é um useQuery na queryKey canônica com
 * staleTime infinito: o teste semeia o cache e o hook devolve o dado semeado
 * sem chamar queryFn. Assim o update otimista da mutation aparece na UI de
 * verdade, em vez de ser observado só no cache.
 */
vi.mock('@/features/gestor/api/queries', async () => {
  const rq = await vi.importActual<typeof import('@tanstack/react-query')>(
    '@tanstack/react-query',
  );
  return {
    useAvisos: (iesId: string) =>
      rq.useQuery({
        queryKey: ['gestor', 'avisos', iesId],
        queryFn: () => {
          throw new Error('queryFn não deve ser chamada: o cache é semeado no teste');
        },
        staleTime: Infinity,
        retry: false,
      }),
  };
});

const META: Meta = {
  periodo: '2026',
  fonte: 'announcements',
  atualizadoEm: '2026-07-26T10:00:00Z',
  criterio: 'Avisos com publico_alvo contendo gestor',
  partial: false,
  lowSample: false,
};

const AVISOS: Aviso[] = [
  { id: 'a1', titulo: 'Manutencao programada', resumo: 'Janela de manutencao no sabado.', data: '2026-07-20T12:00:00Z', lido: false },
  { id: 'a2', titulo: 'Nova trilha disponivel', resumo: 'Trilha de revisao publicada.', data: '2026-07-18T12:00:00Z', lido: true },
  { id: 'a3', titulo: 'Atualizacao de contrato', resumo: 'Documento revisado no portal.', data: '2026-07-15T12:00:00Z', lido: true },
  { id: 'a4', titulo: 'Webinar para gestores', resumo: 'Inscricoes abertas.', data: '2026-07-10T12:00:00Z', lido: false },
];

const envelope = (avisos: Aviso[]): Envelope<Aviso[]> => ({ data: avisos, meta: META });

function montar(avisos: Aviso[] = AVISOS) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  queryClient.setQueryData(avisosQueryKey('ies-1'), envelope(avisos));

  const utils = render(
    <QueryClientProvider client={queryClient}>
      <AvisosSanar iesId="ies-1" />
    </QueryClientProvider>,
  );

  return { ...utils, queryClient };
}

beforeEach(() => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
  mocks.insert.mockResolvedValue({ error: null });
});

describe('AvisosSanar — lido e não-lido', () => {
  it('marca visualmente o não-lido com ponto de marca e o lido sem ponto', () => {
    montar();

    expect(screen.getByTestId('aviso-a1')).toHaveAttribute('data-lido', 'false');
    expect(screen.getByTestId('aviso-ponto-a1')).toBeInTheDocument();

    expect(screen.getByTestId('aviso-a2')).toHaveAttribute('data-lido', 'true');
    expect(screen.queryByTestId('aviso-ponto-a2')).not.toBeInTheDocument();
  });

  it('expõe "não lido" textualmente, não só por cor (a11y)', () => {
    montar();
    expect(screen.getByTestId('aviso-a1')).toHaveTextContent('não lido');
    expect(screen.getByTestId('aviso-a2')).not.toHaveTextContent('não lido');
  });

  it('abrir revela o resumo do aviso', async () => {
    const user = userEvent.setup();
    montar();

    expect(screen.queryByText('Janela de manutencao no sabado.')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('aviso-a1'));
    expect(screen.getByText('Janela de manutencao no sabado.')).toBeInTheDocument();
  });
});

describe('AvisosSanar — marcar como lido (otimista)', () => {
  it('abrir um não-lido marca como lido na hora e grava em announcements_viewed', async () => {
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByTestId('aviso-a1'));

    await waitFor(() => {
      expect(screen.getByTestId('aviso-a1')).toHaveAttribute('data-lido', 'true');
    });
    expect(screen.queryByTestId('aviso-ponto-a1')).not.toBeInTheDocument();

    expect(mocks.from).toHaveBeenCalledWith('announcements_viewed');
    expect(mocks.insert).toHaveBeenCalledWith({
      announcement_id: 'a1',
      user_id: 'user-1',
    });
  });

  it('abrir um já lido não grava nada', async () => {
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByTestId('aviso-a2'));

    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('rollback: falha na escrita devolve o aviso para não-lido', async () => {
    mocks.insert.mockResolvedValue({ error: { message: 'rls_violation' } });
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByTestId('aviso-a1'));

    // otimista primeiro
    await waitFor(() => {
      expect(screen.getByTestId('aviso-a1')).toHaveAttribute('data-lido', 'true');
    });
    // e depois volta
    await waitFor(() => {
      expect(screen.getByTestId('aviso-a1')).toHaveAttribute('data-lido', 'false');
    });
    expect(screen.getByTestId('aviso-ponto-a1')).toBeInTheDocument();
  });

  it('rollback também acontece quando não há sessão', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByTestId('aviso-a1'));

    await waitFor(() => {
      expect(screen.getByTestId('aviso-a1')).toHaveAttribute('data-lido', 'false');
    });
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});

describe('AvisosSanar — limite de 3 + Ver todos', () => {
  it('mostra no máximo 3 avisos', () => {
    montar();
    expect(AVISOS_VISIVEIS).toBe(3);
    expect(screen.getAllByTestId(/^aviso-a\d$/)).toHaveLength(3);
    expect(screen.queryByTestId('aviso-a4')).not.toBeInTheDocument();
  });

  it('Ver todos expande e Ver menos recolhe', async () => {
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByRole('button', { name: 'Ver todos' }));
    expect(screen.getAllByTestId(/^aviso-a\d$/)).toHaveLength(4);
    expect(screen.getByTestId('aviso-a4')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ver menos' }));
    expect(screen.getAllByTestId(/^aviso-a\d$/)).toHaveLength(3);
  });

  it('não oferece Ver todos com 3 avisos ou menos', () => {
    montar(AVISOS.slice(0, 3));
    expect(screen.queryByRole('button', { name: 'Ver todos' })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/gestor/__tests__/AvisosSanar.test.tsx`

Expected: FAIL com `Failed to resolve import "@/features/gestor/components/AvisosSanar"` e `Failed to resolve import "@/features/gestor/hooks/useMarcarAvisoLido"`.

- [ ] **Step 3: Write minimal implementation**

3.1 — `src/features/gestor/hooks/useMarcarAvisoLido.ts`

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Aviso, Envelope } from '@/features/gestor/api/types';

/**
 * queryKey canônica dos avisos do gestor. `useAvisos` em api/queries.ts usa
 * exatamente esta tupla — o update otimista abaixo depende disso.
 */
export const avisosQueryKey = (iesId: string) =>
  ['gestor', 'avisos', iesId] as const;

interface ContextoRollback {
  anterior: Envelope<Aviso[]> | undefined;
}

/**
 * Marca um aviso como lido. Escrita direta em `announcements_viewed`, mesmo
 * caminho já em produção no app do aluno (src/hooks/home/useAnnouncements.ts).
 * Update otimista com rollback: o gestor vê o ponto sumir na hora.
 */
export function useMarcarAvisoLido(iesId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string, ContextoRollback>({
    mutationFn: async (avisoId) => {
      const { data: sessao } = await supabase.auth.getUser();
      const userId = sessao?.user?.id;
      if (!userId) {
        throw new Error('sem_sessao');
      }

      const { error } = await supabase
        .from('announcements_viewed')
        .insert({ announcement_id: avisoId, user_id: userId });

      if (error) {
        throw new Error(error.message);
      }
    },

    onMutate: async (avisoId) => {
      await queryClient.cancelQueries({ queryKey: avisosQueryKey(iesId) });
      const anterior = queryClient.getQueryData<Envelope<Aviso[]>>(
        avisosQueryKey(iesId),
      );

      if (anterior) {
        queryClient.setQueryData<Envelope<Aviso[]>>(avisosQueryKey(iesId), {
          ...anterior,
          data: anterior.data.map((aviso) =>
            aviso.id === avisoId ? { ...aviso, lido: true } : aviso,
          ),
        });
      }

      return { anterior };
    },

    onError: (_erro, _avisoId, contexto) => {
      if (contexto?.anterior) {
        queryClient.setQueryData(avisosQueryKey(iesId), contexto.anterior);
      }
    },

    // Sem invalidateQueries de propósito: o valor otimista é exatamente o
    // estado final no servidor, e invalidar geraria refetch a cada abertura.
  });
}
```

3.2 — `src/features/gestor/components/AvisosSanar.tsx`

```tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useAvisos } from '@/features/gestor/api/queries';
import { useMarcarAvisoLido } from '@/features/gestor/hooks/useMarcarAvisoLido';
import { formatData } from '@/features/gestor/lib/formatters';
import type { Aviso } from '@/features/gestor/api/types';

/** Máximo de avisos na home (handoff docs/04-componentes.md §6). */
export const AVISOS_VISIVEIS = 3;

export interface AvisosSanarProps {
  iesId: string;
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <Card data-testid="avisos">
      <CardHeader>
        <CardTitle className="text-base">Avisos da Sanar</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function AvisosSanar({ iesId }: AvisosSanarProps) {
  const query = useAvisos(iesId);
  const marcarLido = useMarcarAvisoLido(iesId);
  const [expandido, setExpandido] = useState(false);
  const [abertoId, setAbertoId] = useState<string | null>(null);

  if (query.isPending) {
    return (
      <Moldura>
        <div className="space-y-3">
          {[0, 1, 2].map((linha) => (
            <Skeleton
              key={linha}
              data-testid="avisos-skeleton"
              className="h-14 w-full"
            />
          ))}
        </div>
      </Moldura>
    );
  }

  if (query.isError) {
    return (
      <Moldura>
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar os avisos.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => void query.refetch()}
        >
          Tentar novamente
        </Button>
      </Moldura>
    );
  }

  const avisos = query.data?.data ?? [];

  if (avisos.length === 0) {
    return (
      <Moldura>
        <p className="text-sm text-muted-foreground">
          Nenhum aviso da Sanar por aqui.
        </p>
      </Moldura>
    );
  }

  const visiveis = expandido ? avisos : avisos.slice(0, AVISOS_VISIVEIS);

  const abrir = (aviso: Aviso) => {
    setAbertoId((atual) => (atual === aviso.id ? null : aviso.id));
    if (!aviso.lido) {
      marcarLido.mutate(aviso.id);
    }
  };

  return (
    <Moldura>
      <ul className="space-y-1">
        {visiveis.map((aviso) => (
          <li key={aviso.id}>
            <button
              type="button"
              data-testid={`aviso-${aviso.id}`}
              data-lido={aviso.lido ? 'true' : 'false'}
              aria-expanded={abertoId === aviso.id}
              onClick={() => abrir(aviso)}
              className={cn(
                'w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-accent',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                !aviso.lido && 'bg-primary/5',
              )}
            >
              <span className="flex items-center gap-2">
                {!aviso.lido && (
                  <span
                    data-testid={`aviso-ponto-${aviso.id}`}
                    aria-hidden="true"
                    className="h-2 w-2 shrink-0 rounded-full bg-primary"
                  />
                )}
                <span className="truncate text-sm font-medium text-foreground">
                  {aviso.titulo}
                </span>
                {!aviso.lido && <span className="sr-only">não lido</span>}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {formatData(aviso.data)}
              </span>
              {abertoId === aviso.id && (
                <span className="mt-2 block text-sm text-muted-foreground">
                  {aviso.resumo}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {avisos.length > AVISOS_VISIVEIS && (
        <Button
          variant="link"
          size="sm"
          className="mt-2 px-0"
          onClick={() => setExpandido((atual) => !atual)}
        >
          {expandido ? 'Ver menos' : 'Ver todos'}
        </Button>
      )}
    </Moldura>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/gestor/__tests__/AvisosSanar.test.tsx`

Expected: PASS — 10 testes.

- [ ] **Step 5: Verify the queryKey matches queries.ts**

Run: `npx grep -n "avisos" src/features/gestor/api/queries.ts` — ou, mais direto:

```bash
grep -n "avisos" "src/features/gestor/api/queries.ts"
```

Expected: a linha de `queryKey` de `useAvisos` contém exatamente `['gestor', 'avisos', iesId]`. Se estiver diferente (ex.: `'gestor-avisos'`, ou parâmetros a mais), editar `queries.ts` para importar e usar `avisosQueryKey` de `@/features/gestor/hooks/useMarcarAvisoLido`:

```ts
import { avisosQueryKey } from '@/features/gestor/hooks/useMarcarAvisoLido';
// ...
    queryKey: avisosQueryKey(iesId),
```

Depois: `npx vitest run src/features/gestor/__tests__/AvisosSanar.test.tsx` → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/gestor/hooks/useMarcarAvisoLido.ts src/features/gestor/components/AvisosSanar.tsx src/features/gestor/__tests__/AvisosSanar.test.tsx src/features/gestor/api/queries.ts
git commit -m "feat(gestor): AvisosSanar com marcacao de lido otimista e rollback"
```

---

### Task 34: Direcionadores, saudação e prefetch da Visão Geral

**Files:**
- Create: `src/features/gestor/api/prefetch.ts`
- Create: `src/features/gestor/components/SaudacaoGestor.tsx`
- Create: `src/features/gestor/components/DirecionadoresGestor.tsx`
- Test: `src/features/gestor/__tests__/Direcionadores.test.tsx`

**Interfaces:**
- Consumes:
  - `useGestorContexto()` de `src/features/gestor/api/queries.ts` — `UseQueryResult<Envelope<ContextoGestor>, Error>`.
  - `ContextoGestor`, `Envelope`, `FiltroSemestre`, `VisaoGeral`, `Meta` de `src/features/gestor/api/types.ts`.
  - `supabase` de `@/integrations/supabase/client` com `src/integrations/supabase/types.ts` **já regenerado na Fase 1** incluindo a RPC `get_gestor_visao_geral` (do contrário `supabase.rpc('get_gestor_visao_geral', ...)` não type-checa).
  - `QueryClient` / `useQueryClient` de `@tanstack/react-query`; `Link` de `react-router-dom`.
- Produces:
  - `visaoGeralQueryKey(iesId, semestre): readonly ['gestor', 'visao-geral', string, FiltroSemestre]` — **`'visao-geral'` é o `<recurso>` canônico da Visão Geral na queryKey**. `useVisaoGeral` em `queries.ts` usa a mesma tupla; o Step 5 verifica.
  - `GESTOR_STALE_TIME = 5 * 60 * 1000`.
  - `prefetchVisaoGeral(queryClient, iesId, semestre): Promise<void>`.
  - `SaudacaoGestor`, `saudacaoPorHora(agora: Date): string`, `primeiroNome(nome: string): string`.
  - `DirecionadoresGestor` + `DirecionadoresGestorProps { iesId: string; semestre: FiltroSemestre }` — consumidos pela Task 35.

**Decisões travadas:**
- O prefetch mora em `api/prefetch.ts`, arquivo próprio desta fatia, para não colidir com `api/queries.ts` (escrito por outra fatia em paralelo). O único ponto de contrato entre os dois é a queryKey, verificada no Step 5.
- Os cards são `<Link>`, não `<button onClick={navigate}>` — dão `href` real (link colável, meio-clique abre em nova aba) e não dependem do `useNavigate` mockado no setup.
- Hover **e** foco disparam o prefetch: quem navega por teclado ganha o mesmo benefício (§8.2 do handoff só cita o mouse).
- A saudação usa `saudacaoPorHora` como função pura para não precisar de fake timers no teste (que brigam com `user-event`).

- [ ] **Step 1: Write the failing test**

`src/features/gestor/__tests__/Direcionadores.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  SaudacaoGestor,
  saudacaoPorHora,
  primeiroNome,
} from '@/features/gestor/components/SaudacaoGestor';
import { DirecionadoresGestor } from '@/features/gestor/components/DirecionadoresGestor';
import { visaoGeralQueryKey } from '@/features/gestor/api/prefetch';
import type { ContextoGestor, Envelope, Meta } from '@/features/gestor/api/types';

const mocks = vi.hoisted(() => ({
  useGestorContexto: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/features/gestor/api/queries', () => ({
  useGestorContexto: mocks.useGestorContexto,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: mocks.rpc },
}));

// O setup global mocka useNavigate/useLocation; aqui precisamos do módulo real.
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  );
  return actual;
});

const META: Meta = {
  periodo: '2026',
  fonte: 'users + ies',
  atualizadoEm: '2026-07-26T10:00:00Z',
  criterio: 'IES acessíveis pelo token',
  partial: false,
  lowSample: false,
};

const CONTEXTO: Envelope<ContextoGestor> = {
  data: {
    usuario: { id: 'user-1', nome: 'Marina Alves Ribeiro', papel: 'gestor' },
    iesDisponiveis: [{ id: 'ies-1', nome: 'Universidade do Estado do Amazonas' }],
    iesAtual: { id: 'ies-1', nome: 'Universidade do Estado do Amazonas' },
    contrato: {
      nome: 'Academy 2026',
      simuladosContratados: 7,
      vigencia: '01/01/2026 a 31/12/2026',
    },
    podeTrocarIes: false,
    podeExportar: true,
  },
  meta: META,
};

function SondaDeRota() {
  const location = useLocation();
  return <div data-testid="rota">{location.pathname}</div>;
}

function montar(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/gestor']}>
        <SondaDeRota />
        {ui}
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...utils, queryClient };
}

beforeEach(() => {
  mocks.useGestorContexto.mockReturnValue({
    isPending: false,
    isError: false,
    data: CONTEXTO,
    refetch: vi.fn(),
  });
  mocks.rpc.mockResolvedValue({
    data: { data: { kpis: {} }, meta: META },
    error: null,
  });
});

describe('saudacaoPorHora', () => {
  it('antes do meio-dia é Bom dia', () => {
    expect(saudacaoPorHora(new Date(2026, 6, 26, 9, 0))).toBe('Bom dia');
    expect(saudacaoPorHora(new Date(2026, 6, 26, 11, 59))).toBe('Bom dia');
  });

  it('entre 12h e 18h é Boa tarde', () => {
    expect(saudacaoPorHora(new Date(2026, 6, 26, 12, 0))).toBe('Boa tarde');
    expect(saudacaoPorHora(new Date(2026, 6, 26, 17, 59))).toBe('Boa tarde');
  });

  it('das 18h em diante é Boa noite', () => {
    expect(saudacaoPorHora(new Date(2026, 6, 26, 18, 0))).toBe('Boa noite');
    expect(saudacaoPorHora(new Date(2026, 6, 26, 23, 30))).toBe('Boa noite');
  });
});

describe('primeiroNome', () => {
  it('devolve só o primeiro nome', () => {
    expect(primeiroNome('Marina Alves Ribeiro')).toBe('Marina');
  });

  it('tolera espaços sobrando e nome único', () => {
    expect(primeiroNome('  Marina  ')).toBe('Marina');
  });
});

describe('SaudacaoGestor (spec §2.1)', () => {
  it('mostra o primeiro nome e a linha de contexto da IES', () => {
    montar(<SaudacaoGestor />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Marina$/);
    expect(screen.getByTestId('saudacao')).toHaveTextContent(
      'Universidade do Estado do Amazonas',
    );
    expect(screen.getByTestId('saudacao')).toHaveTextContent('Academy 2026');
  });

  it('sem contrato, mostra só o nome da IES', () => {
    mocks.useGestorContexto.mockReturnValue({
      isPending: false,
      isError: false,
      data: { ...CONTEXTO, data: { ...CONTEXTO.data, contrato: null } },
      refetch: vi.fn(),
    });
    montar(<SaudacaoGestor />);

    expect(screen.getByTestId('saudacao')).toHaveTextContent(
      'Universidade do Estado do Amazonas',
    );
    expect(screen.getByTestId('saudacao')).not.toHaveTextContent('Academy 2026');
  });

  it('loading: skeleton no lugar do texto', () => {
    mocks.useGestorContexto.mockReturnValue({
      isPending: true,
      isError: false,
      data: undefined,
      refetch: vi.fn(),
    });
    montar(<SaudacaoGestor />);

    expect(screen.getByTestId('saudacao-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('saudacao')).not.toBeInTheDocument();
  });
});

describe('DirecionadoresGestor (spec §2.1)', () => {
  it('renderiza os dois cards com href correto', () => {
    montar(<DirecionadoresGestor iesId="ies-1" semestre="6ano" />);

    expect(screen.getByTestId('direcionador-visao-geral')).toHaveAttribute(
      'href',
      '/gestor/visao-geral',
    );
    expect(screen.getByTestId('direcionador-detalhamento')).toHaveAttribute(
      'href',
      '/gestor/detalhamento',
    );
    expect(screen.getByText('Visão Geral')).toBeInTheDocument();
    expect(screen.getByText('Detalhamento por Simulados')).toBeInTheDocument();
  });

  it('o card da Visão Geral navega para /gestor/visao-geral', async () => {
    const user = userEvent.setup();
    montar(<DirecionadoresGestor iesId="ies-1" semestre="6ano" />);

    await user.click(screen.getByTestId('direcionador-visao-geral'));
    expect(screen.getByTestId('rota')).toHaveTextContent('/gestor/visao-geral');
  });

  it('o card do Detalhamento navega para /gestor/detalhamento', async () => {
    const user = userEvent.setup();
    montar(<DirecionadoresGestor iesId="ies-1" semestre="6ano" />);

    await user.click(screen.getByTestId('direcionador-detalhamento'));
    expect(screen.getByTestId('rota')).toHaveTextContent('/gestor/detalhamento');
  });

  it('hover no card da Visão Geral faz prefetch da query (§8.2)', async () => {
    const user = userEvent.setup();
    const { queryClient } = montar(
      <DirecionadoresGestor iesId="ies-1" semestre="6ano" />,
    );

    expect(
      queryClient.getQueryData(visaoGeralQueryKey('ies-1', '6ano')),
    ).toBeUndefined();

    await user.hover(screen.getByTestId('direcionador-visao-geral'));

    await waitFor(() => {
      expect(
        queryClient.getQueryData(visaoGeralQueryKey('ies-1', '6ano')),
      ).toBeDefined();
    });
    expect(mocks.rpc).toHaveBeenCalledWith('get_gestor_visao_geral', {
      p_ies_id: 'ies-1',
      p_semestre: '6ano',
    });
  });

  it('prefetch respeita o semestre em vigor', async () => {
    const user = userEvent.setup();
    const { queryClient } = montar(
      <DirecionadoresGestor iesId="ies-1" semestre="11" />,
    );

    await user.hover(screen.getByTestId('direcionador-visao-geral'));

    await waitFor(() => {
      expect(
        queryClient.getQueryData(visaoGeralQueryKey('ies-1', '11')),
      ).toBeDefined();
    });
    expect(
      queryClient.getQueryData(visaoGeralQueryKey('ies-1', '6ano')),
    ).toBeUndefined();
  });

  it('hover no card do Detalhamento não faz prefetch da Visão Geral', async () => {
    const user = userEvent.setup();
    montar(<DirecionadoresGestor iesId="ies-1" semestre="6ano" />);

    await user.hover(screen.getByTestId('direcionador-detalhamento'));

    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe('visaoGeralQueryKey', () => {
  it('é a tupla canônica ["gestor","visao-geral",iesId,semestre]', () => {
    expect(visaoGeralQueryKey('ies-1', '6ano')).toEqual([
      'gestor',
      'visao-geral',
      'ies-1',
      '6ano',
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/gestor/__tests__/Direcionadores.test.tsx`

Expected: FAIL com `Failed to resolve import "@/features/gestor/components/SaudacaoGestor"` (e os outros dois imports novos).

- [ ] **Step 3: Write minimal implementation**

3.1 — `src/features/gestor/api/prefetch.ts`

```ts
import type { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  Envelope,
  FiltroSemestre,
  VisaoGeral,
} from '@/features/gestor/api/types';

/**
 * Recurso canônico da Visão Geral na queryKey do portal: 'visao-geral'.
 * `useVisaoGeral` em api/queries.ts usa a mesma tupla — se divergir, o
 * prefetch aquece um cache que a tela nunca lê.
 */
export const visaoGeralQueryKey = (iesId: string, semestre: FiltroSemestre) =>
  ['gestor', 'visao-geral', iesId, semestre] as const;

/** staleTime único do portal do gestor (spec §8.2). */
export const GESTOR_STALE_TIME = 5 * 60 * 1000;

/**
 * Aquece a Visão Geral antes do clique (handoff docs/08 §Prefetch).
 * `prefetchQuery` nunca rejeita: erro de rede aqui é silencioso de propósito —
 * é otimização, não caminho de leitura.
 */
export function prefetchVisaoGeral(
  queryClient: QueryClient,
  iesId: string,
  semestre: FiltroSemestre,
): Promise<void> {
  return queryClient.prefetchQuery({
    queryKey: visaoGeralQueryKey(iesId, semestre),
    queryFn: async (): Promise<Envelope<VisaoGeral>> => {
      const { data, error } = await supabase.rpc('get_gestor_visao_geral', {
        p_ies_id: iesId,
        p_semestre: semestre,
      });
      if (error) {
        throw new Error(error.message);
      }
      return data as unknown as Envelope<VisaoGeral>;
    },
    staleTime: GESTOR_STALE_TIME,
  });
}
```

3.2 — `src/features/gestor/components/SaudacaoGestor.tsx`

```tsx
import { Skeleton } from '@/components/ui/skeleton';
import { useGestorContexto } from '@/features/gestor/api/queries';

/** Função pura para não precisar de fake timers no teste. */
export function saudacaoPorHora(agora: Date): string {
  const hora = agora.getHours();
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function primeiroNome(nome: string): string {
  const [primeiro] = nome.trim().split(/\s+/);
  return primeiro || nome;
}

export function SaudacaoGestor() {
  const query = useGestorContexto();

  if (query.isPending) {
    return (
      <div className="space-y-2">
        <Skeleton data-testid="saudacao-skeleton" className="h-8 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
    );
  }

  const contexto = query.data?.data;
  if (!contexto) {
    return null;
  }

  return (
    <header data-testid="saudacao">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {`${saudacaoPorHora(new Date())}, ${primeiroNome(contexto.usuario.nome)}`}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {contexto.iesAtual.nome}
        {contexto.contrato
          ? ` · ${contexto.contrato.nome} · ${contexto.contrato.simuladosContratados} simulados contratados`
          : ''}
      </p>
    </header>
  );
}
```

3.3 — `src/features/gestor/components/DirecionadoresGestor.tsx`

```tsx
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, BarChart3, FileSearch } from 'lucide-react';
import { prefetchVisaoGeral } from '@/features/gestor/api/prefetch';
import type { FiltroSemestre } from '@/features/gestor/api/types';

export interface DirecionadoresGestorProps {
  iesId: string;
  semestre: FiltroSemestre;
}

/** Hover: sobe 1px + borda de marca (handoff docs/05-telas.md tela 1). */
const CARTAO =
  'group flex flex-col gap-2 rounded-lg border border-border bg-card p-5 ' +
  'transition-all hover:-translate-y-px hover:border-primary ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function DirecionadoresGestor({
  iesId,
  semestre,
}: DirecionadoresGestorProps) {
  const queryClient = useQueryClient();
  const aquecer = () => void prefetchVisaoGeral(queryClient, iesId, semestre);

  return (
    <div className="grid gap-4 md:grid-cols-2" data-testid="direcionadores">
      <Link
        to="/gestor/visao-geral"
        data-testid="direcionador-visao-geral"
        className={CARTAO}
        onMouseEnter={aquecer}
        onFocus={aquecer}
      >
        <BarChart3 className="h-5 w-5 text-primary" aria-hidden="true" />
        <span className="text-base font-semibold text-foreground">
          Visão Geral
        </span>
        <span className="text-sm text-muted-foreground">
          Como estamos e onde dói — o panorama da instituição em um recorte só.
        </span>
        <span className="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-medium text-primary">
          Abrir
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </Link>

      <Link
        to="/gestor/detalhamento"
        data-testid="direcionador-detalhamento"
        className={CARTAO}
      >
        <FileSearch className="h-5 w-5 text-primary" aria-hidden="true" />
        <span className="text-base font-semibold text-foreground">
          Detalhamento por Simulados
        </span>
        <span className="text-sm text-muted-foreground">
          O que exatamente aconteceu num simulado — questão por questão, aluno
          por aluno.
        </span>
        <span className="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-medium text-primary">
          Abrir
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </Link>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/gestor/__tests__/Direcionadores.test.tsx`

Expected: PASS — 16 testes.

- [ ] **Step 5: Verify the queryKey matches queries.ts**

```bash
grep -n "visao-geral\|visaoGeral" "src/features/gestor/api/queries.ts"
```

Expected: `useVisaoGeral` usa `queryKey: ['gestor', 'visao-geral', iesId, semestre]`. Se divergir, editar `queries.ts` para importar a chave canônica:

```ts
import { visaoGeralQueryKey, GESTOR_STALE_TIME } from '@/features/gestor/api/prefetch';
// ...
    queryKey: visaoGeralQueryKey(filtros.iesId, filtros.semestre),
    staleTime: GESTOR_STALE_TIME,
```

Depois: `npx vitest run src/features/gestor/__tests__/Direcionadores.test.tsx` → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/gestor/api/prefetch.ts src/features/gestor/components/SaudacaoGestor.tsx src/features/gestor/components/DirecionadoresGestor.tsx src/features/gestor/__tests__/Direcionadores.test.tsx src/features/gestor/api/queries.ts
git commit -m "feat(gestor): saudacao, dois direcionadores e prefetch da Visao Geral no hover"
```

---

### Task 35: Rota Início montada, com loading, empty e error por bloco

**Files:**
- Create: `src/features/gestor/routes/Inicio.tsx`
- Test: `src/features/gestor/__tests__/Inicio.test.tsx`

**Interfaces:**
- Consumes:
  - `SaudacaoGestor` (Task 34), `DirecionadoresGestor` (Task 34), `CronogramaSimulados` (Tasks 31–32), `AvisosSanar` (Task 33).
  - `useGestorContexto()` de `src/features/gestor/api/queries.ts`.
  - `useFiltrosGestor()` de `src/features/gestor/hooks/useFiltrosGestor.ts` — `{ semestre, setSemestre, simulados, setSimulados, iesId, setIesId }`.
  - `ErrorBoundary` de `react-error-boundary` (dependência já no `package.json`: `react-error-boundary ^6.0.0`).
- Produces:
  - `export default function Inicio()` — a rota `/gestor` do portal v2. **O registro no roteador (`gestorRoutes` + gate `gestao.portal_v2` + `GestorIndexRedirect`) é da fase de rollout** (spec §9), não desta tarefa: aqui entregamos o componente e sua composição.

**Decisões travadas:**
- `iesId` efetivo = `filtros.iesId ?? contexto.iesAtual.id`. A URL é hint de UI (spec §3); a IES autoritativa vem do servidor. Sem nenhuma das duas, a tela fica em loading — nunca chuta uma IES.
- **Error boundary por bloco, não por página** (§8.4): `CronogramaSimulados` e `AvisosSanar` ficam cada um dentro do seu `<ErrorBoundary>`. Erro de query é tratado dentro do próprio componente (estado `error` com "Tentar novamente"); o boundary é a rede de segurança para erro de render.
- Grade `lg:grid-cols-[2fr_1fr]` (spec §2.1: `2fr / 1fr`); abaixo de `lg` empilha (§2.2: alvo desktop, sem versão mobile de produto).

- [ ] **Step 1: Write the failing test**

`src/features/gestor/__tests__/Inicio.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Inicio from '@/features/gestor/routes/Inicio';
import type {
  Aviso,
  ContextoGestor,
  Envelope,
  ItemCronograma,
  Meta,
} from '@/features/gestor/api/types';

const mocks = vi.hoisted(() => ({
  useGestorContexto: vi.fn(),
  useCronograma: vi.fn(),
  useAvisos: vi.fn(),
  useFiltrosGestor: vi.fn(),
  useMarcarAvisoLido: vi.fn(),
  prefetchVisaoGeral: vi.fn(),
}));

vi.mock('@/features/gestor/api/queries', () => ({
  useGestorContexto: mocks.useGestorContexto,
  useCronograma: mocks.useCronograma,
  useAvisos: mocks.useAvisos,
}));

vi.mock('@/features/gestor/hooks/useFiltrosGestor', () => ({
  useFiltrosGestor: mocks.useFiltrosGestor,
}));

vi.mock('@/features/gestor/hooks/useMarcarAvisoLido', () => ({
  useMarcarAvisoLido: mocks.useMarcarAvisoLido,
  avisosQueryKey: (iesId: string) => ['gestor', 'avisos', iesId],
}));

vi.mock('@/features/gestor/api/prefetch', () => ({
  prefetchVisaoGeral: mocks.prefetchVisaoGeral,
  visaoGeralQueryKey: (iesId: string, semestre: string) => [
    'gestor',
    'visao-geral',
    iesId,
    semestre,
  ],
  GESTOR_STALE_TIME: 300000,
}));

const META: Meta = {
  periodo: '2026',
  fonte: 'gvqv',
  atualizadoEm: '2026-07-26T10:00:00Z',
  criterio: 'Contrato vigente',
  partial: false,
  lowSample: false,
};

const CONTEXTO: Envelope<ContextoGestor> = {
  data: {
    usuario: { id: 'user-1', nome: 'Marina Alves', papel: 'gestor' },
    iesDisponiveis: [{ id: 'ies-1', nome: 'UEA' }],
    iesAtual: { id: 'ies-1', nome: 'UEA' },
    contrato: {
      nome: 'Academy 2026',
      simuladosContratados: 7,
      vigencia: '01/01/2026 a 31/12/2026',
    },
    podeTrocarIes: false,
    podeExportar: true,
  },
  meta: META,
};

const ITENS: ItemCronograma[] = [
  { id: 's1', nome: 'Simulado 1', data: '2026-03-10T12:00:00Z', status: 'realizado', modalidade: 'online', participantes: 88 },
  { id: 's4', nome: 'Simulado 4', data: '2026-08-18T12:00:00Z', status: 'reagendado', modalidade: 'presencial' },
  { id: 's5', nome: 'Simulado 5', data: null, status: 'previsto', modalidade: null },
];

const AVISOS: Aviso[] = [
  { id: 'a1', titulo: 'Manutencao programada', resumo: 'Janela no sabado.', data: '2026-07-20T12:00:00Z', lido: false },
];

const pronto = (data: unknown) => ({
  isPending: false,
  isError: false,
  data,
  refetch: vi.fn(),
});

const carregando = () => ({
  isPending: true,
  isError: false,
  data: undefined,
  refetch: vi.fn(),
});

const comErro = () => ({
  isPending: false,
  isError: true,
  data: undefined,
  refetch: vi.fn(),
});

function montar() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/gestor']}>
        <Inicio />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.useFiltrosGestor.mockReturnValue({
    semestre: '6ano',
    setSemestre: vi.fn(),
    simulados: [],
    setSimulados: vi.fn(),
    iesId: null,
    setIesId: vi.fn(),
  });
  mocks.useMarcarAvisoLido.mockReturnValue({ mutate: vi.fn(), isPending: false });
  mocks.useGestorContexto.mockReturnValue(pronto(CONTEXTO));
  mocks.useCronograma.mockReturnValue(pronto({ data: ITENS, meta: META }));
  mocks.useAvisos.mockReturnValue(pronto({ data: AVISOS, meta: META }));
});

describe('Inicio — composição (spec §2.1)', () => {
  it('monta saudação, direcionadores, cronograma e avisos', () => {
    montar();

    expect(screen.getByTestId('saudacao')).toBeInTheDocument();
    expect(screen.getByTestId('direcionadores')).toBeInTheDocument();
    expect(screen.getByTestId('cronograma')).toBeInTheDocument();
    expect(screen.getByTestId('avisos')).toBeInTheDocument();
  });

  it('passa a IES do contexto adiante quando a URL não tem ies', () => {
    montar();
    expect(mocks.useCronograma).toHaveBeenCalledWith('ies-1');
    expect(mocks.useAvisos).toHaveBeenCalledWith('ies-1');
  });

  it('a IES da URL vence como hint de UI', () => {
    mocks.useFiltrosGestor.mockReturnValue({
      semestre: '6ano',
      setSemestre: vi.fn(),
      simulados: [],
      setSimulados: vi.fn(),
      iesId: 'ies-9',
      setIesId: vi.fn(),
    });
    montar();
    expect(mocks.useCronograma).toHaveBeenCalledWith('ies-9');
  });
});

describe('Inicio — estados (spec §8.4)', () => {
  it('loading: skeleton das duas colunas, sem cronograma nem avisos', () => {
    mocks.useGestorContexto.mockReturnValue(carregando());
    montar();

    expect(screen.getByTestId('inicio-skeleton-cronograma')).toBeInTheDocument();
    expect(screen.getByTestId('inicio-skeleton-avisos')).toBeInTheDocument();
    expect(screen.queryByTestId('cronograma')).not.toBeInTheDocument();
    expect(screen.queryByTestId('avisos')).not.toBeInTheDocument();
    expect(screen.getByTestId('saudacao-skeleton')).toBeInTheDocument();
  });

  it('empty: nenhum simulado contratado, e os avisos continuam de pé', () => {
    mocks.useCronograma.mockReturnValue(pronto({ data: [], meta: META }));
    montar();

    expect(screen.getByText(/nenhum simulado contratado/i)).toBeInTheDocument();
    expect(screen.getByTestId('avisos')).toBeInTheDocument();
    expect(screen.getByText('Manutencao programada')).toBeInTheDocument();
  });

  it('error por bloco: cronograma quebrado não derruba os avisos', () => {
    mocks.useCronograma.mockReturnValue(comErro());
    montar();

    expect(
      screen.getByText(/não foi possível carregar o cronograma/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId('avisos')).toBeInTheDocument();
    expect(screen.getByTestId('direcionadores')).toBeInTheDocument();
  });

  it('error por bloco: avisos quebrados não derrubam o cronograma', () => {
    mocks.useAvisos.mockReturnValue(comErro());
    montar();

    expect(screen.getByText(/não foi possível carregar os avisos/i)).toBeInTheDocument();
    expect(screen.getByTestId('cronograma')).toBeInTheDocument();
    expect(screen.getByTestId('cronograma-item-s1')).toBeInTheDocument();
  });
});

describe('Inicio — nenhum indicador de desempenho na tela (spec §2.1)', () => {
  const PROIBIDOS: RegExp[] = [
    /%/,
    /proficiênc/i,
    /proficienc/i,
    /\bTRI\b/,
    /ENAMED/i,
    /acerto/i,
    /conceito/i,
    /desempenho/i,
    /\bmédia\b/i,
    /\bnota\b/i,
  ];

  it('a tela inteira não contém nenhum vocabulário de desempenho', () => {
    montar();
    const texto = screen.getByTestId('gestor-inicio').textContent ?? '';

    for (const proibido of PROIBIDOS) {
      expect(
        texto,
        `a tela de Início não pode conter ${proibido} — o propósito é orientar, não medir`,
      ).not.toMatch(proibido);
    }
  });

  it('vale também no estado vazio do cronograma', () => {
    mocks.useCronograma.mockReturnValue(pronto({ data: [], meta: META }));
    montar();
    const texto = screen.getByTestId('gestor-inicio').textContent ?? '';

    for (const proibido of PROIBIDOS) {
      expect(texto).not.toMatch(proibido);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/gestor/__tests__/Inicio.test.tsx`

Expected: FAIL com `Failed to resolve import "@/features/gestor/routes/Inicio"`.

- [ ] **Step 3: Write minimal implementation**

`src/features/gestor/routes/Inicio.tsx`

```tsx
import { ErrorBoundary } from 'react-error-boundary';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AvisosSanar } from '@/features/gestor/components/AvisosSanar';
import { CronogramaSimulados } from '@/features/gestor/components/CronogramaSimulados';
import { DirecionadoresGestor } from '@/features/gestor/components/DirecionadoresGestor';
import { SaudacaoGestor } from '@/features/gestor/components/SaudacaoGestor';
import { useGestorContexto } from '@/features/gestor/api/queries';
import { useFiltrosGestor } from '@/features/gestor/hooks/useFiltrosGestor';

/** Rede de segurança de render por bloco (§8.4) — erro de query é tratado dentro do bloco. */
function FallbackBloco({
  resetErrorBoundary,
}: {
  resetErrorBoundary: () => void;
}) {
  return (
    <div role="alert" className="rounded-lg border border-border p-5">
      <p className="text-sm text-muted-foreground">
        Algo deu errado neste bloco.
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={resetErrorBoundary}
      >
        Tentar novamente
      </Button>
    </div>
  );
}

/**
 * Início do gestor — rota /gestor do portal v2 (spec §2.1).
 * Propósito: orientar. Nenhum indicador de desempenho vive aqui.
 */
export default function Inicio() {
  const contextoQuery = useGestorContexto();
  const { semestre, iesId } = useFiltrosGestor();

  const contexto = contextoQuery.data?.data;
  // A URL é hint de UI; a IES autoritativa vem do servidor (§3).
  const iesAtivaId = iesId ?? contexto?.iesAtual.id ?? null;

  return (
    <div className="space-y-8" data-testid="gestor-inicio">
      <SaudacaoGestor />

      {iesAtivaId ? (
        <DirecionadoresGestor iesId={iesAtivaId} semestre={semestre} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton
            data-testid="inicio-skeleton-direcionadores"
            className="h-40 w-full"
          />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      <div
        className="grid gap-6 lg:grid-cols-[2fr_1fr]"
        data-testid="inicio-grade"
      >
        {iesAtivaId && contexto ? (
          <>
            <ErrorBoundary FallbackComponent={FallbackBloco}>
              <CronogramaSimulados
                iesId={iesAtivaId}
                iesNome={contexto.iesAtual.nome}
                contrato={contexto.contrato}
              />
            </ErrorBoundary>
            <ErrorBoundary FallbackComponent={FallbackBloco}>
              <AvisosSanar iesId={iesAtivaId} />
            </ErrorBoundary>
          </>
        ) : (
          <>
            <Skeleton
              data-testid="inicio-skeleton-cronograma"
              className="h-72 w-full"
            />
            <Skeleton
              data-testid="inicio-skeleton-avisos"
              className="h-72 w-full"
            />
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/gestor/__tests__/Inicio.test.tsx`

Expected: PASS — 9 testes.

Se o teste "nenhum indicador de desempenho" falhar, **a correção é no texto do componente, nunca no teste**: a lista de proibidos é a garantia do propósito da tela (§2.1). Os textos entregues nas Tasks 31–34 já foram escritos para passar — `Início:`, `Realização:`, `participantes`, `simulados contratados`, `Realizado`, `Em processamento`, `A definir`.

- [ ] **Step 5: Run the whole slice and the project gates**

```bash
npx vitest run src/features/gestor/__tests__
npm run lint
npm run type-check
npm run test:run
npm run build
```

Expected: `Test Files 5 passed` na primeira; as quatro seguintes verdes (spec §11).

- [ ] **Step 6: Commit**

```bash
git add src/features/gestor/routes/Inicio.tsx src/features/gestor/__tests__/Inicio.test.tsx
git commit -m "feat(gestor): rota Inicio composta com loading, empty e error por bloco"
```

---

## Fase 4 — Tela 2: Visão Geral

Esta fase implementa `/gestor/visao-geral` (spec §2.1, §4.8). Ordem vertical **final** da tela, com a divergência do briefing resolvida a favor da spec §4.8 ("Visão de Alunos acima, visão por área abaixo" — decisão de 22/07, macro precede micro):

1. barra de filtros + contexto do recorte
2. 4 KPIs
3. gráfico protagonista (3 modos)
4. **Visão de Alunos (resumo)**
5. **Diagnóstico Curricular (resumo) + cascata ao lado**
6. Insights (2)
7. divisor "Detalhe · micro" + Tabela de alunos

**Contrato de consumo das queries assumido por toda a Fase 4** (declarado uma vez, vale para as Tasks 41–46): os hooks de `src/features/gestor/api/queries.ts` recebem **apenas a parte de dado** do filtro, no formato `{ iesId: string | null; semestre: FiltroSemestre }` (o tipo `Recorte`, criado na Task 41). Se a Fase 2 tipou o parâmetro `filtros` incluindo os setters de `useFiltrosGestor`, altere a assinatura dos hooks para `Pick<ReturnType<typeof useFiltrosGestor>, 'iesId' | 'semestre'>` — a Fase 4 nunca passa setters para a camada de dados.

Retornos assumidos (envelope da §5.2):
- `useVisaoGeral(recorte)` → `UseQueryResult<Envelope<VisaoGeral>>`
- `useDiagnostico(recorte, node: string | null)` → `UseQueryResult<Envelope<NoDiagnostico[]>>`
- `useDiagnosticoTemas(recorte, especialidade: string)` → `UseQueryResult<Envelope<TemaCritico[]>>`
- `useAlunos(recorte, paginacao: { page: number; pageSize: number; sort: string; order: 'asc' | 'desc'; q: string })` → `UseQueryResult<Envelope<Paginado<LinhaAluno>>>`
- `useAluno(alunoId: string | null, simulados: string[])` → `UseQueryResult<Envelope<AlunoNoSimulado>>`

---

### Task 36: KpiCard + TooltipRastreabilidade

**Files:**
- Create: `src/features/gestor/components/TooltipRastreabilidade.tsx`
- Create: `src/features/gestor/components/KpiCard.tsx`
- Test: `src/features/gestor/__tests__/KpiCard.test.tsx`

**Interfaces:**
- Consumes: `Meta`, `PontoSerie` de `src/features/gestor/api/types.ts` (Fase 1); `TRACO`, `formatNumero`, `formatDelta`, `formatData` de `src/features/gestor/lib/formatters.ts` (Fase 1).
- Produces:
  - `TooltipRastreabilidade({ meta, criterio }: { meta: Meta; criterio?: string })` — botão de info + tooltip `Período · Fonte · Atualizado em · Critério` (§4.1) e o mesmo texto em `<span class="sr-only" data-testid="rastreabilidade-texto">`.
  - `KpiCard(props: KpiCardProps)` e `type EstadoKpi = 'ok' | 'loading' | 'empty' | 'error'`.
  - `KpiCardProps = { titulo; valor; meta; criterio?; badge?; delta?; serie?; formatarPonto?; trilha?; rodape?; estado?; onTentarNovamente? }`.

> **NOTA de coexistência entre fatias:** se a Fase 3 (Início) já criou `src/features/gestor/components/TooltipRastreabilidade.tsx`, **não duplique**: confira que a assinatura é exatamente `({ meta, criterio }: { meta: Meta; criterio?: string })` e que existe o `data-testid="rastreabilidade-texto"`; se faltar, adicione. `KpiCard` é criado aqui em qualquer cenário.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/gestor/__tests__/KpiCard.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, userEvent } from '@/test/utils';
import { KpiCard } from '@/features/gestor/components/KpiCard';
import type { Meta, PontoSerie } from '@/features/gestor/api/types';

const meta: Meta = {
  periodo: '2026.1',
  fonte: 'Simulados ENAMED SanarFlix',
  atualizadoEm: '2026-07-20T12:00:00.000Z',
  criterio: 'Proficiente = proficiência >= 60',
  partial: false,
  lowSample: false,
};

const serieCompleta: PontoSerie[] = [
  { rotulo: '1º simulado', valor: 51 },
  { rotulo: 'anterior', valor: 58 },
  { rotulo: 'atual', valor: 62 },
];

describe('KpiCard', () => {
  it('mostra título, valor e a régua com os três pontos, com "atual" como ponto corrente', () => {
    render(<KpiCard titulo="Alunos proficientes" valor="62%" meta={meta} serie={serieCompleta} delta={4} />);

    expect(screen.getByTestId('kpi-titulo')).toHaveTextContent('Alunos proficientes');
    expect(screen.getByTestId('kpi-valor')).toHaveTextContent('62%');

    const regua = screen.getByTestId('kpi-regua');
    expect(regua).toBeInTheDocument();
    expect(regua.querySelectorAll('li')).toHaveLength(3);
    expect(regua).toHaveTextContent('1º simulado');
    expect(regua).toHaveTextContent('anterior');
    expect(regua).toHaveTextContent('atual');
    expect(regua).not.toHaveTextContent('último');
  });

  it('SOME com a régua quando há apenas 1 simulado realizado (um ponto na série)', () => {
    render(<KpiCard titulo="Alunos proficientes" valor="51%" meta={meta} serie={[{ rotulo: 'atual', valor: 51 }]} />);
    expect(screen.queryByTestId('kpi-regua')).not.toBeInTheDocument();
  });

  it('mostra a régua com dois pontos quando há 2 simulados realizados', () => {
    render(
      <KpiCard
        titulo="Alunos proficientes"
        valor="58%"
        meta={meta}
        serie={[{ rotulo: '1º simulado', valor: 51 }, { rotulo: 'atual', valor: 58 }]}
      />
    );
    expect(screen.getByTestId('kpi-regua').querySelectorAll('li')).toHaveLength(2);
  });

  it('formata o delta com sinal explícito', () => {
    render(<KpiCard titulo="Percentual de acerto" valor="57%" meta={meta} delta={-2} serie={serieCompleta} />);
    expect(screen.getByTestId('kpi-delta')).toHaveTextContent('-2');
  });

  it('mostra o badge "projetado" quando informado', () => {
    render(<KpiCard titulo="Conceito ENAMED projetado" valor="3/5" meta={meta} badge="projetado" />);
    expect(screen.getByText('projetado')).toBeInTheDocument();
  });

  it('mostra a trilha e o rodapé quando informados', () => {
    render(
      <KpiCard
        titulo="Simulados realizados"
        valor="3 de 7"
        meta={meta}
        trilha={{ feitos: 3, total: 7 }}
        rodape={<a href="/gestor">Ver cronograma</a>}
      />
    );
    expect(screen.getByTestId('kpi-trilha')).toHaveAttribute('aria-valuenow', '43');
    expect(screen.getByRole('link', { name: 'Ver cronograma' })).toBeInTheDocument();
  });

  it('expõe a rastreabilidade com Período, Fonte, Atualizado em e Critério', () => {
    render(<KpiCard titulo="Alunos proficientes" valor="62%" meta={meta} criterio="Critério do KPI" />);
    const texto = screen.getByTestId('rastreabilidade-texto');
    expect(texto).toHaveTextContent('Período: 2026.1');
    expect(texto).toHaveTextContent('Fonte: Simulados ENAMED SanarFlix');
    expect(texto).toHaveTextContent('Atualizado em: 20/07/2026');
    expect(texto).toHaveTextContent('Critério: Critério do KPI');
  });

  it('no estado loading mostra skeleton com altura reservada e nenhum valor', () => {
    render(<KpiCard titulo="Alunos proficientes" valor="62%" meta={meta} estado="loading" />);
    expect(screen.getByTestId('kpi-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('kpi-valor')).not.toBeInTheDocument();
  });

  it('no estado empty mostra o traço e não mostra régua', () => {
    render(<KpiCard titulo="Alunos proficientes" valor="—" meta={meta} estado="empty" serie={serieCompleta} />);
    expect(screen.getByTestId('kpi-valor')).toHaveTextContent('—');
    expect(screen.queryByTestId('kpi-regua')).not.toBeInTheDocument();
  });

  it('no estado error oferece "Tentar novamente" que refaz só este bloco', async () => {
    const user = userEvent.setup();
    const onTentarNovamente = vi.fn();
    render(<KpiCard titulo="Alunos proficientes" valor="62%" meta={meta} estado="error" onTentarNovamente={onTentarNovamente} />);

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(onTentarNovamente).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/gestor/__tests__/KpiCard.test.tsx`
Expected: FAIL com `Failed to resolve import "@/features/gestor/components/KpiCard"`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/features/gestor/components/TooltipRastreabilidade.tsx
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatData } from '@/features/gestor/lib/formatters';
import type { Meta } from '@/features/gestor/api/types';

export interface TooltipRastreabilidadeProps {
  meta: Meta;
  criterio?: string;
}

export function TooltipRastreabilidade({ meta, criterio }: TooltipRastreabilidadeProps) {
  const linhas = [
    `Período: ${meta.periodo}`,
    `Fonte: ${meta.fonte}`,
    `Atualizado em: ${formatData(meta.atualizadoEm)}`,
    `Critério: ${criterio ?? meta.criterio}`,
  ];

  return (
    <span className="inline-flex items-center">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Rastreabilidade do indicador"
            className="rounded-full p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[280px]">
          <ul className="space-y-0.5 text-xs">
            {linhas.map((linha) => (
              <li key={linha}>{linha}</li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
      <span className="sr-only" data-testid="rastreabilidade-texto">
        {linhas.join(' · ')}
      </span>
    </span>
  );
}
```

```tsx
// src/features/gestor/components/KpiCard.tsx
import * as React from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { TooltipRastreabilidade } from '@/features/gestor/components/TooltipRastreabilidade';
import { TRACO, formatDelta, formatNumero } from '@/features/gestor/lib/formatters';
import type { Meta, PontoSerie } from '@/features/gestor/api/types';

export type EstadoKpi = 'ok' | 'loading' | 'empty' | 'error';

export interface KpiCardProps {
  titulo: string;
  valor: string;
  meta: Meta;
  criterio?: string;
  badge?: string;
  delta?: number | null;
  serie?: PontoSerie[];
  formatarPonto?: (valor: number | null) => string;
  trilha?: { feitos: number; total: number };
  rodape?: React.ReactNode;
  estado?: EstadoKpi;
  onTentarNovamente?: () => void;
}

function IconeDelta({ delta }: { delta: number }) {
  if (delta > 0) return <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />;
  if (delta < 0) return <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />;
  return <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />;
}

export function KpiCard({
  titulo,
  valor,
  meta,
  criterio,
  badge,
  delta,
  serie,
  formatarPonto = formatNumero,
  trilha,
  rodape,
  estado = 'ok',
  onTentarNovamente,
}: KpiCardProps) {
  // §4.8: a régua `1º simulado · anterior · atual` some com 1 simulado realizado.
  const mostrarRegua = estado === 'ok' && Array.isArray(serie) && serie.length >= 2;
  const percentualTrilha = trilha && trilha.total > 0 ? Math.round((trilha.feitos / trilha.total) * 100) : 0;

  return (
    <Card data-testid="kpi-card" className="h-full">
      <CardContent className="flex h-full min-h-[148px] flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <span data-testid="kpi-titulo" className="text-xs font-medium leading-tight text-muted-foreground">
            {titulo}
          </span>
          <TooltipRastreabilidade meta={meta} criterio={criterio} />
        </div>

        {estado === 'loading' ? (
          <div data-testid="kpi-skeleton" className="flex flex-1 flex-col justify-end gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : estado === 'error' ? (
          <div className="flex flex-1 flex-col items-start justify-end gap-2">
            <p className="text-xs text-muted-foreground">Não foi possível carregar este indicador.</p>
            <Button type="button" size="sm" variant="outline" onClick={onTentarNovamente}>
              Tentar novamente
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-end gap-2">
              <span data-testid="kpi-valor" className="text-3xl font-semibold leading-none tabular-nums">
                {estado === 'empty' ? TRACO : valor}
              </span>
              {badge ? (
                <Badge variant="secondary" className="mb-0.5 text-[10px] font-medium">
                  {badge}
                </Badge>
              ) : null}
              {estado === 'ok' && delta !== undefined && delta !== null ? (
                <span
                  data-testid="kpi-delta"
                  className={cn(
                    'mb-0.5 inline-flex items-center gap-0.5 text-xs font-medium tabular-nums',
                    delta > 0 && 'text-emerald-600 dark:text-emerald-400',
                    delta < 0 && 'text-destructive',
                    delta === 0 && 'text-muted-foreground'
                  )}
                >
                  <IconeDelta delta={delta} />
                  {formatDelta(delta)}
                  <span className="sr-only">em relação ao simulado anterior</span>
                </span>
              ) : null}
            </div>

            {mostrarRegua ? (
              <ol data-testid="kpi-regua" aria-label="Evolução do indicador" className="mt-auto flex items-end gap-4">
                {serie!.map((ponto, indice) => {
                  const corrente = indice === serie!.length - 1;
                  return (
                    <li key={`${ponto.rotulo}-${indice}`} className={cn(!corrente && 'opacity-60')}>
                      <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                        {ponto.rotulo}
                      </span>
                      <span className={cn('block text-sm tabular-nums', corrente && 'font-semibold')}>
                        {formatarPonto(ponto.valor)}
                      </span>
                    </li>
                  );
                })}
              </ol>
            ) : null}

            {trilha ? (
              <div className="mt-auto">
                <div
                  data-testid="kpi-trilha"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percentualTrilha}
                  aria-label={`${trilha.feitos} de ${trilha.total} simulados realizados`}
                  className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                >
                  <div className="h-full rounded-full bg-primary" style={{ width: `${percentualTrilha}%` }} />
                </div>
              </div>
            ) : null}

            {rodape ? <div className="text-xs font-medium text-primary">{rodape}</div> : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/gestor/__tests__/KpiCard.test.tsx`
Expected: PASS (11 testes).

- [ ] **Step 5: Commit**

```bash
git add src/features/gestor/components/KpiCard.tsx src/features/gestor/components/TooltipRastreabilidade.tsx src/features/gestor/__tests__/KpiCard.test.tsx
git commit -m "feat(gestor): KpiCard com regua de evolucao, delta e rastreabilidade

Regua 1o simulado · anterior · atual, some com 1 simulado realizado (spec §4.8).
Rotulo do ponto corrente e 'atual', nunca 'ultimo'."
```

---

### Task 37: Os 4 KPIs da Visão Geral na ordem canônica

**Files:**
- Create: `src/features/gestor/__tests__/fixtures/visaoGeral.ts`
- Create: `src/features/gestor/components/KpisVisaoGeral.tsx`
- Test: `src/features/gestor/__tests__/KpisVisaoGeral.test.tsx`

**Interfaces:**
- Consumes: `KpiCard`, `EstadoKpi` (Task 36); `VisaoGeral`, `Meta` de `api/types.ts`; `formatConceito`, `formatPct`, `formatNumero` de `lib/formatters.ts`.
- Produces:
  - `metaFake: Meta`, `visaoGeralFake: VisaoGeral`, `visaoComUmSimulado(): VisaoGeral` em `__tests__/fixtures/visaoGeral.ts` — **fixture única da Fase 4**, reusada nas Tasks 38, 39, 40, 41, 44 e 46.
  - `KpisVisaoGeral({ kpis, meta, estado, onTentarNovamente }: { kpis: VisaoGeral['kpis']; meta: Meta; estado?: EstadoKpi; onTentarNovamente?: () => void })`.

- [ ] **Step 1: Write the failing test**

Primeiro a fixture (é insumo do teste, não implementação de produto):

```ts
// src/features/gestor/__tests__/fixtures/visaoGeral.ts
import type { Meta, VisaoGeral } from '@/features/gestor/api/types';

export const metaFake: Meta = {
  periodo: '2026.1',
  fonte: 'Simulados ENAMED SanarFlix',
  atualizadoEm: '2026-07-20T12:00:00.000Z',
  criterio: 'Proficiente = proficiência >= 60',
  partial: false,
  lowSample: false,
};

export const visaoGeralFake: VisaoGeral = {
  kpis: {
    enamedProjetado: {
      valor: 3,
      delta: 1,
      serie: [
        { rotulo: '1º simulado', valor: 2 },
        { rotulo: 'anterior', valor: 2 },
        { rotulo: 'atual', valor: 3 },
      ],
      criterio: 'Conceito 1–5 derivado do percentual de alunos proficientes do simulado',
    },
    proficientesPct: {
      valor: 62,
      delta: 4,
      serie: [
        { rotulo: '1º simulado', valor: 51 },
        { rotulo: 'anterior', valor: 58 },
        { rotulo: 'atual', valor: 62 },
      ],
      criterio: 'Proficiente = proficiência >= 60',
    },
    acertoPct: {
      valor: 57,
      delta: -2,
      serie: [
        { rotulo: '1º simulado', valor: 55 },
        { rotulo: 'anterior', valor: 59 },
        { rotulo: 'atual', valor: 57 },
      ],
      criterio: 'Acertos sobre questões respondidas',
    },
    simulados: { realizados: 3, contratados: 7 },
  },
  evolucao: [
    { simuladoId: 's1', nome: 'Simulado 1', data: '2026-03-10T00:00:00.000Z', valor: 51, participantes: 120 },
    { simuladoId: 's2', nome: 'Simulado 2', data: '2026-05-12T00:00:00.000Z', valor: 58, participantes: 118 },
    { simuladoId: 's3', nome: 'Simulado 3', data: '2026-07-14T00:00:00.000Z', valor: 62, participantes: 115 },
  ],
  evolucaoPorArea: [
    {
      area: 'Clínica Médica',
      critica: true,
      pontos: [
        { rotulo: 'Simulado 1', valor: 28 },
        { rotulo: 'Simulado 2', valor: 29 },
        { rotulo: 'Simulado 3', valor: 27 },
      ],
    },
    {
      area: 'Cirurgia',
      critica: false,
      pontos: [
        { rotulo: 'Simulado 1', valor: 58 },
        { rotulo: 'Simulado 2', valor: 60 },
        { rotulo: 'Simulado 3', valor: 61 },
      ],
    },
    {
      area: 'Pediatria',
      critica: false,
      pontos: [
        { rotulo: 'Simulado 1', valor: 52 },
        { rotulo: 'Simulado 2', valor: 54 },
        { rotulo: 'Simulado 3', valor: 55 },
      ],
    },
  ],
  diagnosticoResumo: [
    { nivel: 'excelente', areas: [{ id: 'ga-gine', nome: 'Ginecologia e Obstetrícia', acertoPct: 84 }] },
    {
      nivel: 'mediano',
      areas: [
        { id: 'ga-cirurgia', nome: 'Cirurgia', acertoPct: 61 },
        { id: 'ga-pediatria', nome: 'Pediatria', acertoPct: 55 },
      ],
    },
    { nivel: 'critico', areas: [{ id: 'ga-clinica', nome: 'Clínica Médica', acertoPct: 27 }] },
  ],
  distribuicaoAlunos: [
    { grupo: 'consistentemente_proficiente', quantidade: 48, percentual: 42 },
    { grupo: 'em_variacao', quantidade: 39, percentual: 34 },
    { grupo: 'consistentemente_nao_proficiente', quantidade: 28, percentual: 24 },
  ],
  dispersao: [
    { alunoId: 'a1', semestre: 11, nota: 72 },
    { alunoId: 'a2', semestre: 11, nota: 58 },
    { alunoId: 'a3', semestre: 11, nota: 64 },
    { alunoId: 'a4', semestre: 12, nota: 81 },
    { alunoId: 'a5', semestre: 12, nota: 49 },
    { alunoId: 'a6', semestre: 12, nota: 66 },
  ],
  insights: [
    { escopo: 'area', texto: 'Clínica Médica está em nível crítico nos três simulados, com desempenho estável em 27%.' },
    { escopo: 'aluno', texto: '28 alunos permanecem abaixo do limiar em todos os simulados do recorte.' },
  ],
};

/** Recorte com apenas 1 simulado realizado: régua some, gráfico não desenha linha. */
export function visaoComUmSimulado(): VisaoGeral {
  return {
    ...visaoGeralFake,
    kpis: {
      enamedProjetado: { valor: 2, delta: null, serie: [{ rotulo: 'atual', valor: 2 }], criterio: metaFake.criterio },
      proficientesPct: { valor: 51, delta: null, serie: [{ rotulo: 'atual', valor: 51 }], criterio: metaFake.criterio },
      acertoPct: { valor: 55, delta: null, serie: [{ rotulo: 'atual', valor: 55 }], criterio: metaFake.criterio },
      simulados: { realizados: 1, contratados: 7 },
    },
    evolucao: [visaoGeralFake.evolucao[0]],
    evolucaoPorArea: visaoGeralFake.evolucaoPorArea.map((area) => ({ ...area, pontos: [area.pontos[0]] })),
  };
}
```

```tsx
// src/features/gestor/__tests__/KpisVisaoGeral.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@/test/utils';
import { KpisVisaoGeral } from '@/features/gestor/components/KpisVisaoGeral';
import { metaFake, visaoGeralFake, visaoComUmSimulado } from './fixtures/visaoGeral';

const titulos = () =>
  screen.getAllByTestId('kpi-card').map((card) => card.querySelector('[data-testid="kpi-titulo"]')?.textContent);

describe('KpisVisaoGeral', () => {
  it('renderiza os 4 KPIs na ordem canônica da §4.8', () => {
    render(<KpisVisaoGeral kpis={visaoGeralFake.kpis} meta={metaFake} />);
    expect(titulos()).toEqual([
      'Conceito ENAMED projetado',
      'Alunos proficientes',
      'Percentual de acerto',
      'Simulados realizados',
    ]);
  });

  it('formata cada KPI na sua escala: conceito 1-5, percentuais e feitos/total', () => {
    render(<KpisVisaoGeral kpis={visaoGeralFake.kpis} meta={metaFake} />);
    const valores = screen.getAllByTestId('kpi-valor').map((v) => v.textContent);
    expect(valores).toEqual(['3/5', '62%', '57%', '3 de 7']);
  });

  it('marca o conceito ENAMED com o badge "projetado" e só ele', () => {
    render(<KpisVisaoGeral kpis={visaoGeralFake.kpis} meta={metaFake} />);
    expect(screen.getAllByText('projetado')).toHaveLength(1);
    expect(screen.getAllByTestId('kpi-card')[0]).toHaveTextContent('projetado');
  });

  it('os três primeiros KPIs lideram pela evolução (régua presente) e o quarto não tem régua', () => {
    render(<KpisVisaoGeral kpis={visaoGeralFake.kpis} meta={metaFake} />);
    const cards = screen.getAllByTestId('kpi-card');
    expect(cards[0].querySelector('[data-testid="kpi-regua"]')).not.toBeNull();
    expect(cards[1].querySelector('[data-testid="kpi-regua"]')).not.toBeNull();
    expect(cards[2].querySelector('[data-testid="kpi-regua"]')).not.toBeNull();
    expect(cards[3].querySelector('[data-testid="kpi-regua"]')).toBeNull();
  });

  it('o KPI de simulados tem trilha e link "Ver cronograma" para o Início', () => {
    render(<KpisVisaoGeral kpis={visaoGeralFake.kpis} meta={metaFake} />);
    expect(screen.getByTestId('kpi-trilha')).toHaveAttribute('aria-valuenow', '43');
    expect(screen.getByRole('link', { name: 'Ver cronograma' })).toHaveAttribute('href', '/gestor');
  });

  it('com 1 simulado realizado nenhuma régua aparece', () => {
    render(<KpisVisaoGeral kpis={visaoComUmSimulado().kpis} meta={metaFake} />);
    expect(screen.queryAllByTestId('kpi-regua')).toHaveLength(0);
  });

  it('propaga o estado de loading para os quatro cards', () => {
    render(<KpisVisaoGeral kpis={visaoGeralFake.kpis} meta={metaFake} estado="loading" />);
    expect(screen.queryAllByTestId('kpi-skeleton')).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/gestor/__tests__/KpisVisaoGeral.test.tsx`
Expected: FAIL com `Failed to resolve import "@/features/gestor/components/KpisVisaoGeral"`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/features/gestor/components/KpisVisaoGeral.tsx
import { Link } from 'react-router-dom';
import { KpiCard, type EstadoKpi } from '@/features/gestor/components/KpiCard';
import { formatConceito, formatNumero, formatPct } from '@/features/gestor/lib/formatters';
import type { Meta, VisaoGeral } from '@/features/gestor/api/types';

export interface KpisVisaoGeralProps {
  kpis: VisaoGeral['kpis'];
  meta: Meta;
  estado?: EstadoKpi;
  onTentarNovamente?: () => void;
}

/** §4.8 — ordem fixa: ENAMED projetado · proficientes · acerto · simulados realizados. */
export function KpisVisaoGeral({ kpis, meta, estado = 'ok', onTentarNovamente }: KpisVisaoGeralProps) {
  return (
    <div data-testid="kpis-visao-geral" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        titulo="Conceito ENAMED projetado"
        valor={formatConceito(kpis.enamedProjetado.valor)}
        badge="projetado"
        meta={meta}
        criterio={kpis.enamedProjetado.criterio}
        delta={kpis.enamedProjetado.delta}
        serie={kpis.enamedProjetado.serie}
        formatarPonto={formatConceito}
        estado={estado}
        onTentarNovamente={onTentarNovamente}
      />
      <KpiCard
        titulo="Alunos proficientes"
        valor={formatPct(kpis.proficientesPct.valor)}
        meta={meta}
        criterio={kpis.proficientesPct.criterio}
        delta={kpis.proficientesPct.delta}
        serie={kpis.proficientesPct.serie}
        formatarPonto={(valor) => formatPct(valor)}
        estado={estado}
        onTentarNovamente={onTentarNovamente}
      />
      <KpiCard
        titulo="Percentual de acerto"
        valor={formatPct(kpis.acertoPct.valor)}
        meta={meta}
        criterio={kpis.acertoPct.criterio}
        delta={kpis.acertoPct.delta}
        serie={kpis.acertoPct.serie}
        formatarPonto={(valor) => formatPct(valor)}
        estado={estado}
        onTentarNovamente={onTentarNovamente}
      />
      <KpiCard
        titulo="Simulados realizados"
        valor={`${formatNumero(kpis.simulados.realizados)} de ${formatNumero(kpis.simulados.contratados)}`}
        meta={meta}
        criterio="Slots do contrato com simulado já realizado"
        trilha={{ feitos: kpis.simulados.realizados, total: kpis.simulados.contratados }}
        rodape={<Link to="/gestor">Ver cronograma</Link>}
        estado={estado}
        onTentarNovamente={onTentarNovamente}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/gestor/__tests__/KpisVisaoGeral.test.tsx`
Expected: PASS (7 testes).

- [ ] **Step 5: Commit**

```bash
git add src/features/gestor/components/KpisVisaoGeral.tsx src/features/gestor/__tests__/KpisVisaoGeral.test.tsx src/features/gestor/__tests__/fixtures/visaoGeral.ts
git commit -m "feat(gestor): 4 KPIs da Visao Geral na ordem canonica

ENAMED projetado (1-5, badge projetado) · proficientes % · acerto % · simulados feitos/total.
Fixture compartilhada da Fase 4 em __tests__/fixtures/visaoGeral.ts."
```

---

### Task 38: EvolucaoChart — modo Geral

**Files:**
- Create: `src/features/gestor/charts/EvolucaoChart.tsx`
- Test: `src/features/gestor/__tests__/EvolucaoChart.test.tsx`

**Interfaces:**
- Consumes: `VisaoGeral` de `api/types.ts`; `formatNumero`, `formatData` de `lib/formatters.ts`; fixture `visaoGeralFake`/`visaoComUmSimulado` (Task 37); `PROFICIENCIA_MINIMA` de `lib/regras.ts` (Fase 1).
- Produces: `EvolucaoChart({ pontos, largura, altura }: { pontos: VisaoGeral['evolucao']; largura?: number; altura?: number })`.
  - Quando `largura`/`altura` são passados, o recharts renderiza com dimensões fixas (indispensável no jsdom). Sem eles, usa `ResponsiveContainer`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/gestor/__tests__/EvolucaoChart.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@/test/utils';
import { EvolucaoChart } from '@/features/gestor/charts/EvolucaoChart';
import { visaoComUmSimulado, visaoGeralFake } from './fixtures/visaoGeral';

const DIM = { largura: 640, altura: 320 };

describe('EvolucaoChart (modo Geral)', () => {
  it('é acessível como imagem com título e descrição', () => {
    const { container } = render(<EvolucaoChart pontos={visaoGeralFake.evolucao} {...DIM} />);
    const figura = screen.getByRole('img', { name: /Evolução da proficiência institucional/i });
    expect(figura).toBeInTheDocument();
    expect(container.querySelector('svg title')?.textContent).toMatch(/Evolução da proficiência institucional/i);
    expect(container.querySelector('svg desc')?.textContent).toMatch(/escala 0 a 100/i);
  });

  it('desenha linha, área e a linha de meta 60 tracejada com 2+ simulados', () => {
    const { container } = render(<EvolucaoChart pontos={visaoGeralFake.evolucao} {...DIM} />);
    expect(container.querySelector('.recharts-line')).not.toBeNull();
    expect(container.querySelector('.recharts-area')).not.toBeNull();

    const meta = container.querySelector('.recharts-reference-line-line');
    expect(meta).not.toBeNull();
    expect(meta?.getAttribute('stroke-dasharray')).toBe('6 4');
    expect(screen.getByText(/Meta institucional de proficiência: 60/i)).toBeInTheDocument();
  });

  it('usa espessura de 2.5px na linha protagonista', () => {
    const { container } = render(<EvolucaoChart pontos={visaoGeralFake.evolucao} {...DIM} />);
    expect(container.querySelector('.recharts-line-curve')?.getAttribute('stroke-width')).toBe('2.5');
  });

  it('com 1 simulado NÃO desenha linha: mostra o ponto rotulado e a nota de primeira medição', () => {
    const { container } = render(<EvolucaoChart pontos={visaoComUmSimulado().evolucao} {...DIM} />);
    expect(container.querySelector('.recharts-surface')).toBeNull();
    expect(container.querySelector('.recharts-line')).toBeNull();

    const unico = screen.getByTestId('evolucao-ponto-unico');
    expect(unico).toHaveTextContent('Simulado 1');
    expect(unico).toHaveTextContent('51');
    expect(
      screen.getByText('Primeira medição; a evolução aparece a partir do segundo simulado.')
    ).toBeInTheDocument();
  });

  it('mostra estado vazio sem simulados realizados', () => {
    render(<EvolucaoChart pontos={[]} {...DIM} />);
    expect(screen.getByTestId('evolucao-vazio')).toHaveTextContent('Nenhum simulado realizado neste recorte');
  });

  it('oferece alternativa tabular com um registro por simulado', () => {
    render(<EvolucaoChart pontos={visaoGeralFake.evolucao} {...DIM} />);
    const tabela = screen.getByTestId('evolucao-tabela');
    expect(tabela.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(tabela).toHaveTextContent('Simulado 3');
    expect(tabela).toHaveTextContent('14/07/2026');
    expect(tabela).toHaveTextContent('62');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/gestor/__tests__/EvolucaoChart.test.tsx`
Expected: FAIL com `Failed to resolve import "@/features/gestor/charts/EvolucaoChart"`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/features/gestor/charts/EvolucaoChart.tsx
import * as React from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PROFICIENCIA_MINIMA } from '@/features/gestor/lib/regras';
import { formatData, formatNumero } from '@/features/gestor/lib/formatters';
import type { VisaoGeral } from '@/features/gestor/api/types';

export interface EvolucaoChartProps {
  pontos: VisaoGeral['evolucao'];
  largura?: number;
  altura?: number;
}

const TICKS_Y = [0, 20, 40, 60, 80, 100];
const TITULO = 'Evolução da proficiência institucional por simulado';

function PontoAtual(props: { cx?: number; cy?: number; index?: number; ultimoIndice: number }) {
  const { cx, cy, index, ultimoIndice } = props;
  if (cx === undefined || cy === undefined) return null;
  const corrente = index === ultimoIndice;
  return (
    <g>
      {corrente ? <circle cx={cx} cy={cy} r={9} fill="hsl(var(--primary))" fillOpacity={0.18} /> : null}
      <circle
        cx={cx}
        cy={cy}
        r={corrente ? 5 : 3.5}
        fill="hsl(var(--primary))"
        stroke="hsl(var(--card))"
        strokeWidth={2}
      />
    </g>
  );
}

export function EvolucaoChart({ pontos, largura, altura = 300 }: EvolucaoChartProps) {
  const descricao = `Proficiência institucional por simulado, escala 0 a 100, com ${pontos.length} simulado(s) realizado(s). Meta institucional de ${PROFICIENCIA_MINIMA}.`;

  const tabela = (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs text-muted-foreground">Ver dados em tabela</summary>
      <table data-testid="evolucao-tabela" className="mt-2 w-full text-left text-xs">
        <caption className="sr-only">{TITULO}</caption>
        <thead>
          <tr className="text-muted-foreground">
            <th scope="col" className="py-1 pr-3 font-medium">Simulado</th>
            <th scope="col" className="py-1 pr-3 font-medium">Data</th>
            <th scope="col" className="py-1 pr-3 font-medium">Proficiência</th>
            <th scope="col" className="py-1 font-medium">Participantes</th>
          </tr>
        </thead>
        <tbody>
          {pontos.map((ponto) => (
            <tr key={ponto.simuladoId} className="border-t border-border/60">
              <th scope="row" className="py-1 pr-3 font-normal">{ponto.nome}</th>
              <td className="py-1 pr-3 tabular-nums">{formatData(ponto.data)}</td>
              <td className="py-1 pr-3 tabular-nums">{formatNumero(ponto.valor)}</td>
              <td className="py-1 tabular-nums">{formatNumero(ponto.participantes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );

  if (pontos.length === 0) {
    return (
      <div data-testid="evolucao-vazio" className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        Nenhum simulado realizado neste recorte.
      </div>
    );
  }

  // Handoff de data viz: com 1 simulado não se desenha linha de um ponto.
  if (pontos.length === 1) {
    const unico = pontos[0];
    return (
      <figure role="img" aria-label={`${TITULO}. ${descricao}`} className="m-0">
        <div
          data-testid="evolucao-ponto-unico"
          className="flex h-[300px] flex-col items-center justify-center gap-2"
        >
          <span className="relative flex h-4 w-4 items-center justify-center">
            <span className="absolute h-4 w-4 rounded-full bg-primary/20" />
            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
          <span className="text-3xl font-semibold tabular-nums">{formatNumero(unico.valor)}</span>
          <span className="text-xs text-muted-foreground">{unico.nome} · {formatData(unico.data)}</span>
        </div>
        <figcaption className="text-xs text-muted-foreground">
          Primeira medição; a evolução aparece a partir do segundo simulado.
        </figcaption>
        {tabela}
      </figure>
    );
  }

  const dados = pontos.map((ponto) => ({ rotulo: ponto.nome, valor: ponto.valor }));
  const ultimoIndice = dados.length - 1;

  const grafico = (
    <ComposedChart
      data={dados}
      width={largura}
      height={largura ? altura : undefined}
      title={TITULO}
      desc={descricao}
      margin={{ top: 8, right: 56, bottom: 0, left: 0 }}
    >
      <defs>
        <linearGradient id="gradiente-evolucao-gestor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" vertical={false} />
      <XAxis dataKey="rotulo" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
      <YAxis
        domain={[0, 100]}
        ticks={TICKS_Y}
        width={36}
        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
        axisLine={false}
        tickLine={false}
      />
      <ReferenceLine
        y={PROFICIENCIA_MINIMA}
        stroke="hsl(var(--muted-foreground))"
        strokeDasharray="6 4"
        label={{ value: `Meta ${PROFICIENCIA_MINIMA}`, position: 'right', fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
      />
      <Tooltip
        formatter={(valor: number) => [formatNumero(valor), 'Proficiência']}
        contentStyle={{
          backgroundColor: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          borderRadius: '8px',
          fontSize: '12px',
        }}
      />
      <Area type="monotone" dataKey="valor" stroke="none" fill="url(#gradiente-evolucao-gestor)" isAnimationActive={false} />
      <Line
        type="monotone"
        dataKey="valor"
        stroke="hsl(var(--primary))"
        strokeWidth={2.5}
        connectNulls={false}
        isAnimationActive={false}
        dot={<PontoAtual ultimoIndice={ultimoIndice} />}
        activeDot={{ r: 6 }}
      />
    </ComposedChart>
  );

  return (
    <figure role="img" aria-label={`${TITULO}. ${descricao}`} className="m-0">
      {largura ? grafico : (
        <div style={{ height: altura }}>
          <ResponsiveContainer width="100%" height="100%">
            {grafico}
          </ResponsiveContainer>
        </div>
      )}
      <figcaption className="text-xs text-muted-foreground">
        Meta institucional de proficiência: {PROFICIENCIA_MINIMA}.
      </figcaption>
      {tabela}
    </figure>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/gestor/__tests__/EvolucaoChart.test.tsx`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add src/features/gestor/charts/EvolucaoChart.tsx src/features/gestor/__tests__/EvolucaoChart.test.tsx
git commit -m "feat(gestor): EvolucaoChart modo Geral (proficiencia 0-100, meta 60)

Linha 2.5px + area com gradiente de marca, halo no ponto atual, ticks 20/40/60/80.
Com 1 simulado nao desenha linha: ponto rotulado + nota de primeira medicao."
```

---

### Task 39: AreasChart — modo Por grande área

**Files:**
- Create: `src/features/gestor/charts/AreasChart.tsx`
- Test: `src/features/gestor/__tests__/AreasChart.test.tsx`

**Interfaces:**
- Consumes: `VisaoGeral` de `api/types.ts`; `formatPct` de `lib/formatters.ts`; fixture da Task 37.
- Produces: `AreasChart({ areas, largura, altura }: { areas: VisaoGeral['evolucaoPorArea']; largura?: number; altura?: number })`.
  - Série em **% de acerto** (§4.8) e rótulo **"desempenho"** (§4.6) — nunca "proficiência".
  - Legenda clicável que isola/reativa (estado local `isolada`).

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/gestor/__tests__/AreasChart.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen, userEvent } from '@/test/utils';
import { AreasChart } from '@/features/gestor/charts/AreasChart';
import { visaoGeralFake } from './fixtures/visaoGeral';

const DIM = { largura: 640, altura: 320 };

describe('AreasChart (modo Por grande área)', () => {
  it('desenha uma linha por grande área', () => {
    const { container } = render(<AreasChart areas={visaoGeralFake.evolucaoPorArea} {...DIM} />);
    expect(container.querySelectorAll('.recharts-line')).toHaveLength(3);
  });

  it('rotula a métrica como desempenho em % de acerto, e nunca como proficiência', () => {
    render(<AreasChart areas={visaoGeralFake.evolucaoPorArea} {...DIM} />);
    expect(screen.getByTestId('areas-rotulo-metrica')).toHaveTextContent('Desempenho por grande área (% de acerto)');
    expect(screen.queryByText(/profici/i)).not.toBeInTheDocument();
  });

  it('dá peso 3px à área crítica e 1.5px às demais, com 70% de opacidade nas demais', () => {
    const { container } = render(<AreasChart areas={visaoGeralFake.evolucaoPorArea} {...DIM} />);
    const curvas = Array.from(container.querySelectorAll('.recharts-line-curve'));
    expect(curvas[0].getAttribute('stroke-width')).toBe('3');
    expect(curvas[1].getAttribute('stroke-width')).toBe('1.5');
    expect(curvas[1].getAttribute('stroke-opacity')).toBe('0.7');
  });

  it('marca a área crítica na legenda', () => {
    render(<AreasChart areas={visaoGeralFake.evolucaoPorArea} {...DIM} />);
    const item = screen.getByRole('button', { name: /Clínica Médica/ });
    expect(item).toHaveTextContent('área crítica');
  });

  it('legenda clicável isola a área e o segundo clique reativa todas', async () => {
    const user = userEvent.setup();
    const { container } = render(<AreasChart areas={visaoGeralFake.evolucaoPorArea} {...DIM} />);

    const cirurgia = screen.getByRole('button', { name: /Cirurgia/ });
    await user.click(cirurgia);
    expect(cirurgia).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelectorAll('.recharts-line')).toHaveLength(1);

    await user.click(cirurgia);
    expect(cirurgia).toHaveAttribute('aria-pressed', 'false');
    expect(container.querySelectorAll('.recharts-line')).toHaveLength(3);
  });

  it('oferece alternativa tabular com % de acerto por simulado', () => {
    render(<AreasChart areas={visaoGeralFake.evolucaoPorArea} {...DIM} />);
    const tabela = screen.getByTestId('areas-tabela');
    expect(tabela.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(tabela).toHaveTextContent('27%');
  });

  it('mostra estado vazio sem áreas', () => {
    render(<AreasChart areas={[]} {...DIM} />);
    expect(screen.getByTestId('areas-vazio')).toHaveTextContent('Sem dados por grande área neste recorte');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/gestor/__tests__/AreasChart.test.tsx`
Expected: FAIL com `Failed to resolve import "@/features/gestor/charts/AreasChart"`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/features/gestor/charts/AreasChart.tsx
import * as React from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cn } from '@/lib/utils';
import { formatPct } from '@/features/gestor/lib/formatters';
import type { VisaoGeral } from '@/features/gestor/api/types';

export interface AreasChartProps {
  areas: VisaoGeral['evolucaoPorArea'];
  largura?: number;
  altura?: number;
}

const TICKS_Y = [0, 20, 40, 60, 80, 100];
const TITULO = 'Desempenho por grande área, em percentual de acerto, por simulado';
const CORES = [
  'hsl(var(--destructive))',
  'hsl(var(--primary))',
  'hsl(var(--chart-3, var(--primary)))',
  'hsl(var(--chart-4, var(--muted-foreground)))',
  'hsl(var(--chart-5, var(--foreground)))',
];

export function AreasChart({ areas, largura, altura = 300 }: AreasChartProps) {
  const [isolada, setIsolada] = React.useState<string | null>(null);

  const rotulos = areas[0]?.pontos.map((ponto) => ponto.rotulo) ?? [];
  const dados = rotulos.map((rotulo, indice) => {
    const linha: Record<string, string | number | null> = { rotulo };
    areas.forEach((area) => {
      linha[area.area] = area.pontos[indice]?.valor ?? null;
    });
    return linha;
  });

  if (areas.length === 0) {
    return (
      <div data-testid="areas-vazio" className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        Sem dados por grande área neste recorte.
      </div>
    );
  }

  const grafico = (
    <LineChart
      data={dados}
      width={largura}
      height={largura ? altura : undefined}
      title={TITULO}
      desc={`${areas.length} grandes áreas, escala de 0 a 100% de acerto.`}
      margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
    >
      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" vertical={false} />
      <XAxis dataKey="rotulo" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
      <YAxis
        domain={[0, 100]}
        ticks={TICKS_Y}
        width={40}
        tickFormatter={(valor: number) => `${valor}%`}
        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
        axisLine={false}
        tickLine={false}
      />
      <Tooltip
        formatter={(valor: number, nome: string) => [formatPct(valor), nome]}
        contentStyle={{
          backgroundColor: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          borderRadius: '8px',
          fontSize: '12px',
        }}
      />
      {areas.map((area, indice) => (
        <Line
          key={area.area}
          type="monotone"
          dataKey={area.area}
          stroke={CORES[indice % CORES.length]}
          strokeWidth={area.critica ? 3 : 1.5}
          strokeOpacity={area.critica ? 1 : 0.7}
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
          hide={isolada !== null && isolada !== area.area}
        />
      ))}
    </LineChart>
  );

  return (
    <figure role="img" aria-label={TITULO} className="m-0">
      <p data-testid="areas-rotulo-metrica" className="mb-1 text-xs text-muted-foreground">
        Desempenho por grande área (% de acerto)
      </p>
      {largura ? grafico : (
        <div style={{ height: altura }}>
          <ResponsiveContainer width="100%" height="100%">
            {grafico}
          </ResponsiveContainer>
        </div>
      )}
      <ul data-testid="areas-legenda" className="mt-2 flex flex-wrap gap-2">
        {areas.map((area, indice) => (
          <li key={area.area}>
            <button
              type="button"
              aria-pressed={isolada === area.area}
              onClick={() => setIsolada((atual) => (atual === area.area ? null : area.area))}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
                isolada === area.area ? 'border-foreground/40 bg-muted font-medium' : 'border-border text-muted-foreground hover:text-foreground'
              )}
            >
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: CORES[indice % CORES.length] }}
              />
              {area.area}
              {area.critica ? <span className="text-[10px] font-medium text-destructive">área crítica</span> : null}
            </button>
          </li>
        ))}
      </ul>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-muted-foreground">Ver dados em tabela</summary>
        <table data-testid="areas-tabela" className="mt-2 w-full text-left text-xs">
          <caption className="sr-only">{TITULO}</caption>
          <thead>
            <tr className="text-muted-foreground">
              <th scope="col" className="py-1 pr-3 font-medium">Grande área</th>
              {rotulos.map((rotulo) => (
                <th key={rotulo} scope="col" className="py-1 pr-3 font-medium">{rotulo}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {areas.map((area) => (
              <tr key={area.area} className="border-t border-border/60">
                <th scope="row" className="py-1 pr-3 font-normal">{area.area}</th>
                {area.pontos.map((ponto) => (
                  <td key={`${area.area}-${ponto.rotulo}`} className="py-1 pr-3 tabular-nums">
                    {formatPct(ponto.valor)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/gestor/__tests__/AreasChart.test.tsx`
Expected: PASS (7 testes).

- [ ] **Step 5: Commit**

```bash
git add src/features/gestor/charts/AreasChart.tsx src/features/gestor/__tests__/AreasChart.test.tsx
git commit -m "feat(gestor): AreasChart multi-linha em % de acerto

Rotulo 'desempenho' (spec §4.6), nunca proficiencia por area.
Area critica com peso 3px, demais 1.5px a 70%; legenda clicavel isola/reativa."
```

---

### Task 40: DispersaoChart — modo Por aluno

**Files:**
- Create: `src/features/gestor/charts/DispersaoChart.tsx`
- Test: `src/features/gestor/__tests__/DispersaoChart.test.tsx`

**Interfaces:**
- Consumes: `VisaoGeral`, `PontoSerie` de `api/types.ts`; `PROFICIENCIA_MINIMA` de `lib/regras.ts`; `formatNumero` de `lib/formatters.ts`.
- Produces:
  - `DispersaoChart({ pontos, tendencia, largura, altura }: { pontos: VisaoGeral['dispersao']; tendencia?: { semestre: number; nota: number }[] | null; largura?: number; altura?: number })`.
  - `prepararPontos(pontos)` e `medianaDeNotas(pontos)` exportados para teste unitário.
  - §4.11: a reta de tendência é **calculada e armazenada no backend**; o componente só a desenha quando recebida. Sem ela, exibe a nota "linha de tendência indisponível para este recorte" (pendência nº4, a tela não depende dela).

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/gestor/__tests__/DispersaoChart.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@/test/utils';
import { DispersaoChart, medianaDeNotas, prepararPontos } from '@/features/gestor/charts/DispersaoChart';
import { visaoGeralFake } from './fixtures/visaoGeral';

const DIM = { largura: 640, altura: 320 };
const UM_SEMESTRE = [
  { alunoId: 'a1', semestre: 11, nota: 40 },
  { alunoId: 'a2', semestre: 11, nota: 55 },
  { alunoId: 'a3', semestre: 11, nota: 70 },
];

describe('prepararPontos', () => {
  it('não aplica jitter quando há mais de um semestre', () => {
    const preparados = prepararPontos(visaoGeralFake.dispersao);
    expect(preparados.map((p) => p.x)).toEqual([11, 11, 11, 12, 12, 12]);
  });

  it('aplica jitter determinístico quando há um único semestre', () => {
    const preparados = prepararPontos(UM_SEMESTRE);
    const xs = preparados.map((p) => p.x);
    expect(new Set(xs).size).toBe(3);
    xs.forEach((x) => expect(Math.abs(x - 11)).toBeLessThan(0.25));
  });
});

describe('medianaDeNotas', () => {
  it('calcula a mediana com número ímpar de pontos', () => {
    expect(medianaDeNotas(UM_SEMESTRE)).toBe(55);
  });

  it('calcula a mediana com número par de pontos', () => {
    expect(medianaDeNotas([...UM_SEMESTRE, { alunoId: 'a4', semestre: 11, nota: 80 }])).toBe(62.5);
  });
});

describe('DispersaoChart (modo Por aluno)', () => {
  it('desenha um símbolo por aluno e é acessível como imagem', () => {
    const { container } = render(<DispersaoChart pontos={visaoGeralFake.dispersao} {...DIM} />);
    expect(screen.getByRole('img', { name: /Dispersão de proficiência por semestre/i })).toBeInTheDocument();
    expect(container.querySelectorAll('.recharts-scatter-symbol')).toHaveLength(6);
  });

  it('desenha o corte de proficiência em 60', () => {
    const { container } = render(<DispersaoChart pontos={visaoGeralFake.dispersao} {...DIM} />);
    expect(container.querySelector('.recharts-reference-line-line')).not.toBeNull();
    expect(screen.getByText(/Corte de proficiência: 60/i)).toBeInTheDocument();
  });

  it('desenha a linha de tendência quando o servidor a fornece', () => {
    const { container } = render(
      <DispersaoChart pontos={visaoGeralFake.dispersao} tendencia={[{ semestre: 11, nota: 58 }, { semestre: 12, nota: 66 }]} {...DIM} />
    );
    expect(container.querySelector('.recharts-scatter-line')).not.toBeNull();
    expect(screen.queryByText(/linha de tendência indisponível/i)).not.toBeInTheDocument();
  });

  it('sem tendência do servidor não desenha reta e informa a indisponibilidade', () => {
    const { container } = render(<DispersaoChart pontos={visaoGeralFake.dispersao} {...DIM} />);
    expect(container.querySelector('.recharts-scatter-line')).toBeNull();
    expect(screen.getByText(/linha de tendência indisponível para este recorte/i)).toBeInTheDocument();
  });

  it('com um único semestre vira distribuição interna: jitter + mediana em destaque', () => {
    const { container } = render(<DispersaoChart pontos={UM_SEMESTRE} {...DIM} />);
    expect(container.querySelectorAll('.recharts-scatter-symbol')).toHaveLength(3);
    expect(screen.getByText(/Mediana do semestre: 55/i)).toBeInTheDocument();
  });

  it('mostra estado vazio sem alunos', () => {
    render(<DispersaoChart pontos={[]} {...DIM} />);
    expect(screen.getByTestId('dispersao-vazio')).toHaveTextContent('Sem alunos com resultado neste recorte');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/gestor/__tests__/DispersaoChart.test.tsx`
Expected: FAIL com `Failed to resolve import "@/features/gestor/charts/DispersaoChart"`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/features/gestor/charts/DispersaoChart.tsx
import * as React from 'react';
import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import { PROFICIENCIA_MINIMA } from '@/features/gestor/lib/regras';
import { formatNumero } from '@/features/gestor/lib/formatters';
import type { VisaoGeral } from '@/features/gestor/api/types';

type PontoDispersao = VisaoGeral['dispersao'][number];

export interface DispersaoChartProps {
  pontos: PontoDispersao[];
  /** §4.11: reta calculada e armazenada no backend. Ausente = não desenhar. */
  tendencia?: { semestre: number; nota: number }[] | null;
  largura?: number;
  altura?: number;
}

const TICKS_Y = [0, 20, 40, 60, 80, 100];
const TITULO = 'Dispersão de proficiência por semestre, um ponto por aluno';

export function prepararPontos(pontos: PontoDispersao[]): { alunoId: string; x: number; y: number; semestre: number }[] {
  const semestres = Array.from(new Set(pontos.map((ponto) => ponto.semestre)));
  const semestreUnico = semestres.length === 1;
  return pontos.map((ponto, indice) => ({
    alunoId: ponto.alunoId,
    semestre: ponto.semestre,
    // §4.5: com um semestre só, o gráfico vira distribuição interna — jitter determinístico.
    x: semestreUnico ? ponto.semestre + ((indice % 7) - 3) * 0.06 : ponto.semestre,
    y: ponto.nota,
  }));
}

export function medianaDeNotas(pontos: PontoDispersao[]): number | null {
  if (pontos.length === 0) return null;
  const notas = pontos.map((ponto) => ponto.nota).sort((a, b) => a - b);
  const meio = Math.floor(notas.length / 2);
  return notas.length % 2 === 1 ? notas[meio] : (notas[meio - 1] + notas[meio]) / 2;
}

export function DispersaoChart({ pontos, tendencia, largura, altura = 300 }: DispersaoChartProps) {
  if (pontos.length === 0) {
    return (
      <div data-testid="dispersao-vazio" className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        Sem alunos com resultado neste recorte.
      </div>
    );
  }

  const preparados = prepararPontos(pontos);
  const semestres = Array.from(new Set(pontos.map((ponto) => ponto.semestre))).sort((a, b) => a - b);
  const semestreUnico = semestres.length === 1;
  const mediana = semestreUnico ? medianaDeNotas(pontos) : null;
  const retaTendencia = tendencia?.map((ponto) => ({ x: ponto.semestre, y: ponto.nota })) ?? null;

  const grafico = (
    <ScatterChart
      width={largura}
      height={largura ? altura : undefined}
      title={TITULO}
      desc={`${pontos.length} alunos, proficiência de 0 a 100, semestres ${semestres.join(', ')}.`}
      margin={{ top: 8, right: 56, bottom: 8, left: 0 }}
    >
      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
      <XAxis
        type="number"
        dataKey="x"
        name="Semestre"
        domain={[semestres[0] - 0.5, semestres[semestres.length - 1] + 0.5]}
        ticks={semestres}
        tickFormatter={(valor: number) => `${valor}º`}
        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
        axisLine={false}
        tickLine={false}
      />
      <YAxis
        type="number"
        dataKey="y"
        name="Proficiência"
        domain={[0, 100]}
        ticks={TICKS_Y}
        width={36}
        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
        axisLine={false}
        tickLine={false}
      />
      <ReferenceLine
        y={PROFICIENCIA_MINIMA}
        stroke="hsl(var(--muted-foreground))"
        strokeDasharray="6 4"
        label={{ value: `Corte ${PROFICIENCIA_MINIMA}`, position: 'right', fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
      />
      {mediana !== null ? (
        <ReferenceLine
          y={mediana}
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          label={{ value: 'Mediana', position: 'right', fontSize: 11, fill: 'hsl(var(--primary))' }}
        />
      ) : null}
      <Tooltip
        formatter={(valor: number, nome: string) => [nome === 'Semestre' ? `${Math.round(valor)}º` : formatNumero(valor), nome]}
        contentStyle={{
          backgroundColor: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          borderRadius: '8px',
          fontSize: '12px',
        }}
      />
      <Scatter name="Alunos" data={preparados} fill="hsl(var(--primary))" fillOpacity={0.55} isAnimationActive={false} />
      {retaTendencia ? (
        <Scatter
          name="Tendência"
          data={retaTendencia}
          fill="transparent"
          line={{ stroke: 'hsl(var(--primary))', strokeWidth: 2, strokeDasharray: '6 4' }}
          isAnimationActive={false}
        />
      ) : null}
    </ScatterChart>
  );

  return (
    <figure role="img" aria-label={TITULO} className="m-0">
      {largura ? grafico : (
        <div style={{ height: altura }}>
          <ResponsiveContainer width="100%" height="100%">
            {grafico}
          </ResponsiveContainer>
        </div>
      )}
      <figcaption className="text-xs text-muted-foreground">
        Corte de proficiência: {PROFICIENCIA_MINIMA}.
        {mediana !== null ? ` Mediana do semestre: ${formatNumero(mediana)}.` : ''}
        {retaTendencia ? '' : ' Linha de tendência indisponível para este recorte.'}
      </figcaption>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-muted-foreground">Ver dados em tabela</summary>
        <table data-testid="dispersao-tabela" className="mt-2 w-full text-left text-xs">
          <caption className="sr-only">{TITULO}</caption>
          <thead>
            <tr className="text-muted-foreground">
              <th scope="col" className="py-1 pr-3 font-medium">Semestre</th>
              <th scope="col" className="py-1 font-medium">Proficiência</th>
            </tr>
          </thead>
          <tbody>
            {pontos.map((ponto) => (
              <tr key={ponto.alunoId} className="border-t border-border/60">
                <th scope="row" className="py-1 pr-3 font-normal">{ponto.semestre}º</th>
                <td className="py-1 tabular-nums">{formatNumero(ponto.nota)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/gestor/__tests__/DispersaoChart.test.tsx`
Expected: PASS (9 testes).

- [ ] **Step 5: Commit**

```bash
git add src/features/gestor/charts/DispersaoChart.tsx src/features/gestor/__tests__/DispersaoChart.test.tsx
git commit -m "feat(gestor): DispersaoChart nota x semestre com corte 60

Tendencia so quando vem do backend (spec §4.11, pendencia 4).
Semestre unico vira distribuicao interna: jitter deterministico + mediana."
```

---

### Task 41: GraficoProtagonista — 3 modos sem refetch

**Files:**
- Create: `src/features/gestor/lib/recorte.ts`
- Create: `src/features/gestor/components/GraficoProtagonista.tsx`
- Test: `src/features/gestor/__tests__/GraficoProtagonista.test.tsx`

**Interfaces:**
- Consumes: `EvolucaoChart` (Task 38), `AreasChart` (Task 39), `DispersaoChart` (Task 40); `useVisaoGeral` de `api/queries.ts` (só no teste, via harness); `ModoGrafico`, `VisaoGeral`, `FiltroSemestre` de `api/types.ts`.
- Produces:
  - `type Recorte = { iesId: string | null; semestre: FiltroSemestre }` em `lib/recorte.ts` — parâmetro de dado dos hooks, usado nas Tasks 42, 45 e 46.
  - `GraficoProtagonista({ visao }: { visao: VisaoGeral })` — controle de modo **dentro** do gráfico (§4.8), estado local, **sem refetch** (§8.2, caso crítico nº15).

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/gestor/__tests__/GraficoProtagonista.test.tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, userEvent, waitFor } from '@/test/utils';
import { GraficoProtagonista } from '@/features/gestor/components/GraficoProtagonista';
import { useVisaoGeral } from '@/features/gestor/api/queries';
import type { FiltroSemestre } from '@/features/gestor/api/types';
import { metaFake, visaoGeralFake } from './fixtures/visaoGeral';

const { rpcSpy } = vi.hoisted(() => ({ rpcSpy: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: rpcSpy } }));

const recorte = { iesId: 'ies-1', semestre: '6ano' as FiltroSemestre };

function Harness() {
  const consulta = useVisaoGeral(recorte);
  if (!consulta.data) return <p>carregando</p>;
  return <GraficoProtagonista visao={consulta.data.data} />;
}

describe('GraficoProtagonista', () => {
  beforeEach(() => {
    rpcSpy.mockResolvedValue({ data: { data: visaoGeralFake, meta: metaFake }, error: null });
  });

  it('abre no modo Geral', () => {
    render(<GraficoProtagonista visao={visaoGeralFake} />);
    expect(screen.getByRole('button', { name: 'Geral', pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Evolução da proficiência institucional/i })).toBeInTheDocument();
  });

  it('mantém o controle de modo dentro do card do gráfico', () => {
    render(<GraficoProtagonista visao={visaoGeralFake} />);
    const card = screen.getByTestId('grafico-protagonista');
    expect(card).toContainElement(screen.getByTestId('grafico-modos'));
  });

  it('alterna para Por grande área e para Por aluno trocando o componente exibido', async () => {
    const user = userEvent.setup();
    render(<GraficoProtagonista visao={visaoGeralFake} />);

    await user.click(screen.getByRole('button', { name: 'Por grande área' }));
    expect(screen.getByRole('img', { name: /Desempenho por grande área/i })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Evolução da proficiência institucional/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Por aluno' }));
    expect(screen.getByRole('img', { name: /Dispersão de proficiência por semestre/i })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Desempenho por grande área/i })).not.toBeInTheDocument();
  });

  it('NÃO dispara nenhuma requisição ao trocar de modo (caso crítico nº15)', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await waitFor(() => expect(screen.getByTestId('grafico-protagonista')).toBeInTheDocument());
    expect(rpcSpy).toHaveBeenCalledTimes(1);
    expect(rpcSpy).toHaveBeenCalledWith('get_gestor_visao_geral', expect.anything());

    await user.click(screen.getByRole('button', { name: 'Por grande área' }));
    await user.click(screen.getByRole('button', { name: 'Por aluno' }));
    await user.click(screen.getByRole('button', { name: 'Geral' }));

    expect(rpcSpy).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/gestor/__tests__/GraficoProtagonista.test.tsx`
Expected: FAIL com `Failed to resolve import "@/features/gestor/components/GraficoProtagonista"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/gestor/lib/recorte.ts
import type { FiltroSemestre } from '@/features/gestor/api/types';

/**
 * Parte de DADO do filtro global. É o que a camada de queries recebe —
 * os setters de useFiltrosGestor nunca descem para api/queries.ts.
 */
export interface Recorte {
  iesId: string | null;
  semestre: FiltroSemestre;
}
```

```tsx
// src/features/gestor/components/GraficoProtagonista.tsx
import * as React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { AreasChart } from '@/features/gestor/charts/AreasChart';
import { DispersaoChart } from '@/features/gestor/charts/DispersaoChart';
import { EvolucaoChart } from '@/features/gestor/charts/EvolucaoChart';
import type { ModoGrafico, VisaoGeral } from '@/features/gestor/api/types';

export interface GraficoProtagonistaProps {
  visao: VisaoGeral;
}

const MODOS: { valor: ModoGrafico; rotulo: string }[] = [
  { valor: 'geral', rotulo: 'Geral' },
  { valor: 'area', rotulo: 'Por grande área' },
  { valor: 'aluno', rotulo: 'Por aluno' },
];

const TITULOS: Record<ModoGrafico, string> = {
  geral: 'Evolução institucional',
  area: 'Evolução por grande área',
  aluno: 'Alunos por semestre',
};

/**
 * §4.8 — controle dos 3 modos DENTRO do gráfico. A troca alterna o componente
 * exibido usando as três séries que já vieram na mesma query: nenhum refetch (§8.2).
 */
export function GraficoProtagonista({ visao }: GraficoProtagonistaProps) {
  const [modo, setModo] = React.useState<ModoGrafico>('geral');

  return (
    <Card data-testid="grafico-protagonista">
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
        <h2 className="text-sm font-semibold">{TITULOS[modo]}</h2>
        <div data-testid="grafico-modos" role="group" aria-label="Modo do gráfico" className="flex items-center rounded-lg bg-muted/60 p-0.5">
          {MODOS.map((opcao) => (
            <button
              key={opcao.valor}
              type="button"
              aria-pressed={modo === opcao.valor}
              onClick={() => setModo(opcao.valor)}
              className={cn(
                'rounded-md px-2.5 py-1 text-[11px] font-medium transition-all',
                modo === opcao.valor ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {opcao.rotulo}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {modo === 'geral' ? <EvolucaoChart pontos={visao.evolucao} /> : null}
        {modo === 'area' ? <AreasChart areas={visao.evolucaoPorArea} /> : null}
        {modo === 'aluno' ? <DispersaoChart pontos={visao.dispersao} /> : null}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/gestor/__tests__/GraficoProtagonista.test.tsx`
Expected: PASS (4 testes). Se o 3º teste falhar por `role="img"` ausente, confirme que os gráficos das Tasks 38–40 renderizam mesmo sem `largura` (usam `ResponsiveContainer`; o `<figure role="img">` é externo ao recharts e existe sempre).

- [ ] **Step 5: Commit**

```bash
git add src/features/gestor/lib/recorte.ts src/features/gestor/components/GraficoProtagonista.tsx src/features/gestor/__tests__/GraficoProtagonista.test.tsx
git commit -m "feat(gestor): grafico protagonista com 3 modos, controle dentro do grafico

Geral | Por grande area | Por aluno alternam o componente sem refetch
(spec §4.8/§8.2, caso critico 15). Teste prova supabase.rpc chamado 1x."
```

---

### Task 42: CascataDiagnostico — 2 níveis, ao lado, no lugar

**Files:**
- Create: `src/features/gestor/lib/rotulos.ts`
- Create: `src/features/gestor/components/CascataDiagnostico.tsx`
- Test: `src/features/gestor/__tests__/CascataDiagnostico.test.tsx`

**Interfaces:**
- Consumes: `useDiagnostico(recorte, node)` de `api/queries.ts`; `Recorte` (Task 41); `NoDiagnostico`, `VisaoGeral`, `NivelDesempenho`, `GrupoEvolucao`, `Tendencia` de `api/types.ts`; `formatPct` de `lib/formatters.ts`.
- Produces:
  - `ROTULO_NIVEL: Record<NivelDesempenho, string>`, `ROTULO_GRUPO: Record<GrupoEvolucao, string>`, `ROTULO_TENDENCIA: Record<Tendencia, string>` em `lib/rotulos.ts` (usados nas Tasks 44, 45 e 46).
  - `CascataDiagnostico({ resumo, recorte, onAbrirTemas }: { resumo: VisaoGeral['diagnosticoResumo']; recorte: Recorte; onAbrirTemas: (especialidade: { id: string; nome: string }) => void })`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/gestor/__tests__/CascataDiagnostico.test.tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, userEvent } from '@/test/utils';
import { CascataDiagnostico } from '@/features/gestor/components/CascataDiagnostico';
import { useDiagnostico } from '@/features/gestor/api/queries';
import type { NoDiagnostico } from '@/features/gestor/api/types';
import { metaFake, visaoGeralFake } from './fixtures/visaoGeral';

vi.mock('@/features/gestor/api/queries', () => ({ useDiagnostico: vi.fn() }));

const grandesAreas: NoDiagnostico[] = [
  { id: 'ga-clinica', nome: 'Clínica Médica', nivel: 'grande_area', acertoPct: 27, desempenho: 'critico', amostra: 118, lowSample: false, temFilhos: true },
  { id: 'ga-cirurgia', nome: 'Cirurgia', nivel: 'grande_area', acertoPct: 61, desempenho: 'mediano', amostra: 118, lowSample: false, temFilhos: true },
];

const especialidadesClinica: NoDiagnostico[] = [
  { id: 'esp-cardio', nome: 'Cardiologia', nivel: 'especialidade', acertoPct: 24, desempenho: 'critico', amostra: 8, lowSample: true, temFilhos: true },
  { id: 'esp-pneumo', nome: 'Pneumologia', nivel: 'especialidade', acertoPct: 31, desempenho: 'mediano', amostra: 110, lowSample: false, temFilhos: true },
];

const recorte = { iesId: 'ies-1', semestre: '6ano' as const };
const mockUseDiagnostico = vi.mocked(useDiagnostico);

function envelope(dados: NoDiagnostico[]) {
  return { data: { data: dados, meta: metaFake }, isLoading: false, isError: false, refetch: vi.fn() };
}

describe('CascataDiagnostico', () => {
  beforeEach(() => {
    mockUseDiagnostico.mockImplementation(((_r: unknown, node: string | null) =>
      envelope(node === null ? grandesAreas : especialidadesClinica)) as unknown as typeof useDiagnostico);
  });

  it('mostra os 3 grupos por nível com chips de área', () => {
    render(<CascataDiagnostico resumo={visaoGeralFake.diagnosticoResumo} recorte={recorte} onAbrirTemas={vi.fn()} />);
    expect(screen.getByText('Excelente')).toBeInTheDocument();
    expect(screen.getByText('Mediano')).toBeInTheDocument();
    expect(screen.getByText('Crítico')).toBeInTheDocument();
    expect(screen.getByTestId('chip-ga-clinica')).toHaveTextContent('Clínica Médica');
    expect(screen.getByTestId('chip-ga-clinica')).toHaveTextContent('27%');
  });

  it('não renderiza os links removidos em 22/07', () => {
    render(<CascataDiagnostico resumo={visaoGeralFake.diagnosticoResumo} recorte={recorte} onAbrirTemas={vi.fn()} />);
    expect(screen.queryByText(/Ver alunos em TRI/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Explorar diagnóstico/i)).not.toBeInTheDocument();
  });

  it('só busca a cascata depois de abrir: nenhuma chamada de nível raiz antes do clique', async () => {
    const user = userEvent.setup();
    render(<CascataDiagnostico resumo={visaoGeralFake.diagnosticoResumo} recorte={recorte} onAbrirTemas={vi.fn()} />);
    expect(mockUseDiagnostico).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Abrir cascata do nível crítico' }));
    expect(mockUseDiagnostico).toHaveBeenCalledWith(recorte, null);
  });

  it('a seta divide o grid em dois e a cascata aparece AO LADO, não em drawer', async () => {
    const user = userEvent.setup();
    render(<CascataDiagnostico resumo={visaoGeralFake.diagnosticoResumo} recorte={recorte} onAbrirTemas={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Abrir cascata do nível crítico' }));
    expect(screen.getByTestId('diagnostico-grid')).toHaveAttribute('data-dividido', 'true');
    expect(screen.getByTestId('cascata')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('expande a especialidade no lugar, é accordion exclusivo e o segundo clique recolhe', async () => {
    const user = userEvent.setup();
    render(<CascataDiagnostico resumo={visaoGeralFake.diagnosticoResumo} recorte={recorte} onAbrirTemas={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Abrir cascata do nível crítico' }));

    const clinica = screen.getByRole('button', { name: /Clínica Médica/ });
    await user.click(clinica);
    expect(clinica).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('filhos-ga-clinica')).toBeInTheDocument();

    // exclusivo: abrir Cirurgia fecha Clínica Médica
    await user.click(screen.getByRole('button', { name: /Cirurgia/ }));
    expect(screen.queryByTestId('filhos-ga-clinica')).not.toBeInTheDocument();
    expect(screen.getByTestId('filhos-ga-cirurgia')).toBeInTheDocument();

    // segundo clique recolhe
    await user.click(screen.getByRole('button', { name: /Cirurgia/ }));
    expect(screen.queryByTestId('filhos-ga-cirurgia')).not.toBeInTheDocument();
  });

  it('a cascata para no 2º nível: a especialidade abre o drawer de temas', async () => {
    const user = userEvent.setup();
    const onAbrirTemas = vi.fn();
    render(<CascataDiagnostico resumo={visaoGeralFake.diagnosticoResumo} recorte={recorte} onAbrirTemas={onAbrirTemas} />);
    await user.click(screen.getByRole('button', { name: 'Abrir cascata do nível crítico' }));
    await user.click(screen.getByRole('button', { name: /Clínica Médica/ }));

    await user.click(screen.getByRole('button', { name: /Cardiologia/ }));
    expect(onAbrirTemas).toHaveBeenCalledWith({ id: 'esp-cardio', nome: 'Cardiologia' });
    expect(screen.queryByTestId('filhos-esp-cardio')).not.toBeInTheDocument();
  });

  it('marca cobertura parcial com o n da amostra quando lowSample', async () => {
    const user = userEvent.setup();
    render(<CascataDiagnostico resumo={visaoGeralFake.diagnosticoResumo} recorte={recorte} onAbrirTemas={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Abrir cascata do nível crítico' }));
    await user.click(screen.getByRole('button', { name: /Clínica Médica/ }));

    const cardio = screen.getByRole('button', { name: /Cardiologia/ });
    expect(cardio).toHaveTextContent('cobertura parcial');
    expect(cardio.querySelector('[data-testid="amostra-esp-cardio"]')).toHaveTextContent('n = 8');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/gestor/__tests__/CascataDiagnostico.test.tsx`
Expected: FAIL com `Failed to resolve import "@/features/gestor/components/CascataDiagnostico"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/gestor/lib/rotulos.ts
import type { GrupoEvolucao, NivelDesempenho, Tendencia } from '@/features/gestor/api/types';

/** §4.4 — 3 níveis sobre % de acerto. */
export const ROTULO_NIVEL: Record<NivelDesempenho, string> = {
  excelente: 'Excelente',
  mediano: 'Mediano',
  critico: 'Crítico',
};

/** §4.6 — na visão por aluno a leitura é de proficiência, então "proficiente" é legítimo aqui. */
export const ROTULO_GRUPO: Record<GrupoEvolucao, string> = {
  consistentemente_proficiente: 'Consistentemente proficiente',
  em_variacao: 'Em variação',
  consistentemente_nao_proficiente: 'Consistentemente não proficiente',
};

export const ROTULO_TENDENCIA: Record<Tendencia, string> = {
  subindo: 'Subindo',
  descendo: 'Descendo',
  alternando: 'Alternando',
  estavel: 'Estável',
};

export const ORDEM_NIVEL: NivelDesempenho[] = ['excelente', 'mediano', 'critico'];
```

```tsx
// src/features/gestor/components/CascataDiagnostico.tsx
import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useDiagnostico } from '@/features/gestor/api/queries';
import { formatPct } from '@/features/gestor/lib/formatters';
import { ORDEM_NIVEL, ROTULO_NIVEL } from '@/features/gestor/lib/rotulos';
import type { Recorte } from '@/features/gestor/lib/recorte';
import type { NivelDesempenho, NoDiagnostico, VisaoGeral } from '@/features/gestor/api/types';

export interface CascataDiagnosticoProps {
  resumo: VisaoGeral['diagnosticoResumo'];
  recorte: Recorte;
  onAbrirTemas: (especialidade: { id: string; nome: string }) => void;
}

interface NivelCascataProps {
  recorte: Recorte;
  node: string | null;
  nodeAberto: string | null;
  onAlternar: (id: string) => void;
  onAbrirTemas: (especialidade: { id: string; nome: string }) => void;
}

function LinhaNo({
  no,
  aberto,
  onClick,
  ehFolha,
}: {
  no: NoDiagnostico;
  aberto: boolean;
  onClick: () => void;
  ehFolha: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={ehFolha ? undefined : aberto}
      className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex min-w-0 items-center gap-2">
        {ehFolha ? null : (
          <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 transition-transform', aberto && 'rotate-90')} aria-hidden="true" />
        )}
        <span className="truncate">{no.nome}</span>
        {no.lowSample ? (
          <Badge variant="outline" className="shrink-0 text-[10px] font-medium">
            cobertura parcial
            <span data-testid={`amostra-${no.id}`} className="ml-1 text-muted-foreground">n = {no.amostra}</span>
          </Badge>
        ) : null}
      </span>
      <span className="shrink-0 tabular-nums text-muted-foreground">{formatPct(no.acertoPct)}</span>
    </button>
  );
}

/** Um nível da cascata. Só é montado quando o pai está aberto — daí a laziness do fetch. */
function NivelCascata({ recorte, node, nodeAberto, onAlternar, onAbrirTemas }: NivelCascataProps) {
  const consulta = useDiagnostico(recorte, node);

  if (consulta.isLoading) {
    return (
      <div className="space-y-1.5 py-1" aria-busy="true">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (consulta.isError) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
        Não foi possível carregar este nível.
        <Button type="button" size="sm" variant="outline" onClick={() => consulta.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  const nos = consulta.data?.data ?? [];
  if (nos.length === 0) {
    return <p className="py-2 text-xs text-muted-foreground">Sem classificação disponível neste nível.</p>;
  }

  return (
    <ul className="space-y-0.5">
      {nos.map((no) => {
        const ehEspecialidade = no.nivel === 'especialidade';
        const aberto = nodeAberto === no.id;
        return (
          <li key={no.id}>
            <LinhaNo
              no={no}
              aberto={aberto}
              ehFolha={ehEspecialidade}
              onClick={() => (ehEspecialidade ? onAbrirTemas({ id: no.id, nome: no.nome }) : onAlternar(no.id))}
            />
            {/* Expande PARA BAIXO, no lugar, empurrando o conteúdo (§4.8). */}
            {!ehEspecialidade && aberto ? (
              <div data-testid={`filhos-${no.id}`} className="ml-4 border-l border-border pl-2">
                <NivelCascataFilho recorte={recorte} node={no.id} onAbrirTemas={onAbrirTemas} />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** 2º e último nível: especialidades. Não há 3º nível na cascata — tema é drawer (§4.9). */
function NivelCascataFilho({
  recorte,
  node,
  onAbrirTemas,
}: {
  recorte: Recorte;
  node: string;
  onAbrirTemas: (especialidade: { id: string; nome: string }) => void;
}) {
  return <NivelCascata recorte={recorte} node={node} nodeAberto={null} onAlternar={() => undefined} onAbrirTemas={onAbrirTemas} />;
}

export function CascataDiagnostico({ resumo, recorte, onAbrirTemas }: CascataDiagnosticoProps) {
  const [cascataAberta, setCascataAberta] = React.useState(false);
  const [nivelOrigem, setNivelOrigem] = React.useState<NivelDesempenho | null>(null);
  const [nodeAberto, setNodeAberto] = React.useState<string | null>(null);

  const abrirCascata = (nivel: NivelDesempenho) => {
    setCascataAberta((aberta) => !(aberta && nivelOrigem === nivel));
    setNivelOrigem((atual) => (atual === nivel && cascataAberta ? null : nivel));
    setNodeAberto(null);
  };

  const porNivel = new Map(resumo.map((grupo) => [grupo.nivel, grupo.areas]));

  return (
    <section data-testid="bloco-diagnostico" aria-labelledby="titulo-diagnostico" className="space-y-3">
      <div>
        <h2 id="titulo-diagnostico" className="text-sm font-semibold">Diagnóstico Curricular</h2>
        <p className="text-xs text-muted-foreground">Desempenho por grande área, em percentual de acerto.</p>
      </div>

      <div
        data-testid="diagnostico-grid"
        data-dividido={cascataAberta ? 'true' : 'false'}
        className={cn('grid gap-3', cascataAberta ? 'lg:grid-cols-2' : 'grid-cols-1')}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {ORDEM_NIVEL.map((nivel) => {
            const areas = porNivel.get(nivel) ?? [];
            return (
              <Card key={nivel}>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <span className="text-xs font-semibold">{ROTULO_NIVEL[nivel]}</span>
                  <button
                    type="button"
                    aria-label={`Abrir cascata do nível ${ROTULO_NIVEL[nivel].toLowerCase()}`}
                    aria-expanded={cascataAberta && nivelOrigem === nivel}
                    onClick={() => abrirCascata(nivel)}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ChevronRight
                      className={cn('h-4 w-4 transition-transform', cascataAberta && nivelOrigem === nivel && 'rotate-90')}
                      aria-hidden="true"
                    />
                  </button>
                </CardHeader>
                <CardContent className="pt-0">
                  {areas.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhuma área neste nível.</p>
                  ) : (
                    <ul className="flex flex-wrap gap-1.5">
                      {areas.map((area) => (
                        <li key={area.id}>
                          <span
                            data-testid={`chip-${area.id}`}
                            className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs"
                          >
                            {area.nome}
                            <span className="tabular-nums text-muted-foreground">{formatPct(area.acertoPct)}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {cascataAberta ? (
          <Card data-testid="cascata">
            <CardHeader className="pb-2">
              <span className="text-xs font-semibold">Grande área → especialidade</span>
            </CardHeader>
            <CardContent className="pt-0">
              <NivelCascata
                recorte={recorte}
                node={null}
                nodeAberto={nodeAberto}
                onAlternar={(id) => setNodeAberto((atual) => (atual === id ? null : id))}
                onAbrirTemas={onAbrirTemas}
              />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/gestor/__tests__/CascataDiagnostico.test.tsx`
Expected: PASS (8 testes).

- [ ] **Step 5: Commit**

```bash
git add src/features/gestor/lib/rotulos.ts src/features/gestor/components/CascataDiagnostico.tsx src/features/gestor/__tests__/CascataDiagnostico.test.tsx
git commit -m "feat(gestor): cascata de diagnostico de 2 niveis ao lado dos cards

Grid divide em dois (nao e drawer), accordion exclusivo, expande no lugar,
nivel seguinte lazy via useDiagnostico, badge de cobertura parcial com n.
Sem os links 'Ver alunos em TRI'/'Explorar diagnostico' (removidos em 22/07)."
```

---

### Task 43: DrawerTemas

**Files:**
- Create: `src/features/gestor/components/DrawerTemas.tsx`
- Test: `src/features/gestor/__tests__/DrawerTemas.test.tsx`

**Interfaces:**
- Consumes: `useDiagnosticoTemas(recorte, especialidade)` de `api/queries.ts`; `Recorte` (Task 41); `TemaCritico` de `api/types.ts`; `formatPct` de `lib/formatters.ts`; `Sheet*` de `@/components/ui/sheet`.
- Produces: `DrawerTemas({ especialidade, recorte, onFechar, onExportarRecorte }: { especialidade: { id: string; nome: string } | null; recorte: Recorte; onFechar: () => void; onExportarRecorte: (escopo: string) => void })`.
  - "Copiar resumo" copia **texto agregado**, nunca lista nominal (§7.7).

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/gestor/__tests__/DrawerTemas.test.tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, userEvent, waitFor } from '@/test/utils';
import { DrawerTemas } from '@/features/gestor/components/DrawerTemas';
import { useDiagnosticoTemas } from '@/features/gestor/api/queries';
import type { TemaCritico } from '@/features/gestor/api/types';
import { metaFake } from './fixtures/visaoGeral';

vi.mock('@/features/gestor/api/queries', () => ({ useDiagnosticoTemas: vi.fn() }));

const temas: TemaCritico[] = [
  { id: 'tema-ic', nome: 'Insuficiência cardíaca', acertoPct: 22, amostra: 118, lowSample: false },
  { id: 'tema-arritmia', nome: 'Arritmias', acertoPct: 41, amostra: 7, lowSample: true },
];

const recorte = { iesId: 'ies-1', semestre: '6ano' as const };
const especialidade = { id: 'esp-cardio', nome: 'Cardiologia' };
const mockUseTemas = vi.mocked(useDiagnosticoTemas);

describe('DrawerTemas', () => {
  beforeEach(() => {
    mockUseTemas.mockReturnValue({
      data: { data: temas, meta: metaFake },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useDiagnosticoTemas>);
  });

  it('não renderiza nada sem especialidade selecionada', () => {
    render(<DrawerTemas especialidade={null} recorte={recorte} onFechar={vi.fn()} onExportarRecorte={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('lista os temas com % de acerto e barra proporcional', () => {
    render(<DrawerTemas especialidade={especialidade} recorte={recorte} onFechar={vi.fn()} onExportarRecorte={vi.fn()} />);
    const dialogo = screen.getByRole('dialog');
    expect(dialogo).toHaveAccessibleName(/Temas de Cardiologia/i);

    const linha = screen.getByTestId('tema-tema-ic');
    expect(linha).toHaveTextContent('Insuficiência cardíaca');
    expect(linha).toHaveTextContent('22%');
    expect(linha.querySelector('[data-testid="barra-tema-ic"]')).toHaveAttribute('aria-valuenow', '22');
  });

  it('marca cobertura parcial no tema com amostra pequena', () => {
    render(<DrawerTemas especialidade={especialidade} recorte={recorte} onFechar={vi.fn()} onExportarRecorte={vi.fn()} />);
    expect(screen.getByTestId('tema-tema-arritmia')).toHaveTextContent('cobertura parcial');
  });

  it('prende o foco dentro do drawer ao abrir', async () => {
    render(<DrawerTemas especialidade={especialidade} recorte={recorte} onFechar={vi.fn()} onExportarRecorte={vi.fn()} />);
    const dialogo = screen.getByRole('dialog');
    await waitFor(() => expect(dialogo).toContainElement(document.activeElement as HTMLElement));
  });

  it('fecha com ESC', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onFechar = vi.fn();
    render(<DrawerTemas especialidade={especialidade} recorte={recorte} onFechar={onFechar} onExportarRecorte={vi.fn()} />);

    await user.keyboard('{Escape}');
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it('fecha ao clicar no scrim', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onFechar = vi.fn();
    render(<DrawerTemas especialidade={especialidade} recorte={recorte} onFechar={onFechar} onExportarRecorte={vi.fn()} />);

    const scrim = screen.getByRole('dialog').parentElement?.querySelector('div.fixed.inset-0');
    expect(scrim).not.toBeNull();
    await user.click(scrim as HTMLElement);
    expect(onFechar).toHaveBeenCalled();
  });

  it('exporta o recorte identificando a especialidade', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onExportarRecorte = vi.fn();
    render(<DrawerTemas especialidade={especialidade} recorte={recorte} onFechar={vi.fn()} onExportarRecorte={onExportarRecorte} />);

    await user.click(screen.getByRole('button', { name: 'Exportar recorte' }));
    expect(onExportarRecorte).toHaveBeenCalledWith('especialidade:esp-cardio');
  });

  it('copia resumo agregado, sem lista nominal de aluno', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

    render(<DrawerTemas especialidade={especialidade} recorte={recorte} onFechar={vi.fn()} onExportarRecorte={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Copiar resumo' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const texto = writeText.mock.calls[0][0] as string;
    expect(texto).toContain('Cardiologia');
    expect(texto).toContain('Insuficiência cardíaca: 22%');
    expect(texto).not.toMatch(/aluno/i);
  });

  it('mostra estado vazio quando a especialidade não tem tema com dado', () => {
    mockUseTemas.mockReturnValue({
      data: { data: [], meta: metaFake },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useDiagnosticoTemas>);

    render(<DrawerTemas especialidade={especialidade} recorte={recorte} onFechar={vi.fn()} onExportarRecorte={vi.fn()} />);
    expect(screen.getByTestId('temas-vazio')).toHaveTextContent('Sem temas com resultado neste recorte');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/gestor/__tests__/DrawerTemas.test.tsx`
Expected: FAIL com `Failed to resolve import "@/features/gestor/components/DrawerTemas"`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/features/gestor/components/DrawerTemas.tsx
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useDiagnosticoTemas } from '@/features/gestor/api/queries';
import { formatPct } from '@/features/gestor/lib/formatters';
import type { Recorte } from '@/features/gestor/lib/recorte';

export interface DrawerTemasProps {
  especialidade: { id: string; nome: string } | null;
  recorte: Recorte;
  onFechar: () => void;
  onExportarRecorte: (escopo: string) => void;
}

export function DrawerTemas({ especialidade, recorte, onFechar, onExportarRecorte }: DrawerTemasProps) {
  const consulta = useDiagnosticoTemas(recorte, especialidade?.id ?? '');
  const temas = consulta.data?.data ?? [];

  if (!especialidade) return null;

  // §7.7: resumo agregado — nunca lista nominal.
  const copiarResumo = () => {
    const linhas = [
      `Temas de ${especialidade.nome} — percentual de acerto`,
      ...temas.map((tema) => `${tema.nome}: ${formatPct(tema.acertoPct)} (n = ${tema.amostra})`),
    ];
    void navigator.clipboard.writeText(linhas.join('\n'));
  };

  return (
    <Sheet open onOpenChange={(aberto) => { if (!aberto) onFechar(); }}>
      <SheetContent side="right" className="flex w-full flex-col gap-4 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Temas de {especialidade.nome}</SheetTitle>
          <SheetDescription>Percentual de acerto por tema. Tema e especialidade nunca usam proficiência.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {consulta.isLoading ? (
            <div className="space-y-2" aria-busy="true">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : consulta.isError ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Não foi possível carregar os temas.</p>
              <Button type="button" size="sm" variant="outline" onClick={() => consulta.refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : temas.length === 0 ? (
            <p data-testid="temas-vazio" className="text-sm text-muted-foreground">
              Sem temas com resultado neste recorte.
            </p>
          ) : (
            <ul className="space-y-3">
              {temas.map((tema) => (
                <li key={tema.id} data-testid={`tema-${tema.id}`} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate">{tema.nome}</span>
                      {tema.lowSample ? (
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          cobertura parcial
                          <span className="ml-1 text-muted-foreground">n = {tema.amostra}</span>
                        </Badge>
                      ) : null}
                    </span>
                    <span className="shrink-0 tabular-nums">{formatPct(tema.acertoPct)}</span>
                  </div>
                  <div
                    data-testid={`barra-${tema.id}`}
                    role="progressbar"
                    aria-label={`Percentual de acerto em ${tema.nome}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(tema.acertoPct)}
                    className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                  >
                    <div className="h-full rounded-full bg-primary" style={{ width: `${tema.acertoPct}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          <Button type="button" size="sm" variant="outline" onClick={() => onExportarRecorte(`especialidade:${especialidade.id}`)}>
            Exportar recorte
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={copiarResumo}>
            Copiar resumo
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/gestor/__tests__/DrawerTemas.test.tsx`
Expected: PASS (9 testes). Se o teste do scrim falhar por `pointer-events`, confirme que o `userEvent.setup({ pointerEventsCheck: 0 })` está aplicado — o Radix põe `pointer-events: none` no `body` em modal.

- [ ] **Step 5: Commit**

```bash
git add src/features/gestor/components/DrawerTemas.tsx src/features/gestor/__tests__/DrawerTemas.test.tsx
git commit -m "feat(gestor): DrawerTemas com % de acerto, ESC, scrim e foco preso

Ultimo nivel da hierarquia (spec §4.9). Copiar resumo copia texto agregado,
nunca lista nominal (§7.7). Exportar recorte identifica a especialidade."
```

---

### Task 44: Bloco Visão de Alunos (distribuição + dispersão)

**Files:**
- Create: `src/features/gestor/components/VisaoDeAlunos.tsx`
- Test: `src/features/gestor/__tests__/VisaoDeAlunos.test.tsx`

**Interfaces:**
- Consumes: `DispersaoChart` (Task 40); `ROTULO_GRUPO` (Task 42); `formatNumero`, `formatPct` de `lib/formatters.ts`; `VisaoGeral` de `api/types.ts`; fixture da Task 37.
- Produces: `VisaoDeAlunos({ distribuicao, dispersao, tendencia }: { distribuicao: VisaoGeral['distribuicaoAlunos']; dispersao: VisaoGeral['dispersao']; tendencia?: { semestre: number; nota: number }[] | null })`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/gestor/__tests__/VisaoDeAlunos.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/utils';
import { CascataDiagnostico } from '@/features/gestor/components/CascataDiagnostico';
import { VisaoDeAlunos } from '@/features/gestor/components/VisaoDeAlunos';
import { visaoGeralFake } from './fixtures/visaoGeral';

vi.mock('@/features/gestor/api/queries', () => ({ useDiagnostico: vi.fn(() => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() })) }));

describe('VisaoDeAlunos', () => {
  it('mostra a distribuição pelos 3 grupos de evolução com quantidade e percentual', () => {
    render(<VisaoDeAlunos distribuicao={visaoGeralFake.distribuicaoAlunos} dispersao={visaoGeralFake.dispersao} />);

    const proficiente = screen.getByTestId('grupo-consistentemente_proficiente');
    expect(proficiente).toHaveTextContent('Consistentemente proficiente');
    expect(proficiente).toHaveTextContent('48');
    expect(proficiente).toHaveTextContent('42%');

    expect(screen.getByTestId('grupo-em_variacao')).toHaveTextContent('Em variação');
    expect(screen.getByTestId('grupo-consistentemente_nao_proficiente')).toHaveTextContent('Consistentemente não proficiente');
  });

  it('mostra a dispersão dentro do bloco, abaixo da distribuição', () => {
    render(<VisaoDeAlunos distribuicao={visaoGeralFake.distribuicaoAlunos} dispersao={visaoGeralFake.dispersao} />);
    const bloco = screen.getByTestId('bloco-visao-alunos');
    const distribuicao = screen.getByTestId('distribuicao-alunos');
    const dispersao = screen.getByTestId('dispersao-alunos');

    expect(bloco).toContainElement(dispersao);
    expect(distribuicao.compareDocumentPosition(dispersao) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('fica ACIMA da visão por área quando os dois blocos são irmãos (§4.8, 22/07)', () => {
    render(
      <>
        <VisaoDeAlunos distribuicao={visaoGeralFake.distribuicaoAlunos} dispersao={visaoGeralFake.dispersao} />
        <CascataDiagnostico
          resumo={visaoGeralFake.diagnosticoResumo}
          recorte={{ iesId: 'ies-1', semestre: '6ano' }}
          onAbrirTemas={vi.fn()}
        />
      </>
    );
    const alunos = screen.getByTestId('bloco-visao-alunos');
    const area = screen.getByTestId('bloco-diagnostico');
    expect(alunos.compareDocumentPosition(area) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('mostra estado vazio de distribuição sem alunos', () => {
    render(<VisaoDeAlunos distribuicao={[]} dispersao={[]} />);
    expect(screen.getByTestId('distribuicao-vazia')).toHaveTextContent('Sem alunos com resultado neste recorte');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/gestor/__tests__/VisaoDeAlunos.test.tsx`
Expected: FAIL com `Failed to resolve import "@/features/gestor/components/VisaoDeAlunos"`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/features/gestor/components/VisaoDeAlunos.tsx
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { DispersaoChart } from '@/features/gestor/charts/DispersaoChart';
import { formatNumero, formatPct } from '@/features/gestor/lib/formatters';
import { ROTULO_GRUPO } from '@/features/gestor/lib/rotulos';
import type { GrupoEvolucao, VisaoGeral } from '@/features/gestor/api/types';

export interface VisaoDeAlunosProps {
  distribuicao: VisaoGeral['distribuicaoAlunos'];
  dispersao: VisaoGeral['dispersao'];
  tendencia?: { semestre: number; nota: number }[] | null;
}

const ORDEM_GRUPO: GrupoEvolucao[] = ['consistentemente_proficiente', 'em_variacao', 'consistentemente_nao_proficiente'];

/** §4.8 — bloco macro: vem ACIMA da visão por área. */
export function VisaoDeAlunos({ distribuicao, dispersao, tendencia }: VisaoDeAlunosProps) {
  const porGrupo = new Map(distribuicao.map((item) => [item.grupo, item]));

  return (
    <section data-testid="bloco-visao-alunos" aria-labelledby="titulo-visao-alunos" className="space-y-3">
      <div>
        <h2 id="titulo-visao-alunos" className="text-sm font-semibold">Visão de Alunos</h2>
        <p className="text-xs text-muted-foreground">Distribuição por grupo de evolução e dispersão de proficiência por semestre.</p>
      </div>

      <div data-testid="distribuicao-alunos">
        {distribuicao.length === 0 ? (
          <p data-testid="distribuicao-vazia" className="text-sm text-muted-foreground">
            Sem alunos com resultado neste recorte.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-3">
            {ORDEM_GRUPO.map((grupo) => {
              const item = porGrupo.get(grupo);
              return (
                <li key={grupo}>
                  <Card data-testid={`grupo-${grupo}`}>
                    <CardContent className="space-y-2 p-4">
                      <span className="block text-xs text-muted-foreground">{ROTULO_GRUPO[grupo]}</span>
                      <span className="flex items-baseline gap-2">
                        <span className="text-2xl font-semibold tabular-nums">{formatNumero(item?.quantidade ?? null)}</span>
                        <span className="text-xs tabular-nums text-muted-foreground">{formatPct(item?.percentual ?? null)}</span>
                      </span>
                      <div
                        role="progressbar"
                        aria-label={`Participação de ${ROTULO_GRUPO[grupo]}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(item?.percentual ?? 0)}
                        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                      >
                        <div className="h-full rounded-full bg-primary" style={{ width: `${item?.percentual ?? 0}%` }} />
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Card data-testid="dispersao-alunos">
        <CardHeader className="pb-2">
          <span className="text-xs font-semibold">Proficiência por semestre</span>
        </CardHeader>
        <CardContent>
          <DispersaoChart pontos={dispersao} tendencia={tendencia} />
        </CardContent>
      </Card>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/gestor/__tests__/VisaoDeAlunos.test.tsx`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/features/gestor/components/VisaoDeAlunos.tsx src/features/gestor/__tests__/VisaoDeAlunos.test.tsx
git commit -m "feat(gestor): bloco Visao de Alunos (distribuicao + dispersao)

Macro precede micro: fica acima da visao por area (spec §4.8, decisao 22/07)."
```

---

### Task 45: TabelaAlunos + DrawerAluno

**Files:**
- Create: `src/features/gestor/components/DrawerAluno.tsx`
- Create: `src/features/gestor/components/TabelaAlunos.tsx`
- Test: `src/features/gestor/__tests__/TabelaAlunos.test.tsx`

**Interfaces:**
- Consumes: `useAlunos(recorte, paginacao)`, `useAluno(alunoId, simulados)` de `api/queries.ts`; `Recorte` (Task 41); `ROTULO_GRUPO`, `ROTULO_TENDENCIA` (Task 42); `TRACO`, `formatNumero`, `formatPct`, `formatDelta` de `lib/formatters.ts`; `LinhaAluno`, `AlunoNoSimulado`, `Paginado` de `api/types.ts`.
- Produces:
  - `TabelaAlunos({ recorte, colunasSimulados }: { recorte: Recorte; colunasSimulados: { id: string; nome: string }[] })`.
  - `DrawerAluno({ alunoId, nome, simulados, onFechar }: { alunoId: string | null; nome: string; simulados: string[]; onFechar: () => void })`.
  - Uma única coluna de escala 0–100 por simulado, rotulada **Proficiência** — nenhuma coluna "Nota TRI" (§4.1, caso crítico nº2).

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/gestor/__tests__/TabelaAlunos.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, userEvent, waitFor } from '@/test/utils';
import { TabelaAlunos } from '@/features/gestor/components/TabelaAlunos';
import { useAluno, useAlunos } from '@/features/gestor/api/queries';
import type { AlunoNoSimulado, LinhaAluno } from '@/features/gestor/api/types';
import { metaFake } from './fixtures/visaoGeral';

vi.mock('@/features/gestor/api/queries', () => ({ useAlunos: vi.fn(), useAluno: vi.fn() }));

const linhas: LinhaAluno[] = [
  { id: 'a1', nome: 'Ana Prado', semestre: 11, grupo: 'consistentemente_proficiente', proficiencias: [64, 68, 71], tendencia: 'subindo' },
  { id: 'a2', nome: 'Bruno Lima', semestre: 12, grupo: 'em_variacao', proficiencias: [58, null, 62], tendencia: 'alternando' },
];

const colunasSimulados = [
  { id: 's1', nome: 'Simulado 1' },
  { id: 's2', nome: 'Simulado 2' },
  { id: 's3', nome: 'Simulado 3' },
];

const recorte = { iesId: 'ies-1', semestre: '6ano' as const };
const mockUseAlunos = vi.mocked(useAlunos);
const mockUseAluno = vi.mocked(useAluno);

function envelopePaginado(page = 1, total = 24) {
  return {
    data: { data: { data: linhas, page, pageSize: 2, total, totalPages: Math.ceil(total / 2) }, meta: metaFake },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useAlunos>;
}

const alunoDetalhado: AlunoNoSimulado = {
  id: 'a1',
  nome: 'Ana Prado',
  semestre: 11,
  participou: true,
  acertos: 71,
  proficiencia: 71,
  situacao: 'proficiente',
  posicao: { lugar: 12, total: 118, percentil: 90 },
  acertoPorArea: [{ area: 'Clínica Médica', acertoPct: 42, critica: true }],
  variacao: 3,
};

describe('TabelaAlunos', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockUseAlunos.mockReturnValue(envelopePaginado());
    mockUseAluno.mockReturnValue({
      data: { data: alunoDetalhado, meta: metaFake },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useAluno>);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('tem uma coluna de proficiência por simulado e NENHUMA coluna "Nota TRI"', () => {
    render(<TabelaAlunos recorte={recorte} colunasSimulados={colunasSimulados} />);
    const cabecalhos = screen.getAllByRole('columnheader').map((celula) => celula.textContent);
    expect(cabecalhos).toEqual(['Aluno', 'Semestre', 'Simulado 1', 'Simulado 2', 'Simulado 3', 'Tendência']);
    expect(screen.queryByText(/Nota TRI/i)).not.toBeInTheDocument();
  });

  it('mostra a tag do grupo ao lado do nome', () => {
    render(<TabelaAlunos recorte={recorte} colunasSimulados={colunasSimulados} />);
    const celula = screen.getByTestId('celula-nome-a1');
    expect(celula).toHaveTextContent('Ana Prado');
    expect(celula).toHaveTextContent('Consistentemente proficiente');
  });

  it('mostra — para proficiência ausente e nunca zero', () => {
    render(<TabelaAlunos recorte={recorte} colunasSimulados={colunasSimulados} />);
    expect(screen.getByTestId('prof-a2-s2')).toHaveTextContent('—');
    expect(screen.getByTestId('prof-a2-s2')).not.toHaveTextContent('0');
  });

  it('mostra a tendência por aluno', () => {
    render(<TabelaAlunos recorte={recorte} colunasSimulados={colunasSimulados} />);
    expect(screen.getByTestId('tendencia-a1')).toHaveTextContent('Subindo');
    expect(screen.getByTestId('tendencia-a2')).toHaveTextContent('Alternando');
  });

  it('pagina no servidor: avançar pede a página 2 ao hook', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<TabelaAlunos recorte={recorte} colunasSimulados={colunasSimulados} />);

    await user.click(screen.getByRole('button', { name: 'Próxima página' }));
    expect(mockUseAlunos).toHaveBeenLastCalledWith(recorte, expect.objectContaining({ page: 2 }));
  });

  it('busca com debounce chega ao hook como q', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<TabelaAlunos recorte={recorte} colunasSimulados={colunasSimulados} />);

    await user.type(screen.getByRole('searchbox', { name: 'Buscar aluno' }), 'ana');
    expect(mockUseAlunos).toHaveBeenLastCalledWith(recorte, expect.objectContaining({ q: '' }));

    vi.advanceTimersByTime(350);
    await waitFor(() =>
      expect(mockUseAlunos).toHaveBeenLastCalledWith(recorte, expect.objectContaining({ q: 'ana', page: 1 }))
    );
  });

  it('o nome abre o DrawerAluno com a visão detalhada', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime, pointerEventsCheck: 0 });
    render(<TabelaAlunos recorte={recorte} colunasSimulados={colunasSimulados} />);

    await user.click(screen.getByRole('button', { name: 'Ana Prado' }));
    const dialogo = screen.getByRole('dialog');
    expect(dialogo).toHaveAccessibleName(/Ana Prado/);
    expect(dialogo).toHaveTextContent('Proficiência');
    expect(dialogo).toHaveTextContent('71');
    expect(dialogo).toHaveTextContent('12º de 118');
    expect(dialogo).toHaveTextContent('42%');
    expect(dialogo.textContent).not.toMatch(/Nota TRI/i);
  });

  it('estado vazio quando a busca não retorna aluno', () => {
    mockUseAlunos.mockReturnValue({
      data: { data: { data: [], page: 1, pageSize: 2, total: 0, totalPages: 0 }, meta: metaFake },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useAlunos>);

    render(<TabelaAlunos recorte={recorte} colunasSimulados={colunasSimulados} />);
    expect(screen.getByTestId('alunos-vazio')).toHaveTextContent('Nenhum aluno encontrado');
  });

  it('estado de erro só do bloco, com "Tentar novamente"', async () => {
    const refetch = vi.fn();
    mockUseAlunos.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch } as unknown as ReturnType<typeof useAlunos>);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<TabelaAlunos recorte={recorte} colunasSimulados={colunasSimulados} />);
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/gestor/__tests__/TabelaAlunos.test.tsx`
Expected: FAIL com `Failed to resolve import "@/features/gestor/components/TabelaAlunos"`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/features/gestor/components/DrawerAluno.tsx
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useAluno } from '@/features/gestor/api/queries';
import { TRACO, formatDelta, formatNumero, formatPct } from '@/features/gestor/lib/formatters';

export interface DrawerAlunoProps {
  alunoId: string | null;
  nome: string;
  simulados: string[];
  onFechar: () => void;
}

const ROTULO_SITUACAO = {
  proficiente: 'Proficiente',
  abaixo_do_limiar: 'Abaixo do limiar',
  nao_participou: 'Não participou',
} as const;

export function DrawerAluno({ alunoId, nome, simulados, onFechar }: DrawerAlunoProps) {
  const consulta = useAluno(alunoId, simulados);
  const aluno = consulta.data?.data;

  if (!alunoId) return null;

  return (
    <Sheet open onOpenChange={(aberto) => { if (!aberto) onFechar(); }}>
      <SheetContent side="right" className="flex w-full flex-col gap-4 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{nome}</SheetTitle>
          <SheetDescription>
            {aluno ? `${aluno.semestre}º semestre` : 'Carregando dados do aluno'}
          </SheetDescription>
        </SheetHeader>

        {consulta.isLoading ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : consulta.isError || !aluno ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Não foi possível carregar este aluno.</p>
            <Button type="button" size="sm" variant="outline" onClick={() => consulta.refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto">
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs text-muted-foreground">Proficiência</dt>
                <dd className="text-xl font-semibold tabular-nums">{formatNumero(aluno.proficiencia)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Acertos</dt>
                <dd className="text-xl font-semibold tabular-nums">{formatNumero(aluno.acertos)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Situação</dt>
                <dd><Badge variant="secondary">{ROTULO_SITUACAO[aluno.situacao]}</Badge></dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Posição</dt>
                <dd className="text-sm tabular-nums">
                  {aluno.posicao ? `${aluno.posicao.lugar}º de ${aluno.posicao.total}` : TRACO}
                </dd>
              </div>
              {aluno.variacao !== undefined ? (
                <div>
                  <dt className="text-xs text-muted-foreground">Variação</dt>
                  <dd className="text-sm tabular-nums">{formatDelta(aluno.variacao)}</dd>
                </div>
              ) : null}
            </dl>

            {aluno.acertoPorArea && aluno.acertoPorArea.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold">Desempenho por grande área (% de acerto)</h3>
                <ul className="space-y-1.5">
                  {aluno.acertoPorArea.map((area) => (
                    <li key={area.area} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate">{area.area}</span>
                        {area.critica ? <Badge variant="outline" className="shrink-0 text-[10px]">área crítica</Badge> : null}
                      </span>
                      <span className="shrink-0 tabular-nums">{formatPct(area.acertoPct)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

```tsx
// src/features/gestor/components/TabelaAlunos.tsx
import * as React from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Repeat } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAlunos } from '@/features/gestor/api/queries';
import { DrawerAluno } from '@/features/gestor/components/DrawerAluno';
import { TRACO, formatNumero } from '@/features/gestor/lib/formatters';
import { ROTULO_GRUPO, ROTULO_TENDENCIA } from '@/features/gestor/lib/rotulos';
import type { Recorte } from '@/features/gestor/lib/recorte';
import type { Tendencia } from '@/features/gestor/api/types';

export interface TabelaAlunosProps {
  recorte: Recorte;
  colunasSimulados: { id: string; nome: string }[];
}

const TAMANHO_PAGINA = 25;

function IconeTendencia({ tendencia }: { tendencia: Tendencia }) {
  if (tendencia === 'subindo') return <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />;
  if (tendencia === 'descendo') return <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />;
  if (tendencia === 'alternando') return <Repeat className="h-3.5 w-3.5" aria-hidden="true" />;
  return <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />;
}

export function TabelaAlunos({ recorte, colunasSimulados }: TabelaAlunosProps) {
  const [busca, setBusca] = React.useState('');
  const [q, setQ] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [alunoAberto, setAlunoAberto] = React.useState<{ id: string; nome: string } | null>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setQ(busca.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [busca]);

  const consulta = useAlunos(recorte, {
    page,
    pageSize: TAMANHO_PAGINA,
    sort: 'nome',
    order: 'asc',
    q,
  });

  const pagina = consulta.data?.data;
  const linhas = pagina?.data ?? [];
  const totalPaginas = pagina?.totalPages ?? 0;
  const simuladosIds = colunasSimulados.map((coluna) => coluna.id);

  return (
    <section data-testid="bloco-tabela-alunos" aria-labelledby="titulo-tabela-alunos" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="titulo-tabela-alunos" className="text-sm font-semibold">Alunos</h2>
          <p className="text-xs text-muted-foreground">Proficiência por simulado. Ausência aparece como {TRACO} e fica fora de toda média.</p>
        </div>
        <Input
          type="search"
          role="searchbox"
          aria-label="Buscar aluno"
          placeholder="Buscar aluno"
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
          className="w-full max-w-xs"
        />
      </div>

      {consulta.isLoading ? (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : consulta.isError ? (
        <div className="space-y-2 rounded-md border border-border p-4">
          <p className="text-sm text-muted-foreground">Não foi possível carregar a lista de alunos.</p>
          <Button type="button" size="sm" variant="outline" onClick={() => consulta.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : linhas.length === 0 ? (
        <p data-testid="alunos-vazio" className="rounded-md border border-border p-4 text-sm text-muted-foreground">
          Nenhum aluno encontrado neste recorte.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Semestre</TableHead>
                  {colunasSimulados.map((coluna) => (
                    <TableHead key={coluna.id}>{coluna.nome}</TableHead>
                  ))}
                  <TableHead>Tendência</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((linha) => (
                  <TableRow key={linha.id}>
                    <TableCell data-testid={`celula-nome-${linha.id}`}>
                      <span className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setAlunoAberto({ id: linha.id, nome: linha.nome })}
                          className="font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {linha.nome}
                        </button>
                        <Badge variant="outline" className="text-[10px] font-medium">{ROTULO_GRUPO[linha.grupo]}</Badge>
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums">{linha.semestre}º</TableCell>
                    {colunasSimulados.map((coluna, indice) => (
                      <TableCell key={coluna.id} data-testid={`prof-${linha.id}-${coluna.id}`} className="tabular-nums">
                        {formatNumero(linha.proficiencias[indice] ?? null)}
                      </TableCell>
                    ))}
                    <TableCell data-testid={`tendencia-${linha.id}`}>
                      <span className="inline-flex items-center gap-1 text-xs">
                        <IconeTendencia tendencia={linha.tendencia} />
                        {ROTULO_TENDENCIA[linha.tendencia]}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <nav aria-label="Paginação de alunos" className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              Página {pagina?.page ?? 1} de {totalPaginas} · {pagina?.total ?? 0} alunos
            </span>
            <span className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-label="Página anterior"
                disabled={(pagina?.page ?? 1) <= 1}
                onClick={() => setPage((atual) => Math.max(1, atual - 1))}
              >
                Anterior
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-label="Próxima página"
                disabled={(pagina?.page ?? 1) >= totalPaginas}
                onClick={() => setPage((atual) => atual + 1)}
              >
                Próxima
              </Button>
            </span>
          </nav>
        </>
      )}

      <DrawerAluno
        alunoId={alunoAberto?.id ?? null}
        nome={alunoAberto?.nome ?? ''}
        simulados={simuladosIds}
        onFechar={() => setAlunoAberto(null)}
      />
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/gestor/__tests__/TabelaAlunos.test.tsx`
Expected: PASS (10 testes).

- [ ] **Step 5: Commit**

```bash
git add src/features/gestor/components/TabelaAlunos.tsx src/features/gestor/components/DrawerAluno.tsx src/features/gestor/__tests__/TabelaAlunos.test.tsx
git commit -m "feat(gestor): TabelaAlunos paginada no servidor + DrawerAluno

Tag do grupo ao lado do nome, proficiencia por simulado, tendencia e busca com debounce.
Uma unica coluna 0-100 rotulada Proficiencia — sem 'Nota TRI' (§4.1, caso critico 2).
Ausencia sempre como '—', nunca zero (§4.10)."
```

---

### Task 45b: Gate de "Exportar recorte" e "Copiar resumo"

> **Pertence à Fase 4.** O `DrawerTemas` (Task 43) e o `DrawerAluno` (Task 45) trazem essas duas ações no rodapé. Elas precisam respeitar `ContextoGestor.podeExportar` e a regra do spec §7.7 de que "Copiar resumo" copia texto **agregado**, nunca lista nominal de alunos.

**Files:**
- Create: `src/features/gestor/components/AcoesRecorte.tsx`
- Modify: `src/features/gestor/components/DrawerTemas.tsx` · `src/features/gestor/components/DrawerAluno.tsx`
- Test: `src/features/gestor/__tests__/AcoesRecorte.test.tsx`

**Interfaces:**
- Consumes: `useGestorContexto()` de `src/features/gestor/api/queries.ts` (Task 28), que devolve `{ data: ContextoGestor | undefined, ... }` com o campo `podeExportar: boolean`; `Button` de `@/components/ui/button`; `useToast` de `@/hooks/use-toast`.
- Produces: `export function AcoesRecorte(props: AcoesRecorteProps): JSX.Element | null` e `export interface AcoesRecorteProps { escopo: string; resumoTexto: string; onExportar: () => void }`. Consumida pelas Tasks 43 e 45.

**Regra de privacidade (spec §7.7):** `resumoTexto` é responsabilidade de quem monta o componente e **deve ser agregado**. O `AcoesRecorte` não recebe lista de alunos e não tem como montar uma — a assinatura é a barreira. O teste abaixo trava isso.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/gestor/__tests__/AcoesRecorte.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AcoesRecorte } from '../components/AcoesRecorte';
import { useGestorContexto } from '../api/queries';

vi.mock('../api/queries', () => ({ useGestorContexto: vi.fn() }));

const contexto = (podeExportar: boolean) => ({
  data: {
    usuario: { id: 'u1', nome: 'Ana', papel: 'gestor' as const },
    iesDisponiveis: [{ id: 'i1', nome: 'IES Teste' }],
    iesAtual: { id: 'i1', nome: 'IES Teste' },
    contrato: null,
    podeTrocarIes: false,
    podeExportar,
  },
  meta: undefined,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
});

describe('AcoesRecorte', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('renderiza as duas acoes quando podeExportar e true', () => {
    vi.mocked(useGestorContexto).mockReturnValue(contexto(true) as never);
    render(
      <AcoesRecorte escopo="Pediatria · 6º ano" resumoTexto="resumo" onExportar={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'Exportar recorte' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copiar resumo' })).toBeInTheDocument();
  });

  it('nao renderiza NADA quando podeExportar e false — ausente, nao desabilitado', () => {
    vi.mocked(useGestorContexto).mockReturnValue(contexto(false) as never);
    const { container } = render(
      <AcoesRecorte escopo="Pediatria" resumoTexto="resumo" onExportar={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('chama onExportar com o escopo ao clicar em Exportar recorte', async () => {
    const user = userEvent.setup();
    const onExportar = vi.fn();
    vi.mocked(useGestorContexto).mockReturnValue(contexto(true) as never);
    render(
      <AcoesRecorte escopo="Pediatria" resumoTexto="resumo" onExportar={onExportar} />,
    );

    await user.click(screen.getByRole('button', { name: 'Exportar recorte' }));
    expect(onExportar).toHaveBeenCalledTimes(1);
  });

  it('copia o resumo agregado, com cabecalho de escopo', async () => {
    const user = userEvent.setup();
    vi.mocked(useGestorContexto).mockReturnValue(contexto(true) as never);
    render(
      <AcoesRecorte
        escopo="Pediatria · 6º ano"
        resumoTexto="Acerto medio 61%. 3 temas com cobertura parcial."
        onExportar={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Copiar resumo' }));

    const copiado = vi.mocked(navigator.clipboard.writeText).mock.calls[0][0];
    expect(copiado).toContain('IES Teste');
    expect(copiado).toContain('Pediatria · 6º ano');
    expect(copiado).toContain('Acerto medio 61%');
  });

  it('nao vaza nome de aluno: o texto copiado e exatamente o resumo agregado recebido', async () => {
    const user = userEvent.setup();
    vi.mocked(useGestorContexto).mockReturnValue(contexto(true) as never);
    const resumoAgregado = '54% dos alunos proficientes (56 de 104).';
    render(
      <AcoesRecorte escopo="6º ano" resumoTexto={resumoAgregado} onExportar={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: 'Copiar resumo' }));

    const copiado = vi.mocked(navigator.clipboard.writeText).mock.calls[0][0] as string;
    // O componente nao tem acesso a lista nominal — so ao texto agregado.
    expect(copiado).toContain(resumoAgregado);
    expect(copiado).not.toMatch(/@/); // nenhum e-mail
    expect(copiado.split('\n').length).toBeLessThanOrEqual(6); // nao e um dump de linhas
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/gestor/__tests__/AcoesRecorte.test.tsx`

Expected: FAIL com `Failed to resolve import "../components/AcoesRecorte"`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/features/gestor/components/AcoesRecorte.tsx
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useGestorContexto } from '../api/queries';

export interface AcoesRecorteProps {
  /** Descrição legível do recorte, ex.: "Pediatria · 6º ano". Vai no cabeçalho do texto copiado. */
  escopo: string;
  /**
   * Texto JÁ AGREGADO do recorte. Spec §7.7: "Copiar resumo" copia texto
   * agregado — nunca lista nominal completa de alunos. A assinatura é a
   * barreira: este componente não recebe lista de alunos e não pode montar uma.
   */
  resumoTexto: string;
  onExportar: () => void;
}

/**
 * Rodapé de ações dos drawers de recorte (temas e aluno).
 *
 * Gate (spec §3 e §7.7): quando o papel não pode exportar, as ações ficam
 * AUSENTES — não desabilitadas. Afordância desabilitada comunica "existe, mas
 * não para você", o que não é o caso.
 */
export function AcoesRecorte({ escopo, resumoTexto, onExportar }: AcoesRecorteProps) {
  const { data: contexto } = useGestorContexto();
  const { toast } = useToast();

  if (!contexto?.podeExportar) return null;

  const copiar = async () => {
    const cabecalho = `${contexto.iesAtual.nome} · ${escopo}`;
    try {
      await navigator.clipboard.writeText(`${cabecalho}\n${resumoTexto}`);
      toast({ description: 'Resumo copiado.' });
    } catch {
      toast({
        variant: 'destructive',
        description: 'Não foi possível copiar. Tente novamente.',
      });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="default" size="sm" onClick={onExportar}>
        Exportar recorte
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={copiar}>
        Copiar resumo
      </Button>
    </div>
  );
}
```

Nos dois drawers, substituir o rodapé de ações pelo componente. Em `DrawerTemas.tsx`:

```tsx
import { AcoesRecorte } from './AcoesRecorte';

// ...no rodapé do drawer, onde antes havia os dois botões soltos:
<AcoesRecorte
  escopo={`${especialidade.nome} · ${rotuloSemestre}`}
  resumoTexto={`Acerto médio ${formatPct(especialidade.acertoPct)}. ${temas.length} temas no recorte.`}
  onExportar={() => exportarRecorteTemas(especialidade.id)}
/>
```

Em `DrawerAluno.tsx`:

```tsx
import { AcoesRecorte } from './AcoesRecorte';

// ...no rodapé do drawer:
<AcoesRecorte
  escopo={`${aluno.nome} · ${aluno.semestre}º semestre`}
  resumoTexto={`Proficiência ${formatNumero(aluno.proficiencia)}. Acertos ${formatNumero(aluno.acertos)}. Situação: ${rotuloSituacao(aluno.situacao)}.`}
  onExportar={() => exportarRecorteAluno(aluno.id)}
/>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/gestor/__tests__/AcoesRecorte.test.tsx`

Expected: PASS — 5 testes.

Depois, confirmar que os drawers não regrediram:

Run: `npx vitest run src/features/gestor/__tests__/DrawerTemas.test.tsx src/features/gestor/__tests__/DrawerAluno.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/gestor/components/AcoesRecorte.tsx src/features/gestor/components/DrawerTemas.tsx src/features/gestor/components/DrawerAluno.tsx src/features/gestor/__tests__/AcoesRecorte.test.tsx
git commit -m "feat(gestor): gate de exportar e copiar resumo por podeExportar

Extrai o rodape de acoes dos drawers para AcoesRecorte, que le podeExportar
do contexto e fica AUSENTE quando o papel nao pode exportar — nao desabilitado
(spec §3).

A assinatura do componente e a barreira de privacidade da spec §7.7: ele
recebe apenas 'resumoTexto' ja agregado, nao lista de alunos, entao nao tem
como vazar lista nominal. Teste trava isso."
```

---

### Task 46: Rota VisaoGeral.tsx — composição, estados independentes e Insights

**Files:**
- Create: `src/features/gestor/components/BlocoGestor.tsx`
- Create: `src/features/gestor/components/BlocoInsights.tsx`
- Create: `src/features/gestor/components/ContextoDoRecorte.tsx`
- Create: `src/features/gestor/routes/VisaoGeral.tsx`
- Test: `src/features/gestor/__tests__/VisaoGeral.test.tsx`

**Interfaces:**
- Consumes: `FiltroSemestre` de `@/features/gestor/components/FiltroSemestre` e `useFiltrosGestor` de `@/features/gestor/hooks/useFiltrosGestor` (Fase 2 — `<FiltroSemestre />` lê e escreve o estado via `useFiltrosGestor` internamente, sem props obrigatórias); `useVisaoGeral`, `useAlunos`, `useDiagnostico`, `useDiagnosticoTemas`, `useAluno` de `api/queries.ts`; `KpisVisaoGeral` (37), `GraficoProtagonista` (41), `CascataDiagnostico` (42), `DrawerTemas` (43), `VisaoDeAlunos` (44), `TabelaAlunos` (45); `Recorte` (41).
- Produces:
  - `BlocoGestor({ titulo?, estado, aoTentarNovamente?, mensagemVazio?, parcial?, alturaSkeleton?, children })` — casca de bloco com `loading`/`empty`/`error`/`partial` **e error boundary por bloco** (§8.4).
  - `BlocoInsights({ insights }: { insights: VisaoGeral['insights'] })`.
  - `ContextoDoRecorte({ semestre, meta }: { semestre: FiltroSemestreTipo; meta: Meta })` e `rotuloSemestre(semestre)`.
  - `VisaoGeral` (default export da rota `/gestor/visao-geral`).

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/gestor/__tests__/VisaoGeral.test.tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, userEvent } from '@/test/utils';
import VisaoGeralRoute from '@/features/gestor/routes/VisaoGeral';
import { BlocoGestor } from '@/features/gestor/components/BlocoGestor';
import { useAluno, useAlunos, useDiagnostico, useDiagnosticoTemas, useVisaoGeral } from '@/features/gestor/api/queries';
import { metaFake, visaoGeralFake } from './fixtures/visaoGeral';

vi.mock('@/features/gestor/api/queries', () => ({
  useVisaoGeral: vi.fn(),
  useAlunos: vi.fn(),
  useDiagnostico: vi.fn(),
  useDiagnosticoTemas: vi.fn(),
  useAluno: vi.fn(),
}));

vi.mock('@/features/gestor/hooks/useFiltrosGestor', () => ({
  useFiltrosGestor: () => ({
    semestre: '6ano',
    setSemestre: vi.fn(),
    simulados: [],
    setSimulados: vi.fn(),
    iesId: 'ies-1',
    setIesId: vi.fn(),
  }),
}));

vi.mock('@/features/gestor/components/FiltroSemestre', () => ({
  FiltroSemestre: () => <div data-testid="filtro-semestre" />,
}));

const mockUseVisaoGeral = vi.mocked(useVisaoGeral);
const mockUseAlunos = vi.mocked(useAlunos);

function ordemNoDom(ids: string[]) {
  const nos = ids.map((id) => screen.getByTestId(id));
  return nos.every((no, indice) =>
    indice === 0 ? true : Boolean(nos[indice - 1].compareDocumentPosition(no) & Node.DOCUMENT_POSITION_FOLLOWING)
  );
}

describe('rota VisaoGeral', () => {
  beforeEach(() => {
    mockUseVisaoGeral.mockReturnValue({
      data: { data: visaoGeralFake, meta: metaFake },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useVisaoGeral>);

    mockUseAlunos.mockReturnValue({
      data: {
        data: { data: [], page: 1, pageSize: 25, total: 0, totalPages: 0 },
        meta: metaFake,
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useAlunos>);

    vi.mocked(useDiagnostico).mockReturnValue({
      data: { data: [], meta: metaFake },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useDiagnostico>);

    vi.mocked(useDiagnosticoTemas).mockReturnValue({
      data: { data: [], meta: metaFake },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useDiagnosticoTemas>);

    vi.mocked(useAluno).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useAluno>);
  });

  it('monta os blocos na ordem vertical da §4.8, com Visão de Alunos ACIMA da visão por área', () => {
    render(<VisaoGeralRoute />);
    expect(
      ordemNoDom([
        'barra-filtros',
        'kpis-visao-geral',
        'grafico-protagonista',
        'bloco-visao-alunos',
        'bloco-diagnostico',
        'bloco-insights',
        'divisor-detalhe-micro',
        'bloco-tabela-alunos',
      ])
    ).toBe(true);
  });

  it('mostra o contexto do recorte junto do filtro', () => {
    render(<VisaoGeralRoute />);
    expect(screen.getByTestId('barra-filtros')).toContainElement(screen.getByTestId('filtro-semestre'));
    expect(screen.getByTestId('contexto-recorte')).toHaveTextContent('6º ano (11º e 12º em evidência)');
    expect(screen.getByTestId('contexto-recorte')).toHaveTextContent('2026.1');
  });

  it('mostra os 2 insights autogerados, um por área e um por aluno', () => {
    render(<VisaoGeralRoute />);
    const insights = screen.getByTestId('bloco-insights').querySelectorAll('li');
    expect(insights).toHaveLength(2);
    expect(insights[0]).toHaveTextContent('Clínica Médica está em nível crítico');
    expect(insights[1]).toHaveTextContent('28 alunos permanecem abaixo do limiar');
  });

  it('não existe nenhuma coluna nem rótulo "Nota TRI" na tela (caso crítico nº2)', () => {
    render(<VisaoGeralRoute />);
    expect(screen.queryByText(/Nota TRI/i)).not.toBeInTheDocument();
  });

  it('área, especialidade e tema usam % de acerto e nunca proficiência (caso crítico nº14)', () => {
    render(<VisaoGeralRoute />);
    const diagnostico = screen.getByTestId('bloco-diagnostico');
    expect(diagnostico).toHaveTextContent('percentual de acerto');
    expect(diagnostico.textContent).not.toMatch(/profici/i);

    const grafico = screen.getByTestId('grafico-protagonista');
    expect(grafico).toHaveTextContent('Evolução institucional');
  });

  it('erro em um bloco não deixa a tela em branco: KPIs seguem, só a tabela mostra erro', () => {
    mockUseAlunos.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: vi.fn() } as unknown as ReturnType<typeof useAlunos>);
    render(<VisaoGeralRoute />);

    expect(screen.getByTestId('kpis-visao-geral')).toBeInTheDocument();
    expect(screen.getByTestId('grafico-protagonista')).toBeInTheDocument();
    expect(screen.getByTestId('bloco-tabela-alunos')).toHaveTextContent('Não foi possível carregar a lista de alunos');
  });

  it('loading da query da tela mostra skeletons com altura reservada, sem sumir com a barra de filtros', () => {
    mockUseVisaoGeral.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useVisaoGeral>);
    render(<VisaoGeralRoute />);

    expect(screen.getByTestId('barra-filtros')).toBeInTheDocument();
    expect(screen.getAllByTestId('kpi-skeleton')).toHaveLength(4);
    expect(screen.getByTestId('bloco-grafico-loading')).toBeInTheDocument();
  });

  it('faixa de recorte parcial aparece quando meta.partial é true', () => {
    mockUseVisaoGeral.mockReturnValue({
      data: { data: visaoGeralFake, meta: { ...metaFake, partial: true } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useVisaoGeral>);

    render(<VisaoGeralRoute />);
    expect(screen.getAllByTestId('faixa-parcial').length).toBeGreaterThan(0);
  });

  it('abrir o drawer de temas pela cascata não desmonta o resto da tela', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    vi.mocked(useDiagnostico).mockReturnValue({
      data: {
        data: [
          { id: 'esp-cardio', nome: 'Cardiologia', nivel: 'especialidade', acertoPct: 24, desempenho: 'critico', amostra: 90, lowSample: false, temFilhos: true },
        ],
        meta: metaFake,
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useDiagnostico>);

    render(<VisaoGeralRoute />);
    await user.click(screen.getByRole('button', { name: 'Abrir cascata do nível crítico' }));
    await user.click(screen.getByRole('button', { name: /Cardiologia/ }));

    expect(screen.getByRole('dialog')).toHaveAccessibleName(/Temas de Cardiologia/i);
    expect(screen.getByTestId('kpis-visao-geral')).toBeInTheDocument();
  });
});

describe('BlocoGestor', () => {
  it('contém o erro de render de um filho sem derrubar o resto da página', () => {
    const Bomba = () => {
      throw new Error('quebrou');
    };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <>
        <BlocoGestor estado="ok">
          <Bomba />
        </BlocoGestor>
        <p>vizinho intacto</p>
      </>
    );

    expect(screen.getByText('Não foi possível exibir este bloco.')).toBeInTheDocument();
    expect(screen.getByText('vizinho intacto')).toBeInTheDocument();
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/gestor/__tests__/VisaoGeral.test.tsx`
Expected: FAIL com `Failed to resolve import "@/features/gestor/routes/VisaoGeral"`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/features/gestor/components/BlocoGestor.tsx
import * as React from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export type EstadoBloco = 'ok' | 'loading' | 'empty' | 'error';

export interface BlocoGestorProps {
  titulo?: string;
  estado: EstadoBloco;
  aoTentarNovamente?: () => void;
  mensagemVazio?: string;
  parcial?: boolean;
  alturaSkeleton?: number;
  children: React.ReactNode;
  testIdLoading?: string;
}

/** §8.4 — estados por bloco + error boundary por bloco, nunca por página. */
export function BlocoGestor({
  titulo,
  estado,
  aoTentarNovamente,
  mensagemVazio = 'Sem dados neste recorte.',
  parcial = false,
  alturaSkeleton = 300,
  children,
  testIdLoading,
}: BlocoGestorProps) {
  return (
    <section className="space-y-2">
      {titulo ? <h2 className="text-sm font-semibold">{titulo}</h2> : null}
      {parcial ? (
        <p data-testid="faixa-parcial" role="status" className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Recorte parcial: parte dos simulados do período não entrou neste cálculo.
        </p>
      ) : null}

      {estado === 'loading' ? (
        <div data-testid={testIdLoading} aria-busy="true" style={{ minHeight: alturaSkeleton }}>
          <Skeleton className="h-full w-full" style={{ height: alturaSkeleton }} />
        </div>
      ) : estado === 'error' ? (
        <div className="space-y-2 rounded-md border border-border p-4">
          <p className="text-sm text-muted-foreground">Não foi possível carregar este bloco.</p>
          <Button type="button" size="sm" variant="outline" onClick={aoTentarNovamente}>
            Tentar novamente
          </Button>
        </div>
      ) : estado === 'empty' ? (
        <p className="rounded-md border border-border p-4 text-sm text-muted-foreground">{mensagemVazio}</p>
      ) : (
        <ErrorBoundary
          fallback={
            <p className="rounded-md border border-border p-4 text-sm text-muted-foreground">
              Não foi possível exibir este bloco.
            </p>
          }
        >
          {children}
        </ErrorBoundary>
      )}
    </section>
  );
}
```

```tsx
// src/features/gestor/components/BlocoInsights.tsx
import { Card, CardContent } from '@/components/ui/card';
import type { VisaoGeral } from '@/features/gestor/api/types';

const ROTULO_ESCOPO = { area: 'Por grande área', aluno: 'Por aluno' } as const;

/** §4.8 — 2 insights autogerados, leitura curta, sem linguagem de aluno. */
export function BlocoInsights({ insights }: { insights: VisaoGeral['insights'] }) {
  return (
    <section data-testid="bloco-insights" aria-labelledby="titulo-insights" className="space-y-3">
      <h2 id="titulo-insights" className="text-sm font-semibold">Insights</h2>
      {insights.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem insights para este recorte.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {insights.map((insight) => (
            <li key={`${insight.escopo}-${insight.texto}`}>
              <Card className="h-full">
                <CardContent className="space-y-1 p-4">
                  <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                    {ROTULO_ESCOPO[insight.escopo]}
                  </span>
                  <p className="text-sm">{insight.texto}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

```tsx
// src/features/gestor/components/ContextoDoRecorte.tsx
import { TooltipRastreabilidade } from '@/features/gestor/components/TooltipRastreabilidade';
import type { FiltroSemestre, Meta } from '@/features/gestor/api/types';

export function rotuloSemestre(semestre: FiltroSemestre): string {
  if (semestre === '6ano') return '6º ano (11º e 12º em evidência)';
  if (semestre === 'geral') return 'Todos os semestres';
  return `${semestre}º semestre`;
}

export function ContextoDoRecorte({ semestre, meta }: { semestre: FiltroSemestre; meta: Meta }) {
  return (
    <p data-testid="contexto-recorte" className="flex items-center gap-1.5 text-xs text-muted-foreground">
      Recorte: {rotuloSemestre(semestre)} · Período {meta.periodo}
      <TooltipRastreabilidade meta={meta} />
    </p>
  );
}
```

```tsx
// src/features/gestor/routes/VisaoGeral.tsx
import * as React from 'react';
import { Separator } from '@/components/ui/separator';
import { useVisaoGeral } from '@/features/gestor/api/queries';
import { useFiltrosGestor } from '@/features/gestor/hooks/useFiltrosGestor';
import { FiltroSemestre } from '@/features/gestor/components/FiltroSemestre';
import { BlocoGestor } from '@/features/gestor/components/BlocoGestor';
import { BlocoInsights } from '@/features/gestor/components/BlocoInsights';
import { CascataDiagnostico } from '@/features/gestor/components/CascataDiagnostico';
import { ContextoDoRecorte } from '@/features/gestor/components/ContextoDoRecorte';
import { DrawerTemas } from '@/features/gestor/components/DrawerTemas';
import { GraficoProtagonista } from '@/features/gestor/components/GraficoProtagonista';
import { KpisVisaoGeral } from '@/features/gestor/components/KpisVisaoGeral';
import { TabelaAlunos } from '@/features/gestor/components/TabelaAlunos';
import { VisaoDeAlunos } from '@/features/gestor/components/VisaoDeAlunos';
import type { Meta } from '@/features/gestor/api/types';

const META_VAZIA: Meta = {
  periodo: '—',
  fonte: '—',
  atualizadoEm: '',
  criterio: '—',
  partial: false,
  lowSample: false,
};

/**
 * /gestor/visao-geral — "Como estamos e onde dói?" (spec §2.1).
 * Ordem vertical §4.8, com Visão de Alunos ACIMA da visão por área (decisão 22/07).
 */
export default function VisaoGeral() {
  const filtros = useFiltrosGestor();
  const recorte = React.useMemo(
    () => ({ iesId: filtros.iesId, semestre: filtros.semestre }),
    [filtros.iesId, filtros.semestre]
  );

  const consulta = useVisaoGeral(recorte);
  const [especialidadeAberta, setEspecialidadeAberta] = React.useState<{ id: string; nome: string } | null>(null);

  const visao = consulta.data?.data;
  const meta = consulta.data?.meta ?? META_VAZIA;
  const estado = consulta.isLoading ? 'loading' : consulta.isError ? 'error' : visao ? 'ok' : 'empty';
  const parcial = meta.partial;

  const colunasSimul
```tsx
  const colunasSimulados = React.useMemo(
    () => (visao?.evolucao ?? []).map((ponto) => ({ id: ponto.simuladoId, nome: ponto.nome })),
    [visao?.evolucao]
  );

  return (
    <div className="space-y-6 pb-12">
      <div data-testid="barra-filtros" className="space-y-2">
        <FiltroSemestre />
        <ContextoDoRecorte semestre={filtros.semestre} meta={meta} />
      </div>

      {/* 2. KPIs — o bloco tem seu próprio estado, derivado da query da tela. */}
      <KpisVisaoGeral
        kpis={
          visao?.kpis ?? {
            enamedProjetado: { valor: null, delta: null, serie: [], criterio: meta.criterio },
            proficientesPct: { valor: null, delta: null, serie: [], criterio: meta.criterio },
            acertoPct: { valor: null, delta: null, serie: [], criterio: meta.criterio },
            simulados: { realizados: 0, contratados: 0 },
          }
        }
        meta={meta}
        estado={estado}
        onTentarNovamente={() => consulta.refetch()}
      />

      {/* 3. Gráfico protagonista com 3 modos. */}
      <BlocoGestor
        estado={estado}
        parcial={parcial}
        alturaSkeleton={360}
        testIdLoading="bloco-grafico-loading"
        aoTentarNovamente={() => consulta.refetch()}
        mensagemVazio="Sem simulados realizados neste recorte."
      >
        {visao ? <GraficoProtagonista visao={visao} /> : null}
      </BlocoGestor>

      {/* 4. Visão de Alunos (macro). */}
      <BlocoGestor
        estado={estado}
        parcial={parcial}
        alturaSkeleton={320}
        aoTentarNovamente={() => consulta.refetch()}
        mensagemVazio="Sem alunos com resultado neste recorte."
      >
        {visao ? <VisaoDeAlunos distribuicao={visao.distribuicaoAlunos} dispersao={visao.dispersao} /> : null}
      </BlocoGestor>

      {/* 5. Diagnóstico Curricular (micro por área) + cascata ao lado. */}
      <BlocoGestor
        estado={estado}
        parcial={parcial}
        alturaSkeleton={220}
        aoTentarNovamente={() => consulta.refetch()}
        mensagemVazio="Sem classificação por grande área neste recorte."
      >
        {visao ? (
          <CascataDiagnostico
            resumo={visao.diagnosticoResumo}
            recorte={recorte}
            onAbrirTemas={setEspecialidadeAberta}
          />
        ) : null}
      </BlocoGestor>

      {/* 6. Insights. */}
      <BlocoGestor
        estado={estado}
        alturaSkeleton={120}
        aoTentarNovamente={() => consulta.refetch()}
        mensagemVazio="Sem insights para este recorte."
      >
        {visao ? <BlocoInsights insights={visao.insights} /> : null}
      </BlocoGestor>

      {/* 7. Divisor + tabela de alunos (bloco com query própria, estado independente). */}
      <div data-testid="divisor-detalhe-micro" className="flex items-center gap-3 pt-2">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Detalhe · micro</span>
        <Separator className="flex-1" />
      </div>

      <TabelaAlunos recorte={recorte} colunasSimulados={colunasSimulados} />

      <DrawerTemas
        especialidade={especialidadeAberta}
        recorte={recorte}
        onFechar={() => setEspecialidadeAberta(null)}
        onExportarRecorte={() => undefined}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/gestor/__tests__/VisaoGeral.test.tsx`
Expected: PASS (10 testes).

Se o teste "área, especialidade e tema usam % de acerto e nunca proficiência" falhar, a causa provável é o `DispersaoChart` do bloco de alunos ter vazado para dentro de `bloco-diagnostico` — confira que `CascataDiagnostico` e `VisaoDeAlunos` são `<section>` irmãs, nunca aninhadas.

- [ ] **Step 5: Commit**

```bash
git add src/features/gestor/routes/VisaoGeral.tsx src/features/gestor/components/BlocoGestor.tsx src/features/gestor/components/BlocoInsights.tsx src/features/gestor/components/ContextoDoRecorte.tsx src/features/gestor/__tests__/VisaoGeral.test.tsx
git commit -m "feat(gestor): rota /gestor/visao-geral montando os blocos da Fase 4

Ordem §4.8 com Visao de Alunos acima da visao por area (22/07).
Estado por bloco + error boundary por bloco: um bloco quebrado nao apaga a tela.
Testes de integracao cobrem ausencia de 'Nota TRI' e % de acerto em area/especialidade/tema."
```

---

### Task 46b: Verificação de fim de fase

**Files:** nenhum arquivo novo — porta de qualidade da Fase 4.

**Interfaces:**
- Consumes: tudo das Tasks 36–46.
- Produces: nada de código; evidência de que a fatia fecha verde antes da Fase 5.

- [ ] **Step 1: Rodar a suíte da feature**

Run: `npx vitest run src/features/gestor`
Expected: PASS em todos os arquivos de `src/features/gestor/__tests__/` (KpiCard, KpisVisaoGeral, EvolucaoChart, AreasChart, DispersaoChart, GraficoProtagonista, CascataDiagnostico, DrawerTemas, VisaoDeAlunos, TabelaAlunos, VisaoGeral).

- [ ] **Step 2: Type-check e lint**

Run: `npm run type-check`
Expected: exit 0, nenhuma saída. Se aparecer erro na assinatura de `useVisaoGeral` / `useDiagnostico` / `useAlunos` / `useAluno` / `useDiagnosticoTemas`, aplique a reconciliação declarada no cabeçalho desta fase: os hooks recebem `Recorte` (`{ iesId, semestre }`), não o objeto completo de `useFiltrosGestor`.

Run: `npm run lint`
Expected: exit 0. Não silenciar regra com `eslint-disable`; corrigir o código.

- [ ] **Step 3: Suíte completa e build**

Run: `npm run test:run`
Expected: PASS, sem regressão nas 5 telas antigas de `src/experiences/gestor/` (coexistência da §7.5) nem em `src/test/unit/route-gates.test.tsx`.

Run: `npm run build`
Expected: build concluído; `charts/` deve sair em chunk separado da rota (§8.5). Confirmar no sumário do Vite que existe um chunk contendo `recharts` distinto do chunk de `routes/VisaoGeral`.

- [ ] **Step 4: Checklist manual da §11 nesta tela**

Verificar no claro **e** no escuro, com a flag `gestao.portal_v2` ligada:
1. nenhum hex nem px solto nos arquivos criados (`grep -rn "#[0-9a-fA-F]\{3,6\}" src/features/gestor` deve voltar vazio);
2. teclado completo: tab percorre modos do gráfico → setas dos níveis → cascata → tabela; ESC fecha os dois drawers;
3. cada gráfico tem `role="img"`, `<title>`, `<desc>` e a tabela alternativa em `<details>`;
4. régua dos KPIs some com 1 simulado e o ponto corrente diz "atual";
5. nenhum `any`, `@ts-ignore`, `console.log` ou `TODO` nos arquivos da fase.

- [ ] **Step 5: Commit**

```bash
git add -A src/features/gestor
git commit -m "chore(gestor): fecha Fase 4 (Visao Geral) com lint, type-check, testes e build verdes"
```

---

**Arquivos criados nesta fase (caminhos absolutos):**

- `C:\Users\felipe.souza\Documents\Projetos (Sanar)\sanarflix-study-guide\src\features\gestor\components\TooltipRastreabilidade.tsx`
- `...\src\features\gestor\components\KpiCard.tsx`
- `...\src\features\gestor\components\KpisVisaoGeral.tsx`
- `...\src\features\gestor\components\GraficoProtagonista.tsx`
- `...\src\features\gestor\components\CascataDiagnostico.tsx`
- `...\src\features\gestor\components\DrawerTemas.tsx`
- `...\src\features\gestor\components\VisaoDeAlunos.tsx`
- `...\src\features\gestor\components\TabelaAlunos.tsx`
- `...\src\features\gestor\components\DrawerAluno.tsx`
- `...\src\features\gestor\components\BlocoGestor.tsx`
- `...\src\features\gestor\components\BlocoInsights.tsx`
- `...\src\features\gestor\components\ContextoDoRecorte.tsx`
- `...\src\features\gestor\charts\EvolucaoChart.tsx`
- `...\src\features\gestor\charts\AreasChart.tsx`
- `...\src\features\gestor\charts\DispersaoChart.tsx`
- `...\src\features\gestor\lib\recorte.ts`
- `...\src\features\gestor\lib\rotulos.ts`
- `...\src\features\gestor\routes\VisaoGeral.tsx`
- `...\src\features\gestor\__tests__\fixtures\visaoGeral.ts` + 11 arquivos de teste em `...\src\features\gestor\__tests__\`

**Dois pontos de atenção para quem consolidar as fatias:**

1. `TooltipRastreabilidade.tsx` também pode ser criado pela Fase 3 (Início). A assinatura canônica é `({ meta, criterio }: { meta: Meta; criterio?: string })` com `data-testid="rastreabilidade-texto"` — não duplicar o arquivo.
2. A Fase 5 (Detalhamento) reusa `KpiCard`, `BlocoGestor`, `DispersaoChart`, `lib/rotulos.ts` e `lib/recorte.ts` desta fase; a régua de evolução do Detalhamento (§4.7, item 5) é o mesmo `KpiCard` com `serie`.

---

## Fase 5 — Tela 3: Detalhamento por Simulados

Contexto desta fase: spec §4.7 (regras do Detalhamento), §4.1 (métricas e "Nota TRI" eliminada), §4.4 (níveis), §4.5 (filtro global e virada para distribuição), §4.10 (ausência/parcialidade), §8.2 (estado), §8.4 (estados por bloco), §12 (casos 3, 4, 5, 6, 7, 8, 9, 10, 11, 14).

Contratos de fases anteriores que esta fase **consome** (assinaturas exatas, já definidas nas Fases 2/3/4):

```ts
// src/features/gestor/api/queries.ts
useCronograma(iesId: string | null): UseQueryResult<Envelope<ItemCronograma[]>>
useDetalhamento(filtros: { iesId: string | null; semestre: FiltroSemestre; simulados: string[] }): UseQueryResult<Envelope<Detalhamento>>
useQuestoes(filtros: { iesId: string | null; simulados: string[] }, paginacao: { page: number; pageSize: number; sort: string; area: string | null }): UseQueryResult<Envelope<Paginado<Questao>>>
useAluno(alunoId: string | null, simulados: string[]): UseQueryResult<Envelope<AlunoNoSimulado[]>>

// src/features/gestor/hooks/useFiltrosGestor.ts
useFiltrosGestor(): { semestre; setSemestre; simulados; setSimulados; iesId; setIesId }

// src/features/gestor/components/FiltroSemestre.tsx
interface FiltroSemestreProps { valor: FiltroSemestre; onChange: (v: FiltroSemestre) => void }
// src/features/gestor/components/CronogramaSimulados.tsx
interface CronogramaSimuladosProps { itens: ItemCronograma[] }
// src/features/gestor/components/DrawerAluno.tsx
interface DrawerAlunoProps { alunoId: string | null; simulados: string[]; onFechar: () => void }
// src/features/gestor/charts/EvolucaoChart.tsx
interface EvolucaoChartProps { pontos: { rotulo: string; valor: number | null }[]; meta?: number | null; ariaLabel: string }
// src/features/gestor/charts/DispersaoChart.tsx
interface DispersaoChartProps { pontos: { alunoId: string; semestre: number; nota: number }[]; semestresEmEvidencia: number[]; ariaLabel: string }
```

Nos testes desta fase, `FiltroSemestre`, `CronogramaSimulados`, `DrawerAluno`, `EvolucaoChart` e `DispersaoChart` são sempre substituídos por `vi.mock` — as asserções são sobre as props passadas, não sobre o render deles. Se alguma dessas cinco assinaturas tiver saído da Fase 3/4 diferente do bloco acima, o único ponto de ajuste é a linha de chamada no arquivo da Fase 5 que a usa; nenhuma props de componente da Fase 5 muda.

Decisões desta fase, registradas para não virarem ambiguidade:

- **Evidência de semestre é derivada no cliente** a partir do filtro global (§4.5). O campo `semestres[].emEvidencia` do envelope é o eco do servidor e **não** é usado para estilo — assim a evidência nunca desincroniza da URL.
- **Ordenação e paginação das tabelas do Detalhamento vivem em estado local do componente**, não na URL. `useFiltrosGestor` é congelado em `semestre`/`simulados`/`ies` e inventar chaves novas de URL colidiria com outras fatias.
- **O recorte cruzado (área ↔ semestre) é 100% cliente**, sobre uma matriz que vem no mesmo payload. Transição de 200 ms em valor só fecha sem round-trip.

---

### Task 47: SeletorSimulados

**Files:**
- Create: `src/features/gestor/components/SeletorSimulados.tsx`
- Test: `src/features/gestor/__tests__/SeletorSimulados.test.tsx`

**Interfaces:**
- Consumes: `ItemCronograma` de `src/features/gestor/api/types.ts`; `ToggleGroup`/`ToggleGroupItem` de `@/components/ui/toggle-group`; `cn` de `@/lib/utils`.
- Produces: `SeletorSimulados`, `SeletorSimuladosProps`, `motivoIndisponivel(item: ItemCronograma): string | null`, `LIMITE_LEGIBILIDADE = 5`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/gestor/__tests__/SeletorSimulados.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, userEvent } from '@/test/utils';
import { SeletorSimulados } from '@/features/gestor/components/SeletorSimulados';
import type { ItemCronograma } from '@/features/gestor/api/types';

const item = (over: Partial<ItemCronograma>): ItemCronograma => ({
  id: 's1',
  nome: 'Simulado 1',
  data: '2026-03-10T13:00:00Z',
  status: 'realizado',
  modalidade: 'online',
  ...over,
});

const REALIZADOS: ItemCronograma[] = [
  item({ id: 's1', nome: 'Simulado 1' }),
  item({ id: 's2', nome: 'Simulado 2' }),
  item({ id: 's3', nome: 'Simulado 3' }),
  item({ id: 's4', nome: 'Simulado 4' }),
  item({ id: 's5', nome: 'Simulado 5' }),
  item({ id: 's6', nome: 'Simulado 6' }),
];

describe('SeletorSimulados', () => {
  it('não oferece nenhuma opção "todos" — a seleção é sempre explícita (§4.7.1)', () => {
    render(<SeletorSimulados itens={REALIZADOS.slice(0, 2)} selecionados={['s1']} onChange={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /todos/i })).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('desabilita simulado previsto e em processamento, mostrando o motivo (§4.7.1, §4.10)', () => {
    render(
      <SeletorSimulados
        itens={[
          item({ id: 's1', nome: 'Simulado 1' }),
          item({ id: 's2', nome: 'Simulado 2', status: 'processing' }),
          item({ id: 's3', nome: 'Simulado 3', status: 'previsto', data: null }),
          item({ id: 's4', nome: 'Simulado 4', status: 'agendado' }),
        ]}
        selecionados={['s1']}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Simulado 1' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Simulado 2 — Gabarito em processamento' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Simulado 3 — Simulado previsto, sem data definida' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Simulado 4 — Simulado ainda não realizado' })).toBeDisabled();
    expect(screen.getByText('Gabarito em processamento')).toBeInTheDocument();
  });

  it('soma o id ao clicar num simulado não selecionado', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SeletorSimulados itens={REALIZADOS.slice(0, 3)} selecionados={['s1']} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Simulado 2' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toEqual(expect.arrayContaining(['s1', 's2']));
    expect(onChange.mock.calls[0][0]).toHaveLength(2);
  });

  it('permite chegar a zero e então cobra a seleção mínima', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <SeletorSimulados itens={REALIZADOS.slice(0, 3)} selecionados={['s1']} onChange={onChange} />,
    );

    await user.click(screen.getByRole('button', { name: 'Simulado 1' }));
    expect(onChange).toHaveBeenCalledWith([]);

    rerender(<SeletorSimulados itens={REALIZADOS.slice(0, 3)} selecionados={[]} onChange={onChange} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Escolha ao menos um simulado');
  });

  it('acima de 5 simulados avisa sobre legibilidade sem bloquear (§4.7.2, caso 5)', () => {
    render(<SeletorSimulados itens={REALIZADOS} selecionados={['s1', 's2', 's3', 's4', 's5', 's6']} onChange={vi.fn()} />);

    const aviso = screen.getByTestId('aviso-legibilidade');
    expect(aviso).toHaveAttribute('role', 'status');
    expect(aviso).toHaveTextContent('6 simulados selecionados');
    expect(screen.queryByRole('alert')).toBeNull();
    REALIZADOS.forEach((s) => expect(screen.getByRole('button', { name: s.nome })).toBeEnabled());
  });

  it('não avisa com exatamente 5 selecionados', () => {
    render(<SeletorSimulados itens={REALIZADOS} selecionados={['s1', 's2', 's3', 's4', 's5']} onChange={vi.fn()} />);
    expect(screen.queryByTestId('aviso-legibilidade')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/gestor/__tests__/SeletorSimulados.test.tsx`
Expected: FAIL com `Failed to resolve import "@/features/gestor/components/SeletorSimulados"`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/features/gestor/components/SeletorSimulados.tsx
import { AlertTriangle, Info } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import type { ItemCronograma } from '../api/types';

/** Acima disso a leitura dos gráficos degrada — aviso, nunca bloqueio (§4.7.2). */
export const LIMITE_LEGIBILIDADE = 5;

const MOTIVO_POR_STATUS: Record<ItemCronograma['status'], string | null> = {
  realizado: null,
  processing: 'Gabarito em processamento',
  agendado: 'Simulado ainda não realizado',
  reagendado: 'Simulado ainda não realizado',
  previsto: 'Simulado previsto, sem data definida',
};

/** `null` = selecionável. Qualquer string = motivo de indisponibilidade (§4.7.1). */
export function motivoIndisponivel(item: ItemCronograma): string | null {
  return item.indisponivelPorque ?? MOTIVO_POR_STATUS[item.status];
}

export interface SeletorSimuladosProps {
  itens: ItemCronograma[];
  selecionados: string[];
  onChange: (ids: string[]) => void;
}

export function SeletorSimulados({ itens, selecionados, onChange }: SeletorSimuladosProps) {
  const semSelecao = selecionados.length === 0;
  const excedeLegibilidade = selecionados.length > LIMITE_LEGIBILIDADE;

  return (
    <div
      data-testid="seletor-simulados"
      className={cn(
        'rounded-lg border border-border bg-card p-3',
        semSelecao && 'border-destructive ring-2 ring-destructive/20',
      )}
    >
      <p className="mb-2 text-sm font-medium text-foreground">Simulados</p>

      <ToggleGroup
        type="multiple"
        value={selecionados}
        onValueChange={onChange}
        aria-label="Selecione os simulados do detalhamento"
        className="flex flex-wrap justify-start gap-2"
      >
        {itens.map((item) => {
          const motivo = motivoIndisponivel(item);
          return (
            <ToggleGroupItem
              key={item.id}
              value={item.id}
              disabled={motivo !== null}
              aria-label={motivo ? `${item.nome} — ${motivo}` : item.nome}
              className="h-auto flex-col items-start gap-0.5 px-3 py-2 data-[state=on]:bg-primary/10"
            >
              <span className="text-sm">{item.nome}</span>
              {motivo && <span className="text-xs text-muted-foreground">{motivo}</span>}
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>

      {semSelecao && (
        <p role="alert" className="mt-2 flex items-center gap-1.5 text-sm text-destructive">
          <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
          Escolha ao menos um simulado
        </p>
      )}

      {excedeLegibilidade && (
        <p
          role="status"
          data-testid="aviso-legibilidade"
          className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {selecionados.length} simulados selecionados: os gráficos podem ficar difíceis de ler. A leitura continua
          disponível.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/gestor/__tests__/SeletorSimulados.test.tsx`
Expected: PASS — `Tests 6 passed (6)`.

- [ ] **Step 5: Commit**

```bash
git add src/features/gestor/components/SeletorSimulados.tsx src/features/gestor/__tests__/SeletorSimulados.test.tsx
git commit -m "Gestor v2: SeletorSimulados com minimo 1, motivo de indisponibilidade e aviso de legibilidade"
```

---

### Task 48: Estado vazio do Detalhamento e zero requisição de métrica

**Files:**
- Create: `src/features/gestor/components/EstadoVazioDetalhamento.tsx`
- Modify: `src/features/gestor/api/queries.ts`
- Test: `src/features/gestor/__tests__/EstadoVazioDetalhamento.test.tsx`

**Interfaces:**
- Consumes: `useDetalhamento` da Fase 2 (assinatura no preâmbulo desta fase); `supabase` de `@/integrations/supabase/client`.
- Produces: `EstadoVazioDetalhamento`; `useDetalhamento` com `enabled` que impede a chamada de `get_gestor_detalhamento` sem simulado (§12 caso 4).

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/gestor/__tests__/EstadoVazioDetalhamento.test.tsx
import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDetalhamento } from '@/features/gestor/api/queries';
import { EstadoVazioDetalhamento } from '@/features/gestor/components/EstadoVazioDetalhamento';
import type { FiltroSemestre } from '@/features/gestor/api/types';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: vi.fn() },
}));

const rpc = vi.mocked(supabase.rpc);

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

const filtros = (simulados: string[], semestre: FiltroSemestre = '6ano') => ({
  iesId: 'ies-1',
  semestre,
  simulados,
});

describe('Detalhamento sem simulado selecionado (§12 caso 4)', () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: null, error: null } as never);
  });

  it('não chama get_gestor_detalhamento com seleção vazia', async () => {
    const { result } = renderHook(() => useDetalhamento(filtros([])), { wrapper });

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(rpc).not.toHaveBeenCalled();
  });

  it('não chama nada quando não há IES resolvida', async () => {
    const { result } = renderHook(
      () => useDetalhamento({ iesId: null, semestre: '6ano', simulados: ['s1'] }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(rpc).not.toHaveBeenCalled();
  });

  it('chama a RPC com a lista ordenada assim que existe 1 simulado', async () => {
    renderHook(() => useDetalhamento(filtros(['s2', 's1'])), { wrapper });

    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    expect(rpc).toHaveBeenCalledWith('get_gestor_detalhamento', {
      p_ies_id: 'ies-1',
      p_semestre: '6ano',
      p_simulados: ['s1', 's2'],
    });
  });

  it('o estado vazio põe o seletor em evidência e nega a leitura "de todos"', () => {
    render(<EstadoVazioDetalhamento />);

    expect(screen.getByRole('heading', { name: 'Escolha ao menos um simulado' })).toBeInTheDocument();
    expect(screen.getByTestId('detalhamento-vazio')).toHaveTextContent(/não há leitura de todos/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/gestor/__tests__/EstadoVazioDetalhamento.test.tsx`
Expected: FAIL com `Failed to resolve import "@/features/gestor/components/EstadoVazioDetalhamento"`.

- [ ] **Step 3: Write the empty state**

```tsx
// src/features/gestor/components/EstadoVazioDetalhamento.tsx
export function EstadoVazioDetalhamento() {
  return (
    <section
      data-testid="detalhamento-vazio"
      aria-labelledby="detalhamento-vazio-titulo"
      className="rounded-lg border border-dashed border-border p-8 text-center"
    >
      <h2 id="detalhamento-vazio-titulo" className="text-base font-semibold text-foreground">
        Escolha ao menos um simulado
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Os indicadores desta tela são calculados sobre os simulados que você selecionar acima. Não há leitura de todos:
        cada recorte precisa ser explícito.
      </p>
    </section>
  );
}
```

- [ ] **Step 4: Rewrite `useDetalhamento` with the guard**

Substituir integralmente a função `useDetalhamento` em `src/features/gestor/api/queries.ts` (versão da Fase 2) por esta. O `enabled` é a garantia dura do §12 caso 4; a lista ordenada mantém a `queryKey` estável quando o gestor clica os mesmos simulados em outra ordem.

```ts
export function useDetalhamento(filtros: {
  iesId: string | null;
  semestre: FiltroSemestre;
  simulados: string[];
}) {
  const { iesId, semestre, simulados } = filtros;
  const ids = [...simulados].sort();

  return useQuery({
    queryKey: ['gestor', 'detalhamento', iesId, semestre, ids] as const,
    queryFn: async (): Promise<Envelope<Detalhamento>> => {
      const { data, error } = await supabase.rpc('get_gestor_detalhamento', {
        p_ies_id: iesId,
        p_semestre: semestre,
        p_simulados: ids,
      });
      if (error) throw error;
      return data as unknown as Envelope<Detalhamento>;
    },
    // §4.7.1 + §12 caso 4: sem simulado explícito não existe requisição de métrica.
    enabled: Boolean(iesId) && ids.length > 0,
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/features/gestor/__tests__/EstadoVazioDetalhamento.test.tsx`
Expected: PASS — `Tests 4 passed (4)`.

- [ ] **Step 6: Commit**

```bash
git add src/features/gestor/components/EstadoVazioDetalhamento.tsx src/features/gestor/api/queries.ts src/features/gestor/__tests__/EstadoVazioDetalhamento.test.tsx
git commit -m "Gestor v2: estado vazio do Detalhamento e guard de zero requisicao sem simulado"
```

---

### Task 49: Os 3 KPIs do Detalhamento

**Files:**
- Create: `src/features/gestor/lib/agregarDetalhamento.ts`
- Create: `src/features/gestor/components/KpisDetalhamento.tsx`
- Test: `src/features/gestor/__tests__/agregarDetalhamento.test.ts`
- Test: `src/features/gestor/__tests__/KpisDetalhamento.test.tsx`

**Interfaces:**
- Consumes: `MetricasSimulado`, `Meta` de `api/types.ts`; `formatPct`, `formatNumero`, `formatConceito`, `formatData`, `TRACO` de `lib/formatters.ts`; `Card`, `CardContent` de `@/components/ui/card`.
- Produces: `mediaPonderadaPorParticipantes(entradas: { valor: number | null; participantes: number }[]): number | null`, `mediana(valores: number[]): number | null` em `lib/agregarDetalhamento.ts`; `KpisDetalhamento`, `KpisDetalhamentoProps`.

- [ ] **Step 1: Write the failing test of the aggregation lib**

```ts
// src/features/gestor/__tests__/agregarDetalhamento.test.ts
import { describe, it, expect } from 'vitest';
import { mediaPonderadaPorParticipantes, mediana } from '@/features/gestor/lib/agregarDetalhamento';

describe('mediaPonderadaPorParticipantes', () => {
  it('pondera pelo número de participantes de cada simulado', () => {
    const valor = mediaPonderadaPorParticipantes([
      { valor: 60, participantes: 100 },
      { valor: 70, participantes: 50 },
    ]);
    expect(valor).toBeCloseTo(63.3333, 3);
  });

  it('devolve o próprio valor com uma única entrada', () => {
    expect(mediaPonderadaPorParticipantes([{ valor: 72.5, participantes: 40 }])).toBe(72.5);
  });

  it('ignora entradas com valor null em vez de tratá-las como zero (§4.10)', () => {
    expect(
      mediaPonderadaPorParticipantes([
        { valor: null, participantes: 100 },
        { valor: 80, participantes: 20 },
      ]),
    ).toBe(80);
  });

  it('ignora entradas sem participante', () => {
    expect(
      mediaPonderadaPorParticipantes([
        { valor: 10, participantes: 0 },
        { valor: 90, participantes: 10 },
      ]),
    ).toBe(90);
  });

  it('devolve null quando não há nenhuma entrada aproveitável', () => {
    expect(mediaPonderadaPorParticipantes([])).toBeNull();
    expect(mediaPonderadaPorParticipantes([{ valor: null, participantes: 30 }])).toBeNull();
    expect(mediaPonderadaPorParticipantes([{ valor: 50, participantes: 0 }])).toBeNull();
  });
});

describe('mediana', () => {
  it('devolve o valor central numa lista ímpar', () => {
    expect(mediana([70, 30, 50])).toBe(50);
  });

  it('devolve a média dos dois centrais numa lista par', () => {
    expect(mediana([10, 20, 30, 40])).toBe(25);
  });

  it('devolve null para lista vazia', () => {
    expect(mediana([])).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/gestor/__tests__/agregarDetalhamento.test.ts`
Expected: FAIL com `Failed to resolve import "@/features/gestor/lib/agregarDetalhamento"`.

- [ ] **Step 3: Write the aggregation lib**

```ts
// src/features/gestor/lib/agregarDetalhamento.ts

/**
 * Média das entradas ponderada pelo número de participantes de cada simulado.
 * Entrada com `valor === null` ou sem participante fica **fora** da média (§4.10:
 * nunca preencher lacuna com zero). Sem nenhuma entrada aproveitável, `null`.
 */
export function mediaPonderadaPorParticipantes(
  entradas: { valor: number | null; participantes: number }[],
): number | null {
  let soma = 0;
  let peso = 0;

  for (const entrada of entradas) {
    if (entrada.valor === null || entrada.participantes <= 0) continue;
    soma += entrada.valor * entrada.participantes;
    peso += entrada.participantes;
  }

  return peso === 0 ? null : soma / peso;
}

/** Mediana de uma lista de valores. Lista vazia devolve `null`. */
export function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 1 ? ordenados[meio] : (ordenados[meio - 1] + ordenados[meio]) / 2;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/gestor/__tests__/agregarDetalhamento.test.ts`
Expected: PASS — `Tests 8 passed (8)`.

- [ ] **Step 5: Write the failing test of the KPI block**

```tsx
// src/features/gestor/__tests__/KpisDetalhamento.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@/test/utils';
import { KpisDetalhamento } from '@/features/gestor/components/KpisDetalhamento';
import type { Meta, MetricasSimulado } from '@/features/gestor/api/types';

const META: Meta = {
  periodo: '2026.1',
  fonte: 'Simulados SanarFlix',
  atualizadoEm: '2026-07-20T13:00:00Z',
  criterio: 'Proficiente = proficiência maior ou igual a 60',
  partial: false,
  lowSample: false,
};

const metrica = (over: Partial<MetricasSimulado>): MetricasSimulado => ({
  simuladoId: 's1',
  nome: 'Simulado 1',
  data: '2026-03-10T13:00:00Z',
  participantes: 100,
  acertoMedioPct: 60,
  enamedProjetado: 3,
  proficienciaMedia: 55,
  ...over,
});

describe('KpisDetalhamento', () => {
  it('mostra exatamente os 3 KPIs do Detalhamento, sem "simulados realizados" (§4.7.6)', () => {
    render(<KpisDetalhamento metricas={[metrica({})]} meta={META} />);

    expect(screen.getByTestId('kpi-acerto-medio')).toHaveTextContent('Percentual de acerto médio');
    expect(screen.getByTestId('kpi-enamed')).toHaveTextContent('Conceito ENAMED (projetado)');
    expect(screen.getByTestId('kpi-proficiencia-media')).toHaveTextContent('Proficiência média');
    expect(screen.getAllByTestId(/^kpi-/)).toHaveLength(3);
    expect(screen.queryByText(/simulados realizados/i)).toBeNull();
  });

  it('com 1 simulado mostra os valores daquele simulado', () => {
    render(<KpisDetalhamento metricas={[metrica({ acertoMedioPct: 61, proficienciaMedia: 58, enamedProjetado: 3 })]} meta={META} />);

    expect(within(screen.getByTestId('kpi-acerto-medio')).getByTestId('kpi-valor')).toHaveTextContent('61%');
    expect(within(screen.getByTestId('kpi-enamed')).getByTestId('kpi-valor')).toHaveTextContent('3/5');
    expect(within(screen.getByTestId('kpi-proficiencia-media')).getByTestId('kpi-valor')).toHaveTextContent('58');
  });

  it('com 2+ simulados recalcula as médias sobre o conjunto', () => {
    render(
      <KpisDetalhamento
        metricas={[
          metrica({ simuladoId: 's1', nome: 'Simulado 1', participantes: 100, acertoMedioPct: 60, proficienciaMedia: 55, enamedProjetado: 3 }),
          metrica({ simuladoId: 's2', nome: 'Simulado 2', participantes: 100, acertoMedioPct: 70, proficienciaMedia: 65, enamedProjetado: 4 }),
        ]}
        meta={META}
      />,
    );

    expect(within(screen.getByTestId('kpi-acerto-medio')).getByTestId('kpi-valor')).toHaveTextContent('65%');
    expect(within(screen.getByTestId('kpi-proficiencia-media')).getByTestId('kpi-valor')).toHaveTextContent('60');
    expect(screen.getByTestId('kpi-acerto-medio')).toHaveTextContent('2 simulados');
  });

  it('com 2+ simulados o Conceito ENAMED vira comparativo, nunca média (§4.1, §12 caso 3)', () => {
    render(
      <KpisDetalhamento
        metricas={[
          metrica({ simuladoId: 's1', nome: 'Simulado 1', enamedProjetado: 3 }),
          metrica({ simuladoId: 's2', nome: 'Simulado 2', enamedProjetado: 4 }),
        ]}
        meta={META}
      />,
    );

    const enamed = screen.getByTestId('kpi-enamed');
    expect(enamed).toHaveTextContent('comparativo');
    expect(within(enamed).queryByTestId('kpi-valor')).toBeNull();
    expect(within(enamed).getByTestId('enamed-s1')).toHaveTextContent('Simulado 1');
    expect(within(enamed).getByTestId('enamed-s1')).toHaveTextContent('3/5');
    expect(within(enamed).getByTestId('enamed-s2')).toHaveTextContent('4/5');
    expect(within(enamed).getAllByTestId(/^enamed-/)).toHaveLength(2);
  });

  it('valor ausente aparece como travessão, nunca como zero (§4.10)', () => {
    render(<KpisDetalhamento metricas={[metrica({ acertoMedioPct: null, proficienciaMedia: null, enamedProjetado: null })]} meta={META} />);

    expect(within(screen.getByTestId('kpi-acerto-medio')).getByTestId('kpi-valor')).toHaveTextContent('—');
    expect(within(screen.getByTestId('kpi-proficiencia-media')).getByTestId('kpi-valor')).toHaveTextContent('—');
    expect(within(screen.getByTestId('kpi-enamed')).getByTestId('kpi-valor')).toHaveTextContent('—');
  });

  it('carrega a rastreabilidade do bloco (§4.1)', () => {
    render(<KpisDetalhamento metricas={[metrica({})]} meta={META} />);

    const rastro = screen.getByTestId('kpis-rastreabilidade');
    expect(rastro).toHaveTextContent('2026.1');
    expect(rastro).toHaveTextContent('Simulados SanarFlix');
    expect(rastro).toHaveTextContent('20/07/2026');
    expect(rastro).toHaveTextContent('Proficiente = proficiência maior ou igual a 60');
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/features/gestor/__tests__/KpisDetalhamento.test.tsx`
Expected: FAIL com `Failed to resolve import "@/features/gestor/components/KpisDetalhamento"`.

- [ ] **Step 7: Write the KPI block**

```tsx
// src/features/gestor/components/KpisDetalhamento.tsx
import { Card, CardContent } from '@/components/ui/card';
import { mediaPonderadaPorParticipantes } from '../lib/agregarDetalhamento';
import { formatConceito, formatData, formatNumero, formatPct } from '../lib/formatters';
import type { Meta, MetricasSimulado } from '../api/types';

export interface KpisDetalhamentoProps {
  metricas: MetricasSimulado[];
  meta: Meta;
}

function CartaoKpi({
  testId,
  rotulo,
  base,
  children,
}: {
  testId: string;
  rotulo: string;
  base: string;
  children: React.ReactNode;
}) {
  return (
    <Card data-testid={testId}>
      <CardContent className="space-y-1 p-4">
        <p className="text-sm font-medium text-muted-foreground">{rotulo}</p>
        {children}
        <p className="text-xs text-muted-foreground">{base}</p>
      </CardContent>
    </Card>
  );
}

function Valor({ children }: { children: React.ReactNode }) {
  return (
    <p data-testid="kpi-valor" className="text-3xl font-semibold tabular-nums text-foreground">
      {children}
    </p>
  );
}

export function KpisDetalhamento({ metricas, meta }: KpisDetalhamentoProps) {
  const multiSimulado = metricas.length > 1;
  const base = `${metricas.length} ${metricas.length === 1 ? 'simulado' : 'simulados'}`;

  const acertoMedio = mediaPonderadaPorParticipantes(
    metricas.map((m) => ({ valor: m.acertoMedioPct, participantes: m.participantes })),
  );
  const proficienciaMedia = mediaPonderadaPorParticipantes(
    metricas.map((m) => ({ valor: m.proficienciaMedia, participantes: m.participantes })),
  );

  return (
    <section aria-label="Indicadores do recorte" className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <CartaoKpi testId="kpi-acerto-medio" rotulo="Percentual de acerto médio" base={base}>
          <Valor>{formatPct(acertoMedio)}</Valor>
        </CartaoKpi>

        {/* §4.1: Conceito ENAMED não tem média. Com 2+ simulados é comparativo lado a lado. */}
        <CartaoKpi
          testId="kpi-enamed"
          rotulo="Conceito ENAMED (projetado)"
          base={multiSimulado ? 'comparativo por simulado — sem média' : base}
        >
          {multiSimulado ? (
            <ul className="flex flex-wrap gap-2">
              {metricas.map((m) => (
                <li
                  key={m.simuladoId}
                  data-testid={`enamed-${m.simuladoId}`}
                  className="rounded-md bg-muted px-2 py-1 text-sm tabular-nums"
                >
                  <span className="text-muted-foreground">{m.nome}: </span>
                  <span className="font-semibold text-foreground">{formatConceito(m.enamedProjetado)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Valor>{formatConceito(metricas[0]?.enamedProjetado ?? null)}</Valor>
          )}
        </CartaoKpi>

        <CartaoKpi testId="kpi-proficiencia-media" rotulo="Proficiência média" base={base}>
          <Valor>
            {proficienciaMedia === null ? formatNumero(null) : formatNumero(Math.round(proficienciaMedia * 10) / 10)}
          </Valor>
        </CartaoKpi>
      </div>

      <p data-testid="kpis-rastreabilidade" className="text-xs text-muted-foreground">
        {meta.periodo} · {meta.fonte} · Atualizado em {formatData(meta.atualizadoEm)} · {meta.criterio}
      </p>
    </section>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/features/gestor/__tests__/KpisDetalhamento.test.tsx`
Expected: PASS — `Tests 6 passed (6)`.

- [ ] **Step 9: Commit**

```bash
git add src/features/gestor/lib/agregarDetalhamento.ts src/features/gestor/components/KpisDetalhamento.tsx src/features/gestor/__tests__/agregarDetalhamento.test.ts src/features/gestor/__tests__/KpisDetalhamento.test.tsx
git commit -m "Gestor v2: 3 KPIs do Detalhamento com media ponderada e ENAMED comparativo"
```

---

### Task 50: Evolução do recorte e a virada para distribuição

**Files:**
- Create: `src/features/gestor/charts/DistribuicaoSemestreChart.tsx`
- Create: `src/features/gestor/components/EvolucaoRecorte.tsx`
- Test: `src/features/gestor/__tests__/EvolucaoRecorte.test.tsx`

**Interfaces:**
- Consumes: `EvolucaoChart` (contrato no preâmbulo); `mediana` de `lib/agregarDetalhamento.ts`; `PROFICIENCIA_MINIMA` de `lib/regras.ts`; `formatNumero`, `formatPct` de `lib/formatters.ts`; `MetricasSimulado`, `FiltroSemestre` de `api/types.ts`; recharts.
- Produces: `EvolucaoRecorte`, `EvolucaoRecorteProps`, `ehSemestreEspecifico(semestre: FiltroSemestre): boolean`; `DistribuicaoSemestreChart`, `DistribuicaoSemestreChartProps`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/gestor/__tests__/EvolucaoRecorte.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@/test/utils';
import { EvolucaoRecorte, ehSemestreEspecifico } from '@/features/gestor/components/EvolucaoRecorte';
import type { MetricasSimulado } from '@/features/gestor/api/types';

const propsEvolucaoChart = vi.fn();
vi.mock('@/features/gestor/charts/EvolucaoChart', () => ({
  EvolucaoChart: (props: unknown) => {
    propsEvolucaoChart(props);
    return <div data-testid="evolucao-chart" />;
  },
}));

const metrica = (over: Partial<MetricasSimulado>): MetricasSimulado => ({
  simuladoId: 's1',
  nome: 'Simulado 1',
  data: '2026-03-10T13:00:00Z',
  participantes: 100,
  acertoMedioPct: 60,
  enamedProjetado: 3,
  proficienciaMedia: 55,
  ...over,
});

const METRICAS = [
  metrica({ simuladoId: 's1', nome: 'Simulado 1', proficienciaMedia: 55 }),
  metrica({ simuladoId: 's2', nome: 'Simulado 2', proficienciaMedia: 62 }),
];

const DISPERSAO = [
  { alunoId: 'a1', semestre: 11, nota: 40 },
  { alunoId: 'a2', semestre: 11, nota: 60 },
  { alunoId: 'a3', semestre: 11, nota: 80 },
  { alunoId: 'a4', semestre: 12, nota: 70 },
];

describe('EvolucaoRecorte', () => {
  it('ehSemestreEspecifico distingue os agregadores dos semestres (§4.5)', () => {
    expect(ehSemestreEspecifico('6ano')).toBe(false);
    expect(ehSemestreEspecifico('geral')).toBe(false);
    expect(ehSemestreEspecifico('11')).toBe(true);
  });

  it('com 6º ano mostra a linha de evolução com a meta de proficiência', () => {
    propsEvolucaoChart.mockClear();
    render(<EvolucaoRecorte metricas={METRICAS} semestre="6ano" dispersao={DISPERSAO} />);

    expect(screen.getByRole('heading', { name: 'Evolução do recorte' })).toBeInTheDocument();
    expect(screen.getByTestId('evolucao-chart')).toBeInTheDocument();
    expect(screen.queryByTestId('distribuicao-semestre')).toBeNull();
    expect(propsEvolucaoChart).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: 60,
        pontos: [
          { rotulo: 'Simulado 1', valor: 55 },
          { rotulo: 'Simulado 2', valor: 62 },
        ],
      }),
    );
  });

  it('oferece alternativa tabular da linha (§11)', () => {
    render(<EvolucaoRecorte metricas={METRICAS} semestre="geral" dispersao={DISPERSAO} />);

    const tabela = screen.getByRole('table', { name: 'Proficiência média por simulado' });
    expect(within(tabela).getByRole('row', { name: /Simulado 2\s+62/ })).toBeInTheDocument();
  });

  it('com um semestre específico vira a distribuição daquele semestre (§4.5, §12 caso 9)', () => {
    render(<EvolucaoRecorte metricas={METRICAS} semestre="11" dispersao={DISPERSAO} />);

    expect(screen.getByRole('heading', { name: 'Distribuição do 11º semestre' })).toBeInTheDocument();
    expect(screen.getByTestId('distribuicao-semestre')).toBeInTheDocument();
    expect(screen.queryByTestId('evolucao-chart')).toBeNull();
    expect(screen.getByTestId('distribuicao-resumo')).toHaveTextContent('3 alunos');
    expect(screen.getByTestId('distribuicao-resumo')).toHaveTextContent('mediana 60');
  });

  it('sem aluno no semestre filtrado mostra vazio, não zero (§4.10)', () => {
    render(<EvolucaoRecorte metricas={METRICAS} semestre="3" dispersao={DISPERSAO} />);

    expect(screen.getByTestId('distribuicao-vazia')).toHaveTextContent('Sem aluno com resultado neste semestre');
    expect(screen.queryByTestId('distribuicao-semestre')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/gestor/__tests__/EvolucaoRecorte.test.tsx`
Expected: FAIL com `Failed to resolve import "@/features/gestor/components/EvolucaoRecorte"`.

- [ ] **Step 3: Write the distribution chart**

```tsx
// src/features/gestor/charts/DistribuicaoSemestreChart.tsx
import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, XAxis, YAxis } from 'recharts';
import { formatNumero } from '../lib/formatters';

export interface DistribuicaoSemestreChartProps {
  notas: number[];
  mediana: number | null;
  ariaLabel: string;
}

/**
 * Jitter determinístico: o mesmo índice sempre cai na mesma coluna, então o
 * gráfico não "dança" a cada render nem depende de Math.random em teste.
 */
function jitter(indice: number): number {
  return 0.5 + (((indice * 37) % 21) - 10) / 40;
}

export function DistribuicaoSemestreChart({ notas, mediana, ariaLabel }: DistribuicaoSemestreChartProps) {
  const pontos = notas.map((nota, indice) => ({ x: jitter(indice), y: nota }));

  return (
    <div data-testid="distribuicao-semestre" role="img" aria-label={ariaLabel} className="h-64 w-full">
      <p data-testid="distribuicao-resumo" className="mb-1 text-xs text-muted-foreground">
        {notas.length} {notas.length === 1 ? 'aluno' : 'alunos'} · mediana {formatNumero(mediana)}
      </p>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <CartesianGrid className="stroke-border" strokeDasharray="3 3" />
          <XAxis type="number" dataKey="x" domain={[0, 1]} tick={false} axisLine={false} />
          <YAxis type="number" dataKey="y" domain={[0, 100]} className="text-xs" width={32} />
          {mediana !== null && (
            <ReferenceLine y={mediana} className="stroke-primary" strokeWidth={2} ifOverflow="extendDomain" />
          )}
          <Scatter data={pontos} className="fill-primary/60" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 4: Write the container**

```tsx
// src/features/gestor/components/EvolucaoRecorte.tsx
import { DistribuicaoSemestreChart } from '../charts/DistribuicaoSemestreChart';
import { EvolucaoChart } from '../charts/EvolucaoChart';
import { mediana } from '../lib/agregarDetalhamento';
import { formatNumero } from '../lib/formatters';
import { PROFICIENCIA_MINIMA } from '../lib/regras';
import type { FiltroSemestre, MetricasSimulado } from '../api/types';

/** '6ano' e 'geral' são agregadores; o resto é um semestre único (§4.5). */
export function ehSemestreEspecifico(semestre: FiltroSemestre): boolean {
  return semestre !== '6ano' && semestre !== 'geral';
}

export interface EvolucaoRecorteProps {
  metricas: MetricasSimulado[];
  semestre: FiltroSemestre;
  dispersao: { alunoId: string; semestre: number; nota: number }[];
}

export function EvolucaoRecorte({ metricas, semestre, dispersao }: EvolucaoRecorteProps) {
  if (ehSemestreEspecifico(semestre)) {
    const alvo = Number(semestre);
    const notas = dispersao.filter((p) => p.semestre === alvo).map((p) => p.nota);

    return (
      <section aria-labelledby="evolucao-recorte-titulo" className="rounded-lg border border-border bg-card p-4">
        <h3 id="evolucao-recorte-titulo" className="mb-2 text-base font-semibold text-foreground">
          Distribuição do {alvo}º semestre
        </h3>
        {notas.length === 0 ? (
          <p data-testid="distribuicao-vazia" className="py-8 text-center text-sm text-muted-foreground">
            Sem aluno com resultado neste semestre
          </p>
        ) : (
          <DistribuicaoSemestreChart
            notas={notas}
            mediana={mediana(notas)}
            ariaLabel={`Distribuição de proficiência dos alunos do ${alvo}º semestre`}
          />
        )}
      </section>
    );
  }

  return (
    <section aria-labelledby="evolucao-recorte-titulo" className="rounded-lg border border-border bg-card p-4">
      <h3 id="evolucao-recorte-titulo" className="mb-2 text-base font-semibold text-foreground">
        Evolução do recorte
      </h3>
      <EvolucaoChart
        pontos={metricas.map((m) => ({ rotulo: m.nome, valor: m.proficienciaMedia }))}
        meta={PROFICIENCIA_MINIMA}
        ariaLabel="Proficiência média por simulado, com a linha de meta em 60"
      />
      <table className="mt-3 w-full text-sm" aria-label="Proficiência média por simulado">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th scope="col" className="py-1 font-medium">
              Simulado
            </th>
            <th scope="col" className="py-1 text-right font-medium">
              Proficiência média
            </th>
          </tr>
        </thead>
        <tbody>
          {metricas.map((m) => (
            <tr key={m.simuladoId} className="border-t border-border">
              <td className="py-1">{m.nome}</td>
              <td className="py-1 text-right tabular-nums">{formatNumero(m.proficienciaMedia)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/features/gestor/__tests__/EvolucaoRecorte.test.tsx`
Expected: PASS — `Tests 5 passed (5)`.

- [ ] **Step 6: Commit**

```bash
git add src/features/gestor/charts/DistribuicaoSemestreChart.tsx src/features/gestor/components/EvolucaoRecorte.tsx src/features/gestor/__tests__/EvolucaoRecorte.test.tsx
git commit -m "Gestor v2: evolucao do recorte com meta e virada para distribuicao em semestre unico"
```

---

### Task 51: AcertoPorAreaESemestre — render dos dois grupos de barras

**Files:**
- Create: `src/features/gestor/components/AcertoPorAreaESemestre.tsx`
- Test: `src/features/gestor/__tests__/AcertoPorAreaESemestre.test.tsx`

**Interfaces:**
- Consumes: `AcertoPorAreaESemestre` (tipo) e `FiltroSemestre` de `api/types.ts`; `formatPct` de `lib/formatters.ts`; `cn` de `@/lib/utils`.
- Produces: componente `AcertoPorAreaESemestre`, `AcertoPorAreaESemestreProps`, `semestresEmEvidencia(semestre: FiltroSemestre, disponiveis: number[]): number[]`.

Nota de nome: o tipo e o componente têm o mesmo nome. No componente o tipo é importado com alias `type AcertoPorAreaESemestreDados`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/gestor/__tests__/AcertoPorAreaESemestre.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@/test/utils';
import {
  AcertoPorAreaESemestre,
  semestresEmEvidencia,
} from '@/features/gestor/components/AcertoPorAreaESemestre';
import type { AcertoPorAreaESemestre as Dados } from '@/features/gestor/api/types';

const DADOS: Dados = {
  areas: [
    { id: 'clinica', nome: 'Clínica Médica', acertoPct: 72, critica: false },
    { id: 'cirurgia', nome: 'Cirurgia', acertoPct: 41, critica: true },
    { id: 'pediatria', nome: 'Pediatria', acertoPct: 58, critica: false },
  ],
  semestres: [
    { semestre: 10, acertoPct: 51, emEvidencia: false },
    { semestre: 11, acertoPct: 63, emEvidencia: true },
    { semestre: 12, acertoPct: 68, emEvidencia: true },
  ],
};

describe('semestresEmEvidencia', () => {
  it('6º ano põe 11 e 12 em evidência (§4.5, §12 caso 10)', () => {
    expect(semestresEmEvidencia('6ano', [9, 10, 11, 12])).toEqual([11, 12]);
  });

  it('geral trata todos igualmente', () => {
    expect(semestresEmEvidencia('geral', [9, 10, 11, 12])).toEqual([9, 10, 11, 12]);
  });

  it('por semestre destaca só o filtrado', () => {
    expect(semestresEmEvidencia('7', [6, 7, 8])).toEqual([7]);
  });
});

describe('AcertoPorAreaESemestre', () => {
  it('renderiza uma barra horizontal por grande área com nome e % no fim', () => {
    render(<AcertoPorAreaESemestre dados={DADOS} semestre="6ano" />);

    const clinica = screen.getByTestId('area-clinica');
    expect(within(clinica).getByText('Clínica Médica')).toBeInTheDocument();
    expect(within(clinica).getByTestId('area-valor')).toHaveTextContent('72%');
    expect(screen.getAllByTestId(/^area-(?!valor)/)).toHaveLength(3);
  });

  it('marca a grande área crítica', () => {
    render(<AcertoPorAreaESemestre dados={DADOS} semestre="6ano" />);
    expect(screen.getByTestId('area-cirurgia')).toHaveAttribute('data-critica', 'true');
    expect(screen.getByTestId('area-clinica')).toHaveAttribute('data-critica', 'false');
  });

  it('renderiza as colunas de semestre no MESMO bloco das áreas', () => {
    render(<AcertoPorAreaESemestre dados={DADOS} semestre="6ano" />);

    const bloco = screen.getByRole('region', { name: 'Acerto por grande área e por semestre' });
    expect(within(bloco).getByTestId('area-clinica')).toBeInTheDocument();
    expect(within(bloco).getByTestId('semestre-11')).toBeInTheDocument();
    expect(within(bloco).getByTestId('semestre-11')).toHaveTextContent('63%');
    expect(within(bloco).getAllByTestId(/^semestre-\d+$/)).toHaveLength(3);
  });

  it('com 6º ano só 11 e 12 ficam em evidência', () => {
    render(<AcertoPorAreaESemestre dados={DADOS} semestre="6ano" />);

    expect(screen.getByTestId('semestre-10')).toHaveAttribute('data-evidencia', 'false');
    expect(screen.getByTestId('semestre-11')).toHaveAttribute('data-evidencia', 'true');
    expect(screen.getByTestId('semestre-12')).toHaveAttribute('data-evidencia', 'true');
  });

  it('com geral todos ficam iguais', () => {
    render(<AcertoPorAreaESemestre dados={DADOS} semestre="geral" />);

    [10, 11, 12].forEach((s) =>
      expect(screen.getByTestId(`semestre-${s}`)).toHaveAttribute('data-evidencia', 'true'),
    );
  });

  it('com filtro num semestre específico só ele fica em evidência e não existe controle próprio "Por semestre"', () => {
    render(<AcertoPorAreaESemestre dados={DADOS} semestre="12" />);

    expect(screen.getByTestId('semestre-12')).toHaveAttribute('data-evidencia', 'true');
    expect(screen.getByTestId('semestre-10')).toHaveAttribute('data-evidencia', 'false');
    expect(screen.getByTestId('semestre-11')).toHaveAttribute('data-evidencia', 'false');
    expect(screen.queryByRole('button', { name: /por semestre/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /por área/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/gestor/__tests__/AcertoPorAreaESemestre.test.tsx`
Expected: FAIL com `Failed to resolve import "@/features/gestor/components/AcertoPorAreaESemestre"`.

- [ ] **Step 3: Write the component**

```tsx
// src/features/gestor/components/AcertoPorAreaESemestre.tsx
import { cn } from '@/lib/utils';
import { formatPct } from '../lib/formatters';
import type { AcertoPorAreaESemestre as AcertoPorAreaESemestreDados, FiltroSemestre } from '../api/types';

/**
 * Evidência derivada do filtro global (§4.5). O campo `emEvidencia` que vem no
 * envelope é o eco do servidor e não é usado para estilo — derivar no cliente
 * garante que a evidência nunca desincronize da URL.
 */
export function semestresEmEvidencia(semestre: FiltroSemestre, disponiveis: number[]): number[] {
  if (semestre === 'geral') return [...disponiveis];
  if (semestre === '6ano') return disponiveis.filter((s) => s === 11 || s === 12);
  const alvo = Number(semestre);
  return disponiveis.filter((s) => s === alvo);
}

export interface AcertoPorAreaESemestreProps {
  dados: AcertoPorAreaESemestreDados;
  semestre: FiltroSemestre;
}

export function AcertoPorAreaESemestre({ dados, semestre }: AcertoPorAreaESemestreProps) {
  const evidentes = semestresEmEvidencia(
    semestre,
    dados.semestres.map((s) => s.semestre),
  );

  return (
    <section
      role="region"
      aria-label="Acerto por grande área e por semestre"
      className="space-y-6 rounded-lg border border-border bg-card p-4"
    >
      <div>
        <h3 className="mb-3 text-base font-semibold text-foreground">Acerto por grande área</h3>
        <ul className="space-y-2">
          {dados.areas.map((area) => (
            <li
              key={area.id}
              data-testid={`area-${area.id}`}
              data-critica={String(area.critica)}
              className="grid grid-cols-[10rem_1fr_3.5rem] items-center gap-3"
            >
              <span className={cn('truncate text-sm', area.critica ? 'text-destructive' : 'text-foreground')}>
                {area.nome}
              </span>
              <span className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <span
                  aria-hidden="true"
                  className={cn(
                    'block h-full rounded-full transition-[width] duration-200',
                    area.critica ? 'bg-destructive' : 'bg-primary',
                  )}
                  style={{ width: `${Math.max(0, Math.min(100, area.acertoPct))}%` }}
                />
              </span>
              <span
                data-testid="area-valor"
                className="text-right text-sm tabular-nums text-foreground transition-opacity duration-200"
              >
                {formatPct(area.acertoPct)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-3 text-base font-semibold text-foreground">Acerto por semestre</h3>
        <ul className="flex items-end gap-3">
          {dados.semestres.map((s) => {
            const emEvidencia = evidentes.includes(s.semestre);
            return (
              <li
                key={s.semestre}
                data-testid={`semestre-${s.semestre}`}
                data-evidencia={String(emEvidencia)}
                className={cn(
                  'flex flex-1 flex-col items-center gap-1 transition-opacity duration-200',
                  emEvidencia ? 'opacity-100' : 'opacity-40',
                )}
              >
                <span className="text-xs tabular-nums text-foreground">{formatPct(s.acertoPct)}</span>
                <span className="flex h-32 w-full items-end rounded-t bg-muted">
                  <span
                    aria-hidden="true"
                    className="block w-full rounded-t bg-primary transition-[height] duration-200"
                    style={{ height: `${Math.max(0, Math.min(100, s.acertoPct))}%` }}
                  />
                </span>
                <span className="text-xs text-muted-foreground">{s.semestre}º</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/gestor/__tests__/AcertoPorAreaESemestre.test.tsx`
Expected: PASS — `Tests 9 passed (9)`.

- [ ] **Step 5: Commit**

```bash
git add src/features/gestor/components/AcertoPorAreaESemestre.tsx src/features/gestor/__tests__/AcertoPorAreaESemestre.test.tsx
git commit -m "Gestor v2: AcertoPorAreaESemestre com barras por area e por semestre e evidencia derivada do filtro"
```

---

### Task 52: AcertoPorAreaESemestre — clique cruzado nos dois sentidos

**Files:**
- Create: `supabase/migrations/20260726120000_get_gestor_detalhamento_extras_fase5.sql`
- Create: `src/features/gestor/api/detalhamentoExtras.ts`
- Modify: `src/features/gestor/lib/agregarDetalhamento.ts`
- Modify: `src/features/gestor/components/AcertoPorAreaESemestre.tsx`
- Test: `src/features/gestor/__tests__/AcertoPorAreaESemestre.recorte.test.tsx`

**Interfaces:**
- Consumes: `AcertoPorAreaESemestre`, `Detalhamento`, `AlunoNoSimulado`, `Paginado` de `api/types.ts`; o componente da Task 51.
- Produces: `CelulaAreaSemestre`, `RecorteCruzado`, `AcertoPorAreaESemestreComMatriz`, `DetalhamentoComExtras` em `api/detalhamentoExtras.ts`; `recalcularAreas`, `recalcularSemestres` em `lib/agregarDetalhamento.ts`; props `matriz`, `recorte`, `onRecorteChange` no componente.

Por que existe uma matriz: o recálculo cruzado precisa ter transição de 200 ms no valor, o que só fecha sem round-trip. `areas[]` e `semestres[]` são listas planas e não permitem cruzar os eixos. A matriz área × semestre é **aditiva** ao payload de `get_gestor_detalhamento` (RPC nova da Fase 1, fora das 19 com guard injetado) e é lida por um módulo próprio da Fase 5, sem alterar `api/types.ts`.

- [ ] **Step 1: Estender o payload de `get_gestor_detalhamento` com os extras da Fase 5**

Dois campos aditivos, aplicados numa migration só: `acertoPorAreaESemestre.matriz` (consumido nesta task) e `alunos` (consumido na Task 53).

Ler o corpo **vivo** da função antes de qualquer coisa — o arquivo `.sql` versionado pode estar defasado e recriar por ele apagaria o guard de feature escrito no corpo:

```sql
select pg_get_functiondef('public.get_gestor_detalhamento(uuid,text,uuid[])'::regprocedure);
```

Conferir os nomes de coluna do ambiente antes de montar os fragmentos:

```sql
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and table_name in ('answer_progress','questoes_simulado','resultados_alunos_tri','users','simulados_admin')
order by table_name, ordinal_position;
```

Esperado (é o que os fragmentos abaixo assumem): `answer_progress(answer_id, correct, question_id, resposta_usuario, simulado, user_id)` — atenção, a coluna é `simulado`, **não** `simulado_id`; `questoes_simulado(id, simulado_id, grande_area, especialidade, tema, anulada, ordem, numero_questao, correta, enunciado, alternativa_a..e)`; `resultados_alunos_tri(student_id, simulado_id, college_id, num_correct, score_proprio, is_proficient_proprio)`; `users(id, nome, id_ies, semestre)`; `simulados_admin(id, nome, created_at, data_liberacao, ...)` mais as colunas novas da Fase 1 (`modalidade`, `data_realizacao`, `data_agendada_original`).

Fragmento 1 — inserir dentro do `jsonb_build_object` que monta `acertoPorAreaESemestre`, ao lado de `'areas'` e `'semestres'`:

```sql
, 'matriz', coalesce((
    select jsonb_agg(m.item order by m.grande_area, m.semestre)
    from (
      select q.grande_area,
             u.semestre,
             jsonb_build_object(
               'areaId',    q.grande_area,
               'semestre',  u.semestre,
               'acertoPct', round(100.0 * avg(case when ap.correct then 1 else 0 end)::numeric, 1),
               'amostra',   count(*)
             ) as item
      from public.answer_progress ap
      join public.questoes_simulado q on q.id = ap.question_id
      join public.users u             on u.id = ap.user_id
      where ap.simulado::uuid = any(p_simulados)
        and u.id_ies = p_ies_id
        and q.anulada = false
        and q.grande_area is not null
        and u.semestre is not null
      group by q.grande_area, u.semestre
    ) m
  ), '[]'::jsonb)
```

Fragmento 2 — inserir no `jsonb_build_object` raiz do retorno, ao lado de `'metricas'`, `'dispersao'` etc.:

```sql
, 'alunos', coalesce((
    with sel as (
      select s.id,
             coalesce(s.data_realizacao, s.data_liberacao, s.created_at) as quando
      from public.simulados_admin s
      where s.id = any(p_simulados)
    ),
    por_aluno as (
      select u.id                                   as aluno_id,
             u.nome,
             u.semestre,
             count(r.simulado_id)                   as participados,
             sum(r.num_correct)                     as acertos,
             avg(r.score_proprio)                   as proficiencia,
             (array_agg(r.score_proprio order by sel.quando asc nulls last)
                filter (where r.student_id is not null))[1]  as prof_primeiro,
             (array_agg(r.score_proprio order by sel.quando desc nulls last)
                filter (where r.student_id is not null))[1]  as prof_atual
      from public.users u
      cross join sel
      left join public.resultados_alunos_tri r
             on r.student_id = u.id
            and r.simulado_id = sel.id
      where u.id_ies = p_ies_id
        and (
          p_semestre = 'geral'
          or (p_semestre = '6ano' and u.semestre = any(array[11,12]))
          or (p_semestre ~ '^[0-9]+$' and u.semestre = p_semestre::int)
        )
      group by u.id, u.nome, u.semestre
    )
    select jsonb_agg(jsonb_build_object(
             'id',           pa.aluno_id,
             'nome',         pa.nome,
             'semestre',     pa.semestre,
             'participou',   pa.participados > 0,
             'acertos',      case when pa.participados > 0 then pa.acertos end,
             'proficiencia', case when pa.participados > 0 then round(pa.proficiencia::numeric, 1) end,
             'situacao',     case
                               when pa.participados = 0 then 'nao_participou'
                               when pa.proficiencia >= 60 then 'proficiente'
                               else 'abaixo_do_limiar'
                             end,
             -- §4.7.4 + §12 caso 8: variação só existe para quem participou de TODOS.
             'variacao',     case
                               when array_length(p_simulados, 1) > 1
                                    and pa.participados = array_length(p_simulados, 1)
                               then round((pa.prof_atual - pa.prof_primeiro)::numeric, 1)
                             end
           ) order by pa.nome)
    from por_aluno pa
  ), '[]'::jsonb)
```

Aplicar via MCP do Supabase com o project ref **gvqv** (`gvqvrmkizemwsasmupmo`) **confirmado** — o MCP da sessão pode estar apontando para `lljn`; conferir com `get_project_url` antes de qualquer `apply_migration`. Alternativa: `send_message` ao agente do Lovable com o mesmo SQL. O `CREATE OR REPLACE FUNCTION` deve ser montado a partir do corpo devolvido por `pg_get_functiondef` no passo anterior, com os dois fragmentos inseridos — nunca a partir do `.sql` versionado.

Verificação pós-aplicação:

```sql
-- 1) O guard de feature continua no corpo
select position('feature_not_enabled' in pg_get_functiondef(
  'public.get_gestor_detalhamento(uuid,text,uuid[])'::regprocedure)) > 0 as guard_presente;
-- Esperado: guard_presente = true

-- 2) Os extras chegam no payload (trocar pelos uuids reais de uma IES com simulado)
select jsonb_typeof(r.data -> 'acertoPorAreaESemestre' -> 'matriz')  as tipo_matriz,
       jsonb_array_length(r.data -> 'acertoPorAreaESemestre' -> 'matriz') as celulas,
       jsonb_typeof(r.data -> 'alunos')                              as tipo_alunos
from public.get_gestor_detalhamento('<ies_uuid>', '6ano', array['<simulado_uuid>']::uuid[]) r;
-- Esperado: tipo_matriz = 'array', celulas > 0, tipo_alunos = 'array'
```

Salvar o SQL completo aplicado em `supabase/migrations/20260726120000_get_gestor_detalhamento_extras_fase5.sql`. Não regerar `src/integrations/supabase/types.ts`: só o corpo de uma função mudou, nenhuma tabela ou coluna.

```bash
git add supabase/migrations/20260726120000_get_gestor_detalhamento_extras_fase5.sql
git commit -m "Gestor v2: get_gestor_detalhamento passa a devolver matriz area x semestre e alunos do recorte"
```

- [ ] **Step 2: Write the failing test**

```tsx
// src/features/gestor/__tests__/AcertoPorAreaESemestre.recorte.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, userEvent } from '@/test/utils';
import { AcertoPorAreaESemestre } from '@/features/gestor/components/AcertoPorAreaESemestre';
import { recalcularAreas, recalcularSemestres } from '@/features/gestor/lib/agregarDetalhamento';
import type { CelulaAreaSemestre } from '@/features/gestor/api/detalhamentoExtras';
import type { AcertoPorAreaESemestre as Dados } from '@/features/gestor/api/types';

const DADOS: Dados = {
  areas: [
    { id: 'clinica', nome: 'Clínica Médica', acertoPct: 72, critica: false },
    { id: 'cirurgia', nome: 'Cirurgia', acertoPct: 41, critica: true },
  ],
  semestres: [
    { semestre: 11, acertoPct: 63, emEvidencia: true },
    { semestre: 12, acertoPct: 68, emEvidencia: true },
  ],
};

const MATRIZ: CelulaAreaSemestre[] = [
  { areaId: 'clinica', semestre: 11, acertoPct: 66, amostra: 120 },
  { areaId: 'clinica', semestre: 12, acertoPct: 78, amostra: 110 },
  { areaId: 'cirurgia', semestre: 11, acertoPct: 35, amostra: 118 },
  { areaId: 'cirurgia', semestre: 12, acertoPct: 47, amostra: 109 },
];

describe('recalculo cruzado (funções puras)', () => {
  it('recalcularAreas devolve as áreas do semestre pedido, preservando nome e criticidade', () => {
    expect(recalcularAreas(DADOS.areas, MATRIZ, 11)).toEqual([
      { id: 'clinica', nome: 'Clínica Médica', acertoPct: 66, critica: false },
      { id: 'cirurgia', nome: 'Cirurgia', acertoPct: 35, critica: true },
    ]);
  });

  it('recalcularSemestres devolve os semestres da área pedida', () => {
    expect(recalcularSemestres(DADOS.semestres, MATRIZ, 'cirurgia')).toEqual([
      { semestre: 11, acertoPct: 35, emEvidencia: true },
      { semestre: 12, acertoPct: 47, emEvidencia: true },
    ]);
  });

  it('célula com acertoPct null sai do recorte em vez de virar zero (§4.10)', () => {
    const matriz: CelulaAreaSemestre[] = [
      { areaId: 'clinica', semestre: 11, acertoPct: null, amostra: 0 },
      { areaId: 'cirurgia', semestre: 11, acertoPct: 35, amostra: 118 },
    ];
    expect(recalcularAreas(DADOS.areas, matriz, 11)).toEqual([
      { id: 'cirurgia', nome: 'Cirurgia', acertoPct: 35, critica: true },
    ]);
  });
});

describe('AcertoPorAreaESemestre — clique cruzado (§12 caso 11)', () => {
  it('clicar num semestre recalcula as áreas para aquele semestre', async () => {
    const user = userEvent.setup();
    const onRecorteChange = vi.fn();
    const { rerender } = render(
      <AcertoPorAreaESemestre dados={DADOS} semestre="6ano" matriz={MATRIZ} recorte={null} onRecorteChange={onRecorteChange} />,
    );

    await user.click(screen.getByRole('button', { name: /12º semestre/i }));
    expect(onRecorteChange).toHaveBeenCalledWith({ tipo: 'semestre', id: '12' });

    rerender(
      <AcertoPorAreaESemestre
        dados={DADOS}
        semestre="6ano"
        matriz={MATRIZ}
        recorte={{ tipo: 'semestre', id: '12' }}
        onRecorteChange={onRecorteChange}
      />,
    );

    expect(screen.getByTestId('area-clinica')).toHaveTextContent('78%');
    expect(screen.getByTestId('area-cirurgia')).toHaveTextContent('47%');
    expect(screen.getByTestId('semestre-12')).toHaveAttribute('data-recorte', 'ativo');
    expect(screen.getByTestId('recorte-ativo')).toHaveTextContent('12º semestre');
  });

  it('clicar numa área recalcula os semestres para aquela área', async () => {
    const user = userEvent.setup();
    const onRecorteChange = vi.fn();
    const { rerender } = render(
      <AcertoPorAreaESemestre dados={DADOS} semestre="6ano" matriz={MATRIZ} recorte={null} onRecorteChange={onRecorteChange} />,
    );

    await user.click(screen.getByRole('button', { name: /Cirurgia/ }));
    expect(onRecorteChange).toHaveBeenCalledWith({ tipo: 'area', id: 'cirurgia' });

    rerender(
      <AcertoPorAreaESemestre
        dados={DADOS}
        semestre="6ano"
        matriz={MATRIZ}
        recorte={{ tipo: 'area', id: 'cirurgia' }}
        onRecorteChange={onRecorteChange}
      />,
    );

    expect(screen.getByTestId('semestre-11')).toHaveTextContent('35%');
    expect(screen.getByTestId('semestre-12')).toHaveTextContent('47%');
    expect(screen.getByTestId('area-cirurgia')).toHaveAttribute('data-recorte', 'ativo');
  });

  it('segundo clique no mesmo item limpa o recorte', async () => {
    const user = userEvent.setup();
    const onRecorteChange = vi.fn();
    render(
      <AcertoPorAreaESemestre
        dados={DADOS}
        semestre="6ano"
        matriz={MATRIZ}
        recorte={{ tipo: 'semestre', id: '12' }}
        onRecorteChange={onRecorteChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: /12º semestre/i }));
    expect(onRecorteChange).toHaveBeenCalledWith(null);
  });

  it('sem matriz o cruzamento fica desabilitado e a tela segue utilizável', () => {
    render(<AcertoPorAreaESemestre dados={DADOS} semestre="6ano" recorte={null} onRecorteChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Cirurgia/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /12º semestre/i })).toHaveAttribute(
      'title',
      'Recorte cruzado indisponível para esta seleção',
    );
    expect(screen.getByTestId('area-clinica')).toHaveTextContent('72%');
  });

  it('sem os callbacks o bloco continua sendo só leitura (Task 51 intacta)', () => {
    render(<AcertoPorAreaESemestre dados={DADOS} semestre="6ano" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByTestId('area-clinica')).toHaveTextContent('72%');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/features/gestor/__tests__/AcertoPorAreaESemestre.recorte.test.tsx`
Expected: FAIL com `Failed to resolve import "@/features/gestor/api/detalhamentoExtras"`.

- [ ] **Step 4: Write the extras module**

```ts
// src/features/gestor/api/detalhamentoExtras.ts
import type { AcertoPorAreaESemestre, AlunoNoSimulado, Detalhamento } from './types';

/**
 * Célula da matriz área × semestre. Campo aditivo do payload de
 * `get_gestor_detalhamento` (migration 20260726120000). Existe porque o
 * recorte cruzado da tela de Detalhamento tem transição de 200 ms no valor —
 * o que só fecha recalculando no cliente, sem round-trip.
 */
export interface CelulaAreaSemestre {
  areaId: string;
  semestre: number;
  acertoPct: number | null;
  amostra: number;
}

/** Recorte cruzado ativo. Mesma forma do campo `recorte` do envelope. */
export type RecorteCruzado = NonNullable<AcertoPorAreaESemestre['recorte']>;

export type AcertoPorAreaESemestreComMatriz = AcertoPorAreaESemestre & {
  matriz?: CelulaAreaSemestre[];
};

export type DetalhamentoComExtras = Detalhamento & {
  acertoPorAreaESemestre: AcertoPorAreaESemestreComMatriz;
  /** Todos os alunos do recorte, sem paginação — a tabela pagina no cliente. */
  alunos?: AlunoNoSimulado[];
};
```

- [ ] **Step 5: Add the pure recalculation functions**

Acrescentar ao fim de `src/features/gestor/lib/agregarDetalhamento.ts`:

```ts
import type { CelulaAreaSemestre } from '../api/detalhamentoExtras';

type Area = { id: string; nome: string; acertoPct: number; critica: boolean };
type Semestre = { semestre: number; acertoPct: number; emEvidencia: boolean };

/** Áreas recalculadas para um semestre. Célula sem valor sai do recorte (§4.10). */
export function recalcularAreas(areas: Area[], matriz: CelulaAreaSemestre[], semestre: number): Area[] {
  return areas.flatMap((area) => {
    const celula = matriz.find((c) => c.areaId === area.id && c.semestre === semestre);
    if (!celula || celula.acertoPct === null) return [];
    return [{ ...area, acertoPct: celula.acertoPct }];
  });
}

/** Semestres recalculados para uma grande área. Célula sem valor sai do recorte (§4.10). */
export function recalcularSemestres(
  semestres: Semestre[],
  matriz: CelulaAreaSemestre[],
  areaId: string,
): Semestre[] {
  return semestres.flatMap((s) => {
    const celula = matriz.find((c) => c.areaId === areaId && c.semestre === s.semestre);
    if (!celula || celula.acertoPct === null) return [];
    return [{ ...s, acertoPct: celula.acertoPct }];
  });
}
```

- [ ] **Step 6: Make the component interactive**

Substituir `src/features/gestor/components/AcertoPorAreaESemestre.tsx` pela versão abaixo. `semestresEmEvidencia` fica idêntica; o que muda é que cada barra passa a ser um `button` quando há `onRecorteChange`, e as listas exibidas passam pelo recálculo.

```tsx
// src/features/gestor/components/AcertoPorAreaESemestre.tsx
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { recalcularAreas, recalcularSemestres } from '../lib/agregarDetalhamento';
import { formatPct } from '../lib/formatters';
import type { CelulaAreaSemestre, RecorteCruzado } from '../api/detalhamentoExtras';
import type { AcertoPorAreaESemestre as AcertoPorAreaESemestreDados, FiltroSemestre } from '../api/types';

/**
 * Evidência derivada do filtro global (§4.5). O campo `emEvidencia` que vem no
 * envelope é o eco do servidor e não é usado para estilo — derivar no cliente
 * garante que a evidência nunca desincronize da URL.
 */
export function semestresEmEvidencia(semestre: FiltroSemestre, disponiveis: number[]): number[] {
  if (semestre === 'geral') return [...disponiveis];
  if (semestre === '6ano') return disponiveis.filter((s) => s === 11 || s === 12);
  const alvo = Number(semestre);
  return disponiveis.filter((s) => s === alvo);
}

export interface AcertoPorAreaESemestreProps {
  dados: AcertoPorAreaESemestreDados;
  semestre: FiltroSemestre;
  matriz?: CelulaAreaSemestre[];
  recorte?: RecorteCruzado | null;
  onRecorteChange?: (recorte: RecorteCruzado | null) => void;
}

const MOTIVO_SEM_MATRIZ = 'Recorte cruzado indisponível para esta seleção';

export function AcertoPorAreaESemestre({
  dados,
  semestre,
  matriz,
  recorte = null,
  onRecorteChange,
}: AcertoPorAreaESemestreProps) {
  const interativo = typeof onRecorteChange === 'function';
  const cruzamentoDisponivel = Boolean(matriz && matriz.length > 0);

  const areas =
    cruzamentoDisponivel && recorte?.tipo === 'semestre'
      ? recalcularAreas(dados.areas, matriz ?? [], Number(recorte.id))
      : dados.areas;

  const semestres =
    cruzamentoDisponivel && recorte?.tipo === 'area'
      ? recalcularSemestres(dados.semestres, matriz ?? [], recorte.id)
      : dados.semestres;

  const evidentes = semestresEmEvidencia(
    semestre,
    semestres.map((s) => s.semestre),
  );

  const alternar = (proximo: RecorteCruzado) => {
    if (!onRecorteChange) return;
    const igual = recorte?.tipo === proximo.tipo && recorte.id === proximo.id;
    onRecorteChange(igual ? null : proximo);
  };

  const rotuloRecorte =
    recorte === null
      ? null
      : recorte.tipo === 'semestre'
        ? `${recorte.id}º semestre`
        : (dados.areas.find((a) => a.id === recorte.id)?.nome ?? recorte.id);

  return (
    <section
      role="region"
      aria-label="Acerto por grande área e por semestre"
      className="space-y-6 rounded-lg border border-border bg-card p-4"
    >
      {rotuloRecorte && (
        <p data-testid="recorte-ativo" className="flex items-center gap-2 text-sm text-muted-foreground">
          Recorte: <strong className="text-foreground">{rotuloRecorte}</strong>
          <button
            type="button"
            onClick={() => onRecorteChange?.(null)}
            className="inline-flex items-center gap-1 rounded px-1 text-xs underline"
          >
            <X className="h-3 w-3" aria-hidden="true" />
            limpar recorte
          </button>
        </p>
      )}

      <div>
        <h3 className="mb-3 text-base font-semibold text-foreground">Acerto por grande área</h3>
        {areas.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Sem dado de grande área neste recorte</p>
        ) : (
          <ul className="space-y-2">
            {areas.map((area) => {
              const ativo = recorte?.tipo === 'area' && recorte.id === area.id;
              const linha = (
                <>
                  <span className={cn('truncate text-left text-sm', area.critica ? 'text-destructive' : 'text-foreground')}>
                    {area.nome}
                  </span>
                  <span className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <span
                      aria-hidden="true"
                      className={cn(
                        'block h-full rounded-full transition-[width] duration-200',
                        area.critica ? 'bg-destructive' : 'bg-primary',
                      )}
                      style={{ width: `${Math.max(0, Math.min(100, area.acertoPct))}%` }}
                    />
                  </span>
                  <span
                    data-testid="area-valor"
                    className="text-right text-sm tabular-nums text-foreground transition-opacity duration-200"
                  >
                    {formatPct(area.acertoPct)}
                  </span>
                </>
              );

              return (
                <li
                  key={area.id}
                  data-testid={`area-${area.id}`}
                  data-critica={String(area.critica)}
                  data-recorte={ativo ? 'ativo' : 'inativo'}
                  className={cn('rounded', ativo && 'bg-primary/5 ring-1 ring-primary/30')}
                >
                  {interativo ? (
                    <button
                      type="button"
                      disabled={!cruzamentoDisponivel}
                      title={cruzamentoDisponivel ? undefined : MOTIVO_SEM_MATRIZ}
                      aria-pressed={ativo}
                      onClick={() => alternar({ tipo: 'area', id: area.id })}
                      className="grid w-full grid-cols-[10rem_1fr_3.5rem] items-center gap-3 px-1 py-1 disabled:cursor-default"
                    >
                      {linha}
                    </button>
                  ) : (
                    <div className="grid grid-cols-[10rem_1fr_3.5rem] items-center gap-3 px-1 py-1">{linha}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-base font-semibold text-foreground">Acerto por semestre</h3>
        {semestres.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Sem dado de semestre neste recorte</p>
        ) : (
          <ul className="flex items-end gap-3">
            {semestres.map((s) => {
              const emEvidencia = evidentes.includes(s.semestre);
              const ativo = recorte?.tipo === 'semestre' && recorte.id === String(s.semestre);
              const coluna = (
                <>
                  <span className="text-xs tabular-nums text-foreground transition-opacity duration-200">
                    {formatPct(s.acertoPct)}
                  </span>
                  <span className="flex h-32 w-full items-end rounded-t bg-muted">
                    <span
                      aria-hidden="true"
                      className="block w-full rounded-t bg-primary transition-[height] duration-200"
                      style={{ height: `${Math.max(0, Math.min(100, s.acertoPct))}%` }}
                    />
                  </span>
                  <span className="text-xs text-muted-foreground">{s.semestre}º semestre</span>
                </>
              );

              return (
                <li
                  key={s.semestre}
                  data-testid={`semestre-${s.semestre}`}
                  data-evidencia={String(emEvidencia)}
                  data-recorte={ativo ? 'ativo' : 'inativo'}
                  className={cn(
                    'flex flex-1 transition-opacity duration-200',
                    emEvidencia ? 'opacity-100' : 'opacity-40',
                    ativo && 'rounded bg-primary/5 ring-1 ring-primary/30',
                  )}
                >
                  {interativo ? (
                    <button
                      type="button"
                      disabled={!cruzamentoDisponivel}
                      title={cruzamentoDisponivel ? undefined : MOTIVO_SEM_MATRIZ}
                      aria-pressed={ativo}
                      onClick={() => alternar({ tipo: 'semestre', id: String(s.semestre) })}
                      className="flex w-full flex-col items-center gap-1 disabled:cursor-default"
                    >
                      {coluna}
                    </button>
                  ) : (
                    <div className="flex w-full flex-col items-center gap-1">{coluna}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 7: Run both test files to verify they pass**

Run: `npx vitest run src/features/gestor/__tests__/AcertoPorAreaESemestre.test.tsx src/features/gestor/__tests__/AcertoPorAreaESemestre.recorte.test.tsx src/features/gestor/__tests__/agregarDetalhamento.test.ts`
Expected: PASS nos três arquivos — `Tests 25 passed (25)`. A Task 51 continua verde porque sem `onRecorteChange` o bloco é só leitura.

- [ ] **Step 8: Commit**

```bash
git add src/features/gestor/api/detalhamentoExtras.ts src/features/gestor/lib/agregarDetalhamento.ts src/features/gestor/components/AcertoPorAreaESemestre.tsx src/features/gestor/__tests__/AcertoPorAreaESemestre.recorte.test.tsx
git commit -m "Gestor v2: clique cruzado area x semestre com recalculo no cliente e segundo clique limpando"
```

---

### Task 53: TabelaAlunosSimulado

**Files:**
- Create: `src/features/gestor/components/TabelaAlunosSimulado.tsx`
- Test: `src/features/gestor/__tests__/TabelaAlunosSimulado.test.tsx`

**Interfaces:**
- Consumes: `AlunoNoSimulado` de `api/types.ts`; `formatDelta`, `formatNumero`, `TRACO` de `lib/formatters.ts`; `Table*` de `@/components/ui/table`, `Badge`, `Button`, `Switch`, `Label`; `ArrowDown`/`ArrowUp` de lucide.
- Produces: `TabelaAlunosSimulado`, `TabelaAlunosSimuladoProps`, `ColunaOrdenavel`, `ordenarAlunosNoSimulado(alunos, coluna, ordem)`.

Ordenação e página são estado local (§8.2 trata só o compartilhável como estado de URL, e `useFiltrosGestor` é congelado em `semestre`/`simulados`/`ies`).

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/gestor/__tests__/TabelaAlunosSimulado.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, userEvent } from '@/test/utils';
import {
  TabelaAlunosSimulado,
  ordenarAlunosNoSimulado,
} from '@/features/gestor/components/TabelaAlunosSimulado';
import type { AlunoNoSimulado } from '@/features/gestor/api/types';

const aluno = (over: Partial<AlunoNoSimulado>): AlunoNoSimulado => ({
  id: 'a1',
  nome: 'Ana',
  semestre: 11,
  participou: true,
  acertos: 60,
  proficiencia: 72,
  situacao: 'proficiente',
  ...over,
});

const TRES: AlunoNoSimulado[] = [
  aluno({ id: 'a1', nome: 'Ana', acertos: 60, proficiencia: 72, situacao: 'proficiente' }),
  aluno({ id: 'a2', nome: 'Bruno', acertos: 40, proficiencia: 55, situacao: 'abaixo_do_limiar' }),
  aluno({
    id: 'a3',
    nome: 'Carla',
    participou: false,
    acertos: null,
    proficiencia: null,
    situacao: 'nao_participou',
  }),
];

const nomesNaOrdem = () =>
  screen
    .getAllByTestId(/^linha-aluno-/)
    .map((linha) => within(linha).getByTestId('celula-nome').textContent);

describe('ordenarAlunosNoSimulado', () => {
  it('ordena por proficiência decrescente com nulos sempre no fim (§4.10)', () => {
    const ordenado = ordenarAlunosNoSimulado(TRES, 'proficiencia', 'desc');
    expect(ordenado.map((a) => a.id)).toEqual(['a1', 'a2', 'a3']);
  });

  it('mantém os nulos no fim também na ordem crescente', () => {
    const ordenado = ordenarAlunosNoSimulado(TRES, 'proficiencia', 'asc');
    expect(ordenado.map((a) => a.id)).toEqual(['a2', 'a1', 'a3']);
  });

  it('ordena por número de acertos', () => {
    expect(ordenarAlunosNoSimulado(TRES, 'acertos', 'desc').map((a) => a.id)).toEqual(['a1', 'a2', 'a3']);
  });
});

describe('TabelaAlunosSimulado', () => {
  it('mostra as 5 colunas do simulado único e nenhuma coluna "Nota TRI" (§4.1, §12 caso 2)', () => {
    render(<TabelaAlunosSimulado alunos={TRES} multiSimulado={false} />);

    const cabecalhos = screen.getAllByRole('columnheader').map((c) => c.textContent);
    expect(cabecalhos).toEqual(['Aluno', 'Semestre', 'Número de acertos', 'Proficiência', 'Situação']);
    expect(screen.queryByText(/nota tri/i)).toBeNull();
  });

  it('aluno que não participou aparece com travessão e badge, nunca com zero (§12 caso 7)', () => {
    render(<TabelaAlunosSimulado alunos={TRES} multiSimulado={false} />);

    const carla = screen.getByTestId('linha-aluno-a3');
    expect(within(carla).getByTestId('celula-acertos')).toHaveTextContent('—');
    expect(within(carla).getByTestId('celula-proficiencia')).toHaveTextContent('—');
    expect(within(carla).getByText('Não participou')).toBeInTheDocument();
  });

  it('ordena por qualquer coluna numérica ao clicar no cabeçalho', async () => {
    const user = userEvent.setup();
    render(<TabelaAlunosSimulado alunos={TRES} multiSimulado={false} />);

    await user.click(screen.getByRole('button', { name: /Proficiência/ }));
    expect(nomesNaOrdem()).toEqual(['Ana', 'Bruno', 'Carla']);
    expect(screen.getByRole('columnheader', { name: /Proficiência/ })).toHaveAttribute('aria-sort', 'descending');

    await user.click(screen.getByRole('button', { name: /Proficiência/ }));
    expect(nomesNaOrdem()).toEqual(['Bruno', 'Ana', 'Carla']);
    expect(screen.getByRole('columnheader', { name: /Proficiência/ })).toHaveAttribute('aria-sort', 'ascending');
  });

  it('oculta não participantes sob demanda', async () => {
    const user = userEvent.setup();
    render(<TabelaAlunosSimulado alunos={TRES} multiSimulado={false} />);

    expect(screen.getAllByTestId(/^linha-aluno-/)).toHaveLength(3);
    await user.click(screen.getByRole('switch', { name: /ocultar não participantes/i }));
    expect(screen.getAllByTestId(/^linha-aluno-/)).toHaveLength(2);
    expect(screen.queryByTestId('linha-aluno-a3')).toBeNull();
  });

  it('pagina no cliente', async () => {
    const user = userEvent.setup();
    const muitos = Array.from({ length: 25 }, (_, i) =>
      aluno({ id: `a${i}`, nome: `Aluno ${String(i).padStart(2, '0')}`, acertos: 100 - i, proficiencia: 90 - i }),
    );
    render(<TabelaAlunosSimulado alunos={muitos} multiSimulado={false} pageSize={20} />);

    expect(screen.getAllByTestId(/^linha-aluno-/)).toHaveLength(20);
    expect(screen.getByTestId('paginacao')).toHaveTextContent('Página 1 de 2');

    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    expect(screen.getAllByTestId(/^linha-aluno-/)).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled();
  });

  it('marca a linha selecionada com tint e barra de marca, e avisa o pai', async () => {
    const user = userEvent.setup();
    const onSelecionarAluno = vi.fn();
    const { rerender } = render(
      <TabelaAlunosSimulado alunos={TRES} multiSimulado={false} onSelecionarAluno={onSelecionarAluno} />,
    );

    await user.click(screen.getByRole('button', { name: 'Bruno' }));
    expect(onSelecionarAluno).toHaveBeenCalledWith('a2');

    rerender(
      <TabelaAlunosSimulado
        alunos={TRES}
        multiSimulado={false}
        alunoSelecionadoId="a2"
        onSelecionarAluno={onSelecionarAluno}
      />,
    );

    const bruno = screen.getByTestId('linha-aluno-a2');
    expect(bruno).toHaveAttribute('data-selecionado', 'true');
    expect(bruno.className).toContain('bg-primary/5');
    expect(within(bruno).getByTestId('marca-selecao')).toBeInTheDocument();
    expect(screen.getByTestId('linha-aluno-a1')).toHaveAttribute('data-selecionado', 'false');
  });

  it('com 2+ simulados ganha a coluna Variação, só preenchida para quem participou de todos (§12 caso 8)', () => {
    render(
      <TabelaAlunosSimulado
        multiSimulado
        alunos={[
          aluno({ id: 'a1', nome: 'Ana', variacao: 7 }),
          aluno({ id: 'a2', nome: 'Bruno', variacao: -3 }),
          aluno({ id: 'a4', nome: 'Diego', variacao: null }),
        ]}
      />,
    );

    const cabecalhos = screen.getAllByRole('columnheader').map((c) => c.textContent);
    expect(cabecalhos).toEqual(['Aluno', 'Semestre', 'Número de acertos', 'Proficiência', 'Situação', 'Variação']);
    expect(within(screen.getByTestId('linha-aluno-a1')).getByTestId('celula-variacao')).toHaveTextContent('+7');
    expect(within(screen.getByTestId('linha-aluno-a2')).getByTestId('celula-variacao')).toHaveTextContent('-3');
    expect(within(screen.getByTestId('linha-aluno-a4')).getByTestId('celula-variacao')).toHaveTextContent('—');
  });

  it('com 1 simulado a coluna Variação não existe', () => {
    render(<TabelaAlunosSimulado alunos={TRES} multiSimulado={false} />);
    expect(screen.queryByText('Variação')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/gestor/__tests__/TabelaAlunosSimulado.test.tsx`
Expected: FAIL com `Failed to resolve import "@/features/gestor/components/TabelaAlunosSimulado"`.

- [ ] **Step 3: Write the implementation**

```tsx
// src/features/gestor/components/TabelaAlunosSimulado.tsx
import * as React from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatDelta, formatNumero } from '../lib/formatters';
import type { AlunoNoSimulado } from '../api/types';

export type ColunaOrdenavel = 'semestre' | 'acertos' | 'proficiencia' | 'variacao';
type Ordem = 'asc' | 'desc';

const SITUACAO_ROTULO: Record<AlunoNoSimulado['situacao'], string> = {
  proficiente: 'Proficiente',
  abaixo_do_limiar: 'Abaixo do limiar',
  nao_participou: 'Não participou',
};

function valorDaColuna(aluno: AlunoNoSimulado, coluna: ColunaOrdenavel): number | null {
  if (coluna === 'semestre') return aluno.semestre;
  if (coluna === 'acertos') return aluno.acertos;
  if (coluna === 'proficiencia') return aluno.proficiencia;
  return aluno.variacao ?? null;
}

/** Ordena por coluna numérica com nulos **sempre** no fim, nas duas direções (§4.10). */
export function ordenarAlunosNoSimulado(
  alunos: AlunoNoSimulado[],
  coluna: ColunaOrdenavel,
  ordem: Ordem,
): AlunoNoSimulado[] {
  return [...alunos].sort((a, b) => {
    const va = valorDaColuna(a, coluna);
    const vb = valorDaColuna(b, coluna);
    if (va === null && vb === null) return a.nome.localeCompare(b.nome, 'pt-BR');
    if (va === null) return 1;
    if (vb === null) return -1;
    return ordem === 'desc' ? vb - va : va - vb;
  });
}

export interface TabelaAlunosSimuladoProps {
  alunos: AlunoNoSimulado[];
  multiSimulado: boolean;
  pageSize?: number;
  alunoSelecionadoId?: string | null;
  onSelecionarAluno?: (id: string) => void;
}

export function TabelaAlunosSimulado({
  alunos,
  multiSimulado,
  pageSize = 20,
  alunoSelecionadoId = null,
  onSelecionarAluno,
}: TabelaAlunosSimuladoProps) {
  const [ordenacao, setOrdenacao] = React.useState<{ coluna: ColunaOrdenavel; ordem: Ordem } | null>(null);
  const [ocultarNaoParticipantes, setOcultarNaoParticipantes] = React.useState(false);
  const [page, setPage] = React.useState(1);

  const visiveis = React.useMemo(() => {
    const filtrados = ocultarNaoParticipantes ? alunos.filter((a) => a.participou) : alunos;
    return ordenacao ? ordenarAlunosNoSimulado(filtrados, ordenacao.coluna, ordenacao.ordem) : filtrados;
  }, [alunos, ocultarNaoParticipantes, ordenacao]);

  const totalPages = Math.max(1, Math.ceil(visiveis.length / pageSize));
  const pageAtual = Math.min(page, totalPages);
  const daPagina = visiveis.slice((pageAtual - 1) * pageSize, pageAtual * pageSize);

  const alternarOrdenacao = (coluna: ColunaOrdenavel) => {
    setPage(1);
    setOrdenacao((atual) =>
      atual?.coluna === coluna ? { coluna, ordem: atual.ordem === 'desc' ? 'asc' : 'desc' } : { coluna, ordem: 'desc' },
    );
  };

  const ariaSort = (coluna: ColunaOrdenavel) => {
    if (ordenacao?.coluna !== coluna) return 'none' as const;
    return ordenacao.ordem === 'desc' ? ('descending' as const) : ('ascending' as const);
  };

  const CabecalhoOrdenavel = ({ coluna, rotulo }: { coluna: ColunaOrdenavel; rotulo: string }) => (
    <TableHead aria-sort={ariaSort(coluna)} className="text-right">
      <button
        type="button"
        onClick={() => alternarOrdenacao(coluna)}
        className="inline-flex w-full items-center justify-end gap-1"
      >
        {rotulo}
        {ordenacao?.coluna === coluna &&
          (ordenacao.ordem === 'desc' ? (
            <ArrowDown className="h-3 w-3" aria-hidden="true" />
          ) : (
            <ArrowUp className="h-3 w-3" aria-hidden="true" />
          ))}
      </button>
    </TableHead>
  );

  return (
    <section aria-label="Visão de alunos do recorte" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-foreground">Visão de alunos</h3>
        <div className="flex items-center gap-2">
          <Switch
            id="ocultar-nao-participantes"
            checked={ocultarNaoParticipantes}
            onCheckedChange={(v) => {
              setOcultarNaoParticipantes(v);
              setPage(1);
            }}
          />
          <Label htmlFor="ocultar-nao-participantes" className="text-sm">
            Ocultar não participantes
          </Label>
        </div>
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Aluno</TableHead>
              <CabecalhoOrdenavel coluna="semestre" rotulo="Semestre" />
              <CabecalhoOrdenavel coluna="acertos" rotulo="Número de acertos" />
              <CabecalhoOrdenavel coluna="proficiencia" rotulo="Proficiência" />
              <TableHead>Situação</TableHead>
              {multiSimulado && <CabecalhoOrdenavel coluna="variacao" rotulo="Variação" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {daPagina.map((a) => {
              const selecionado = a.id === alunoSelecionadoId;
              return (
                <TableRow
                  key={a.id}
                  data-testid={`linha-aluno-${a.id}`}
                  data-selecionado={String(selecionado)}
                  className={cn(selecionado && 'bg-primary/5')}
                >
                  <TableCell className="relative">
                    {selecionado && (
                      <span
                        data-testid="marca-selecao"
                        aria-hidden="true"
                        className="absolute left-0 top-0 h-full w-0.5 bg-primary"
                      />
                    )}
                    <span data-testid="celula-nome">
                      {onSelecionarAluno ? (
                        <button type="button" onClick={() => onSelecionarAluno(a.id)} className="underline">
                          {a.nome}
                        </button>
                      ) : (
                        a.nome
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{a.semestre}º</TableCell>
                  <TableCell data-testid="celula-acertos" className="text-right tabular-nums">
                    {formatNumero(a.acertos)}
                  </TableCell>
                  <TableCell data-testid="celula-proficiencia" className="text-right tabular-nums">
                    {formatNumero(a.proficiencia)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={a.participou ? 'secondary' : 'outline'}>{SITUACAO_ROTULO[a.situacao]}</Badge>
                  </TableCell>
                  {multiSimulado && (
                    <TableCell data-testid="celula-variacao" className="text-right tabular-nums">
                      {formatDelta(a.variacao ?? null)}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div data-testid="paginacao" className="flex items-center justify-end gap-3 text-sm text-muted-foreground">
        <span>
          Página {pageAtual} de {totalPages}
        </span>
        <Button variant="outline" size="sm" disabled={pageAtual === 1} onClick={() => setPage(pageAtual - 1)}>
          Anterior
        </Button>
        <Button variant="outline" size="sm" disabled={pageAtual === totalPages} onClick={() => setPage(pageAtual + 1)}>
          Próxima
        </Button>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/gestor/__tests__/TabelaAlunosSimulado.test.tsx`
Expected: PASS — `Tests 12 passed (12)`.

- [ ] **Step 5: Commit**

```bash
git add src/features/gestor/components/TabelaAlunosSimulado.tsx src/features/gestor/__tests__/TabelaAlunosSimulado.test.tsx
git commit -m "Gestor v2: TabelaAlunosSimulado com ordenacao, paginacao, selecao e coluna Variacao no multi-simulado"
```

---

### Task 54: TabelaQuestoes e DistribuicaoAlternativas

**Files:**
- Create: `src/features/gestor/charts/DistribuicaoAlternativas.tsx`
- Create: `src/features/gestor/components/TabelaQuestoes.tsx`
- Modify: `src/features/gestor/api/queries.ts`
- Test: `src/features/gestor/__tests__/TabelaQuestoes.test.tsx`

**Interfaces:**
- Consumes: `Questao`, `Alternativa` de `api/types.ts`; `formatPct` de `lib/formatters.ts`; `ToggleGroup`, `Table*`, `Button`, `Badge`.
- Produces: `DistribuicaoAlternativas`, `derivarDistratorDominante(alternativas: Alternativa[]): Alternativa['letra'] | undefined`; `TabelaQuestoes`, `TabelaQuestoesProps`, `OrdenacaoQuestoes`, `ORDENACOES_QUESTOES`, `deveMostrarQuestoes(simulados: string[]): boolean`; `useQuestoes` com `enabled` de exatamente 1 simulado.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/gestor/__tests__/TabelaQuestoes.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, userEvent } from '@/test/utils';
import {
  TabelaQuestoes,
  deveMostrarQuestoes,
  ORDENACOES_QUESTOES,
} from '@/features/gestor/components/TabelaQuestoes';
import { derivarDistratorDominante } from '@/features/gestor/charts/DistribuicaoAlternativas';
import type { Alternativa, Questao } from '@/features/gestor/api/types';

const alternativas = (): Alternativa[] => [
  { letra: 'A', texto: 'Alternativa A', correta: true, marcadaPct: 42 },
  { letra: 'B', texto: 'Alternativa B', correta: false, marcadaPct: 31 },
  { letra: 'C', texto: 'Alternativa C', correta: false, marcadaPct: 15 },
  { letra: 'D', texto: 'Alternativa D', correta: false, marcadaPct: 8 },
  { letra: 'E', texto: 'Alternativa E', correta: false, marcadaPct: 4 },
];

const questao = (over: Partial<Questao>): Questao => ({
  numero: 1,
  grandeArea: 'Clínica Médica',
  especialidade: 'Cardiologia',
  tema: 'Insuficiência cardíaca',
  acertoPct: 42,
  enunciado: 'Paciente de 62 anos com dispneia progressiva…',
  alternativas: alternativas(),
  ...over,
});

const QUESTOES = [
  questao({ numero: 1 }),
  questao({ numero: 2, grandeArea: 'Cirurgia', especialidade: 'Cirurgia geral', tema: 'Abdome agudo', acertoPct: 28 }),
];

const props = (over: Partial<React.ComponentProps<typeof TabelaQuestoes>> = {}) => ({
  questoes: QUESTOES,
  total: 2,
  page: 1,
  pageSize: 20,
  onPageChange: vi.fn(),
  ordenacao: 'ordem_da_prova' as const,
  onOrdenacaoChange: vi.fn(),
  areas: ['Clínica Médica', 'Cirurgia'],
  areaSelecionada: null,
  onAreaChange: vi.fn(),
  ...over,
});

describe('deveMostrarQuestoes (§4.7.3-4, §12 caso 6)', () => {
  it('só com exatamente 1 simulado', () => {
    expect(deveMostrarQuestoes([])).toBe(false);
    expect(deveMostrarQuestoes(['s1'])).toBe(true);
    expect(deveMostrarQuestoes(['s1', 's2'])).toBe(false);
  });
});

describe('derivarDistratorDominante', () => {
  it('escolhe a incorreta mais marcada', () => {
    expect(derivarDistratorDominante(alternativas())).toBe('B');
  });

  it('devolve undefined quando ninguém marcou incorreta', () => {
    expect(
      derivarDistratorDominante([
        { letra: 'A', texto: 'a', correta: true, marcadaPct: 100 },
        { letra: 'B', texto: 'b', correta: false, marcadaPct: 0 },
      ]),
    ).toBeUndefined();
  });
});

describe('TabelaQuestoes', () => {
  it('mostra as 5 colunas do detalhamento das questões', () => {
    render(<TabelaQuestoes {...props()} />);

    const cabecalhos = screen.getAllByRole('columnheader').map((c) => c.textContent);
    expect(cabecalhos).toEqual(['Nº', 'Grande área', 'Especialidade', 'Tema', 'Índice de acerto']);
  });

  it('oferece as 3 ordenações decididas em 24/07 e nenhum slider', async () => {
    const user = userEvent.setup();
    const onOrdenacaoChange = vi.fn();
    render(<TabelaQuestoes {...props({ onOrdenacaoChange })} />);

    expect(ORDENACOES_QUESTOES.map((o) => o.rotulo)).toEqual(['Ordem da prova', 'Mais erradas', 'Mais acertadas']);
    expect(screen.getByRole('button', { name: 'Ordem da prova' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('slider')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Mais erradas' }));
    expect(onOrdenacaoChange).toHaveBeenCalledWith('mais_erradas');
  });

  it('filtra por grande área pelo callback, sem filtrar no cliente', async () => {
    const user = userEvent.setup();
    const onAreaChange = vi.fn();
    render(<TabelaQuestoes {...props({ onAreaChange })} />);

    await user.click(screen.getByRole('button', { name: 'Cirurgia' }));
    expect(onAreaChange).toHaveBeenCalledWith('Cirurgia');
    expect(screen.getAllByTestId(/^linha-questao-/)).toHaveLength(2);
  });

  it('expande a linha com enunciado, alternativas A-E e distribuição', async () => {
    const user = userEvent.setup();
    render(<TabelaQuestoes {...props()} />);

    const gatilho = screen.getByRole('button', { name: /Ver detalhe da questão 1/i });
    expect(gatilho).toHaveAttribute('aria-expanded', 'false');

    await user.click(gatilho);
    expect(gatilho).toHaveAttribute('aria-expanded', 'true');

    const detalhe = screen.getByTestId('detalhe-questao-1');
    expect(within(detalhe).getByText(/dispneia progressiva/)).toBeInTheDocument();
    expect(within(detalhe).getAllByTestId(/^alternativa-/)).toHaveLength(5);
    expect(within(detalhe).getByTestId('alternativa-A')).toHaveAttribute('data-correta', 'true');
    expect(within(detalhe).getByTestId('alternativa-A')).toHaveTextContent('resposta correta');
    expect(within(detalhe).getByTestId('alternativa-B')).toHaveTextContent('distrator dominante');
    expect(within(detalhe).getByTestId('alternativa-B')).toHaveTextContent('31%');
  });

  it('respeita o distrator dominante vindo do servidor', async () => {
    const user = userEvent.setup();
    render(<TabelaQuestoes {...props({ questoes: [questao({ numero: 1, distratorDominante: 'C' })] })} />);

    await user.click(screen.getByRole('button', { name: /Ver detalhe da questão 1/i }));
    expect(screen.getByTestId('alternativa-C')).toHaveTextContent('distrator dominante');
    expect(screen.getByTestId('alternativa-B')).not.toHaveTextContent('distrator dominante');
  });

  it('gabarito em processamento: mensagem, nenhuma linha e nenhum número (§4.10)', () => {
    render(<TabelaQuestoes {...props({ questoes: [], total: 0, processando: true })} />);

    expect(screen.getByTestId('questoes-processando')).toHaveTextContent('Gabarito em processamento');
    expect(screen.queryByTestId(/^linha-questao-/)).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/gestor/__tests__/TabelaQuestoes.test.tsx`
Expected: FAIL com `Failed to resolve import "@/features/gestor/components/TabelaQuestoes"`.

- [ ] **Step 3: Write DistribuicaoAlternativas**

```tsx
// src/features/gestor/charts/DistribuicaoAlternativas.tsx
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPct } from '../lib/formatters';
import type { Alternativa } from '../api/types';

/**
 * Derivação exata (não estimativa): a incorreta mais marcada. Usada só quando o
 * servidor não manda `distratorDominante`.
 */
export function derivarDistratorDominante(alternativas: Alternativa[]): Alternativa['letra'] | undefined {
  const incorretas = alternativas.filter((a) => !a.correta && a.marcadaPct > 0);
  if (incorretas.length === 0) return undefined;
  return incorretas.reduce((maior, a) => (a.marcadaPct > maior.marcadaPct ? a : maior)).letra;
}

export interface DistribuicaoAlternativasProps {
  alternativas: Alternativa[];
  distratorDominante?: Alternativa['letra'];
}

export function DistribuicaoAlternativas({ alternativas, distratorDominante }: DistribuicaoAlternativasProps) {
  const dominante = distratorDominante ?? derivarDistratorDominante(alternativas);

  return (
    <ul className="space-y-2" aria-label="Distribuição das marcações por alternativa">
      {alternativas.map((alt) => {
        const ehDominante = !alt.correta && alt.letra === dominante;
        return (
          <li
            key={alt.letra}
            data-testid={`alternativa-${alt.letra}`}
            data-correta={String(alt.correta)}
            className={cn(
              'grid grid-cols-[1.5rem_1fr_3.5rem] items-start gap-2 rounded p-1.5 text-sm',
              alt.correta && 'bg-primary/5 ring-1 ring-primary/30',
            )}
          >
            <span className="flex items-center gap-1 font-semibold text-foreground">
              {alt.letra}
              {alt.correta && <Check className="h-3 w-3 text-primary" aria-hidden="true" />}
            </span>
            <span className="space-y-1">
              <span className="block text-foreground">{alt.texto}</span>
              {alt.correta && <span className="sr-only">resposta correta</span>}
              {ehDominante && (
                <span className="inline-block rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive">
                  distrator dominante
                </span>
              )}
              <span className="block h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <span
                  aria-hidden="true"
                  className={cn(
                    'block h-full rounded-full transition-[width] duration-200',
                    alt.correta ? 'bg-primary' : ehDominante ? 'bg-destructive' : 'bg-muted-foreground/40',
                  )}
                  style={{ width: `${Math.max(0, Math.min(100, alt.marcadaPct))}%` }}
                />
              </span>
            </span>
            <span className="text-right tabular-nums text-foreground">{formatPct(alt.marcadaPct)}</span>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 4: Write TabelaQuestoes**

```tsx
// src/features/gestor/components/TabelaQuestoes.tsx
import * as React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { DistribuicaoAlternativas } from '../charts/DistribuicaoAlternativas';
import { formatPct } from '../lib/formatters';
import type { Questao } from '../api/types';

export const ORDENACOES_QUESTOES = [
  { valor: 'ordem_da_prova', rotulo: 'Ordem da prova' },
  { valor: 'mais_erradas', rotulo: 'Mais erradas' },
  { valor: 'mais_acertadas', rotulo: 'Mais acertadas' },
] as const;

export type OrdenacaoQuestoes = (typeof ORDENACOES_QUESTOES)[number]['valor'];

/** §4.7.3-4: o Detalhamento das Questões existe só com exatamente 1 simulado. */
export function deveMostrarQuestoes(simulados: string[]): boolean {
  return simulados.length === 1;
}

export interface TabelaQuestoesProps {
  questoes: Questao[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  ordenacao: OrdenacaoQuestoes;
  onOrdenacaoChange: (ordenacao: OrdenacaoQuestoes) => void;
  areas: string[];
  areaSelecionada: string | null;
  onAreaChange: (area: string | null) => void;
  processando?: boolean;
}

export function TabelaQuestoes({
  questoes,
  total,
  page,
  pageSize,
  onPageChange,
  ordenacao,
  onOrdenacaoChange,
  areas,
  areaSelecionada,
  onAreaChange,
  processando = false,
}: TabelaQuestoesProps) {
  const [expandida, setExpandida] = React.useState<number | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section aria-labelledby="questoes-titulo" className="space-y-3">
      <h3 id="questoes-titulo" className="text-base font-semibold text-foreground">
        Detalhamento das questões
      </h3>

      {processando ? (
        <p
          data-testid="questoes-processando"
          className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground"
        >
          Gabarito em processamento — as questões aparecem quando o processamento terminar.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Grande área</span>
              <ToggleGroup
                type="single"
                value={areaSelecionada ?? 'todas'}
                onValueChange={(v) => onAreaChange(!v || v === 'todas' ? null : v)}
                aria-label="Filtrar por grande área"
              >
                <ToggleGroupItem value="todas">Todas</ToggleGroupItem>
                {areas.map((area) => (
                  <ToggleGroupItem key={area} value={area}>
                    {area}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Ordenar por</span>
              <ToggleGroup
                type="single"
                value={ordenacao}
                onValueChange={(v) => v && onOrdenacaoChange(v as OrdenacaoQuestoes)}
                aria-label="Ordenação das questões"
              >
                {ORDENACOES_QUESTOES.map((o) => (
                  <ToggleGroupItem key={o.valor} value={o.valor}>
                    {o.rotulo}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </div>

          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Nº</TableHead>
                  <TableHead>Grande área</TableHead>
                  <TableHead>Especialidade</TableHead>
                  <TableHead>Tema</TableHead>
                  <TableHead className="text-right">Índice de acerto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questoes.map((q) => {
                  const aberta = expandida === q.numero;
                  return (
                    <React.Fragment key={q.numero}>
                      <TableRow data-testid={`linha-questao-${q.numero}`}>
                        <TableCell>
                          <button
                            type="button"
                            aria-expanded={aberta}
                            aria-controls={`detalhe-questao-${q.numero}`}
                            aria-label={`Ver detalhe da questão ${q.numero}`}
                            onClick={() => setExpandida(aberta ? null : q.numero)}
                            className="inline-flex items-center gap-1 tabular-nums"
                          >
                            {aberta ? (
                              <ChevronDown className="h-4 w-4" aria-hidden="true" />
                            ) : (
                              <ChevronRight className="h-4 w-4" aria-hidden="true" />
                            )}
                            {q.numero}
                          </button>
                        </TableCell>
                        <TableCell>{q.grandeArea}</TableCell>
                        <TableCell>{q.especialidade}</TableCell>
                        <TableCell>{q.tema}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPct(q.acertoPct)}</TableCell>
                      </TableRow>
                      {aberta && (
                        <TableRow>
                          <TableCell colSpan={5} id={`detalhe-questao-${q.numero}`} data-testid={`detalhe-questao-${q.numero}`}>
                            <p className="mb-3 whitespace-pre-line text-sm text-foreground">{q.enunciado}</p>
                            <DistribuicaoAlternativas
                              alternativas={q.alternativas}
                              distratorDominante={q.distratorDominante}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-end gap-3 text-sm text-muted-foreground">
            <span>
              Página {page} de {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
              Próxima
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Guard `useQuestoes` in `queries.ts`**

Substituir integralmente a função `useQuestoes` (versão da Fase 2). §5.2 já diz "paginada; só com exatamente 1 simulado" — o `enabled` é o que impede a requisição sobrar quando o gestor abre o segundo simulado.

```ts
export function useQuestoes(
  filtros: { iesId: string | null; simulados: string[] },
  paginacao: { page: number; pageSize: number; sort: string; area: string | null },
) {
  const { iesId, simulados } = filtros;
  const simuladoId = simulados.length === 1 ? simulados[0] : null;

  return useQuery({
    queryKey: ['gestor', 'questoes', iesId, simuladoId, paginacao] as const,
    queryFn: async (): Promise<Envelope<Paginado<Questao>>> => {
      const { data, error } = await supabase.rpc('get_gestor_questoes', {
        p_ies_id: iesId,
        p_simulado_id: simuladoId,
        p_page: paginacao.page,
        p_page_size: paginacao.pageSize,
        p_sort: paginacao.sort,
        p_area: paginacao.area,
      });
      if (error) throw error;
      return data as unknown as Envelope<Paginado<Questao>>;
    },
    // §4.7.4 + §12 caso 6: com 0 ou 2+ simulados as questões nem são buscadas.
    enabled: Boolean(iesId) && simuladoId !== null,
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  });
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/features/gestor/__tests__/TabelaQuestoes.test.tsx`
Expected: PASS — `Tests 9 passed (9)`.

- [ ] **Step 7: Commit**

```bash
git add src/features/gestor/charts/DistribuicaoAlternativas.tsx src/features/gestor/components/TabelaQuestoes.tsx src/features/gestor/api/queries.ts src/features/gestor/__tests__/TabelaQuestoes.test.tsx
git commit -m "Gestor v2: TabelaQuestoes com 3 ordenacoes, filtro de grande area, linha expandida e estado processing"
```

---

### Task 55: ComparativoSimulados

**Files:**
- Create: `src/features/gestor/components/ComparativoSimulados.tsx`
- Test: `src/features/gestor/__tests__/ComparativoSimulados.test.tsx`

**Interfaces:**
- Consumes: `MetricasSimulado`, `Detalhamento['comparativoTemas']` de `api/types.ts`; `calcularVariacao` de `lib/regras.ts`; `formatConceito`, `formatDelta`, `formatNumero`, `formatPct`, `formatData` de `lib/formatters.ts`; `Collapsible*`, `Card`, `Badge`, `Table*`.
- Produces: `ComparativoSimulados`, `ComparativoSimuladosProps`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/gestor/__tests__/ComparativoSimulados.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, within, userEvent } from '@/test/utils';
import { ComparativoSimulados } from '@/features/gestor/components/ComparativoSimulados';
import type { MetricasSimulado } from '@/features/gestor/api/types';

const metrica = (over: Partial<MetricasSimulado>): MetricasSimulado => ({
  simuladoId: 's1',
  nome: 'Simulado 1',
  data: '2026-03-10T13:00:00Z',
  participantes: 100,
  acertoMedioPct: 60,
  enamedProjetado: 3,
  proficienciaMedia: 55,
  ...over,
});

const DUAS = [
  metrica({ simuladoId: 's1', nome: 'Simulado 1', acertoMedioPct: 60, proficienciaMedia: 55, enamedProjetado: 3 }),
  metrica({
    simuladoId: 's2',
    nome: 'Simulado 2',
    data: '2026-05-12T13:00:00Z',
    acertoMedioPct: 68,
    proficienciaMedia: 62,
    enamedProjetado: 4,
  }),
];

const TEMAS = [
  {
    tema: 'Abdome agudo',
    porSimulado: [
      { simuladoId: 's1', acertoPct: 38 },
      { simuladoId: 's2', acertoPct: 52 },
    ],
  },
];

describe('ComparativoSimulados', () => {
  it('não existe com menos de 2 simulados', () => {
    const { container } = render(<ComparativoSimulados metricas={[DUAS[0]]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('abre colapsado, com um card por simulado (§4.7.4)', () => {
    render(<ComparativoSimulados metricas={DUAS} comparativoTemas={TEMAS} />);

    expect(screen.getByRole('button', { name: /ver comparativo completo/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('card-simulado-s1')).toBeInTheDocument();
    expect(screen.getByTestId('card-simulado-s2')).toBeInTheDocument();
    expect(screen.queryByTestId('comparativo-temas')).toBeNull();
  });

  it('cada card traz % de acerto, ENAMED e proficiência média, e nenhuma média única (§12 caso 3)', () => {
    render(<ComparativoSimulados metricas={DUAS} comparativoTemas={TEMAS} />);

    const s1 = screen.getByTestId('card-simulado-s1');
    expect(within(s1).getByTestId('card-acerto')).toHaveTextContent('60%');
    expect(within(s1).getByTestId('card-enamed')).toHaveTextContent('3/5');
    expect(within(s1).getByTestId('card-proficiencia')).toHaveTextContent('55');
    expect(screen.queryByText(/média dos simulados|conceito médio/i)).toBeNull();
  });

  it('o simulado atual fica em destaque e traz o delta contra o anterior', () => {
    render(<ComparativoSimulados metricas={DUAS} comparativoTemas={TEMAS} />);

    const s2 = screen.getByTestId('card-simulado-s2');
    expect(s2).toHaveAttribute('data-atual', 'true');
    expect(within(s2).getByText('atual')).toBeInTheDocument();
    expect(within(s2).getByTestId('card-delta-acerto')).toHaveTextContent('+8');
    expect(within(s2).getByTestId('card-delta-proficiencia')).toHaveTextContent('+7');

    const s1 = screen.getByTestId('card-simulado-s1');
    expect(s1).toHaveAttribute('data-atual', 'false');
    expect(within(s1).getByTestId('card-delta-acerto')).toHaveTextContent('—');
  });

  it('expande sob demanda e mostra o comparativo por tema, uma coluna por simulado', async () => {
    const user = userEvent.setup();
    render(<ComparativoSimulados metricas={DUAS} comparativoTemas={TEMAS} />);

    await user.click(screen.getByRole('button', { name: /ver comparativo completo/i }));

    const tabela = screen.getByTestId('comparativo-temas');
    expect(within(tabela).getAllByRole('columnheader').map((c) => c.textContent)).toEqual([
      'Tema',
      'Simulado 1',
      'Simulado 2',
    ]);
    const linha = within(tabela).getByRole('row', { name: /Abdome agudo/ });
    expect(within(linha).getByTestId('tema-s1')).toHaveTextContent('38%');
    expect(within(linha).getByTestId('tema-s2')).toHaveTextContent('52%');
  });

  it('sem comparativo por tema o expandido diz que não há dado, sem inventar número (§4.10)', async () => {
    const user = userEvent.setup();
    render(<ComparativoSimulados metricas={DUAS} />);

    await user.click(screen.getByRole('button', { name: /ver comparativo completo/i }));
    expect(screen.getByTestId('comparativo-temas-vazio')).toHaveTextContent('Sem tema comparável entre estes simulados');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/gestor/__tests__/ComparativoSimulados.test.tsx`
Expected: FAIL com `Failed to resolve import "@/features/gestor/components/ComparativoSimulados"`.

- [ ] **Step 3: Write the implementation**

```tsx
// src/features/gestor/components/ComparativoSimulados.tsx
import * as React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { calcularVariacao } from '../lib/regras';
import { formatConceito, formatData, formatDelta, formatNumero, formatPct } from '../lib/formatters';
import type { Detalhamento, MetricasSimulado } from '../api/types';

export interface ComparativoSimuladosProps {
  metricas: MetricasSimulado[];
  comparativoTemas?: Detalhamento['comparativoTemas'];
}

export function ComparativoSimulados({ metricas, comparativoTemas }: ComparativoSimuladosProps) {
  const [aberto, setAberto] = React.useState(false);

  // §4.7.4: comparativo existe só a partir de 2 simulados.
  if (metricas.length < 2) return null;

  const indiceAtual = metricas.length - 1;

  return (
    <section aria-labelledby="comparativo-titulo" className="space-y-3">
      <h3 id="comparativo-titulo" className="text-base font-semibold text-foreground">
        Comparativo entre simulados
      </h3>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {metricas.map((m, i) => {
          const anterior = i > 0 ? metricas[i - 1] : null;
          const ehAtual = i === indiceAtual;
          return (
            <Card
              key={m.simuladoId}
              data-testid={`card-simulado-${m.simuladoId}`}
              data-atual={String(ehAtual)}
              className={cn(ehAtual && 'ring-2 ring-primary')}
            >
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">{m.nome}</p>
                    <p className="text-xs text-muted-foreground">{formatData(m.data)}</p>
                  </div>
                  {ehAtual && <Badge>atual</Badge>}
                </div>

                <dl className="space-y-1 text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-muted-foreground">Percentual de acerto</dt>
                    <dd className="flex items-baseline gap-2 tabular-nums">
                      <span data-testid="card-acerto" className="font-semibold text-foreground">
                        {formatPct(m.acertoMedioPct)}
                      </span>
                      <span data-testid="card-delta-acerto" className="text-xs text-muted-foreground">
                        {formatDelta(calcularVariacao(anterior?.acertoMedioPct ?? null, m.acertoMedioPct))}
                      </span>
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-muted-foreground">Conceito ENAMED</dt>
                    <dd data-testid="card-enamed" className="font-semibold tabular-nums text-foreground">
                      {formatConceito(m.enamedProjetado)}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-muted-foreground">Proficiência média</dt>
                    <dd className="flex items-baseline gap-2 tabular-nums">
                      <span data-testid="card-proficiencia" className="font-semibold text-foreground">
                        {formatNumero(m.proficienciaMedia)}
                      </span>
                      <span data-testid="card-delta-proficiencia" className="text-xs text-muted-foreground">
                        {formatDelta(calcularVariacao(anterior?.proficienciaMedia ?? null, m.proficienciaMedia))}
                      </span>
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Collapsible open={aberto} onOpenChange={setAberto}>
        <CollapsibleTrigger className="inline-flex items-center gap-1 text-sm underline">
          {aberto ? (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          )}
          Ver comparativo completo
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          {comparativoTemas && comparativoTemas.length > 0 ? (
            <div className="rounded-lg border border-border">
              <Table data-testid="comparativo-temas">
                <TableHeader>
                  <TableRow>
                    <TableHead>Tema</TableHead>
                    {metricas.map((m) => (
                      <TableHead key={m.simuladoId} className="text-right">
                        {m.nome}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparativoTemas.map((linha) => (
                    <TableRow key={linha.tema}>
                      <TableCell>{linha.tema}</TableCell>
                      {metricas.map((m) => {
                        const ponto = linha.porSimulado.find((p) => p.simuladoId === m.simuladoId);
                        return (
                          <TableCell
                            key={m.simuladoId}
                            data-testid={`tema-${m.simuladoId}`}
                            className="text-right tabular-nums"
                          >
                            {formatPct(ponto?.acertoPct ?? null)}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p data-testid="comparativo-temas-vazio" className="text-sm text-muted-foreground">
              Sem tema comparável entre estes simulados
            </p>
          )}
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/gestor/__tests__/ComparativoSimulados.test.tsx`
Expected: PASS — `Tests 6 passed (6)`.

- [ ] **Step 5: Commit**

```bash
git add src/features/gestor/components/ComparativoSimulados.tsx src/features/gestor/__tests__/ComparativoSimulados.test.tsx
git commit -m "Gestor v2: ComparativoSimulados colapsado por padrao, um card por simulado e comparativo por tema"
```

---

### Task 56: Rota Detalhamento e os 3 sub-estados

**Files:**
- Create: `src/features/gestor/routes/Detalhamento.tsx`
- Test: `src/features/gestor/__tests__/Detalhamento.test.tsx`

**Interfaces:**
- Consumes: `useFiltrosGestor`; `useCronograma`, `useDetalhamento`, `useQuestoes` de `api/queries.ts`; `FiltroSemestre` (componente), `CronogramaSimulados`, `DrawerAluno` das Fases 3/4; `DispersaoChart`; e tudo o que as Tasks 47–55 produziram; `Sheet*` de `@/components/ui/sheet`.
- Produces: `export default function Detalhamento()` — a página, ordem vertical do §4.7 fechada.

Ordem vertical: barra de filtros → nota de reatividade → 3 KPIs → comparativo (2+) → evolução do recorte → acerto por área e semestre → dispersão nota × semestre → visão de alunos → detalhamento das questões (último). O `recorte` cruzado é `useState` local (§8.2, "hover/seleção de gráfico"). O registro da rota em `buildAppRoutes` e no teste-guarda `src/test/unit/route-gates.test.tsx` pertence à fase de rollout (§9), não a esta.

- [ ] **Step 1: Write the failing integration test**

```tsx
// src/features/gestor/__tests__/Detalhamento.test.tsx
import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import Detalhamento from '@/features/gestor/routes/Detalhamento';
import { useCronograma, useDetalhamento, useQuestoes } from '@/features/gestor/api/queries';
import type { AlunoNoSimulado, ItemCronograma, Meta, MetricasSimulado, Questao } from '@/features/gestor/api/types';
import type { DetalhamentoComExtras } from '@/features/gestor/api/detalhamentoExtras';

vi.mock('@/features/gestor/api/queries', () => ({
  useCronograma: vi.fn(),
  useDetalhamento: vi.fn(),
  useQuestoes: vi.fn(),
}));

vi.mock('@/features/gestor/components/FiltroSemestre', () => ({
  FiltroSemestre: ({ valor }: { valor: string }) => <div data-testid="filtro-semestre">{valor}</div>,
}));
vi.mock('@/features/gestor/components/CronogramaSimulados', () => ({
  CronogramaSimulados: () => <div data-testid="cronograma-simulados" />,
}));
vi.mock('@/features/gestor/components/DrawerAluno', () => ({
  DrawerAluno: ({ alunoId }: { alunoId: string | null }) =>
    alunoId ? <div data-testid="drawer-aluno">{alunoId}</div> : null,
}));
vi.mock('@/features/gestor/charts/DispersaoChart', () => ({
  DispersaoChart: () => <div data-testid="dispersao-chart" />,
}));
vi.mock('@/features/gestor/charts/EvolucaoChart', () => ({
  EvolucaoChart: () => <div data-testid="evolucao-chart" />,
}));

const META: Meta = {
  periodo: '2026.1',
  fonte: 'Simulados SanarFlix',
  atualizadoEm: '2026-07-20T13:00:00Z',
  criterio: 'Proficiente = proficiência maior ou igual a 60',
  partial: false,
  lowSample: false,
};

const metrica = (i: number): MetricasSimulado => ({
  simuladoId: `s${i}`,
  nome: `Simulado ${i}`,
  data: `2026-0${i}-10T13:00:00Z`,
  participantes: 100,
  acertoMedioPct: 60 + i,
  enamedProjetado: 3,
  proficienciaMedia: 55 + i,
});

const aluno: AlunoNoSimulado = {
  id: 'a1',
  nome: 'Ana',
  semestre: 11,
  participou: true,
  acertos: 60,
  proficiencia: 72,
  situacao: 'proficiente',
  variacao: 5,
};

const questao: Questao = {
  numero: 1,
  grandeArea: 'Clínica Médica',
  especialidade: 'Cardiologia',
  tema: 'Insuficiência cardíaca',
  acertoPct: 42,
  enunciado: 'Enunciado da questão 1',
  alternativas: [
    { letra: 'A', texto: 'a', correta: true, marcadaPct: 42 },
    { letra: 'B', texto: 'b', correta: false, marcadaPct: 31 },
    { letra: 'C', texto: 'c', correta: false, marcadaPct: 15 },
    { letra: 'D', texto: 'd', correta: false, marcadaPct: 8 },
    { letra: 'E', texto: 'e', correta: false, marcadaPct: 4 },
  ],
};

const CRONOGRAMA: ItemCronograma[] = Array.from({ length: 7 }, (_, i) => ({
  id: `s${i + 1}`,
  nome: `Simulado ${i + 1}`,
  data: '2026-03-10T13:00:00Z',
  status: 'realizado',
  modalidade: 'online',
}));

function dados(quantos: number): DetalhamentoComExtras {
  return {
    metricas: Array.from({ length: quantos }, (_, i) => metrica(i + 1)),
    acertoPorAreaESemestre: {
      areas: [{ id: 'clinica', nome: 'Clínica Médica', acertoPct: 72, critica: false }],
      semestres: [{ semestre: 11, acertoPct: 63, emEvidencia: true }],
      matriz: [{ areaId: 'clinica', semestre: 11, acertoPct: 66, amostra: 120 }],
    },
    dispersao: [{ alunoId: 'a1', semestre: 11, nota: 72 }],
    alunos: [aluno],
  };
}

const renderRota = (query: string) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/gestor/detalhamento${query}`]}>
        <TooltipProvider>
          <Detalhamento />
        </TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const comSimulados = (quantos: number) => {
  vi.mocked(useDetalhamento).mockReturnValue({
    data: quantos === 0 ? undefined : { data: dados(quantos), meta: META },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useDetalhamento>);
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useCronograma).mockReturnValue({
    data: { data: CRONOGRAMA, meta: META },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useCronograma>);
  vi.mocked(useQuestoes).mockReturnValue({
    data: { data: { data: [questao], page: 1, pageSize: 20, total: 1, totalPages: 1 }, meta: META },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useQuestoes>);
});

describe('Rota Detalhamento — sub-estado vazio (§12 caso 4)', () => {
  it('sem simulado mostra o estado vazio e nenhum indicador', () => {
    comSimulados(0);
    renderRota('?ies=ies-1&semestre=6ano');

    expect(screen.getByTestId('detalhamento-vazio')).toBeInTheDocument();
    expect(screen.getByTestId('seletor-simulados')).toBeInTheDocument();
    expect(screen.queryByTestId('kpi-acerto-medio')).toBeNull();
    expect(screen.queryByTestId('comparativo-temas')).toBeNull();
    expect(screen.queryByText('Detalhamento das questões')).toBeNull();
    expect(vi.mocked(useDetalhamento)).toHaveBeenCalledWith({
      iesId: 'ies-1',
      semestre: '6ano',
      simulados: [],
    });
  });
});

describe('Rota Detalhamento — 1 simulado (§4.7.3)', () => {
  beforeEach(() => comSimulados(1));

  it('faz a leitura completa e põe as questões como último componente da página', () => {
    renderRota('?ies=ies-1&semestre=6ano&simulados=s1');

    expect(screen.queryByTestId('detalhamento-vazio')).toBeNull();
    expect(screen.getByTestId('kpi-acerto-medio')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-enamed')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-proficiencia-media')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Evolução do recorte' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Acerto por grande área e por semestre' })).toBeInTheDocument();
    expect(screen.getByTestId('dispersao-chart')).toBeInTheDocument();
    expect(screen.getByTestId('linha-aluno-a1')).toBeInTheDocument();
    expect(screen.getByTestId('linha-questao-1')).toBeInTheDocument();

    const blocos = screen.getAllByTestId(/^bloco-/).map((b) => b.dataset.testid);
    expect(blocos[blocos.length - 1]).toBe('bloco-questoes');
  });

  it('explicita a reatividade dos indicadores', () => {
    renderRota('?ies=ies-1&semestre=6ano&simulados=s1');
    expect(screen.getByTestId('nota-reatividade')).toHaveTextContent(
      /reagem ao semestre e aos simulados selecionados/i,
    );
  });

  it('não mostra a coluna Variação com um único simulado', () => {
    renderRota('?ies=ies-1&semestre=6ano&simulados=s1');
    expect(screen.queryByText('Variação')).toBeNull();
  });

  it('abre o drawer do aluno ao clicar no nome', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderRota('?ies=ies-1&semestre=6ano&simulados=s1');

    await user.click(screen.getByRole('button', { name: 'Ana' }));
    expect(screen.getByTestId('drawer-aluno')).toHaveTextContent('a1');
  });

  it('abre o cronograma pelo atalho, sem sair da tela', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderRota('?ies=ies-1&semestre=6ano&simulados=s1');

    expect(screen.queryByTestId('cronograma-simulados')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Ver cronograma' }));
    expect(await screen.findByTestId('cronograma-simulados')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-acerto-medio')).toBeInTheDocument();
  });
});

describe('Rota Detalhamento — 2 simulados (§4.7.4, §12 casos 3, 6, 8)', () => {
  beforeEach(() => comSimulados(2));

  it('oculta o detalhamento das questões', () => {
    renderRota('?ies=ies-1&semestre=6ano&simulados=s1,s2');

    expect(screen.queryByText('Detalhamento das questões')).toBeNull();
    expect(screen.queryByTestId('linha-questao-1')).toBeNull();
    expect(screen.queryByTestId('bloco-questoes')).toBeNull();
  });

  it('mostra a coluna Variação e o comparativo colapsado', () => {
    renderRota('?ies=ies-1&semestre=6ano&simulados=s1,s2');

    expect(screen.getByRole('columnheader', { name: /Variação/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ver comparativo completo/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByTestId('card-simulado-s1')).toBeInTheDocument();
    expect(screen.getByTestId('card-simulado-s2')).toBeInTheDocument();
  });

  it('o conceito ENAMED vira comparativo, sem média única', () => {
    renderRota('?ies=ies-1&semestre=6ano&simulados=s1,s2');

    const enamed = screen.getByTestId('kpi-enamed');
    expect(within(enamed).queryByTestId('kpi-valor')).toBeNull();
    expect(within(enamed).getAllByTestId(/^enamed-/)).toHaveLength(2);
  });
});

describe('Rota Detalhamento — 6 simulados (§4.7.2, §12 caso 5)', () => {
  it('avisa sobre legibilidade sem bloquear a leitura', () => {
    comSimulados(6);
    renderRota('?ies=ies-1&semestre=6ano&simulados=s1,s2,s3,s4,s5,s6');

    expect(screen.getByTestId('aviso-legibilidade')).toHaveTextContent('6 simulados selecionados');
    expect(screen.getByTestId('kpi-acerto-medio')).toBeInTheDocument();
    expect(screen.getByTestId('linha-aluno-a1')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Acerto por grande área e por semestre' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/gestor/__tests__/Detalhamento.test.tsx`
Expected: FAIL com `Failed to resolve import "@/features/gestor/routes/Detalhamento"`.

- [ ] **Step 3: Write the route**

```tsx
// src/features/gestor/routes/Detalhamento.tsx
import * as React from 'react';
import { CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useCronograma, useDetalhamento, useQuestoes } from '../api/queries';
import { useFiltrosGestor } from '../hooks/useFiltrosGestor';
import { AcertoPorAreaESemestre } from '../components/AcertoPorAreaESemestre';
import { ComparativoSimulados } from '../components/ComparativoSimulados';
import { CronogramaSimulados } from '../components/CronogramaSimulados';
import { DrawerAluno } from '../components/DrawerAluno';
import { EstadoVazioDetalhamento } from '../components/EstadoVazioDetalhamento';
import { EvolucaoRecorte } from '../components/EvolucaoRecorte';
import { FiltroSemestre as FiltroSemestreControle } from '../components/FiltroSemestre';
import { KpisDetalhamento } from '../components/KpisDetalhamento';
import { SeletorSimulados } from '../components/SeletorSimulados';
import { TabelaAlunosSimulado } from '../components/TabelaAlunosSimulado';
import { TabelaQuestoes, deveMostrarQuestoes, type OrdenacaoQuestoes } from '../components/TabelaQuestoes';
import { DispersaoChart } from '../charts/DispersaoChart';
import { semestresEmEvidencia } from '../components/AcertoPorAreaESemestre';
import type { DetalhamentoComExtras, RecorteCruzado } from '../api/detalhamentoExtras';

export default function Detalhamento() {
  const { semestre, setSemestre, simulados, setSimulados, iesId } = useFiltrosGestor();

  const [recorte, setRecorte] = React.useState<RecorteCruzado | null>(null);
  const [alunoSelecionadoId, setAlunoSelecionadoId] = React.useState<string | null>(null);
  const [ordenacaoQuestoes, setOrdenacaoQuestoes] = React.useState<OrdenacaoQuestoes>('ordem_da_prova');
  const [areaQuestoes, setAreaQuestoes] = React.useState<string | null>(null);
  const [pageQuestoes, setPageQuestoes] = React.useState(1);

  const cronograma = useCronograma(iesId);
  const detalhamento = useDetalhamento({ iesId, semestre, simulados });
  const mostrarQuestoes = deveMostrarQuestoes(simulados);
  const questoes = useQuestoes(
    { iesId, simulados },
    { page: pageQuestoes, pageSize: 20, sort: ordenacaoQuestoes, area: areaQuestoes },
  );

  const itensCronograma = cronograma.data?.data ?? [];
  const dados: DetalhamentoComExtras | undefined = detalhamento.data?.data;
  const meta = detalhamento.data?.meta;
  const paginaQuestoes = questoes.data?.data;

  const semSelecao = simulados.length === 0;
  const multiSimulado = simulados.length > 1;

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-semibold text-foreground">Detalhamento por simulados</h1>

      <div data-testid="bloco-filtros" className="space-y-3">
        <div className="flex flex-wrap items-start gap-3">
          <FiltroSemestreControle valor={semestre} onChange={setSemestre} />
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <CalendarDays className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Ver cronograma
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-md">
              <SheetHeader>
                <SheetTitle>Cronograma de simulados</SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                <CronogramaSimulados itens={itensCronograma} />
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <SeletorSimulados itens={itensCronograma} selecionados={simulados} onChange={setSimulados} />

        <p data-testid="nota-reatividade" className="text-sm text-muted-foreground">
          Os indicadores abaixo reagem ao semestre e aos simulados selecionados. Com 2 ou mais simulados as médias são
          recalculadas e o conceito ENAMED vira comparativo, nunca média.
        </p>
      </div>

      {semSelecao || !dados || !meta ? (
        <EstadoVazioDetalhamento />
      ) : (
        <>
          <div data-testid="bloco-kpis">
            <KpisDetalhamento metricas={dados.metricas} meta={meta} />
          </div>

          {multiSimulado && (
            <div data-testid="bloco-comparativo">
              <ComparativoSimulados metricas={dados.metricas} comparativoTemas={dados.comparativoTemas} />
            </div>
          )}

          <div data-testid="bloco-evolucao">
            <EvolucaoRecorte metricas={dados.metricas} semestre={semestre} dispersao={dados.dispersao} />
          </div>

          <div data-testid="bloco-area-semestre">
            <AcertoPorAreaESemestre
              dados={dados.acertoPorAreaESemestre}
              semestre={semestre}
              matriz={dados.acertoPorAreaESemestre.matriz}
              recorte={recorte}
              onRecorteChange={setRecorte}
            />
          </div>

          <div data-testid="bloco-dispersao" className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-3 text-base font-semibold text-foreground">Nota por semestre</h3>
            <DispersaoChart
              pontos={dados.dispersao}
              semestresEmEvidencia={semestresEmEvidencia(
                semestre,
                dados.acertoPorAreaESemestre.semestres.map((s) => s.semestre),
              )}
              ariaLabel="Dispersão de nota por semestre dos alunos do recorte"
            />
          </div>

          <div data-testid="bloco-alunos">
            <TabelaAlunosSimulado
              alunos={dados.alunos ?? []}
              multiSimulado={multiSimulado}
              alunoSelecionadoId={alunoSelecionadoId}
              onSelecionarAluno={setAlunoSelecionadoId}
            />
          </div>

          {/* §4.7.3-4: último componente da página e ausente com 2+ simulados. */}
          {mostrarQuestoes && (
            <div data-testid="bloco-questoes">
              <TabelaQuestoes
                questoes={paginaQuestoes?.data ?? []}
                total={paginaQuestoes?.total ?? 0}
                page={paginaQuestoes?.page ?? pageQuestoes}
                pageSize={paginaQuestoes?.pageSize ?? 20}
                onPageChange={setPageQuestoes}
                ordenacao={ordenacaoQuestoes}
                onOrdenacaoChange={(o) => {
                  setOrdenacaoQuestoes(o);
                  setPageQuestoes(1);
                }}
                areas={[...new Set(dados.acertoPorAreaESemestre.areas.map((a) => a.nome))]}
                areaSelecionada={areaQuestoes}
                onAreaChange={(a) => {
                  setAreaQuestoes(a);
                  setPageQuestoes(1);
                }}
                processando={itensCronograma.some((i) => simulados.includes(i.id) && i.status === 'processing')}
              />
            </div>
          )}

          <DrawerAluno alunoId={alunoSelecionadoId} simulados={simulados} onFechar={() => setAlunoSelecionadoId(null)} />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the integration test to verify it passes**

Run: `npx vitest run src/features/gestor/__tests__/Detalhamento.test.tsx`
Expected: PASS — `Tests 10 passed (10)`.

- [ ] **Step 5: Run the whole Phase 5 suite**

Run: `npx vitest run src/features/gestor/__tests__`
Expected: PASS em 11 arquivos — `Test Files 11 passed (11)`, nenhum teste falhando ou pulado.

- [ ] **Step 6: Type-check, lint escopado e build**

```bash
npm run type-check
npx eslint src/features/gestor --max-warnings=0
npm run test:run
npm run build
```

Expected:
- `npm run type-check` (`tsc --noEmit`): nenhuma saída, exit 0. Qualquer `error TS` aqui é bloqueio.
- `npx eslint src/features/gestor --max-warnings=0`: nenhuma saída, exit 0. O `npm run lint` do repo roda em `.` e falha por dívida antiga fora desta pasta, por isso o escopo.
- `npm run test:run`: a suíte inteira do projeto verde, incluindo os 11 arquivos novos.
- `npm run build`: `built in …`, exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/features/gestor/routes/Detalhamento.tsx src/features/gestor/__tests__/Detalhamento.test.tsx
git commit -m "Gestor v2: rota de Detalhamento com os 3 sub-estados, drawer do cronograma e questoes por ultimo"
```

---

## Fase 6 — QA, piloto, GA e pós-produção

> **Achados da investigação que esta fase assume como verdade (verificados no repo em 26/07/2026):**
>
> 1. **Deploy.** `.github/workflows/ci.yml` existe e descreve um pipeline completo (quality → e2e Playwright → build → security → deploy Vercel), mas **é ficção**: usa `bun install --frozen-lockfile` (não há `bun.lockb`), `bunx playwright test` (Playwright não está instalado, não há `playwright.config.*` nem `tests/`), `actions/upload-artifact@v3` (deprecado) e `bun run lint` (que falha sempre). **Nenhum job desse workflow serve de gate.** O deploy real de produção é `git push` na `main` → build automático da Vercel. Consequência para esta fase: **todos os gates de qualidade são locais e manuais** (`npm run lint`, `npm run type-check`, `npm run test:run`, `npm run build`), e o rollout se controla por *feature flag*, não por pipeline.
> 2. **Teste-guarda de rotas.** É `src/test/unit/route-gates.test.tsx`. Cobre hoje duas coisas: toda rota do aluno redireciona com features off (com allowlist `['/meus-feedbacks']`), e todo item de `GESTOR_NAV` declara `featureKey` que casa `/^gestao\./`. A Fase 5 estende esse arquivo para as 3 rotas novas (§9); a Fase 6 não o duplica.
> 3. **Tracker de telemetria.** O projeto **já tem** um: `src/hooks/useAnalyticsTracker.ts` (`useAnalyticsTracker().trackEvent({ eventName, category, data, pagePath })`), que grava na tabela `public.analytics_events` (colunas `event_name`, `event_category`, `event_data jsonb`, `page_path`, `session_id`, `user_id`, `ies_id`, `created_at`) com dedupe de 1s, rate limit de 60 eventos/min, retry com backoff e *bypass* durante impersonação. **Não há PostHog/Amplitude/Mixpanel/GA.** Logo, `telemetria.ts` da Task 60 encapsula esse hook — não define no-op.
> 4. **Baseline da suíte.** `npm run test:run` hoje: **39 arquivos, 306 testes — 304 passam, 2 falham**. As 2 falhas são pré-existentes e **não** têm relação com o gestor: `src/test/unit/access.test.ts` espera `capabilities` com 2 e 4 itens para `atendimento` e `gestor+atendimento`, mas `ATENDIMENTO_CAPABILITIES` em `src/experiences/access.ts:62` ganhou `'users.edit'` no ciclo de CX e virou 3 e 5. A Task 57 corrige isso antes de qualquer coisa, porque a §11 exige `npm run test:run` **verde** e um gate que já nasce vermelho não é gate.
> 5. **Página morta.** `src/pages/DesempenhoInstitucionalV2.tsx` **não é importada por nenhum arquivo** (as rotas `/desempenho-institucional*` redirecionam para `/gestor`). É código morto que hoje sustenta artificialmente 3 RPCs institucionais — dado central da Task 64.

---

### Task 57: Suíte dos 17 casos críticos do spec §12

**Files:**
- Modify: `src/test/unit/access.test.ts`
- Create: `src/features/gestor/__tests__/fixturesRegrasCriticas.ts`
- Test: `src/features/gestor/__tests__/regras-criticas.test.tsx`

**Interfaces:**
- Consumes: `PROFICIENCIA_MINIMA`, `ehProficiente`, `nivelDesempenho`, `calcularVariacao`, `tendencia` de `@/features/gestor/lib/regras`; `TRACO`, `formatPct`, `formatConceito`, `formatDelta` de `@/features/gestor/lib/formatters`; todos os tipos de `@/features/gestor/api/types`; `useFiltrosGestor` de `@/features/gestor/hooks/useFiltrosGestor`; os componentes `Inicio`, `VisaoGeral`, `Detalhamento` (routes), `SidebarIes` (shell), `TabelaAlunosSimulado`, `DrawerTemas`, `AcertoPorAreaESemestre` (components); `GestorIndexRedirect` de `@/experiences/gestor/GestorFeatureGate`.
- Produces: `fixturesRegrasCriticas.ts` — `META`, `env()`, `envPaginado()`, `CONTEXTO_ADMIN`, `CONTEXTO_GESTOR`, `VISAO_GERAL`, `DETALHAMENTO_1`, `DETALHAMENTO_2`, `ALUNOS_SIMULADO`, `TEMAS_CRITICOS`, `criarRpcMock()`. As Tasks 58 e 61 importam desse arquivo.
- **Contratos de UI que este arquivo fixa** (são o contrato; se um componente da Fase 3/4 não o satisfaz, o componente é ajustado, não o teste):

| # | Contrato | Onde |
|---|---|---|
| C1 | Aviso de >5 simulados: elemento com `role="status"` cuja mensagem contém "legibilidade" | `Detalhamento.tsx` |
| C2 | Vazio de 0 simulados: texto `Selecione ao menos um simulado para ver o detalhamento.` | `Detalhamento.tsx` |
| C3 | `TabelaAlunosSimulado` tem **exatamente um** `columnheader` casando `/profici/i` e **nenhum** casando `/nota tri/i` | `TabelaAlunosSimulado.tsx` |
| C4 | Aluno com `participou: false` → célula com `TRACO` + badge textual `Não participou` | `TabelaAlunosSimulado.tsx` |
| C5 | Controle de modo do gráfico: `role="radiogroup"` com nome acessível `/modo do gráfico/i` e 3 radios `Geral`, `Por grande área`, `Por aluno` | `VisaoGeral.tsx` |
| C6 | Todo gráfico expõe `role="img"` com nome acessível; o de dispersão se chama `/dispersão/i` em multi-semestre e `/distribuição/i` em semestre único | `charts/` |
| C7 | Semestre em evidência na `AcertoPorAreaESemestre`: `rowheader` cujo nome contém `(em evidência)` | `AcertoPorAreaESemestre.tsx` |
| C8 | Grupo de controles multi-semestre: `role="group"` com nome `/semestres comparados/i`, **ausente** em semestre único | `VisaoGeral.tsx` |
| C9 | Erro de bloco por permissão renderiza `Você não tem acesso a este recorte.` e **não** contém o UUID da IES | wrapper de erro de bloco |

- [ ] **Step 1: Destravar a baseline — corrigir as 2 falhas pré-existentes de `access.test.ts`**

`ATENDIMENTO_CAPABILITIES` tem 3 capabilities (`users.support`, `users.edit`, `feedbacks.support`) desde o ciclo de CX; o teste ficou preso em 2.

```ts
// src/test/unit/access.test.ts — dentro de "atendimento ganha a experiência atendimento..."
    expect(access.capabilities).toEqual(
      expect.arrayContaining(['users.support', 'users.edit', 'feedbacks.support']),
    );
    expect(access.capabilities).toHaveLength(3);
```

```ts
// src/test/unit/access.test.ts — dentro de "combinação gestor + atendimento soma..."
    expect(access.capabilities).toEqual(
      expect.arrayContaining([
        'institutional.view', 'alunos.view', 'users.support', 'users.edit', 'feedbacks.support',
      ]),
    );
    expect(access.capabilities).toHaveLength(5);
```

Run: `npx vitest run src/test/unit/access.test.ts`
Expected: `Tests 12 passed (12)` — sem falhas. Baseline vira **306 testes, 306 passando**.

- [ ] **Step 2: Escrever as fixtures**

```ts
// src/features/gestor/__tests__/fixturesRegrasCriticas.ts
import { vi } from 'vitest';
import type {
  AlunoNoSimulado, ContextoGestor, Detalhamento, Envelope, LinhaAluno,
  Meta, Paginado, TemaCritico, VisaoGeral,
} from '@/features/gestor/api/types';

export const IES_ID = '11111111-1111-4111-8111-111111111111';
export const SIM_1 = '22222222-2222-4222-8222-222222222221';
export const SIM_2 = '22222222-2222-4222-8222-222222222222';
export const ALUNO_ID = '33333333-3333-4333-8333-333333333333';

export const META: Meta = {
  periodo: '01/01/2026 a 26/07/2026',
  fonte: 'resultados_alunos_tri',
  atualizadoEm: '2026-07-26T12:00:00.000Z',
  criterio: 'Proficiência >= 60',
  partial: false,
  lowSample: false,
};

export const env = <T,>(data: T): Envelope<T> => ({ data, meta: META });
export const envPaginado = <T,>(itens: T[]): Envelope<Paginado<T>> =>
  env({ data: itens, page: 1, pageSize: 25, total: itens.length, totalPages: 1 });

export const CONTEXTO_ADMIN: ContextoGestor = {
  usuario: { id: '44444444-4444-4444-8444-444444444444', nome: 'Admin Teste', papel: 'admin' },
  iesDisponiveis: [{ id: IES_ID, nome: 'IES Alfa' }, { id: '55555555-5555-4555-8555-555555555555', nome: 'IES Beta' }],
  iesAtual: { id: IES_ID, nome: 'IES Alfa' },
  contrato: { nome: 'Contrato 2026', simuladosContratados: 4, vigencia: '2026' },
  podeTrocarIes: true,
  podeExportar: true,
};

export const CONTEXTO_GESTOR: ContextoGestor = {
  ...CONTEXTO_ADMIN,
  usuario: { id: '66666666-6666-4666-8666-666666666666', nome: 'Gestor Teste', papel: 'gestor' },
  iesDisponiveis: [{ id: IES_ID, nome: 'IES Alfa' }],
  podeTrocarIes: false,
};

export const VISAO_GERAL: VisaoGeral = {
  kpis: {
    enamedProjetado: { valor: 3, delta: 1, serie: [{ rotulo: '1º', valor: 2 }, { rotulo: 'anterior', valor: 2 }, { rotulo: 'atual', valor: 3 }], criterio: 'concept de resultados_ies_tri' },
    proficientesPct: { valor: 62, delta: 4, serie: [{ rotulo: '1º', valor: 55 }, { rotulo: 'anterior', valor: 58 }, { rotulo: 'atual', valor: 62 }], criterio: 'score_proprio >= 60' },
    acertoPct: { valor: 57, delta: -2, serie: [{ rotulo: '1º', valor: 60 }, { rotulo: 'anterior', valor: 59 }, { rotulo: 'atual', valor: 57 }], criterio: 'answer_progress.correct' },
    simulados: { realizados: 2, contratados: 4 },
  },
  evolucao: [
    { simuladoId: SIM_1, nome: 'Simulado 1', data: '2026-03-10', valor: 58, participantes: 120 },
    { simuladoId: SIM_2, nome: 'Simulado 2', data: '2026-06-10', valor: 62, participantes: 118 },
  ],
  evolucaoPorArea: [
    { area: 'Clínica Médica', pontos: [{ rotulo: 'Simulado 1', valor: 61 }, { rotulo: 'Simulado 2', valor: 64 }], critica: false },
    { area: 'Pediatria', pontos: [{ rotulo: 'Simulado 1', valor: 28 }, { rotulo: 'Simulado 2', valor: 26 }], critica: true },
  ],
  diagnosticoResumo: [
    { nivel: 'excelente', areas: [{ id: 'a1', nome: 'Clínica Médica', acertoPct: 82 }] },
    { nivel: 'mediano', areas: [{ id: 'a2', nome: 'Cirurgia', acertoPct: 55 }] },
    { nivel: 'critico', areas: [{ id: 'a3', nome: 'Pediatria', acertoPct: 26 }] },
  ],
  distribuicaoAlunos: [
    { grupo: 'consistentemente_proficiente', quantidade: 40, percentual: 40 },
    { grupo: 'em_variacao', quantidade: 35, percentual: 35 },
    { grupo: 'consistentemente_nao_proficiente', quantidade: 25, percentual: 25 },
  ],
  dispersao: [
    { alunoId: ALUNO_ID, semestre: 11, nota: 72 },
    { alunoId: '77777777-7777-4777-8777-777777777777', semestre: 12, nota: 64 },
    { alunoId: '88888888-8888-4888-8888-888888888888', semestre: 5, nota: 41 },
  ],
  insights: [
    { escopo: 'area', texto: 'Pediatria segue como a área de menor desempenho nas duas aplicações.' },
    { escopo: 'aluno', texto: '25% dos alunos permanecem abaixo do limiar nas duas aplicações.' },
  ],
};

export const ALUNOS_SIMULADO: AlunoNoSimulado[] = [
  {
    id: ALUNO_ID, nome: 'Ana Souza', semestre: 11, participou: true, acertos: 72,
    proficiencia: 72, situacao: 'proficiente',
    posicao: { lugar: 3, total: 118, percentil: 97 },
    acertoPorArea: [{ area: 'Pediatria', acertoPct: 30, critica: true }],
    variacao: 4,
  },
  {
    id: '99999999-9999-4999-8999-999999999999', nome: 'Bruno Lima', semestre: 12,
    participou: false, acertos: null, proficiencia: null, situacao: 'nao_participou',
    variacao: null,
  },
];

export const LINHAS_ALUNO: LinhaAluno[] = [
  { id: ALUNO_ID, nome: 'Ana Souza', semestre: 11, grupo: 'consistentemente_proficiente', proficiencias: [68, 72], tendencia: 'subindo' },
];

export const TEMAS_CRITICOS: TemaCritico[] = [
  { id: 't1', nome: 'Icterícia neonatal', acertoPct: 22, amostra: 118, lowSample: false },
  { id: 't2', nome: 'Aleitamento materno', acertoPct: 31, amostra: 6, lowSample: true },
];

const DET_METRICA_1 = { simuladoId: SIM_1, nome: 'Simulado 1', data: '2026-03-10', participantes: 120, acertoMedioPct: 57, enamedProjetado: 2, proficienciaMedia: 58 };
const DET_METRICA_2 = { simuladoId: SIM_2, nome: 'Simulado 2', data: '2026-06-10', participantes: 118, acertoMedioPct: 59, enamedProjetado: 3, proficienciaMedia: 62 };

const AREAS_E_SEMESTRES = {
  areas: [
    { id: 'a1', nome: 'Clínica Médica', acertoPct: 61, critica: false },
    { id: 'a3', nome: 'Pediatria', acertoPct: 26, critica: true },
  ],
  semestres: [
    { semestre: 5, acertoPct: 41, emEvidencia: false },
    { semestre: 11, acertoPct: 60, emEvidencia: true },
    { semestre: 12, acertoPct: 63, emEvidencia: true },
  ],
};

export const DETALHAMENTO_1: Detalhamento = {
  metricas: [DET_METRICA_1],
  acertoPorAreaESemestre: AREAS_E_SEMESTRES,
  dispersao: VISAO_GERAL.dispersao,
  questoes: {
    data: [{
      numero: 1, grandeArea: 'Pediatria', especialidade: 'Neonatologia', tema: 'Icterícia neonatal',
      acertoPct: 22, enunciado: 'Recém-nascido de 3 dias com icterícia...',
      alternativas: [
        { letra: 'A', texto: 'Fototerapia', correta: true, marcadaPct: 22 },
        { letra: 'B', texto: 'Exsanguineotransfusão', correta: false, marcadaPct: 51 },
        { letra: 'C', texto: 'Observação', correta: false, marcadaPct: 27 },
      ],
      distratorDominante: 'B',
    }],
    page: 1, pageSize: 25, total: 1, totalPages: 1,
  },
};

export const DETALHAMENTO_2: Detalhamento = {
  metricas: [DET_METRICA_1, DET_METRICA_2],
  acertoPorAreaESemestre: AREAS_E_SEMESTRES,
  dispersao: VISAO_GERAL.dispersao,
  comparativoTemas: [
    { tema: 'Icterícia neonatal', porSimulado: [{ simuladoId: SIM_1, acertoPct: 22 }, { simuladoId: SIM_2, acertoPct: 29 }] },
  ],
};

/**
 * Mock do `supabase.rpc` que despacha por nome de função. Registra toda chamada
 * para as asserções de "não dispara requisição" (§12 casos 4 e 15).
 */
export function criarRpcMock(overrides: Record<string, unknown> = {}) {
  const tabela: Record<string, unknown> = {
    get_gestor_contexto: env(CONTEXTO_ADMIN),
    get_gestor_cronograma: env([]),
    get_gestor_avisos: env([]),
    get_gestor_visao_geral: env(VISAO_GERAL),
    get_gestor_diagnostico: env([]),
    get_gestor_diagnostico_temas: env(TEMAS_CRITICOS),
    get_gestor_alunos: envPaginado(LINHAS_ALUNO),
    get_gestor_aluno: env(ALUNOS_SIMULADO[0]),
    get_gestor_detalhamento: env(DETALHAMENTO_1),
    get_gestor_questoes: envPaginado(DETALHAMENTO_1.questoes!.data),
    ...overrides,
  };
  return vi.fn(async (fn: string) => {
    if (!(fn in tabela)) return { data: null, error: { message: `rpc não mockada no teste: ${fn}` } };
    const valor = tabela[fn];
    if (valor instanceof Error) return { data: null, error: { message: valor.message } };
    return { data: valor, error: null };
  });
}

export const nomesChamados = (rpc: ReturnType<typeof criarRpcMock>): string[] =>
  rpc.mock.calls.map((c) => c[0] as string);
```

- [ ] **Step 3: Escrever os 17 testes (o teste falha antes da implementação existir)**

```tsx
// src/features/gestor/__tests__/regras-criticas.test.tsx
import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';

import {
  ALUNOS_SIMULADO, CONTEXTO_ADMIN, CONTEXTO_GESTOR, DETALHAMENTO_2, IES_ID,
  SIM_1, SIM_2, TEMAS_CRITICOS, criarRpcMock, env, nomesChamados,
} from './fixturesRegrasCriticas';

import { PROFICIENCIA_MINIMA, calcularVariacao, ehProficiente, nivelDesempenho } from '@/features/gestor/lib/regras';
import { TRACO } from '@/features/gestor/lib/formatters';
import { useFiltrosGestor } from '@/features/gestor/hooks/useFiltrosGestor';
import Inicio from '@/features/gestor/routes/Inicio';
import VisaoGeral from '@/features/gestor/routes/VisaoGeral';
import Detalhamento from '@/features/gestor/routes/Detalhamento';
import { SidebarIes } from '@/features/gestor/shell/SidebarIes';
import { TabelaAlunosSimulado } from '@/features/gestor/components/TabelaAlunosSimulado';
import { DrawerTemas } from '@/features/gestor/components/DrawerTemas';
import { GestorIndexRedirect } from '@/experiences/gestor/GestorFeatureGate';

// O setup global (src/test/setup.ts) mocka '@/integrations/supabase/client' SEM `rpc`.
// Esta re-declaração no arquivo de teste tem precedência e adiciona o spy de rpc.
const rpc = vi.hoisted(() => ({ atual: null as ReturnType<typeof import('vitest').vi.fn> | null }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc.atual!(...args),
    from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() })),
    auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) },
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: CONTEXTO_ADMIN.usuario.id, nome: 'Admin Teste', email: 'admin@sanar.com', id_ies: IES_ID, semestre: null },
    access: { roles: ['admin'], experiences: ['aluno', 'gestao', 'admin'], capabilities: ['institutional.view', 'alunos.view'] },
    isImpersonating: false,
  }),
}));

const featureLigada = { portalV2: true };
vi.mock('@/hooks/useEffectiveFeatures', () => ({
  useEffectiveFeatures: () => ({
    loading: false,
    hasFeature: (k: string) => (k === 'gestao.portal_v2' ? featureLigada.portalV2 : k === 'gestao.visao_institucional'),
  }),
}));

function renderRota(ui: React.ReactElement, url = '/gestor') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <TooltipProvider>{ui}</TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  rpc.atual = criarRpcMock();
  featureLigada.portalV2 = true;
});

// ─────────────────────────────────────────────────────────────────────────────
describe('§12 — casos de teste críticos do Portal do Gestor v2', () => {

  it('caso 1 — proficiente é >= 60: 60 é proficiente, 59,9 não é (§4.3)', () => {
    expect(PROFICIENCIA_MINIMA).toBe(60);
    expect(ehProficiente(60)).toBe(true);
    expect(ehProficiente(60.0)).toBe(true);
    expect(ehProficiente(59.9)).toBe(false);
    expect(ehProficiente(null)).toBe(false);
  });

  it('caso 2 — nenhuma tela expõe "Nota TRI"; a tabela por simulado tem UMA coluna 0–100 (§4.1)', async () => {
    const { unmount } = renderRota(<VisaoGeral />, '/gestor/visao-geral?semestre=6ano');
    await waitFor(() => expect(nomesChamados(rpc.atual!)).toContain('get_gestor_visao_geral'));
    expect(screen.queryByText(/nota\s*tri/i)).toBeNull();
    unmount();

    render(
      <TooltipProvider>
        <TabelaAlunosSimulado alunos={ALUNOS_SIMULADO} comparativo={false} />
      </TooltipProvider>,
    );
    expect(screen.queryByRole('columnheader', { name: /nota\s*tri/i })).toBeNull();
    expect(screen.getAllByRole('columnheader', { name: /profici/i })).toHaveLength(1);
  });

  it('caso 3 — Conceito ENAMED nunca é média: com 2 simulados, dois valores (§4.1)', async () => {
    rpc.atual = criarRpcMock({ get_gestor_detalhamento: env(DETALHAMENTO_2) });
    renderRota(<Detalhamento />, `/gestor/detalhamento?semestre=6ano&simulados=${SIM_1},${SIM_2}`);
    // formatConceito devolve 'N/5' — dois conceitos ⇒ duas ocorrências, nenhuma média única.
    const conceitos = await screen.findAllByText(/^[1-5]\/5$/);
    expect(conceitos).toHaveLength(2);
    expect(conceitos.map((n) => n.textContent)).toEqual(['2/5', '3/5']);
  });

  it('caso 4 — 0 simulados selecionados: estado vazio e NENHUMA requisição de métrica (§4.7.1)', async () => {
    renderRota(<Detalhamento />, '/gestor/detalhamento?semestre=6ano');
    expect(
      await screen.findByText('Selecione ao menos um simulado para ver o detalhamento.'),
    ).toBeInTheDocument();
    expect(nomesChamados(rpc.atual!)).not.toContain('get_gestor_detalhamento');
    expect(nomesChamados(rpc.atual!)).not.toContain('get_gestor_questoes');
  });

  it('caso 5 — 6 simulados: aviso não-bloqueante, tela segue utilizável (§4.7.2)', async () => {
    const seis = [SIM_1, SIM_2, ...Array.from({ length: 4 }, (_, i) => `22222222-2222-4222-8222-00000000000${i}`)];
    rpc.atual = criarRpcMock({ get_gestor_detalhamento: env(DETALHAMENTO_2) });
    renderRota(<Detalhamento />, `/gestor/detalhamento?semestre=6ano&simulados=${seis.join(',')}`);
    const aviso = await screen.findByRole('status');
    expect(aviso).toHaveTextContent(/legibilidade/i);
    // não-bloqueante: as métricas continuam renderizadas
    expect(await screen.findByText('Simulado 1')).toBeInTheDocument();
  });

  it('caso 6 — com 2+ simulados, "Detalhamento das Questões" não é renderizado (§4.7.4)', async () => {
    rpc.atual = criarRpcMock({ get_gestor_detalhamento: env(DETALHAMENTO_2) });
    const { unmount } = renderRota(<Detalhamento />, `/gestor/detalhamento?semestre=6ano&simulados=${SIM_1},${SIM_2}`);
    await screen.findByText('Simulado 2');
    expect(screen.queryByRole('heading', { name: /detalhamento das quest/i })).toBeNull();
    expect(nomesChamados(rpc.atual!)).not.toContain('get_gestor_questoes');
    unmount();

    rpc.atual = criarRpcMock();
    renderRota(<Detalhamento />, `/gestor/detalhamento?semestre=6ano&simulados=${SIM_1}`);
    expect(await screen.findByRole('heading', { name: /detalhamento das quest/i })).toBeInTheDocument();
  });

  it('caso 7 — aluno sem participação: TRAÇO + "Não participou" (§4.10)', () => {
    render(<TooltipProvider><TabelaAlunosSimulado alunos={ALUNOS_SIMULADO} comparativo={false} /></TooltipProvider>);
    const linha = screen.getByRole('row', { name: /Bruno Lima/ });
    expect(linha).toHaveTextContent('Não participou');
    expect(linha).toHaveTextContent(TRACO);
    expect(linha).not.toHaveTextContent(/\d+%/);
    // A exclusão da média é responsabilidade do servidor (get_gestor_detalhamento);
    // a UI apenas não inventa número — nunca 0, nunca média do grupo.
  });

  it('caso 8 — variação só existe quando participou de TODOS os simulados comparados (§4.7.4)', () => {
    expect(calcularVariacao(58, 62)).toBe(4);
    expect(calcularVariacao(null, 62)).toBeNull();
    expect(calcularVariacao(58, null)).toBeNull();
    expect(calcularVariacao(null, null)).toBeNull();

    render(<TooltipProvider><TabelaAlunosSimulado alunos={ALUNOS_SIMULADO} comparativo /></TooltipProvider>);
    expect(screen.getByRole('columnheader', { name: /varia/i })).toBeInTheDocument();
    const semParticipacao = screen.getByRole('row', { name: /Bruno Lima/ });
    expect(semParticipacao).not.toHaveTextContent(/[+-]\d/);
  });

  it('caso 9 — "Por semestre": controles multi-semestre somem e a comparação vira distribuição (§4.5)', async () => {
    const { unmount } = renderRota(<VisaoGeral />, '/gestor/visao-geral?semestre=geral');
    expect(await screen.findByRole('group', { name: /semestres comparados/i })).toBeInTheDocument();
    unmount();

    renderRota(<VisaoGeral />, '/gestor/visao-geral?semestre=5');
    await waitFor(() => expect(nomesChamados(rpc.atual!)).toContain('get_gestor_visao_geral'));
    expect(screen.queryByRole('group', { name: /semestres comparados/i })).toBeNull();
    await userEvent.click(screen.getByRole('radio', { name: 'Por aluno' }));
    expect(screen.getByRole('img', { name: /distribui/i })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /dispers/i })).toBeNull();
  });

  it('caso 10 — "6º ano": 11º e 12º em evidência, demais como referência (§4.5)', async () => {
    renderRota(<Detalhamento />, `/gestor/detalhamento?semestre=6ano&simulados=${SIM_1}`);
    expect(await screen.findByRole('rowheader', { name: /11º \(em evidência\)/ })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: /12º \(em evidência\)/ })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: /^5º$/ })).toBeInTheDocument();
  });

  it('caso 11 — clique cruzado área ↔ semestre recalcula o outro eixo; segundo clique limpa (§4.7)', async () => {
    const onRecorteChange = vi.fn();
    const { AcertoPorAreaESemestre } = await import('@/features/gestor/components/AcertoPorAreaESemestre');
    render(
      <TooltipProvider>
        <AcertoPorAreaESemestre dados={DETALHAMENTO_2.acertoPorAreaESemestre} onRecorteChange={onRecorteChange} />
      </TooltipProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: /Pediatria/ }));
    expect(onRecorteChange).toHaveBeenLastCalledWith({ tipo: 'area', id: 'a3' });
    await userEvent.click(screen.getByRole('button', { name: /Pediatria/ }));
    expect(onRecorteChange).toHaveBeenLastCalledWith(null);
    await userEvent.click(screen.getByRole('button', { name: /11º/ }));
    expect(onRecorteChange).toHaveBeenLastCalledWith({ tipo: 'semestre', id: '11' });
  });

  it('caso 12 — filtro de semestre vive na URL: persiste entre telas e sobrevive ao refresh (§8.2)', async () => {
    const Sonda: React.FC = () => {
      const { semestre, setSemestre, simulados } = useFiltrosGestor();
      return (
        <div>
          <span data-testid="semestre">{semestre}</span>
          <span data-testid="simulados">{simulados.join('|')}</span>
          <button onClick={() => setSemestre('7')}>trocar</button>
        </div>
      );
    };
    // 1) lê da URL (equivale a refresh na mesma URL)
    const { unmount } = renderRota(<Sonda />, `/gestor/detalhamento?semestre=9&simulados=${SIM_1},${SIM_2}`);
    expect(screen.getByTestId('semestre')).toHaveTextContent('9');
    expect(screen.getByTestId('simulados')).toHaveTextContent(`${SIM_1}|${SIM_2}`);
    unmount();

    // 2) escreve na URL — é isso que faz o filtro atravessar Visão Geral ↔ Detalhamento
    renderRota(
      <Routes>
        <Route path="/gestor/*" element={<Sonda />} />
      </Routes>,
      '/gestor/visao-geral?semestre=6ano',
    );
    await userEvent.click(screen.getByRole('button', { name: 'trocar' }));
    expect(screen.getByTestId('semestre')).toHaveTextContent('7');
  });

  it('caso 13 — gestor não recebe dropdown de IES; admin recebe (§3, §8.3)', () => {
    const { unmount } = render(<TooltipProvider><SidebarIes contexto={CONTEXTO_GESTOR} /></TooltipProvider>);
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByText('IES Alfa')).toBeInTheDocument();
    unmount();

    render(<TooltipProvider><SidebarIes contexto={CONTEXTO_ADMIN} /></TooltipProvider>);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('caso 14 — tema/especialidade usam SÓ % de acerto: nunca TRI, ENAMED ou proficiência (§4.1)', () => {
    expect(nivelDesempenho(49.9)).toBe('critico');
    expect(nivelDesempenho(50)).toBe('mediano');
    expect(nivelDesempenho(79.9)).toBe('mediano');
    expect(nivelDesempenho(80)).toBe('excelente');
    expect(nivelDesempenho(null)).toBeNull();

    render(
      <TooltipProvider>
        <DrawerTemas aberto especialidade="Neonatologia" temas={TEMAS_CRITICOS} onFechar={() => {}} />
      </TooltipProvider>,
    );
    const painel = screen.getByRole('dialog');
    expect(painel).toHaveTextContent('22%');
    expect(painel).not.toHaveTextContent(/profici/i);
    expect(painel).not.toHaveTextContent(/enamed/i);
    expect(painel).not.toHaveTextContent(/\btri\b/i);
    expect(painel).not.toHaveTextContent(/^[1-5]\/5$/);
  });

  it('caso 15 — trocar o modo do gráfico protagonista NÃO dispara requisição (§4.8)', async () => {
    renderRota(<VisaoGeral />, '/gestor/visao-geral?semestre=6ano');
    await waitFor(() => expect(nomesChamados(rpc.atual!)).toContain('get_gestor_visao_geral'));
    const antes = rpc.atual!.mock.calls.length;

    const grupo = screen.getByRole('radiogroup', { name: /modo do gráfico/i });
    await userEvent.click(screen.getByRole('radio', { name: 'Por grande área' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Por aluno' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Geral' }));

    expect(grupo).toBeInTheDocument();
    expect(rpc.atual!.mock.calls.length).toBe(antes);
  });

  it('caso 16 — IES sem gestao.portal_v2 continua nas 5 telas antigas (§9)', () => {
    featureLigada.portalV2 = false;
    const { unmount } = renderRota(
      <Routes>
        <Route path="/gestor" element={<GestorIndexRedirect />} />
        <Route path="/gestor/visao-institucional" element={<p>tela antiga</p>} />
        <Route path="/gestor/inicio" element={<p>portal novo</p>} />
      </Routes>,
      '/gestor',
    );
    expect(screen.getByText('tela antiga')).toBeInTheDocument();
    unmount();

    featureLigada.portalV2 = true;
    renderRota(
      <Routes>
        <Route path="/gestor" element={<GestorIndexRedirect />} />
        <Route path="/gestor/visao-institucional" element={<p>tela antiga</p>} />
        <Route path="/gestor/inicio" element={<p>portal novo</p>} />
      </Routes>,
      '/gestor',
    );
    expect(screen.getByText('portal novo')).toBeInTheDocument();
  });

  it('caso 17 — erro de permissão da RPC não revela existência de IES nem identificadores (§7.7)', async () => {
    rpc.atual = criarRpcMock({ get_gestor_visao_geral: new Error('permissao_negada') });
    renderRota(<VisaoGeral />, `/gestor/visao-geral?semestre=6ano&ies=${IES_ID}`);
    expect(await screen.findByText('Você não tem acesso a este recorte.')).toBeInTheDocument();
    const html = document.body.innerHTML;
    expect(html).not.toContain(IES_ID);
    expect(html).not.toMatch(/IES Beta/);
    expect(html).not.toMatch(/does not exist|não encontrada|relation/i);
  });
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npx vitest run src/features/gestor/__tests__/regras-criticas.test.tsx`
Expected: FAIL. Antes da Fase 3/4 estar completa, falha no *collect* com `Failed to resolve import "@/features/gestor/routes/VisaoGeral"`. Com as fases 1–5 prontas, falham só os casos cujo contrato de UI (C1–C9) ainda não existe, com mensagens como `Unable to find an accessible element with the role "status"` (caso 5) e `Unable to find an accessible element with the role "radiogroup" and name /modo do gráfico/i` (caso 15).

- [ ] **Step 5: Fazer os contratos C1–C9 passarem**

Para cada falha, ajustar o componente da Fase 3/4 — o teste é o contrato. Os quatro ajustes mais prováveis, com o código exato:

```tsx
// C1 — src/features/gestor/routes/Detalhamento.tsx, quando simulados.length > 5
{simulados.length > 5 && (
  <p role="status" className="text-sm text-[hsl(var(--gp-warning-on))]">
    Acima de 5 simulados a comparação perde legibilidade. A leitura continua disponível.
  </p>
)}
```

```tsx
// C2 — src/features/gestor/routes/Detalhamento.tsx, quando simulados.length === 0
{simulados.length === 0 && (
  <p className="text-sm text-muted-foreground">
    Selecione ao menos um simulado para ver o detalhamento.
  </p>
)}
```

```tsx
// C5 — src/features/gestor/routes/VisaoGeral.tsx, controle dentro do gráfico
<div role="radiogroup" aria-label="Modo do gráfico" className="flex gap-1">
  {(['geral', 'area', 'aluno'] as ModoGrafico[]).map((m) => (
    <button
      key={m}
      role="radio"
      aria-checked={modo === m}
      onClick={() => setModo(m)}
      className="rounded-full px-3 py-1 text-sm"
    >
      {m === 'geral' ? 'Geral' : m === 'area' ? 'Por grande área' : 'Por aluno'}
    </button>
  ))}
</div>
```

```tsx
// C7 — src/features/gestor/components/AcertoPorAreaESemestre.tsx
<th scope="row">
  {s.semestre}º{s.emEvidencia && <span className="sr-only"> (em evidência)</span>}
</th>
```

- [ ] **Step 6: Rodar até passar e confirmar a suíte inteira**

Run: `npx vitest run src/features/gestor/__tests__/regras-criticas.test.tsx`
Expected: `Tests 17 passed (17)`

Run: `npm run test:run`
Expected: `Test Files 41 passed (41)` · `Tests 323 passed (323)` — 306 da baseline corrigida + 17. Zero falhas.

- [ ] **Step 7: Commit**
```bash
git add src/test/unit/access.test.ts src/features/gestor/__tests__/fixturesRegrasCriticas.ts src/features/gestor/__tests__/regras-criticas.test.tsx src/features/gestor/routes src/features/gestor/components
git commit -m "test(gestor): suite dos 17 casos criticos do spec §12 + destrava baseline de access.test"
```

---

### Task 58: Acessibilidade — instalar `vitest-axe` e testar por rota

**Files:**
- Modify: `package.json`
- Modify: `src/test/setup.ts`
- Create: `src/test/vitest-axe.d.ts`
- Create: `src/features/gestor/charts/GraficoAcessivel.tsx`
- Modify: `src/features/gestor/charts/EvolucaoChart.tsx` · `AreasChart.tsx` · `DispersaoChart.tsx` · `DistribuicaoAlternativas.tsx`
- Test: `src/features/gestor/__tests__/a11y.test.tsx`

**Interfaces:**
- Consumes: fixtures e mocks da Task 57 (`criarRpcMock`, `env`, `TEMAS_CRITICOS`, `ALUNOS_SIMULADO`); rotas `Inicio`/`VisaoGeral`/`Detalhamento`; `DrawerAluno`, `DrawerTemas`.
- Produces: `GraficoAcessivel` (`{ titulo: string; descricao: string; tabela: React.ReactNode; children: React.ReactNode }`) — consumido pelos 4 gráficos; matcher global `toHaveNoViolations`.

**Decisão registrada:** o projeto **não** tem axe. **Instalamos** `vitest-axe` + `axe-core` (dev) — verificação manual roteirizada não é regressível e a §11 pede garantia contínua. **Exceção**: a regra `color-contrast` do axe **não funciona em jsdom** (não há layout nem cor computada), então contraste AA fica como verificação manual com razões calculadas (Step 6) e o resto é automatizado.

- [ ] **Step 1: Instalar**

```bash
npm i -D vitest-axe@^0.1.0 axe-core@^4.10.0
```
Expected: `added 2 packages`. Confirmar: `npm ls vitest-axe axe-core` lista as duas sem `UNMET`.

- [ ] **Step 2: Registrar os matchers no setup global**

```ts
// src/test/setup.ts — acrescentar no topo, depois do import de jest-dom
import '@testing-library/jest-dom';
import * as axeMatchers from 'vitest-axe/matchers';
import { beforeAll, afterEach, afterAll, expect, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

expect.extend(axeMatchers);
```

```ts
// src/test/vitest-axe.d.ts
/// <reference types="vitest-axe/extend-expect" />
```

Run: `npm run type-check`
Expected: sai sem output (código 0) — `toHaveNoViolations` tipado.

- [ ] **Step 3: Criar o wrapper acessível de gráfico**

Nota de engenharia: a §11 pede `role="img"` + `<title>`/`<desc>`. O `<svg>` é gerado pelo **recharts**, que não repassa filhos SVG arbitrários — não é possível injetar `<title>`/`<desc>` dentro dele sem fork. O equivalente para leitor de tela é `role="img"` no contêiner com `aria-labelledby` (título visível) + `aria-describedby` (descrição), e o `<svg>` do recharts marcado `aria-hidden`. **Desvio documentado, mesma garantia funcional.**

```tsx
// src/features/gestor/charts/GraficoAcessivel.tsx
import * as React from 'react';

interface GraficoAcessivelProps {
  /** Título curto e visível do gráfico. Vira o nome acessível (role="img"). */
  titulo: string;
  /** Uma frase que diz o que o gráfico mostra e qual é a leitura. Vira a descrição acessível. */
  descricao: string;
  /** Alternativa tabular do mesmo dado — obrigatória (§11). */
  tabela: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Casca acessível de todo gráfico do portal: nome + descrição programáticos,
 * `<svg>` do recharts escondido do leitor de tela e alternativa tabular
 * sempre presente no DOM (dentro de <details>, alcançável por teclado).
 */
export const GraficoAcessivel: React.FC<GraficoAcessivelProps> = ({ titulo, descricao, tabela, children }) => {
  const id = React.useId();
  const tituloId = `${id}-titulo`;
  const descId = `${id}-desc`;
  return (
    <figure className="m-0">
      <figcaption id={tituloId} className="mb-2 text-sm font-medium text-foreground">{titulo}</figcaption>
      <p id={descId} className="sr-only">{descricao}</p>
      <div role="img" aria-labelledby={tituloId} aria-describedby={descId}>
        <div aria-hidden="true">{children}</div>
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-muted-foreground">Ver dados em tabela</summary>
        {tabela}
      </details>
    </figure>
  );
};
```

Se a Fase 3 já criou esse arquivo, **não recrie** — garanta que ele satisfaça o teste do Step 5; o teste é o contrato.

- [ ] **Step 4: Ligar os 4 gráficos ao wrapper**

Padrão exato (3 linhas por arquivo — envolver o `<ResponsiveContainer>` existente):

```tsx
// src/features/gestor/charts/EvolucaoChart.tsx
return (
  <GraficoAcessivel titulo={TITULO} descricao={DESCRICAO} tabela={<TabelaEvolucao pontos={pontos} />}>
    <ResponsiveContainer width="100%" height={280}>{/* ...conteúdo atual... */}</ResponsiveContainer>
  </GraficoAcessivel>
);
```

Strings exatas por gráfico (o teste do Step 5 depende delas):

| Arquivo | `titulo` | `descricao` |
|---|---|---|
| `EvolucaoChart.tsx` | `Evolução da proficiência institucional` | `Linha da proficiência média da instituição, um ponto por simulado realizado, na escala de 0 a 100.` |
| `AreasChart.tsx` | `Desempenho por grande área` | `Uma linha por grande área, em percentual de acerto, um ponto por simulado realizado.` |
| `DispersaoChart.tsx` (multi-semestre) | `Dispersão de proficiência por semestre` | `Cada ponto é um aluno, posicionado pelo semestre e pela proficiência, com linha de tendência da janela.` |
| `DispersaoChart.tsx` (semestre único) | `Distribuição de proficiência no semestre selecionado` | `Coluna de pontos com um aluno por ponto e mediana em destaque, para o semestre selecionado.` |
| `DistribuicaoAlternativas.tsx` | `Distribuição das alternativas marcadas` | `Percentual de alunos que marcou cada alternativa, com a correta identificada.` |

- [ ] **Step 5: Escrever o teste de a11y**

```tsx
// src/features/gestor/__tests__/a11y.test.tsx
import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ALUNOS_SIMULADO, SIM_1, TEMAS_CRITICOS, criarRpcMock } from './fixturesRegrasCriticas';
import Inicio from '@/features/gestor/routes/Inicio';
import VisaoGeral from '@/features/gestor/routes/VisaoGeral';
import Detalhamento from '@/features/gestor/routes/Detalhamento';
import { DrawerTemas } from '@/features/gestor/components/DrawerTemas';

const rpc = vi.hoisted(() => ({ atual: null as ReturnType<typeof import('vitest').vi.fn> | null }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...a: unknown[]) => rpc.atual!(...a), from: vi.fn(), auth: { onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) } },
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u', nome: 'Admin', email: 'a@sanar.com', id_ies: 'i' }, access: { roles: ['admin'], experiences: ['gestao'], capabilities: [] }, isImpersonating: false }),
}));

/** color-contrast e region não são avaliáveis em jsdom (sem layout/cor computada). */
const AXE = { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } };

function renderRota(ui: React.ReactElement, url: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}><TooltipProvider>{ui}</TooltipProvider></MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => { rpc.atual = criarRpcMock(); });

describe('acessibilidade — sem violações de axe por rota (§11)', () => {
  it('Início', async () => {
    const { container } = renderRota(<Inicio />, '/gestor/inicio');
    await waitFor(() => expect(rpc.atual!).toHaveBeenCalled());
    expect(await axe(container, AXE)).toHaveNoViolations();
  });

  it('Visão Geral', async () => {
    const { container } = renderRota(<VisaoGeral />, '/gestor/visao-geral?semestre=6ano');
    await screen.findByRole('radiogroup', { name: /modo do gráfico/i });
    expect(await axe(container, AXE)).toHaveNoViolations();
  });

  it('Detalhamento com 1 simulado', async () => {
    const { container } = renderRota(<Detalhamento />, `/gestor/detalhamento?semestre=6ano&simulados=${SIM_1}`);
    await screen.findByRole('heading', { name: /detalhamento das quest/i });
    expect(await axe(container, AXE)).toHaveNoViolations();
  });

  it('Drawer de temas aberto', async () => {
    const { container } = render(
      <TooltipProvider>
        <DrawerTemas aberto especialidade="Neonatologia" temas={TEMAS_CRITICOS} onFechar={() => {}} />
      </TooltipProvider>,
    );
    expect(await axe(container, AXE)).toHaveNoViolations();
  });
});

describe('acessibilidade — teclado no drawer (§11)', () => {
  it('ESC fecha o drawer e o foco volta para o disparador', async () => {
    const onFechar = vi.fn();
    const Host: React.FC = () => {
      const [aberto, setAberto] = React.useState(false);
      return (
        <TooltipProvider>
          <button onClick={() => setAberto(true)}>abrir temas</button>
          <DrawerTemas
            aberto={aberto}
            especialidade="Neonatologia"
            temas={TEMAS_CRITICOS}
            onFechar={() => { onFechar(); setAberto(false); }}
          />
        </TooltipProvider>
      );
    };
    render(<Host />);
    const disparador = screen.getByRole('button', { name: 'abrir temas' });
    await userEvent.click(disparador);
    const painel = await screen.findByRole('dialog');
    expect(painel).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    expect(onFechar).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(disparador).toHaveFocus());
  });

  it('o foco fica preso no drawer: Tab não alcança conteúdo de fora', async () => {
    render(
      <TooltipProvider>
        <button>fora</button>
        <DrawerTemas aberto especialidade="Neonatologia" temas={TEMAS_CRITICOS} onFechar={() => {}} />
      </TooltipProvider>,
    );
    const painel = screen.getByRole('dialog');
    const fora = screen.getByRole('button', { name: 'fora' });
    for (let i = 0; i < 12; i += 1) {
      await userEvent.tab();
      expect(fora).not.toHaveFocus();
      expect(painel.contains(document.activeElement)).toBe(true);
    }
  });
});

describe('acessibilidade — gráficos (§11)', () => {
  it('todo gráfico é role="img" com nome e descrição, e tem alternativa tabular', async () => {
    renderRota(<VisaoGeral />, '/gestor/visao-geral?semestre=geral');
    const graficos = await screen.findAllByRole('img');
    expect(graficos.length).toBeGreaterThan(0);
    for (const g of graficos) {
      expect(g).toHaveAccessibleName(/\S/);
      expect(g).toHaveAccessibleDescription(/\S/);
      const figura = g.closest('figure');
      expect(figura, 'todo gráfico vive dentro de <figure>').not.toBeNull();
      expect(within(figura as HTMLElement).getByText('Ver dados em tabela')).toBeInTheDocument();
      expect(within(figura as HTMLElement).getByRole('table')).toBeInTheDocument();
    }
  });

  it('nenhum svg de gráfico é exposto direto ao leitor de tela', async () => {
    const { container } = renderRota(<VisaoGeral />, '/gestor/visao-geral?semestre=geral');
    await screen.findAllByRole('img');
    container.querySelectorAll('.recharts-wrapper').forEach((el) => {
      expect(el.closest('[aria-hidden="true"]')).not.toBeNull();
    });
  });
});
```

- [ ] **Step 6: Rodar**

Run: `npx vitest run src/features/gestor/__tests__/a11y.test.tsx`
Expected na primeira execução: FAIL com `expected element to have accessible description` (gráficos ainda sem o wrapper) e `Expected the element to have focus` (drawer sem retorno de foco). Depois de aplicar os Steps 3–4 e usar o `Dialog`/`Sheet` do shadcn (que já implementa trap + ESC + retorno de foco via Radix): `Tests 8 passed (8)`.

- [ ] **Step 7: Contraste AA — verificação manual roteirizada (o que o axe não cobre)**

Razões calculadas sobre os tokens da Task 59 (fórmula WCAG 2.1, `(L1+0.05)/(L2+0.05)`):

| Par | Razão | Veredito |
|---|---|---|
| `--gp-text-1` `#ECEFEF` sobre `--gp-surface-1` escuro `#17191A` | ≈ 14,4:1 | AAA |
| `--gp-text-3` `#929999` sobre `#17191A` | **6,30:1** | AA para texto normal |
| `--gp-brand-on-dark` `#F0817D` sobre `#17191A` | **7,08:1** | AA |
| `#B81414` sobre `#17191A` | **2,73:1** | **FALHA** — por isso a proibição da §Task 59 |
| `--gp-text-3` `#899090` sobre branco (claro) | **3,25:1** | **falha para texto normal**; só ≥18,66px bold, ícone ou borda |

Roteiro manual, executado uma vez por rota, no claro e no escuro, com o DevTools:
1. `npm run dev`, abrir `/gestor/inicio`, `/gestor/visao-geral`, `/gestor/detalhamento`.
2. Alternar tema pelo controle do app (next-themes, classe `dark` no `<html>`).
3. DevTools → Elements → Accessibility → inspecionar todo texto que use `--gp-text-3`: confirmar que nenhum é corpo de texto em tamanho normal.
4. `Tab` do primeiro ao último elemento focável de cada rota: **anel de foco visível em todos** (`--gp-focus-ring`), nenhum `outline: none` sem substituto.
5. Registrar no PR: 6 screenshots (3 rotas × 2 temas) com o foco visível em um controle.

- [ ] **Step 8: Commit**
```bash
git add package.json package-lock.json src/test/setup.ts src/test/vitest-axe.d.ts src/features/gestor/charts src/features/gestor/__tests__/a11y.test.tsx
git commit -m "test(gestor): vitest-axe + a11y por rota, trap de foco no drawer e graficos com role=img"
```

---

### Task 59: Tema escuro — mapear os tokens do handoff sobre as variáveis do repo

**Files:**
- Create: `src/features/gestor/gestor-theme.css`
- Modify: `src/features/gestor/shell/GestorShell.tsx`
- Test: `src/features/gestor/__tests__/tema.test.tsx`

**Interfaces:**
- Consumes: variáveis já existentes em `src/index.css` (`--background`, `--card`, `--foreground`, `--muted`, `--muted-foreground`, `--border`, `--primary`, `--chart-1..5`, `--radius`) nos blocos `:root` e `.dark`.
- Produces: as variáveis `--gp-*` escopadas em `.gestor-portal`; `GestorShell` passa a aplicar a classe `gestor-portal` no nó raiz.

**Achado que define a abordagem:** o handoff escopa os tokens em `[data-theme="dark"]`. O repo usa **`next-themes` com `attribute="class"`** (`src/App.tsx:150`) e **`darkMode: ["class"]`** no `tailwind.config.ts:5` — ou seja, o escuro é a classe **`.dark`** no `<html>`, e `[data-theme]` **nunca é setado**. Copiar o CSS do handoff como está produziria um tema escuro que nunca ativa. Por isso: **mapear** (nomes `--gp-*` novos, escopados em `.gestor-portal`, apontando para as variáveis do repo onde há equivalente) e **nunca sobrescrever** as variáveis do repo — assim aluno e admin ficam intocados.

- [ ] **Step 1: Tabela de mapeamento (decisões, não conveniência)**

| Token do handoff | Valor handoff claro / escuro | Vira no repo | Por quê |
|---|---|---|---|
| `--gp-bg-app` | `#EDEEF0` / `#0B0C0D` | `hsl(var(--background))` | o repo já tem fundo de app por tema |
| `--gp-surface-1` | `#FFFFFF` / `#17191A` | `hsl(var(--card))` | claro `#FFF`, escuro `220 13% 10%` — já é "nunca preto puro em card" |
| `--gp-surface-2` | `#F9FAFB` / `#1E2223` | `hsl(var(--muted))` | segundo degrau já existe por tema |
| `--gp-surface-3` | `#F4F5F6` / `#23282A` | literal `hsl(220 14% 93%)` / `hsl(220 13% 16%)` | o repo não tem 3º degrau; é o único par literal de superfície |
| `--gp-border-strong` | `#E9EBED` / `#282C2D` | `hsl(var(--border))` | equivalente direto |
| `--gp-border-subtle` | `#F1F2F4` / `#1F2323` | `hsl(var(--border) / 0.5)` | derivado, não novo hex |
| `--gp-border-input` | `#C3C6C6` / `#535959` | `hsl(var(--input))` | equivalente direto |
| `--gp-text-1` | `#111212` / `#ECEFEF` | `hsl(var(--foreground))` | escuro do repo é `220 13% 91%` — nunca `#FFF` |
| `--gp-text-2` | `#414141` / `#B4B9B9` | `hsl(var(--foreground) / 0.78)` | derivado |
| `--gp-text-3` | `#899090` / `#929999` | `hsl(var(--muted-foreground))` | equivalente direto |
| `--gp-brand` | `#B81414` / `#B81414` | `hsl(var(--primary))` | **decisão**: usa a marca do app (vinho `0 65% 35%` claro / `0 65% 45%` escuro). No escuro **clareia**, como manda a regra |
| `--gp-brand-on-dark` | — / `#F0817D` | literal `hsl(2 76% 72%)` | `#B81414` sobre `#17191A` dá **2,73:1** — reprova AA. Token de texto de marca no escuro é obrigatório |
| `--gp-serie-1..5` | 5 hexes fixos | `hsl(var(--chart-1..5))` | o repo já tem a paleta calibrada nos dois temas. A `serie-1` do handoff é `#111212` (quase preto) — **invisível no escuro**; descartada |
| `--gp-grid` / `--gp-axis` | `#F1F2F4` / `#899090` | `hsl(var(--border))` / `hsl(var(--muted-foreground))` | equivalentes |
| `--gp-success/warning/danger/info` (+ `-on`, `-surface`) | 12 hexes | literais por tema | o repo só tem `--destructive`; semânticos de status não existem. Único bloco realmente novo |
| `--gp-radius-*` | 8/12/16px | `calc(var(--radius) - 4px)` / `var(--radius)` / `calc(var(--radius) + 4px)` | `--radius: 0.75rem` = 12px — casa com `md` |
| `--gp-space-*`, `--gp-font-*`, `--gp-motion-*` | grade de 4px, Inter, 5 durações | **não portados** | Tailwind já dá espaçamento, fonte e `transition-*`; portar duplicaria a fonte da verdade |
| `--gp-shadow-*`, `--gp-scrim`, `--gp-focus-ring` | sombras | literais por tema | elevação por cor de superfície no escuro (sombra quase nula) |
| `--gp-skeleton` | ausente no handoff | `hsl(var(--muted))` / `hsl(220 13% 14%)` | **novo**: escuro calibrado 4 pontos acima do card — nunca clarão branco |

- [ ] **Step 2: Escrever o CSS**

```css
/* src/features/gestor/gestor-theme.css
   Camada de tema do Portal do Gestor v2. Escopada em `.gestor-portal` — não
   redefine NENHUMA variável de src/index.css, logo não afeta aluno nem admin.
   Regras (spec §Tema escuro): mesmos nomes nos dois temas, elevação vem da COR
   da superfície, hover no escuro CLAREIA, nunca `filter: invert()`,
   nunca `#B81414` como cor de TEXTO sobre fundo escuro (use --gp-brand-on-dark). */

.gestor-portal {
  /* Superfícies e linhas — mapeadas nas variáveis do repo */
  --gp-bg-app: hsl(var(--background));
  --gp-surface-1: hsl(var(--card));
  --gp-surface-2: hsl(var(--muted));
  --gp-surface-3: hsl(220 14% 93%);
  --gp-border-strong: hsl(var(--border));
  --gp-border-subtle: hsl(var(--border) / 0.5);
  --gp-border-input: hsl(var(--input));

  /* Texto */
  --gp-text-1: hsl(var(--foreground));
  --gp-text-2: hsl(var(--foreground) / 0.78);
  --gp-text-3: hsl(var(--muted-foreground));
  --gp-text-inverse: hsl(var(--primary-foreground));

  /* Marca */
  --gp-brand: hsl(var(--primary));
  --gp-brand-strong: hsl(var(--primary-dark, var(--primary)));
  --gp-brand-on-dark: hsl(var(--primary));   /* no claro, texto de marca = a própria marca */
  --gp-brand-surface: hsl(var(--primary) / 0.08);
  --gp-brand-border: hsl(var(--primary) / 0.24);
  --gp-on-brand: hsl(var(--primary-foreground));

  /* Semânticos (único bloco literal — o repo não tem status tokens) */
  --gp-success: hsl(145 76% 32%);
  --gp-success-on: hsl(145 76% 20%);
  --gp-success-surface: hsl(145 45% 93%);
  --gp-warning: hsl(38 92% 43%);
  --gp-warning-on: hsl(38 92% 26%);
  --gp-warning-surface: hsl(38 75% 94%);
  --gp-danger: hsl(0 74% 44%);
  --gp-danger-on: hsl(0 74% 27%);
  --gp-danger-surface: hsl(0 60% 94%);
  --gp-info: hsl(200 95% 35%);
  --gp-info-on: hsl(200 95% 21%);
  --gp-info-surface: hsl(200 60% 94%);

  /* Séries de gráfico — a paleta do repo já é calibrada nos dois temas */
  --gp-serie-1: hsl(var(--chart-1));
  --gp-serie-2: hsl(var(--chart-2));
  --gp-serie-3: hsl(var(--chart-3));
  --gp-serie-4: hsl(var(--chart-4));
  --gp-serie-5: hsl(var(--chart-5));
  --gp-grid: hsl(var(--border));
  --gp-axis: hsl(var(--muted-foreground));

  /* Forma */
  --gp-radius-sm: calc(var(--radius) - 4px);
  --gp-radius-md: var(--radius);
  --gp-radius-lg: calc(var(--radius) + 4px);
  --gp-radius-pill: 10em;

  /* Elevação e foco */
  --gp-shadow-card: 0 1px 2px hsl(var(--foreground) / 0.03), 0 14px 34px -22px hsl(var(--foreground) / 0.16);
  --gp-shadow-panel: -12px 0 28px -20px hsl(var(--foreground) / 0.25);
  --gp-shadow-drawer: -28px 0 64px -30px hsl(var(--foreground) / 0.42);
  --gp-scrim: hsl(220 13% 6% / 0.42);
  --gp-focus-ring: 0 0 0 3px hsl(var(--ring) / 0.35);

  /* Skeleton — no claro, um degrau acima do card */
  --gp-skeleton: hsl(var(--muted));
  --gp-skeleton-brilho: hsl(var(--background));
}

/* Camada escura. `.dark` é a classe do next-themes (attribute="class") —
   NÃO usar [data-theme="dark"] do handoff: esse atributo não existe neste app. */
.dark .gestor-portal {
  --gp-surface-3: hsl(220 13% 16%);

  /* Nunca #B81414 como texto sobre escuro (2,73:1 — reprova AA).
     Este token dá 7,08:1 sobre a superfície de card do escuro. */
  --gp-brand-on-dark: hsl(2 76% 72%);
  --gp-brand-surface: hsl(var(--primary) / 0.16);
  --gp-brand-border: hsl(var(--primary) / 0.38);

  --gp-success: hsl(145 57% 47%);
  --gp-success-on: hsl(145 55% 61%);
  --gp-success-surface: hsl(150 48% 14%);
  --gp-warning: hsl(38 76% 58%);
  --gp-warning-on: hsl(38 74% 61%);
  --gp-warning-surface: hsl(35 55% 13%);
  --gp-danger: hsl(2 82% 62%);
  --gp-danger-on: hsl(4 80% 72%);
  --gp-danger-surface: hsl(356 52% 14%);
  --gp-info: hsl(202 72% 56%);
  --gp-info-on: hsl(202 68% 66%);
  --gp-info-surface: hsl(203 59% 14%);

  /* Elevação vem da COR da superfície: sombra quase desaparece no escuro */
  --gp-shadow-card: 0 1px 2px hsl(0 0% 0% / 0.30), 0 14px 34px -22px hsl(0 0% 0% / 0.60);
  --gp-shadow-panel: -12px 0 28px -20px hsl(0 0% 0% / 0.55);
  --gp-shadow-drawer: -28px 0 64px -30px hsl(0 0% 0% / 0.75);
  --gp-scrim: hsl(0 0% 0% / 0.60);
  --gp-focus-ring: 0 0 0 3px hsl(2 76% 72% / 0.28);

  /* Skeleton calibrado: 4 pontos de luz acima do card (220 13% 10%) — nunca clarão */
  --gp-skeleton: hsl(220 13% 14%);
  --gp-skeleton-brilho: hsl(220 13% 18%);
}

/* Hover: no claro ESCURECE de leve; no escuro CLAREIA — nunca o contrário. */
.gestor-portal .gp-hover-surface { transition: background-color 140ms cubic-bezier(0.2, 0, 0, 1); }
.gestor-portal .gp-hover-surface:hover { background-color: hsl(var(--accent)); }
.dark .gestor-portal .gp-hover-surface:hover { background-color: hsl(220 13% 16%); }

.gestor-portal .gp-skeleton {
  background-color: var(--gp-skeleton);
  border-radius: var(--gp-radius-sm);
}
.gestor-portal :focus-visible { outline: none; box-shadow: var(--gp-focus-ring); }
```

- [ ] **Step 3: Aplicar a classe no shell**

```tsx
// src/features/gestor/shell/GestorShell.tsx — no nó raiz
import '@/features/gestor/gestor-theme.css';
// ...
return (
  <div className="gestor-portal flex min-h-screen bg-[var(--gp-bg-app)] text-[var(--gp-text-1)]">
    {/* sidebar 240px + <Outlet /> */}
  </div>
);
```

- [ ] **Step 4: Escrever o teste**

```tsx
// src/features/gestor/__tests__/tema.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { criarRpcMock } from './fixturesRegrasCriticas';
import VisaoGeral from '@/features/gestor/routes/VisaoGeral';

const RAIZ = resolve(__dirname, '..');
const CSS = readFileSync(join(RAIZ, 'gestor-theme.css'), 'utf-8');

function arquivosFonte(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== '__tests__') arquivosFonte(p, acc); }
    else if (/\.(ts|tsx|css)$/.test(e.name) && e.name !== 'gestor-theme.css') acc.push(p);
  }
  return acc;
}
const FONTES = arquivosFonte(RAIZ).map((p) => ({ p, src: readFileSync(p, 'utf-8') }));

const declarados = (bloco: string) =>
  new Set([...bloco.matchAll(/(--gp-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));

const blocoDe = (seletor: string) => {
  const i = CSS.indexOf(`${seletor} {`);
  return i < 0 ? '' : CSS.slice(i, CSS.indexOf('\n}', i));
};

describe('tema do portal do gestor', () => {
  it('todo token --gp-* usado no código está declarado no tema claro', () => {
    const claro = declarados(blocoDe('.gestor-portal'));
    const usados = new Set<string>();
    FONTES.forEach(({ src }) => {
      for (const m of src.matchAll(/var\((--gp-[a-z0-9-]+)/g)) usados.add(m[1]);
    });
    const faltando = [...usados].filter((t) => !claro.has(t)).sort();
    expect(faltando, `tokens usados sem declaração em .gestor-portal: ${faltando.join(', ')}`).toEqual([]);
  });

  it('todo token que muda de valor no escuro está declarado sob .dark .gestor-portal', () => {
    const escuro = declarados(blocoDe('.dark .gestor-portal'));
    // Os que NÃO derivam de variável do repo precisam de par explícito no escuro.
    const literaisClaro = [...blocoDe('.gestor-portal').matchAll(/(--gp-[a-z0-9-]+)\s*:\s*([^;]+);/g)]
      .filter(([, , v]) => !v.includes('var(--'))
      .map(([, t]) => t);
    const semPar = literaisClaro.filter((t) => !escuro.has(t) && !t.startsWith('--gp-radius'));
    expect(semPar, `tokens literais sem calibração no escuro: ${semPar.join(', ')}`).toEqual([]);
  });

  it('não usa [data-theme] — o app é next-themes por classe .dark', () => {
    expect(CSS).not.toContain('data-theme');
  });

  it('nunca inverte filtro e nunca usa #B81414 como cor de texto', () => {
    expect(CSS).not.toMatch(/filter:\s*invert/i);
    FONTES.forEach(({ p, src }) => {
      expect(src, `${p} usa filter: invert()`).not.toMatch(/invert\(/);
      expect(src, `${p} usa #B81414 literal — use var(--gp-brand)/var(--gp-brand-on-dark)`)
        .not.toMatch(/#B81414/i);
    });
  });

  it('nenhum hex ou cor solta no código do portal — tudo por token (§11)', () => {
    FONTES.filter(({ p }) => /\.tsx?$/.test(p)).forEach(({ p, src }) => {
      expect(src, `${p} tem hex literal`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(src, `${p} tem rgb()/rgba() literal`).not.toMatch(/\brgba?\(/);
    });
  });

  it('skeleton do escuro é mais claro que o card, sem clarão branco', () => {
    const escuro = blocoDe('.dark .gestor-portal');
    const m = escuro.match(/--gp-skeleton:\s*hsl\(220 13% (\d+)%\)/);
    expect(m, '--gp-skeleton precisa de valor hsl explícito no escuro').not.toBeNull();
    const luz = Number(m![1]);
    expect(luz).toBeGreaterThan(10); // card do repo no escuro: 220 13% 10%
    expect(luz).toBeLessThan(30);    // acima disso é clarão
  });

  it('hover no escuro clareia a superfície', () => {
    const i = CSS.indexOf('.dark .gestor-portal .gp-hover-surface:hover');
    expect(i).toBeGreaterThan(-1);
    const regra = CSS.slice(i, CSS.indexOf('}', i));
    const luz = Number(regra.match(/hsl\(220 13% (\d+)%\)/)![1]);
    expect(luz).toBeGreaterThan(10); // maior que o card ⇒ clareia
  });
});

describe('render nos dois temas', () => {
  const rpc = { atual: criarRpcMock() };
  beforeEach(() => { rpc.atual = criarRpcMock(); document.documentElement.classList.remove('dark'); });

  const renderTema = (tema: 'light' | 'dark') => {
    if (tema === 'dark') document.documentElement.classList.add('dark');
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    return render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/gestor/visao-geral?semestre=6ano']}>
          <TooltipProvider><VisaoGeral /></TooltipProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  };

  it.each(['light', 'dark'] as const)('Visão Geral renderiza no tema %s', async (tema) => {
    const { container, unmount } = renderTema(tema);
    expect(await screen.findByRole('radiogroup', { name: /modo do gráfico/i })).toBeInTheDocument();
    // nenhum estilo inline de cor: cor sempre vem de classe/token
    container.querySelectorAll('[style]').forEach((el) => {
      expect(el.getAttribute('style')).not.toMatch(/(^|;)\s*(color|background(-color)?)\s*:/);
    });
    unmount();
  });
});
```

Nota: o mock de `@/integrations/supabase/client` e `@/contexts/AuthContext` do arquivo de teste é idêntico ao da Task 58 (`vi.hoisted` + `vi.mock`); copiar os dois blocos para o topo deste arquivo.

- [ ] **Step 5: Rodar**

Run: `npx vitest run src/features/gestor/__tests__/tema.test.tsx`
Expected: primeira execução FAIL com `ENOENT: no such file or directory ... gestor-theme.css`; depois do Step 2, FAIL em "nenhum hex ou cor solta" listando os arquivos da Fase 3/4 com hex literal; depois de trocar esses hexes por `var(--gp-*)`: `Tests 9 passed (9)`.

- [ ] **Step 6: Commit**
```bash
git add src/features/gestor/gestor-theme.css src/features/gestor/shell/GestorShell.tsx src/features/gestor/__tests__/tema.test.tsx
git commit -m "feat(gestor): camada de tema --gp-* mapeada nas variaveis do repo, claro e escuro"
```

---

### Task 59b: Reduced-motion e decisão sobre virtualização

> **Pertence à Fase 6 (acabamento).** Fecha duas exigências que não tinham tarefa: `prefers-reduced-motion` (handoff `docs/07-motion.md` e `docs/06-data-viz.md`, princípio 6) e a virtualização condicional do spec §8.5.

**Files:**
- Create: `src/features/gestor/hooks/usePrefersReducedMotion.ts`
- Modify: `src/features/gestor/charts/EvolucaoChart.tsx` · `src/features/gestor/charts/AreasChart.tsx` · `src/features/gestor/charts/DispersaoChart.tsx` · `src/features/gestor/charts/DistribuicaoAlternativas.tsx`
- Test: `src/features/gestor/__tests__/usePrefersReducedMotion.test.tsx`
- Create: `docs/superpowers/notes/2026-07-25-decisao-virtualizacao.md`

**Interfaces:**
- Consumes: nada de tarefas anteriores além dos 4 charts das Tasks 38, 39, 40 e 54.
- Produces: `export function usePrefersReducedMotion(): boolean`. Os 4 charts passam a repassar `isAnimationActive={!reduced}` ao recharts.

**Nota de ambiente de teste:** `window.matchMedia` **já está mockado globalmente** em `src/test/setup.ts:67`, retornando sempre `matches: false`. Portanto o teste do caso "reduce" precisa **sobrescrever** o mock por teste — não criar um novo mock global, que quebraria o `ThemeProvider` de outros testes.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/gestor/__tests__/usePrefersReducedMotion.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

/**
 * src/test/setup.ts:67 já mocka window.matchMedia globalmente com
 * matches: false. Aqui sobrescrevemos por teste e restauramos depois,
 * para não afetar os testes que dependem do ThemeProvider.
 */
const matchMediaOriginal = window.matchMedia;

function mockMatchMedia(matches: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const mql = {
    matches,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn((_: string, cb: (e: MediaQueryListEvent) => void) => {
      listeners.add(cb);
    }),
    removeEventListener: vi.fn((_: string, cb: (e: MediaQueryListEvent) => void) => {
      listeners.delete(cb);
    }),
    dispatchEvent: vi.fn(),
  };
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue(mql),
  });
  return { mql, listeners };
}

afterEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: matchMediaOriginal,
  });
});

describe('usePrefersReducedMotion', () => {
  it('devolve false quando o usuario nao pediu reducao de movimento', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });

  it('devolve true quando o usuario pediu reducao de movimento', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(true);
  });

  it('consulta exatamente a media query de reduced-motion', () => {
    mockMatchMedia(false);
    renderHook(() => usePrefersReducedMotion());
    expect(window.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });

  it('registra e remove o listener de mudanca', () => {
    const { mql } = mockMatchMedia(false);
    const { unmount } = renderHook(() => usePrefersReducedMotion());
    expect(mql.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    unmount();
    expect(mql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('nao quebra quando matchMedia nao existe no ambiente', () => {
    Object.defineProperty(window, 'matchMedia', { writable: true, value: undefined });
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/gestor/__tests__/usePrefersReducedMotion.test.tsx`

Expected: FAIL com `Failed to resolve import "../hooks/usePrefersReducedMotion"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/gestor/hooks/usePrefersReducedMotion.ts
import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Espelha a preferência de sistema por movimento reduzido.
 *
 * Handoff docs/06-data-viz.md princípio 6 e docs/07-motion.md: as animações de
 * entrada (linha se desenhando, barra crescendo, número contando) respeitam
 * `prefers-reduced-motion`. O gráfico continua desenhado — só não anima.
 *
 * Degrada para `false` em ambiente sem matchMedia (SSR, jsdom sem mock).
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;

    const mql = window.matchMedia(QUERY);
    setReduced(mql.matches);

    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
```

Nos 4 charts, desligar a animação do recharts. Padrão idêntico em cada um — exemplo em `EvolucaoChart.tsx`:

```tsx
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

export function EvolucaoChart({ pontos, meta }: EvolucaoChartProps) {
  const reduced = usePrefersReducedMotion();
  // ...
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={pontos}>
        {/* ... eixos, grade, linha de meta ... */}
        <Line
          type="monotone"
          dataKey="valor"
          strokeWidth={2.5}
          stroke="hsl(var(--primary))"
          isAnimationActive={!reduced}
          animationDuration={reduced ? 0 : 560}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

Aplicar `isAnimationActive={!reduced}` em: `<Line>` de `EvolucaoChart`, cada `<Line>` de `AreasChart`, `<Scatter>` de `DispersaoChart` e `<Bar>` de `DistribuicaoAlternativas`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/gestor/__tests__/usePrefersReducedMotion.test.tsx`

Expected: PASS — 5 testes.

Confirmar que os charts não regrediram:

Run: `npx vitest run src/features/gestor/__tests__ -t "Chart"`

Expected: PASS.

- [ ] **Step 5: Decidir sobre virtualização e registrar**

Spec §8.5: "Virtualização só onde a tabela realmente passa de 100 linhas." Medir antes de instalar dependência.

Verificar o `pageSize` efetivo das duas tabelas paginadas:

```bash
grep -rn "pageSize" src/features/gestor/ | grep -iE "default|= 25|= 50|= 100"
```

Expected: `pageSize` default de 25 nas Tasks 45 (`useAlunos`) e 54 (`useQuestoes`), com paginação no **servidor** — nenhuma tabela renderiza mais de `pageSize` linhas por vez.

Confirmar que `@tanstack/react-virtual` não está instalado:

```bash
grep -n "react-virtual" package.json || echo "NAO instalado"
```

Expected: `NAO instalado`.

Criar `docs/superpowers/notes/2026-07-25-decisao-virtualizacao.md`:

```markdown
# Decisão: sem virtualização de tabela no Portal do Gestor v2

**Data:** 2026-07-25 · **Spec:** §8.5 · **Task:** 59b

## Medição

| Tabela | Hook | pageSize default | Paginação | Linhas renderizadas por vez |
|---|---|---|---|---|
| Alunos (Visão Geral) | `useAlunos` | 25 | servidor (`get_gestor_alunos`) | 25 |
| Alunos do simulado (Detalhamento) | `useAlunos` | 25 | servidor | 25 |
| Questões (Detalhamento) | `useQuestoes` | 25 | servidor (`get_gestor_questoes`) | 25 |

## Decisão

**Não instalar `@tanstack/react-virtual`.** O spec §8.5 condiciona a virtualização a
tabela que "realmente passa de 100 linhas"; com paginação no servidor e `pageSize`
de 25, nenhuma tabela do portal chega perto disso. Instalar a dependência agora
seria custo de bundle e de complexidade sem ganho medido.

## Quando reabrir

Se algum `pageSize` subir para além de 100, ou se aparecer uma tabela sem
paginação de servidor. O comando, se for o caso: `npm install @tanstack/react-virtual`.
O handoff pedia virtualização assumindo tabela de 104 alunos carregada de uma vez —
premissa que a arquitetura de RPC paginada eliminou.
```

- [ ] **Step 6: Commit**

```bash
git add src/features/gestor/hooks/usePrefersReducedMotion.ts src/features/gestor/charts/ src/features/gestor/__tests__/usePrefersReducedMotion.test.tsx docs/superpowers/notes/2026-07-25-decisao-virtualizacao.md
git commit -m "feat(gestor): respeita prefers-reduced-motion e decide nao virtualizar

usePrefersReducedMotion espelha a preferencia de sistema e os 4 charts passam
isAnimationActive={!reduced} ao recharts — o grafico continua desenhado, so
nao anima (handoff docs/06 principio 6).

O teste sobrescreve o mock global de matchMedia de src/test/setup.ts por teste
e restaura depois, para nao quebrar os testes que dependem do ThemeProvider.

Virtualizacao: medida antes de instalar. Com paginacao no servidor e pageSize
25, nenhuma tabela passa de 100 linhas, entao @tanstack/react-virtual NAO e
instalado. Decisao e criterio de reabertura registrados em docs/superpowers/notes."
```

---

### Task 60: Telemetria — os 7 eventos da §10, sem PII

**Files:**
- Create: `src/features/gestor/lib/telemetria.ts`
- Modify: `src/features/gestor/routes/Inicio.tsx` · `VisaoGeral.tsx` · `Detalhamento.tsx`
- Modify: `src/features/gestor/components/DrawerAluno.tsx` · `DrawerTemas.tsx`
- Test: `src/features/gestor/__tests__/telemetria.test.tsx`

**Interfaces:**
- Consumes: `useAnalyticsTracker` de `@/hooks/useAnalyticsTracker` (tracker **já existente** do projeto, grava em `public.analytics_events`); `FiltroSemestre`, `ModoGrafico` de `@/features/gestor/api/types`.
- Produces:
```ts
export type EventoGestor =
  | 'gestor_tela_vista' | 'gestor_filtro_alterado' | 'gestor_modo_grafico_alterado'
  | 'gestor_tempo_ate_primeiro_insight' | 'gestor_drawer_aberto'
  | 'gestor_export_solicitado' | 'gestor_erro_bloco';
export const CHAVES_PROIBIDAS: readonly string[];
export function sanitizarProps(props: Record<string, unknown>): Record<string, unknown>;
export function useTelemetriaGestor(): {
  telaVista(tela: 'inicio' | 'visao_geral' | 'detalhamento', semestre: FiltroSemestre): void;
  filtroAlterado(tipo: 'semestre' | 'simulados' | 'ies' | 'area', valor: string): void;
  modoGraficoAlterado(modo: ModoGrafico): void;
  tempoAtePrimeiroInsight(ms: number): void;
  drawerAberto(tipo: 'aluno' | 'temas' | 'questao'): void;
  exportSolicitado(escopo: 'visao_geral' | 'detalhamento' | 'alunos' | 'questoes'): void;
  erroBloco(bloco: string, codigo: string): void;
  marcarPrimeiroInsight(): void;
};
```

- [ ] **Step 1: Escrever o teste**

```tsx
// src/features/gestor/__tests__/telemetria.test.tsx
import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CHAVES_PROIBIDAS, sanitizarProps, useTelemetriaGestor } from '@/features/gestor/lib/telemetria';

const trackEvent = vi.fn();
vi.mock('@/hooks/useAnalyticsTracker', () => ({
  useAnalyticsTracker: () => ({ trackEvent }),
  default: () => ({ trackEvent }),
}));

const Sonda: React.FC = () => {
  const t = useTelemetriaGestor();
  React.useEffect(() => { t.telaVista('visao_geral', '6ano'); }, []);
  return (
    <div>
      <button onClick={() => t.filtroAlterado('semestre', '7')}>filtro</button>
      <button onClick={() => t.modoGraficoAlterado('area')}>modo</button>
      <button onClick={() => { t.marcarPrimeiroInsight(); t.drawerAberto('aluno'); }}>drawer</button>
      <button onClick={() => t.exportSolicitado('detalhamento')}>export</button>
      <button onClick={() => t.erroBloco('evolucao', 'permissao_negada')}>erro</button>
    </div>
  );
};

const chamada = (nome: string) => trackEvent.mock.calls.find((c) => c[0].eventName === nome)?.[0];

beforeEach(() => { trackEvent.mockClear(); vi.useRealTimers(); });

describe('telemetria do gestor (§10)', () => {
  it('gestor_tela_vista dispara no mount, com tela e semestre', () => {
    render(<Sonda />);
    expect(chamada('gestor_tela_vista')).toEqual({
      eventName: 'gestor_tela_vista', category: 'navigation',
      data: { tela: 'visao_geral', semestre: '6ano' },
    });
  });

  it('gestor_filtro_alterado dispara na troca, com tipo e valor', async () => {
    render(<Sonda />);
    await userEvent.click(screen.getByRole('button', { name: 'filtro' }));
    expect(chamada('gestor_filtro_alterado')).toEqual({
      eventName: 'gestor_filtro_alterado', category: 'interaction',
      data: { tipo: 'semestre', valor: '7' },
    });
  });

  it('gestor_modo_grafico_alterado dispara com o modo', async () => {
    render(<Sonda />);
    await userEvent.click(screen.getByRole('button', { name: 'modo' }));
    expect(chamada('gestor_modo_grafico_alterado')!.data).toEqual({ modo: 'area' });
  });

  it('gestor_drawer_aberto dispara com o tipo, e o primeiro insight fecha o tempo uma única vez', async () => {
    render(<Sonda />);
    await userEvent.click(screen.getByRole('button', { name: 'drawer' }));
    expect(chamada('gestor_drawer_aberto')!.data).toEqual({ tipo: 'aluno' });

    const tempo = chamada('gestor_tempo_ate_primeiro_insight')!;
    expect(tempo.category).toBe('performance');
    expect(typeof tempo.data!.ms).toBe('number');
    expect(tempo.data!.ms as number).toBeGreaterThanOrEqual(0);

    await userEvent.click(screen.getByRole('button', { name: 'drawer' }));
    const vezes = trackEvent.mock.calls.filter((c) => c[0].eventName === 'gestor_tempo_ate_primeiro_insight');
    expect(vezes, 'o tempo até o primeiro insight é medido UMA vez por sessão de tela').toHaveLength(1);
  });

  it('gestor_export_solicitado e gestor_erro_bloco disparam com as propriedades da §10', async () => {
    render(<Sonda />);
    await userEvent.click(screen.getByRole('button', { name: 'export' }));
    await userEvent.click(screen.getByRole('button', { name: 'erro' }));
    expect(chamada('gestor_export_solicitado')!.data).toEqual({ escopo: 'detalhamento' });
    expect(chamada('gestor_erro_bloco')).toEqual({
      eventName: 'gestor_erro_bloco', category: 'error',
      data: { bloco: 'evolucao', codigo: 'permissao_negada' },
    });
  });

  it('são exatamente os 7 eventos da §10 — nenhum a mais', async () => {
    render(<Sonda />);
    for (const nome of ['filtro', 'modo', 'drawer', 'export', 'erro']) {
      await userEvent.click(screen.getByRole('button', { name: nome }));
    }
    const nomes = new Set(trackEvent.mock.calls.map((c) => c[0].eventName));
    expect([...nomes].sort()).toEqual([
      'gestor_drawer_aberto', 'gestor_erro_bloco', 'gestor_export_solicitado',
      'gestor_filtro_alterado', 'gestor_modo_grafico_alterado',
      'gestor_tela_vista', 'gestor_tempo_ate_primeiro_insight',
    ]);
  });
});

describe('telemetria — nenhuma PII (§7.7, §10)', () => {
  it('sanitizarProps remove toda chave identificável', () => {
    const limpo = sanitizarProps({
      tela: 'visao_geral', nome: 'Ana Souza', aluno_nome: 'Ana',
      email: 'ana@x.com', matricula: '2020123', cpf: '00011122233',
      telefone: '11999999999', ies_nome: 'IES Alfa', aluno_id: 'uuid-ok',
    });
    expect(limpo).toEqual({ tela: 'visao_geral', aluno_id: 'uuid-ok' });
    CHAVES_PROIBIDAS.forEach((k) => expect(Object.keys(limpo)).not.toContain(k));
  });

  it('sanitizarProps derruba valores que PARECEM e-mail, CPF ou nome completo', () => {
    const limpo = sanitizarProps({ valor: 'ana.souza@sanar.com', outro: '000.111.222-33', ok: '6ano' });
    expect(limpo).toEqual({ ok: '6ano' });
  });

  it('nenhum evento disparado carrega e-mail, CPF ou nome completo em nenhuma propriedade', async () => {
    render(<Sonda />);
    for (const nome of ['filtro', 'modo', 'drawer', 'export', 'erro']) {
      await userEvent.click(screen.getByRole('button', { name: nome }));
    }
    const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/;
    const CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/;
    const NOME_COMPLETO = /\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{2,}\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{2,}/;
    trackEvent.mock.calls.forEach(([ev]) => {
      const serial = JSON.stringify(ev);
      expect(serial, `evento ${ev.eventName} com e-mail`).not.toMatch(EMAIL);
      expect(serial, `evento ${ev.eventName} com CPF`).not.toMatch(CPF);
      expect(serial, `evento ${ev.eventName} com nome completo`).not.toMatch(NOME_COMPLETO);
      expect(ev.eventName, 'nome de evento não pode conter PII').toMatch(/^gestor_[a-z_]+$/);
    });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/features/gestor/__tests__/telemetria.test.tsx`
Expected: FAIL com `Failed to resolve import "@/features/gestor/lib/telemetria"`.

- [ ] **Step 3: Implementar**

```ts
// src/features/gestor/lib/telemetria.ts
import { useCallback, useRef } from 'react';
import { useAnalyticsTracker } from '@/hooks/useAnalyticsTracker';
import type { FiltroSemestre, ModoGrafico } from '@/features/gestor/api/types';

/**
 * Telemetria do Portal do Gestor v2 — os 7 eventos da spec §10.
 *
 * Encapsula o tracker que o projeto já usa (`useAnalyticsTracker`, que grava em
 * `public.analytics_events` com dedupe, rate limit e retry). Este módulo é a
 * ÚNICA porta de entrada de telemetria do portal: nenhum componente chama
 * `trackEvent` direto — assim a garantia de "sem PII" fica num só lugar.
 *
 * O tracker anexa automaticamente `user_id` e `ies_id` do usuário LOGADO (o
 * gestor), nunca de aluno; e `semestre` do próprio usuário (null para gestor).
 * Nada disso é PII de aluno.
 */

export type EventoGestor =
  | 'gestor_tela_vista'
  | 'gestor_filtro_alterado'
  | 'gestor_modo_grafico_alterado'
  | 'gestor_tempo_ate_primeiro_insight'
  | 'gestor_drawer_aberto'
  | 'gestor_export_solicitado'
  | 'gestor_erro_bloco';

/** Chaves que nunca podem entrar num evento, mesmo por acidente de refactor. */
export const CHAVES_PROIBIDAS = [
  'nome', 'nome_completo', 'aluno_nome', 'nomeAluno', 'email', 'e_mail',
  'matricula', 'cpf', 'telefone', 'ies_nome', 'iesNome', 'enunciado',
] as const;

const PARECE_EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/;
const PARECE_CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/;
const PARECE_NOME = /\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{2,}\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{2,}/;

/** Remove chaves proibidas e valores que parecem PII. Última linha de defesa. */
export function sanitizarProps(props: Record<string, unknown>): Record<string, unknown> {
  const saida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if ((CHAVES_PROIBIDAS as readonly string[]).includes(k)) continue;
    if (typeof v === 'string' && (PARECE_EMAIL.test(v) || PARECE_CPF.test(v) || PARECE_NOME.test(v))) continue;
    saida[k] = v;
  }
  return saida;
}

type Categoria = 'navigation' | 'interaction' | 'error' | 'performance';

export function useTelemetriaGestor() {
  const { trackEvent } = useAnalyticsTracker();
  const inicio = useRef<number>(Date.now());
  const insightJaMedido = useRef(false);

  const emitir = useCallback(
    (eventName: EventoGestor, category: Categoria, data: Record<string, unknown>) => {
      trackEvent({ eventName, category, data: sanitizarProps(data) as never });
    },
    [trackEvent],
  );

  const telaVista = useCallback(
    (tela: 'inicio' | 'visao_geral' | 'detalhamento', semestre: FiltroSemestre) => {
      inicio.current = Date.now();
      insightJaMedido.current = false;
      emitir('gestor_tela_vista', 'navigation', { tela, semestre });
    },
    [emitir],
  );

  const marcarPrimeiroInsight = useCallback(() => {
    if (insightJaMedido.current) return;
    insightJaMedido.current = true;
    emitir('gestor_tempo_ate_primeiro_insight', 'performance', { ms: Date.now() - inicio.current });
  }, [emitir]);

  return {
    telaVista,
    marcarPrimeiroInsight,
    filtroAlterado: useCallback(
      (tipo: 'semestre' | 'simulados' | 'ies' | 'area', valor: string) =>
        emitir('gestor_filtro_alterado', 'interaction', { tipo, valor }),
      [emitir],
    ),
    modoGraficoAlterado: useCallback(
      (modo: ModoGrafico) => emitir('gestor_modo_grafico_alterado', 'interaction', { modo }),
      [emitir],
    ),
    tempoAtePrimeiroInsight: useCallback(
      (ms: number) => emitir('gestor_tempo_ate_primeiro_insight', 'performance', { ms }),
      [emitir],
    ),
    drawerAberto: useCallback(
      (tipo: 'aluno' | 'temas' | 'questao') => emitir('gestor_drawer_aberto', 'interaction', { tipo }),
      [emitir],
    ),
    exportSolicitado: useCallback(
      (escopo: 'visao_geral' | 'detalhamento' | 'alunos' | 'questoes') =>
        emitir('gestor_export_solicitado', 'interaction', { escopo }),
      [emitir],
    ),
    erroBloco: useCallback(
      (bloco: string, codigo: string) => emitir('gestor_erro_bloco', 'error', { bloco, codigo }),
      [emitir],
    ),
  };
}
```

Nota de tipos: `useAnalyticsTracker.trackEvent` aceita `data?: Record<string, Json>`. `sanitizarProps` devolve `Record<string, unknown>`; o cast `as never` é o mesmo padrão já usado em `src/services/admin/iesFeatures.ts` para contornar tipos gerados incompletos, e está isolado num único ponto do módulo.

- [ ] **Step 4: Ligar nos momentos certos**

| Evento | Onde chamar |
|---|---|
| `telaVista` | `useEffect` de mount em `Inicio.tsx`, `VisaoGeral.tsx`, `Detalhamento.tsx`, passando o `semestre` atual do `useFiltrosGestor()` |
| `filtroAlterado` | dentro dos setters do `useFiltrosGestor` consumidos por `FiltroSemestre`, `SeletorSimulados` e `SidebarIes` |
| `modoGraficoAlterado` | no `onClick` do radiogroup de modo (contrato C5 da Task 57) |
| `marcarPrimeiroInsight` | primeira expansão da `CascataDiagnostico` **ou** primeira abertura de `DrawerAluno`/`DrawerTemas` — chamar nos três; o ref garante uma emissão |
| `drawerAberto` | `useEffect` de `DrawerAluno` e `DrawerTemas` quando `aberto` vira `true` |
| `exportSolicitado` | handler do botão de export, **antes** de gerar o arquivo |
| `erroBloco` | no `onError` do error boundary por bloco (§8.4), com `bloco` = nome do bloco e `codigo` = código da RPC |

```tsx
// src/features/gestor/routes/VisaoGeral.tsx — padrão de mount
const { telaVista, modoGraficoAlterado, marcarPrimeiroInsight } = useTelemetriaGestor();
const { semestre } = useFiltrosGestor();
React.useEffect(() => { telaVista('visao_geral', semestre); }, [telaVista, semestre]);
```

- [ ] **Step 5: Rodar**

Run: `npx vitest run src/features/gestor/__tests__/telemetria.test.tsx`
Expected: `Tests 9 passed (9)`

- [ ] **Step 6: Commit**
```bash
git add src/features/gestor/lib/telemetria.ts src/features/gestor/__tests__/telemetria.test.tsx src/features/gestor/routes src/features/gestor/components
git commit -m "feat(gestor): telemetria dos 7 eventos da §10 sobre o tracker existente, sem PII"
```

---

### Task 61: Checklist de segurança e LGPD (§7.7) — o que é automatizável vira teste

**Files:**
- Create: `src/features/gestor/__tests__/seguranca-lgpd.test.tsx`
- Create: `docs/superpowers/checklists/portal-gestor-v2-seguranca.md`

**Interfaces:**
- Consumes: fixtures da Task 57; `VisaoGeral`, `TabelaAlunos`, `DrawerAluno`.
- Produces: o checklist em markdown, colado no corpo do PR da Fase 5.

- [ ] **Step 1: Escrever os testes**

```tsx
// src/features/gestor/__tests__/seguranca-lgpd.test.tsx
import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ALUNO_ID, IES_ID, criarRpcMock } from './fixturesRegrasCriticas';
import VisaoGeral from '@/features/gestor/routes/VisaoGeral';

const rpc = vi.hoisted(() => ({ atual: null as ReturnType<typeof import('vitest').vi.fn> | null }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...a: unknown[]) => rpc.atual!(...a), from: vi.fn(), auth: { onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) } },
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'gestor-1', nome: 'Gestor', email: 'g@sanar.com', id_ies: IES_ID }, access: { roles: ['gestor'], experiences: ['gestao'], capabilities: [] }, isImpersonating: false }),
}));

const RAIZ = resolve(__dirname, '..');
function fontes(dir: string, acc: { p: string; src: string }[] = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== '__tests__') fontes(p, acc); }
    else if (/\.tsx?$/.test(e.name)) acc.push({ p: relative(RAIZ, p), src: readFileSync(p, 'utf-8') });
  }
  return acc;
}
const FONTES = fontes(RAIZ);

function renderVisaoGeral(url = '/gestor/visao-geral?semestre=6ano') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}><TooltipProvider><VisaoGeral /></TooltipProvider></MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => { rpc.atual = criarRpcMock(); vi.clearAllMocks(); });

describe('§7.7 — nenhum payload de aluno em storage', () => {
  it('renderizar a tabela de alunos não escreve dado de aluno em localStorage nem sessionStorage', async () => {
    const setLocal = vi.spyOn(window.localStorage, 'setItem');
    const setSession = vi.spyOn(window.sessionStorage, 'setItem');

    renderVisaoGeral();
    expect(await screen.findByText('Ana Souza')).toBeInTheDocument();

    const escritas = [...setLocal.mock.calls, ...setSession.mock.calls].map(([k, v]) => `${k}=${v}`);
    escritas.forEach((e) => {
      expect(e, `escreveu nome de aluno em storage: ${e}`).not.toMatch(/Ana Souza/);
      expect(e, `escreveu id de aluno em storage: ${e}`).not.toContain(ALUNO_ID);
      expect(e, `escreveu proficiência em storage: ${e}`).not.toMatch(/proficiencia|score_proprio/i);
    });
  });

  it('o código do portal não usa localStorage nem sessionStorage — cache só em memória (React Query)', () => {
    FONTES.forEach(({ p, src }) => {
      expect(src, `${p} usa localStorage — proibido (§7.7)`).not.toMatch(/\blocalStorage\b/);
      expect(src, `${p} usa sessionStorage — proibido (§7.7)`).not.toMatch(/\bsessionStorage\b/);
      expect(src, `${p} usa IndexedDB — proibido (§7.7)`).not.toMatch(/indexedDB/i);
    });
  });

  it('React Query do portal não é persistido em disco', () => {
    FONTES.forEach(({ p, src }) => {
      expect(src, `${p} importa persistQueryClient`).not.toMatch(/persistQueryClient|createSyncStoragePersister/);
    });
  });
});

describe('§7.7 — nenhum HTML injetado', () => {
  it('nenhum arquivo de src/features/gestor usa dangerouslySetInnerHTML', () => {
    const infratores = FONTES.filter(({ src }) => src.includes('dangerouslySetInnerHTML')).map(({ p }) => p);
    expect(infratores, `texto vindo da API é sempre texto (§7.7): ${infratores.join(', ')}`).toEqual([]);
  });

  it('nem innerHTML, insertAdjacentHTML ou document.write', () => {
    FONTES.forEach(({ p, src }) => {
      expect(src, `${p} usa innerHTML`).not.toMatch(/\.innerHTML\s*=/);
      expect(src, `${p} usa insertAdjacentHTML`).not.toMatch(/insertAdjacentHTML/);
      expect(src, `${p} usa document.write`).not.toMatch(/document\.write/);
    });
  });
});

describe('§7.7 — identificador de aluno na URL é UUID opaco', () => {
  it('abrir o drawer coloca UUID na URL, nunca e-mail ou matrícula', async () => {
    renderVisaoGeral();
    await userEvent.click(await screen.findByRole('button', { name: /Ana Souza/ }));

    const params = new URLSearchParams(window.location.search || '');
    // A URL do MemoryRouter não vai para window.location: lemos o link/parâmetro renderizado.
    const linkAluno = screen.getByRole('button', { name: /Ana Souza/ }).getAttribute('data-aluno-id');
    const id = linkAluno ?? params.get('aluno');
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(id).not.toContain('@');
  });

  it('nenhum código do portal monta URL/queryparam com email, cpf ou matrícula', () => {
    FONTES.forEach(({ p, src }) => {
      expect(src, `${p} coloca e-mail em query param`).not.toMatch(/[?&](email|e_mail|cpf|matricula)=/);
      expect(src, `${p} usa searchParams.set com chave identificável`)
        .not.toMatch(/set\(\s*['"](email|cpf|matricula|nome)['"]/);
    });
  });
});

describe('§7.7 — export e cópia de resumo', () => {
  it('nenhum caminho de export é chamado sem escopo explícito', () => {
    FONTES.filter(({ src }) => /export(ar)?(Xlsx|Csv|Pdf|Planilha)/i.test(src)).forEach(({ p, src }) => {
      expect(src, `${p} exporta sem recorte — §7.7 exige recorte, nunca a base inteira`)
        .not.toMatch(/exportar\w*\(\s*\)/);
    });
  });

  it('"Copiar resumo" não copia lista nominal', () => {
    FONTES.forEach(({ p, src }) => {
      if (!src.includes('clipboard')) return;
      expect(src, `${p} escreve nomes no clipboard`).not.toMatch(/writeText\([^)]*\.nome/);
    });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/features/gestor/__tests__/seguranca-lgpd.test.tsx`
Expected: FAIL com `Failed to resolve import "@/features/gestor/routes/VisaoGeral"` antes das fases 3–5; com elas prontas, falha em qualquer arquivo que use `localStorage`, `dangerouslySetInnerHTML` ou hex de PII em URL, listando o caminho relativo exato.

- [ ] **Step 3: Corrigir o que o teste apontar**

Padrão de correção quando o teste acusar `localStorage` (o caso mais provável, herdado de copy-paste das telas antigas):

```tsx
// ERRADO — persiste recorte com dado de aluno
localStorage.setItem('gestor:ultimo-recorte', JSON.stringify({ alunos }));

// CERTO — recorte vive na URL (§8.2); dado de aluno só em memória (React Query)
const { setSimulados } = useFiltrosGestor();
setSimulados(ids);
```

- [ ] **Step 4: Rodar até passar**

Run: `npx vitest run src/features/gestor/__tests__/seguranca-lgpd.test.tsx`
Expected: `Tests 9 passed (9)`

- [ ] **Step 5: Escrever o checklist das verificações não-automatizáveis**

```markdown
<!-- docs/superpowers/checklists/portal-gestor-v2-seguranca.md -->
# Checklist de segurança e LGPD — Portal do Gestor v2 (spec §7.7)

Colar no corpo do PR. Automatizado = coberto por `src/features/gestor/__tests__/seguranca-lgpd.test.tsx`.

## Automatizado (não marcar à mão — a suíte é a evidência)
- [x] Nenhum payload de aluno em `localStorage`/`sessionStorage`/IndexedDB
- [x] Nenhum `dangerouslySetInnerHTML`/`innerHTML` em `src/features/gestor`
- [x] ID de aluno na URL é UUID opaco, nunca e-mail/CPF/matrícula
- [x] React Query não persistido em disco
- [x] Clipboard não recebe lista nominal

## Revisão manual obrigatória no PR
- [ ] **RLS/permissão no servidor.** Cada uma das 10 RPCs `get_gestor_*` valida a IES do chamador no corpo e responde erro genérico para IES alheia — sem revelar existência (§12.17). Evidência: `select proname, prosecdef from pg_proc where proname like 'get_gestor_%'` → 10 linhas, `prosecdef = true` nas 10.
- [ ] **Guard de feature no corpo.** As 10 RPCs têm o guard `gestao.portal_v2` **escrito no corpo** (não injetado dinamicamente como as 19 legadas — §7.1). Evidência: `pg_get_functiondef` de uma delas mostra o guard, e o `.sql` versionado tem o mesmo texto.
- [ ] **Trilha de auditoria de dado nominal.** Abrir o `DrawerAluno` gera registro de auditoria (`quem · quando · aluno_id`). Se a Fase 2 não implementou, **registrar como pendência explícita no PR** — não fechar como pronto.
- [ ] **Export com auditoria e confidencialidade.** Todo export grava `quem · quando · escopo · formato` e o arquivo traz cabeçalho de confidencialidade. Verificado abrindo um export real.
- [ ] **Export é sempre de recorte.** Nenhum botão exporta a base inteira da IES.
- [ ] **Sem PII em log.** `grep -rn "Logger\.\(info\|warn\|error\)" src/features/gestor` — nenhum log com nome, e-mail ou enunciado.
- [ ] **Impersonação.** Com `isImpersonating`, o tracker já suprime eventos (`useAnalyticsTracker`); confirmar que nenhum export é possível impersonando.
- [ ] **Screenshots do PR** não contêm nome real de aluno (usar IES de teste ou desfocar).
```

- [ ] **Step 6: Commit**
```bash
git add src/features/gestor/__tests__/seguranca-lgpd.test.tsx docs/superpowers/checklists/portal-gestor-v2-seguranca.md
git commit -m "test(gestor): guardas automatizadas de LGPD (§7.7) + checklist de revisao do PR"
```

---

### Task 62: Piloto por IES — procedimento operacional

**Files:** nenhum arquivo de código. Artefato: seção "Piloto" registrada no PR e o resultado das queries salvo no card do piloto.

**Interfaces:**
- Consumes: `gestao.portal_v2` no `feature_catalog` (criada na Fase 1); RPC `admin_set_ies_features(p_ies_id uuid, p_changes jsonb)` — **`p_changes` é um objeto** `{"chave": bool}`, não array (verificado em `supabase/migrations/20260707172740_...sql:296` e `src/services/admin/iesFeatures.ts:40`); evento `gestor_erro_bloco` da Task 60 em `public.analytics_events`.
- Produces: lista de IES piloto e o veredito de 2 semanas que libera a Task 63.

**Contexto de deploy que muda o procedimento:** não há pipeline de CD funcionando (ver achados no topo da fase). O código do portal v2 **vai para produção junto com tudo** no primeiro push na `main`; quem controla exposição é **só a flag**. Logo, a flag tem de estar **desligada para todas as IES** antes do merge, e o piloto é o primeiro momento em que alguém de fora vê a tela.

- [ ] **Step 1: Confirmar que a flag existe e está desligada para todo mundo**

Aplicar via **MCP do Supabase com o project ref `gvqvrmkizemwsasmupmo` (gvqv) CONFIRMADO** — o MCP da sessão pode estar apontado para `lljn`. Verificar antes com `get_project_url` e conferir que a URL contém `gvqvrmkizemwsasmupmo`.

```sql
-- 1) a chave existe no catálogo?
select key, experience, label, is_master, active, sort_order
from public.feature_catalog
where key in ('gestao.enabled', 'gestao.portal_v2');

-- 2) alguma IES já está com ela ligada?
select i.nome, f.enabled, f.updated_at
from public.ies_features f
join public.ies i on i.id = f.ies_id
where f.feature_key = 'gestao.portal_v2'
order by f.updated_at desc;
```
Expected: query 1 devolve **2 linhas** (`gestao.enabled` com `is_master = true`, `gestao.portal_v2` com `is_master = false`, ambas `active = true`, `experience = 'gestao'`). Query 2 devolve **0 linhas**. Se devolver linhas com `enabled = true`, desligar antes de prosseguir.

- [ ] **Step 2: Identificar as IES elegíveis**

Critério: contrato preenchido **e** pelo menos 2 simulados com resultado processado.

```sql
select
  i.id,
  i.nome,
  count(distinct r.simulado_id)                as simulados_com_resultado,
  c.simulados_contratados,
  sum(r.num_students)                          as alunos_com_resultado,
  bool_and(f.enabled)                          as gestao_master_ligado,
  max(r_dt.data_liberacao)                     as ultimo_simulado_liberado
from public.ies i
join public.resultados_ies_tri r        on r.college_id = i.id
join public.ies_contrato_simulados c    on c.ies_id = i.id
left join public.ies_features f         on f.ies_id = i.id and f.feature_key = 'gestao.enabled'
left join public.simulados_admin r_dt   on r_dt.id = r.simulado_id
group by i.id, i.nome, c.simulados_contratados
having count(distinct r.simulado_id) >= 2
   and c.simulados_contratados is not null
order by alunos_com_resultado desc nulls last;
```
Expected: uma lista ordenada por volume de aluno. **Escolher 1–2 IES** entre as que têm `gestao_master_ligado = true` (já usam o portal antigo — o gestor tem base de comparação) e volume médio (nem a maior, para limitar exposição, nem uma com <30 alunos, que zeraria a leitura por `lowSample`).

Se a query devolver 0 linhas, o bloqueio é **a tabela `ies_contrato_simulados` estar vazia** (pendência nº2 do spec — superfície de admin para contrato). Nesse caso, popular o contrato das IES piloto à mão antes de seguir:

```sql
insert into public.ies_contrato_simulados (ies_id, nome, simulados_contratados, vigencia_inicio, vigencia_fim)
values ('<ies_uuid>', 'Contrato 2026', 4, '2026-01-01', '2026-12-31')
on conflict (ies_id) do update set simulados_contratados = excluded.simulados_contratados;
```

- [ ] **Step 3: Ligar a flag nas IES piloto**

**Preferir a UI**, que já audita: `/admin/ies` → localizar a IES → seção Gestão → marcar `gestao.portal_v2` → **Salvar** (a tela chama `admin_set_ies_features`, transacional, com log `ies_features_update`).

Equivalente por SQL, se a UI não estiver disponível:
```sql
select public.admin_set_ies_features(
  '<ies_uuid>'::uuid,
  '{"gestao.portal_v2": true}'::jsonb
);
```
Expected: JSON com `applied: 1`. A RPC exige `has_role(auth.uid(), 'admin')` — rodar autenticado como admin, **não** com service_role via MCP (com service_role `auth.uid()` é null e a RPC levanta `admin role required`).

Confirmar:
```sql
select i.nome, f.feature_key, f.enabled, f.updated_at
from public.ies_features f join public.ies i on i.id = f.ies_id
where f.feature_key = 'gestao.portal_v2' and f.enabled;
```
Expected: exatamente as 1–2 IES escolhidas.

- [ ] **Step 4: Roteiro de validação manual com dado real (rodar em cada IES piloto, ~20 min)**

Logar como admin, trocar para a IES piloto pelo seletor da sidebar. Marcar cada item; qualquer falha vira issue **antes** de avisar o gestor.

**Início**
1. Cronograma lista os simulados da IES; realizados com data e participantes; previstos desabilitados com o motivo; nenhum número em simulado `processing`.
2. Contrato mostra `realizados/contratados` batendo com a query do Step 2.
3. Avisos da Sanar aparecem só com `publico_alvo` contendo gestor.

**Visão Geral**
4. Os 4 KPIs na ordem da §4.8; nenhum `—` onde a query do Step 2 mostrou dado.
5. Conceito ENAMED entre 1 e 5, inteiro, nunca com decimal.
6. Trocar os 3 modos do gráfico: **aba Network do DevTools não registra nova requisição** (§12.15).
7. Filtro "6º ano": 11º e 12º em evidência. "Por semestre" → 5º: controles multi-semestre somem, comparação vira distribuição.
8. Cascata do Diagnóstico abre ao lado, 2 níveis, especialidade abre drawer de temas — **só % de acerto**, nenhum ENAMED nem proficiência.
9. Tabela de alunos: busca funciona; tag de grupo ao lado do nome; nome abre o drawer.
10. Comparar o % de alunos proficientes com a tela antiga `/gestor/visao-institucional` da mesma IES. **Divergência > 1pp é bug** — investigar antes de liberar (a régua `>= 60` tem de coincidir).

**Detalhamento**
11. Nenhum simulado selecionado → estado vazio, **Network sem chamada de `get_gestor_detalhamento`**.
12. 1 simulado → 3 KPIs + Detalhamento das Questões como último bloco.
13. 2 simulados → comparativo com coluna por simulado, ENAMED lado a lado, coluna Variação, **Questões oculto**.
14. Aluno que não fez um dos simulados: `—` + "Não participou", sem variação.
15. Trocar de tela e voltar: o recorte de semestre e de simulados sobrevive (URL). Dar F5: sobrevive.

**Transversal**
16. Alternar tema claro/escuro em cada tela: nenhum texto ilegível, nenhum skeleton com clarão.
17. Percorrer cada tela só com `Tab`: anel de foco visível em tudo; `ESC` fecha drawer e devolve o foco.
18. DevTools → Application → Local Storage e Session Storage: **nenhuma chave com nome ou id de aluno**.

- [ ] **Step 5: Instrumentar o acompanhamento de `gestor_erro_bloco`**

Rodar diariamente nas 2 semanas (MCP com gvqv confirmado):

```sql
-- saúde por bloco nas últimas 24h
select
  e.event_data->>'bloco'  as bloco,
  e.event_data->>'codigo' as codigo,
  count(*)                as ocorrencias,
  count(distinct e.user_id) as gestores_afetados,
  min(e.created_at)       as primeira,
  max(e.created_at)       as ultima
from public.analytics_events e
where e.event_name = 'gestor_erro_bloco'
  and e.created_at > now() - interval '24 hours'
group by 1, 2
order by ocorrencias desc;
```
Expected em operação saudável: **0 linhas**.

```sql
-- adoção real: quem entrou, em que tela, quantas vezes
select
  e.event_data->>'tela' as tela,
  count(*)              as visitas,
  count(distinct e.user_id) as gestores,
  count(distinct date_trunc('day', e.created_at)) as dias_com_uso
from public.analytics_events e
where e.event_name = 'gestor_tela_vista'
  and e.ies_id in (select ies_id from public.ies_features
                   where feature_key = 'gestao.portal_v2' and enabled)
  and e.created_at > now() - interval '14 days'
group by 1 order by visitas desc;
```

```sql
-- tempo até o primeiro insight (mediana e p90, em segundos)
select
  round(percentile_disc(0.5) within group (order by (event_data->>'ms')::numeric) / 1000.0, 1) as p50_s,
  round(percentile_disc(0.9) within group (order by (event_data->>'ms')::numeric) / 1000.0, 1) as p90_s,
  count(*) as amostras
from public.analytics_events
where event_name = 'gestor_tempo_ate_primeiro_insight'
  and created_at > now() - interval '14 days';
```

- [ ] **Step 6: O que observar por 2 semanas e o gate de saída**

| Sinal | Fonte | Verde | Amarelo (ajustar antes do GA) | Vermelho (rollback) |
|---|---|---|---|---|
| `gestor_erro_bloco` | query do Step 5 | 0 ocorrências | ≤3 ocorrências, 1 bloco, causa conhecida | qualquer erro reincidente ou >1 gestor afetado |
| Adoção | `gestor_tela_vista` | gestor volta em ≥3 dias distintos | volta 1–2 dias | não volta depois da 1ª visita |
| Modos do gráfico | `gestor_modo_grafico_alterado` | os 3 modos usados | 2 modos usados | só "Geral" — reavaliar se os outros 2 se justificam (§10) |
| Tempo até o 1º insight | query do Step 5 | p50 < 60s | p50 60–180s | p50 > 180s — a tela não está entregando leitura |
| Distribuição do nível "crítico" | `get_gestor_diagnostico` com dado real | grupo crítico não-vazio na maioria dos recortes | vazio em metade | **sempre vazio** → subir `NIVEL_CRITICO_MAX` de 30 para 50 em `regras.ts` (decisão prevista na §4.4) |
| Divergência vs telas antigas | item 10 do Step 4 | ≤1pp | — | >1pp |
| Reclamação qualitativa | conversa com o gestor da IES | "consigo agir com isso" | dúvidas de nomenclatura | "não entendi a tela" |

- [ ] **Step 7: Rollback — critério e execução**

**Aciona rollback:** qualquer sinal vermelho da tabela acima; ou número divergente de mais de 1pp em relação às telas antigas; ou qualquer exposição de dado de aluno de outra IES.

Execução (segundos, sem deploy):
```sql
select public.admin_set_ies_features('<ies_uuid>'::uuid, '{"gestao.portal_v2": false}'::jsonb);
```
Ou `/admin/ies` → desmarcar → Salvar. A IES volta imediatamente às 5 telas antigas (§12.16 garante isso por teste). **Nenhuma migração é revertida** — o rollout não fez migração destrutiva (§9). O gestor não perde nada: o dado é o mesmo.

- [ ] **Step 8: Registrar o resultado**

Salvar no card do piloto: as 1–2 IES escolhidas, a data de ligação, o output das 3 queries do Step 5 no dia 7 e no dia 14, a tabela de sinais preenchida e o veredito (`GA liberado` / `ajustar e repetir` / `rollback`). **A Task 63 só começa com veredito "GA liberado".**

---

### Task 63: GA por lotes

**Files:**
- Modify: `src/features/gestor/api/queries.ts` (Step 1 — instrumentação de latência)
- Test: `src/features/gestor/__tests__/latencia.test.tsx`

**Interfaces:**
- Consumes: `trackEdgeLatency(functionName, latencyMs, success)` de `useAnalyticsTracker` — **já existe** no projeto e grava `perf_edge_latency` em `analytics_events`; `admin_set_ies_features`.
- Produces: eventos `perf_edge_latency` com `function_name` começando em `get_gestor_`, que é como se mede o orçamento de 800ms da §8.5.

- [ ] **Step 1: Instrumentar a latência real das RPCs (o único código desta task)**

Sem isso não há como afirmar "latência dentro de 800ms" — `pg_stat_statements` mediria o tempo do banco, não o que o gestor sente (rede + PostgREST + parse).

```ts
// src/features/gestor/api/queries.ts — wrapper único usado por todos os 10 hooks
import { supabase } from '@/integrations/supabase/client';
import { useAnalyticsTracker } from '@/hooks/useAnalyticsTracker';
import type { Envelope } from '@/features/gestor/api/types';

/**
 * Chama uma RPC `get_gestor_*` medindo a latência ponta-a-ponta e emitindo
 * `perf_edge_latency` (evento já existente do projeto). É assim que o gate de
 * GA da §8.5 (< 800ms) é medido — não por pg_stat_statements, que ignora rede.
 */
export function useRpcGestor() {
  const { trackEdgeLatency } = useAnalyticsTracker();
  return async function chamar<T>(fn: string, args: Record<string, unknown>): Promise<Envelope<T>> {
    const t0 = performance.now();
    const { data, error } = await (supabase.rpc as (
      f: string, a: Record<string, unknown>,
    ) => PromiseLike<{ data: unknown; error: { message: string } | null }>)(fn, args);
    trackEdgeLatency(fn, Math.round(performance.now() - t0), !error);
    if (error) throw new Error(error.message);
    return data as Envelope<T>;
  };
}
```

```tsx
// src/features/gestor/__tests__/latencia.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRpcGestor } from '@/features/gestor/api/queries';
import { env, VISAO_GERAL } from './fixturesRegrasCriticas';

const trackEdgeLatency = vi.fn();
vi.mock('@/hooks/useAnalyticsTracker', () => ({
  useAnalyticsTracker: () => ({ trackEdgeLatency, trackEvent: vi.fn() }),
  default: () => ({ trackEdgeLatency, trackEvent: vi.fn() }),
}));
const rpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a), from: vi.fn(), auth: { onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) } } }));

describe('instrumentação de latência das RPCs do gestor', () => {
  it('emite perf_edge_latency com o nome da RPC e sucesso', async () => {
    rpc.mockResolvedValue({ data: env(VISAO_GERAL), error: null });
    const { result } = renderHook(() => useRpcGestor());
    await result.current('get_gestor_visao_geral', { p_ies_id: 'x', p_semestre: '6ano' });
    const [fn, ms, ok] = trackEdgeLatency.mock.calls.at(-1)!;
    expect(fn).toBe('get_gestor_visao_geral');
    expect(typeof ms).toBe('number');
    expect(ms).toBeGreaterThanOrEqual(0);
    expect(ok).toBe(true);
  });

  it('emite com success=false e propaga o erro', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'permissao_negada' } });
    const { result } = renderHook(() => useRpcGestor());
    await expect(result.current('get_gestor_alunos', {})).rejects.toThrow('permissao_negada');
    expect(trackEdgeLatency.mock.calls.at(-1)![2]).toBe(false);
  });
});
```

Run: `npx vitest run src/features/gestor/__tests__/latencia.test.tsx`
Expected: `Tests 2 passed (2)`

- [ ] **Step 2: Montar os lotes**

```sql
-- IES com a experiência de gestão ligada, ainda sem o portal v2, em lotes de 5
with elegiveis as (
  select
    i.id,
    i.nome,
    count(distinct r.simulado_id)                 as simulados,
    coalesce(sum(r.num_students), 0)              as alunos
  from public.ies i
  join public.ies_features m on m.ies_id = i.id and m.feature_key = 'gestao.enabled' and m.enabled
  left join public.resultados_ies_tri r on r.college_id = i.id
  where not exists (
    select 1 from public.ies_features f
    where f.ies_id = i.id and f.feature_key = 'gestao.portal_v2' and f.enabled
  )
  group by i.id, i.nome
)
select
  ntile(ceil(count(*) over () / 5.0)::int) over (order by alunos asc) as lote,
  id, nome, simulados, alunos
from elegiveis
order by lote, alunos;
```
Expected: as IES restantes numeradas em lotes de ~5, **ordenadas do menor para o maior volume de aluno** — o menor risco primeiro. Salvar o resultado; é a partir dele que se liga a chave.

- [ ] **Step 3: Ligar um lote**

Para cada IES do lote (preferir `/admin/ies`, que audita; o BulkRunner do console admin faz o lote de uma vez):
```sql
select public.admin_set_ies_features('<ies_uuid>'::uuid, '{"gestao.portal_v2": true}'::jsonb);
```
Confirmar o total ligado:
```sql
select count(*) as ies_no_portal_v2
from public.ies_features
where feature_key = 'gestao.portal_v2' and enabled;
```
Expected: piloto + lotes já liberados + 5.

- [ ] **Step 4: Janela de observação de 5 dias úteis por lote**

Rodar as duas queries de gate no fim de cada dia.

Gate A — **nenhum `gestor_erro_bloco` novo**:
```sql
select
  e.event_data->>'bloco'  as bloco,
  e.event_data->>'codigo' as codigo,
  count(*)                as ocorrencias,
  count(distinct e.ies_id) as ies_afetadas
from public.analytics_events e
where e.event_name = 'gestor_erro_bloco'
  and e.created_at > now() - interval '5 days'
group by 1, 2
order by ocorrencias desc;
```
Expected para avançar: **0 linhas**. Qualquer linha bloqueia o lote seguinte até a causa estar corrigida ou explicada (ex.: IES sem contrato → não é bug de código, é dado faltando).

Gate B — **latência de RPC dentro de 800ms**:
```sql
select
  e.event_data->>'function_name' as rpc,
  count(*)                                                                                  as chamadas,
  round(percentile_disc(0.50) within group (order by (e.event_data->>'latency_ms')::numeric))as p50_ms,
  round(percentile_disc(0.95) within group (order by (e.event_data->>'latency_ms')::numeric))as p95_ms,
  round(100.0 * avg(case when (e.event_data->>'success')::boolean then 1 else 0 end), 2)     as sucesso_pct
from public.analytics_events e
where e.event_name = 'perf_edge_latency'
  and e.event_data->>'function_name' like 'get_gestor_%'
  and e.created_at > now() - interval '5 days'
group by 1
order by p95_ms desc;
```
Expected para avançar: **`p95_ms` < 800 em todas as 10 RPCs** e `sucesso_pct` >= 99,5.

Diagnóstico quando uma RPC estoura 800ms — separar rede de banco:
```sql
-- tempo puro do banco para o mesmo recorte que estourou
explain (analyze, buffers)
select public.get_gestor_visao_geral('<ies_uuid>'::uuid, '6ano');
```
Se o `Execution Time` do `explain analyze` já passa de 800ms, o problema é a query (índice, agregação); se ele é baixo e o p95 do cliente é alto, é payload/rede (reduzir colunas, paginar).

- [ ] **Step 5: Gate para avançar de lote**

Só liga o lote seguinte quando **todas** forem verdade:
1. Gate A: zero `gestor_erro_bloco` em 5 dias.
2. Gate B: p95 < 800ms nas 10 RPCs, sucesso ≥ 99,5%.
3. Nenhuma reclamação de número divergente vindo das IES do lote.
4. `npm run lint` · `npm run type-check` · `npm run test:run` · `npm run build` verdes na `main` (não há CI que garanta — rodar à mão antes de cada lote).

Falhando qualquer um: **desligar o lote inteiro** (`'{"gestao.portal_v2": false}'`), corrigir, e refazer o mesmo lote. Não avançar "acumulando dívida".

- [ ] **Step 6: Fechar o GA**

Quando o último lote passar o gate:
```sql
-- cobertura final
select
  count(*) filter (where f.enabled) as com_portal_v2,
  count(*) as ies_com_gestao
from public.ies_features m
left join public.ies_features f on f.ies_id = m.ies_id and f.feature_key = 'gestao.portal_v2'
where m.feature_key = 'gestao.enabled' and m.enabled;
```
Expected: `com_portal_v2 = ies_com_gestao`. **Esse é o pré-requisito da Task 64** — nenhuma remoção antes disso.

- [ ] **Step 7: Commit**
```bash
git add src/features/gestor/api/queries.ts src/features/gestor/__tests__/latencia.test.tsx
git commit -m "feat(gestor): mede latencia ponta-a-ponta das RPCs via perf_edge_latency (gate de GA)"
```

---

### Task 64: Cleanup pós-GA (§9)

**Files:**
- Delete: `src/experiences/gestor/pages/VisaoInstitucionalPage.tsx` · `DiagnosticoCurricularPage.tsx` · `AlunosPage.tsx` · `InsightsPedagogicosPage.tsx` · `InteligenciaDecisoriaPage.tsx`
- Delete: `src/experiences/gestor/GestorLayout.tsx` · `GestorNav.ts` · `GestorFiltersProvider.tsx`
- Delete: `src/components/analytics/v2/modules/` (6 arquivos) · `src/components/analytics/v2/ThemeAccuracyEvolutionChart.tsx` · `src/components/analytics/v2/shell/ModuleContentRenderer.tsx`
- Delete: `src/pages/DesempenhoInstitucionalV2.tsx` · `src/hooks/useDesempenhoV2State.ts` · `src/hooks/useInstitutionalPerformanceData.ts` · `src/services/institutional.ts` · `src/utils/mapInstitutionalData.ts` · `src/utils/desempenhoV2Filters.ts`
- Modify: `src/experiences/gestor/gestorRoutes.tsx` · `src/experiences/gestor/GestorFeatureGate.tsx` · `src/test/unit/route-gates.test.tsx` · `src/test/unit/gestorNav.test.ts` · `src/test/unit/gestorFeatureGate.test.tsx` · `src/test/unit/buildAppRoutes.test.ts`
- Create: `supabase/migrations/<ts>_backup_defs_rpcs_institucionais.sql` · `supabase/migrations/<ts>_drop_rpcs_institucionais_sem_consumidor.sql` · `supabase/migrations/<ts>_desativa_features_gestao_antigas.sql`

**Interfaces:**
- Consumes: veredito de GA completo da Task 63 (Step 6).
- Produces: uma árvore só de gestor (`src/features/gestor/`), `feature_catalog` sem as 5 chaves antigas, `types.ts` regenerado.

**ARMADILHA que define a ordem de tudo (spec §7.1, incidente registrado):** 19 RPCs tiveram o guard `feature_not_enabled` **injetado dinamicamente em produção** (migration `20260709171344`) via `pg_get_functiondef`. **Nenhum arquivo `.sql` do repo tem o corpo real dessas funções.** Duas consequências:
1. **Não existe caminho de restauração** para o que for dropado — dropar é irreversível na prática.
2. **Dropar RPC pelo agente do Lovable regenera `src/integrations/supabase/types.ts`** e, se o consumidor morto continuar no código, o **build quebra**. Consumidor e RPC caem no **mesmo ciclo**, nessa ordem: código primeiro, DDL depois.

- [ ] **Step 1: Pré-requisito — provar que o GA está completo**

```sql
select count(*) as ies_sem_portal_v2
from public.ies_features m
where m.feature_key = 'gestao.enabled' and m.enabled
  and not exists (select 1 from public.ies_features f
                  where f.ies_id = m.ies_id and f.feature_key = 'gestao.portal_v2' and f.enabled);
```
Expected: `0`. **Diferente de 0 aborta a task inteira** — as telas antigas ainda servem alguém.

- [ ] **Step 2: Auditar consumidores no front, RPC por RPC (antes de qualquer DROP)**

```bash
for f in get_institutional_performance get_institutional_student_scores get_institutional_evolution \
         get_institutional_tri get_institutional_evolution_tri get_institutional_simulados \
         get_student_growth_tri get_theme_evolution get_ies_student_count get_institutional_faixas; do
  echo "== $f"
  grep -rn "$f" src/ --include=*.ts --include=*.tsx | grep -v "integrations/supabase/types.ts" | grep -v "^src/features/gestor"
done
```

Resultado da auditoria feita em 26/07/2026 (repetir e conferir antes de agir):

| RPC | Consumidor hoje | Depois de remover o front antigo | Veredito |
|---|---|---|---|
| `get_institutional_performance` | `src/services/institutional.ts:28` → `useInstitutionalPerformanceData` → `GestorFiltersProvider` + `DesempenhoInstitucionalV2` (morto) | nenhum | **DROP** |
| `get_institutional_student_scores` | `institutional.ts:45`, mesma cadeia | nenhum | **DROP** |
| `get_institutional_evolution` | `institutional.ts:61`, mesma cadeia | nenhum | **DROP** |
| `get_institutional_tri` | `institutional.ts:116`, mesma cadeia | nenhum | **DROP** |
| `get_institutional_evolution_tri` | `institutional.ts:167`, mesma cadeia | nenhum | **DROP** |
| `get_institutional_simulados` | `useInstitutionalPerformanceData.ts:233` | nenhum | **DROP** |
| `get_theme_evolution` | `ThemeAccuracyEvolutionChart.tsx:33` ← `DiagnosticoCurricularModule.tsx:394` | nenhum | **DROP** |
| `get_student_growth_tri` | `institutional.ts:231` — **e mais nada** | nenhum | **MANTER** (ver Step 3) |
| `get_ies_student_count` | `institutional.ts:266`; `IesFeaturesBoard.tsx:66` diz explicitamente que a contagem foi **omitida de propósito** da tela de admin | nenhum | **MANTER** (ver Step 3) |
| `get_simulado_tem_tri` | fluxo do **aluno** | segue vivo | **MANTER** |
| `get_user_ranking_in_ies` | fluxo do **aluno** | segue vivo | **MANTER** |
| `user_can_access_ies` | usada **dentro de outras RPCs** (guard) | segue viva | **MANTER — nunca dropar** |

**As duas decisões de "manter" e por quê:**
- `get_student_growth_tri`: hoje só `src/services/institutional.ts` a chama, e esse arquivo morre nesta task. Mas ela é a **única fonte de crescimento por aluno já materializada** e a memória do projeto registra que foi deliberadamente preservada para o console do gestor. O portal v2 calcula tendência dentro de `get_gestor_alunos`, logo ela fica **sem consumidor** — porém dropá-la é irreversível (não há `.sql` com o corpo). **Decisão: manter a função, remover o consumidor.** Reavaliar em 90 dias com a query do Step 7. Registrar isso no PR, não como TODO solto.
- `get_ies_student_count`: mesma lógica, e é a candidata natural para a superfície de contrato do admin (pendência nº2 do spec). Manter.

Verificar no banco quem mais depende, do lado do servidor (uma RPC pode chamar outra):
```sql
select p.proname as chamadora, d.proname as chamada
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
cross join lateral (
  select proname from pg_proc
  where pronamespace = n.oid
    and proname <> p.proname
    and position(proname in pg_get_functiondef(p.oid)) > 0
) d
where d.proname like 'get_institutional%' or d.proname in ('get_theme_evolution', 'get_student_growth_tri');
```
Expected: **0 linhas** para as 7 marcadas DROP. Qualquer linha muda o veredito daquela RPC para MANTER.

- [ ] **Step 3: Salvar o corpo real das RPCs antes de dropar (isto é o backup — não existe outro)**

```sql
select 'CREATE OR REPLACE FUNCTION ' || '' as _, pg_get_functiondef(p.oid) || ';' as ddl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
where p.proname in (
  'get_institutional_performance','get_institutional_student_scores','get_institutional_evolution',
  'get_institutional_tri','get_institutional_evolution_tri','get_institutional_simulados',
  'get_theme_evolution','get_student_growth_tri','get_ies_student_count'
)
order by p.proname;
```

Colar o output **integral** (inclui o guard `feature_not_enabled` injetado em produção) em:
`supabase/migrations/<timestamp>_backup_defs_rpcs_institucionais.sql`, com este cabeçalho:

```sql
-- BACKUP, NÃO APLICAR EM PRODUÇÃO.
-- Corpo REAL (com o guard feature_not_enabled injetado dinamicamente pela
-- migration 20260709171344) das 9 RPCs institucionais, extraído de gvqv via
-- pg_get_functiondef em <data>. Este arquivo existe porque nenhuma migration
-- versionada tem o corpo real (spec §7.1) — é a única forma de restaurar
-- qualquer uma delas. Recriar a partir das migrations ORIGINAIS remove o guard
-- silenciosamente.
```

Expected: 9 blocos `CREATE OR REPLACE FUNCTION`, cada um contendo a checagem de feature. **Se algum bloco não tiver o guard, parar e investigar antes de seguir.**

Commit desse arquivo **antes** de qualquer DROP.

- [ ] **Step 4: Remover o front antigo (código primeiro — sempre)**

```bash
git rm -r src/experiences/gestor/pages
git rm src/experiences/gestor/GestorLayout.tsx src/experiences/gestor/GestorNav.ts src/experiences/gestor/GestorFiltersProvider.tsx
git rm -r src/components/analytics/v2/modules src/components/analytics/v2/shell
git rm src/components/analytics/v2/ThemeAccuracyEvolutionChart.tsx
git rm src/pages/DesempenhoInstitucionalV2.tsx src/hooks/useDesempenhoV2State.ts src/hooks/useInstitutionalPerformanceData.ts
git rm src/services/institutional.ts src/utils/mapInstitutionalData.ts src/utils/desempenhoV2Filters.ts
```

`gestorRoutes.tsx` passa a servir só o portal novo:

```tsx
// src/experiences/gestor/gestorRoutes.tsx
import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import { ExperienceGuard } from '@/experiences/shared/ExperienceGuard';
import { GestorFeatureGate } from '@/experiences/gestor/GestorFeatureGate';
import { GestorShell } from '@/features/gestor/shell/GestorShell';

const Inicio = lazy(() => import('@/features/gestor/routes/Inicio'));
const VisaoGeral = lazy(() => import('@/features/gestor/routes/VisaoGeral'));
const Detalhamento = lazy(() => import('@/features/gestor/routes/Detalhamento'));

/**
 * Rotas da experiência Gestão (`/gestor/*`) — Portal do Gestor v2.
 * As 5 telas antigas foram removidas no cleanup pós-GA (spec §9); a única
 * chave de feature do portal é `gestao.portal_v2`, sob o master `gestao.enabled`.
 */
export const gestorRoutes = (): RouteObject[] => [
  {
    path: '/gestor',
    element: (
      <ExperienceGuard experience="gestao">
        <GestorFeatureGate featureKey="gestao.portal_v2">
          <GestorShell />
        </GestorFeatureGate>
      </ExperienceGuard>
    ),
    children: [
      { index: true, element: <Navigate to="/gestor/inicio" replace /> },
      { path: 'inicio', element: <Inicio /> },
      { path: 'visao-geral', element: <VisaoGeral /> },
      { path: 'detalhamento', element: <Detalhamento /> },
    ],
  },
  // Redirects de compatibilidade das URLs antigas.
  { path: '/desempenho-institucional', element: <Navigate to="/gestor" replace /> },
  { path: '/desempenho-institucional-v2', element: <Navigate to="/gestor" replace /> },
  { path: '/gestor/visao-institucional', element: <Navigate to="/gestor/visao-geral" replace /> },
  { path: '/gestor/diagnostico-curricular', element: <Navigate to="/gestor/visao-geral" replace /> },
  { path: '/gestor/alunos', element: <Navigate to="/gestor/visao-geral" replace /> },
  { path: '/gestor/insights-pedagogicos', element: <Navigate to="/gestor/visao-geral" replace /> },
  { path: '/gestor/inteligencia-decisoria', element: <Navigate to="/gestor/detalhamento" replace /> },
];
```

`GestorFeatureGate.tsx` perde o `GestorIndexRedirect` (que existia só para escolher entre as 5 telas) e mantém apenas o gate:

```tsx
// src/experiences/gestor/GestorFeatureGate.tsx
import * as React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAccessRules } from '@/hooks/useAccessRules';
import { useEffectiveFeatures } from '@/hooks/useEffectiveFeatures';
import { getDefaultRouteForUser } from '@/utils/experiences';

interface GestorFeatureGateProps {
  featureKey: string;
  children: React.ReactNode;
}

/**
 * Gate por feature do portal do gestor. Feature desligada para a IES → sai do
 * portal pela rota default do usuário (não há mais fallback entre módulos: o
 * portal é uma única feature, `gestao.portal_v2`).
 */
export const GestorFeatureGate: React.FC<GestorFeatureGateProps> = ({ featureKey, children }) => {
  const { hasFeature, loading } = useEffectiveFeatures();
  const { user, access } = useAuth();
  const { accessRules } = useAccessRules();
  if (loading) return null;
  if (!hasFeature(featureKey)) {
    return <Navigate to={getDefaultRouteForUser(user, { ...accessRules, desempenhoInstitucional: false }, access)} replace />;
  }
  return <>{children}</>;
};
```

- [ ] **Step 5: Ajustar os testes que referenciavam o que morreu**

```bash
git rm src/test/unit/gestorNav.test.ts
```
Em `src/test/unit/route-gates.test.tsx`, remover o import de `GESTOR_NAV` e o teste `'todo item da nav do gestor declara featureKey gestao.*'`, substituindo por:

```tsx
import { gestorRoutes } from '@/experiences/gestor/gestorRoutes';

  it('toda rota do gestor está sob o gate gestao.portal_v2', () => {
    const raiz = gestorRoutes().find((r) => r.path === '/gestor')!;
    const el = raiz.element as React.ReactElement;
    // ExperienceGuard > GestorFeatureGate > GestorShell
    const gate = (el.props as { children: React.ReactElement }).children;
    expect((gate.props as { featureKey: string }).featureKey).toBe('gestao.portal_v2');
    const filhos = (raiz.children ?? []).map((c) => c.path).filter(Boolean);
    expect(filhos).toEqual(['inicio', 'visao-geral', 'detalhamento']);
  });
```

Em `src/test/unit/gestorFeatureGate.test.tsx`, remover os dois `describe('GestorIndexRedirect')`. Em `src/test/unit/buildAppRoutes.test.ts`, substituir o teste da linha 294 (`'a index de /gestor resolve dinamicamente...'`) por:

```ts
  it('a index de /gestor redireciona para o Início do portal v2', () => {
    const raiz = gestorRoutes().find((r) => r.path === '/gestor')!;
    const index = (raiz.children ?? []).find((c) => c.index)!;
    expect((index.element as React.ReactElement).props.to).toBe('/gestor/inicio');
  });
```

- [ ] **Step 6: Verificar o front antes de tocar no banco**

```bash
npm run type-check && npm run lint && npm run test:run && npm run build
```
Expected: `type-check` sem output; `lint` **vai falhar** (falha sempre neste repo — comparar a contagem de problemas com `git stash && npm run lint` para garantir que não **aumentou**); `test:run` verde com os arquivos removidos fora da conta; `build` gerando `dist/` sem erro de import.

Confirmar que nenhuma referência sobrou:
```bash
grep -rn "GestorNav\|GestorLayout\|GestorFiltersProvider\|useInstitutionalPerformanceData\|services/institutional\|mapInstitutionalData\|desempenhoV2Filters\|analytics/v2/modules\|GestorIndexRedirect" src/
```
Expected: **nenhuma saída**.

- [ ] **Step 7: Desativar as 5 chaves de feature antigas (DDL — dado, não código)**

Aplicar via MCP do Supabase com **project ref gvqv CONFIRMADO** (`get_project_url` contendo `gvqvrmkizemwsasmupmo`), ou pelo agente do Lovable com `send_message`.

```sql
-- supabase/migrations/<ts>_desativa_features_gestao_antigas.sql
-- Cleanup pós-GA do Portal do Gestor v2 (spec §9): as 5 telas que essas chaves
-- gateavam não existem mais no código. Desativa no catálogo (deixa de aparecer
-- em /admin/ies) e apaga as atribuições por IES. Não dropa linha do catálogo:
-- `active = false` preserva o histórico de auditoria de ies_features_update.
begin;

update public.feature_catalog
set active = false
where key in (
  'gestao.visao_institucional',
  'gestao.diagnostico_curricular',
  'gestao.alunos',
  'gestao.insights_pedagogicos',
  'gestao.inteligencia_decisoria'
);

delete from public.ies_features
where feature_key in (
  'gestao.visao_institucional',
  'gestao.diagnostico_curricular',
  'gestao.alunos',
  'gestao.insights_pedagogicos',
  'gestao.inteligencia_decisoria'
);

commit;
```

Verificação:
```sql
select key, active from public.feature_catalog where experience = 'gestao' order by sort_order;
select feature_key, count(*) from public.ies_features
where feature_key like 'gestao.%' group by 1 order by 1;
```
Expected: no catálogo, só `gestao.enabled` e `gestao.portal_v2` com `active = true`; as 5 antigas com `active = false`. Em `ies_features`, só `gestao.enabled` e `gestao.portal_v2`.

- [ ] **Step 8: Dropar as 7 RPCs sem consumidor (só depois do Step 6 verde e do Step 3 commitado)**

```sql
-- supabase/migrations/<ts>_drop_rpcs_institucionais_sem_consumidor.sql
-- Cleanup pós-GA (spec §9). Consumidores removidos no MESMO ciclo (front já
-- mergeado). O corpo real destas 7 funções está preservado em
-- <ts>_backup_defs_rpcs_institucionais.sql — é o ÚNICO backup existente,
-- porque nenhuma migration versionada tem o corpo com o guard (§7.1).
--
-- NÃO estão nesta lista, deliberadamente:
--   get_student_growth_tri  — sem consumidor após este cleanup, mas é a única
--     fonte materializada de crescimento por aluno e drop é irreversível.
--     Reavaliar em 90 dias.
--   get_ies_student_count   — idem; candidata à superfície de contrato do admin.
--   user_can_access_ies     — guard usado DENTRO de outras RPCs.
--   get_simulado_tem_tri, get_user_ranking_in_ies — fluxo do aluno, vivos.
begin;

drop function if exists public.get_institutional_performance(uuid, uuid, integer[]);
drop function if exists public.get_institutional_student_scores(uuid, uuid, integer[]);
drop function if exists public.get_institutional_evolution(uuid);
drop function if exists public.get_institutional_tri(uuid, uuid, integer[]);
drop function if exists public.get_institutional_evolution_tri(uuid);
drop function if exists public.get_institutional_simulados(uuid);
drop function if exists public.get_theme_evolution(text, uuid);

commit;
```

**Antes de aplicar**, conferir as assinaturas exatas (o `drop` erra se os tipos divergirem):
```sql
select p.proname, pg_get_function_identity_arguments(p.oid) as assinatura
from pg_proc p join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
where p.proname in (
  'get_institutional_performance','get_institutional_student_scores','get_institutional_evolution',
  'get_institutional_tri','get_institutional_evolution_tri','get_institutional_simulados','get_theme_evolution'
) order by 1;
```
Expected: 7 linhas. **Ajustar o DDL para a assinatura devolvida** antes de aplicar; se uma função tiver duas sobrecargas, dropar as duas explicitamente.

Verificação pós-aplicação:
```sql
select count(*) as restantes from pg_proc p
join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
where p.proname in (
  'get_institutional_performance','get_institutional_student_scores','get_institutional_evolution',
  'get_institutional_tri','get_institutional_evolution_tri','get_institutional_simulados','get_theme_evolution'
);
```
Expected: `0`.

- [ ] **Step 9: Regenerar os tipos e revalidar**

Regenerar `src/integrations/supabase/types.ts` (MCP `generate_typescript_types` com **gvqv confirmado**, ou o agente do Lovable). Depois:

```bash
npm run type-check && npm run test:run && npm run build
```
Expected: verdes. Se `type-check` acusar `Property 'get_institutional_x' does not exist`, sobrou consumidor — o Step 6 foi feito incompleto; corrigir o código, **não** recriar a RPC.

Confirmar que o `types.ts` perdeu exatamente 7 funções:
```bash
git diff --stat src/integrations/supabase/types.ts
grep -c "get_institutional" src/integrations/supabase/types.ts
```
Expected: `0` ocorrências de `get_institutional`.

- [ ] **Step 10: Commit**
```bash
git add -A
git commit -m "chore(gestor): cleanup pos-GA — remove 5 telas antigas, modulos v2, 5 chaves de feature e 7 RPCs sem consumidor

- backup do corpo REAL das 9 RPCs institucionais (com o guard injetado em prod) antes de qualquer drop
- get_student_growth_tri e get_ies_student_count mantidas de proposito: drop e irreversivel (nenhum .sql tem o corpo)
- consumidor e RPC removidos no MESMO ciclo, front antes do DDL, para o types.ts regenerado nao quebrar o build
- redirects das 5 URLs antigas preservados"
```

---

### Task 64b: Eliminar a régua divergente do `AiChatDrawer`

> **Pertence à Fase 6 (cleanup), imediatamente depois da Task 64.** Spec §4.4 e §7.3: o `AiChatDrawer` usa duas réguas incompatíveis com a canônica e precisa ser corrigido "no mesmo ciclo ou ter seus números removidos". Enquanto ele existir com esses números, o mesmo aluno pode aparecer classificado de dois jeitos diferentes no produto.

**Files:**
- Delete: `src/components/analytics/v2/shared/AiChatDrawer.tsx` (caminho A) **ou** Modify o mesmo arquivo (caminho B)
- Delete: `src/pages/DesempenhoInstitucionalV2.tsx`
- Test: `src/features/gestor/__tests__/regras-criticas.test.ts` (teste-guarda novo)

**Interfaces:**
- Consumes: a Task 64 já removeu `src/experiences/gestor/GestorLayout.tsx`, que era um dos dois consumidores. `nivelDesempenho` e `ehProficiente` de `src/features/gestor/lib/regras.ts` (Task 8), caso o caminho B seja necessário.
- Produces: nenhuma interface nova. Produz a garantia de que existe **uma** régua no produto.

**O problema, literal.** Em `src/components/analytics/v2/shared/AiChatDrawer.tsx`:

```tsx
// linhas 68-71 — régua de conceito, incompatível com a canônica (90/75/60/40)
const conceito = headerSummary.percentProficientes >= 80 ? '5' :
  headerSummary.percentProficientes >= 60 ? '4' :
  headerSummary.percentProficientes >= 40 ? '3' :
  headerSummary.percentProficientes >= 20 ? '2' : '1';

// linhas 82-88 — régua de risco, incompatível com crítico<30 / mediano / excelente>=80
const criticos = data.allStudents.filter(s => s.percentual < 45).length;
const atencao = data.allStudents.filter(s => s.percentual >= 45 && s.percentual < 55).length;
// ... "🔵 Oportunidade (55-60%)" ...
```

- [ ] **Step 1: Levantar os consumidores restantes**

```bash
grep -rn "AiChatDrawer" src/ --include=*.tsx --include=*.ts | grep -v "^src/components/analytics/v2/shared/AiChatDrawer.tsx"
```

Expected, **depois** da Task 64 (que removeu `GestorLayout.tsx`): exatamente uma linha de import e uma de JSX, ambas em `src/pages/DesempenhoInstitucionalV2.tsx`.

Agora verificar se essa página é alcançável:

```bash
grep -rn "DesempenhoInstitucionalV2" src/ --include=*.tsx --include=*.ts | grep -v "^src/pages/DesempenhoInstitucionalV2.tsx"
```

Expected: **nenhuma linha de rota ou import** — só ocorrências de string em log dentro de `src/hooks/useDesempenhoV2State.ts`. Ou seja, `DesempenhoInstitucionalV2.tsx` é **página órfã**: nada no `buildAppRoutes` a monta.

- [ ] **Step 2: Aplicar o critério de decisão**

| Resultado do Step 1 | Caminho |
|---|---|
| Nenhum consumidor alcançável (esperado) | **Caminho A** — apagar o `AiChatDrawer` e a página órfã junto. A régua divergente deixa de existir. |
| Algum consumidor alcançável (ex.: o portal novo passou a usar o drawer) | **Caminho B** — trocar os números pelas funções de `regras.ts`. |

Registrar no PR qual caminho foi seguido e por quê.

- [ ] **Step 3 (Caminho A): Escrever o teste-guarda antes de apagar**

Acrescentar ao arquivo da Task 57, `src/features/gestor/__tests__/regras-criticas.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { globSync } from 'node:fs';
import { join } from 'node:path';

describe('regra unica de desempenho no produto (spec §4.4, §7.3)', () => {
  it('o AiChatDrawer com regua divergente nao existe mais', () => {
    expect(existsSync('src/components/analytics/v2/shared/AiChatDrawer.tsx')).toBe(false);
  });

  it('a pagina orfa DesempenhoInstitucionalV2 nao existe mais', () => {
    expect(existsSync('src/pages/DesempenhoInstitucionalV2.tsx')).toBe(false);
  });

  it('nenhum arquivo de src/features/gestor reimplementa corte de nivel', () => {
    const arquivos = globSync('src/features/gestor/**/*.{ts,tsx}', {
      exclude: (p) => p.includes('/lib/regras.ts') || p.includes('/__tests__/'),
    });
    const ofensores: string[] = [];
    for (const arquivo of arquivos) {
      const src = readFileSync(arquivo, 'utf-8');
      // cortes numericos de classificacao fora de regras.ts
      if (/[><]=?\s*(30|45|55|60|80)\b/.test(src)) ofensores.push(arquivo);
    }
    expect(ofensores).toEqual([]);
  });
});
```

Run: `npx vitest run src/features/gestor/__tests__/regras-criticas.test.ts -t "regra unica"`

Expected: FAIL nos dois primeiros testes (`expected true to be false`) — os arquivos ainda existem.

- [ ] **Step 4 (Caminho A): Apagar**

```bash
git rm src/components/analytics/v2/shared/AiChatDrawer.tsx
git rm src/pages/DesempenhoInstitucionalV2.tsx
```

Confirmar que nada mais importa o que foi removido:

```bash
grep -rn "AiChatDrawer\|DesempenhoInstitucionalV2" src/ --include=*.tsx --include=*.ts
```

Expected: só as duas linhas de `Logger.info('[DesempenhoInstitucionalV2]', ...)` em `src/hooks/useDesempenhoV2State.ts`. Se `useDesempenhoV2State.ts` também tiver ficado sem consumidor depois da Task 64, removê-lo no mesmo commit — a Task 64 já o lista entre os candidatos.

Verificar que o build ainda fecha (é aqui que import morto aparece):

```bash
npm run type-check && npm run build
```

Expected: ambos sem erro. **Se o build quebrar por import órfão, remover o consumidor no MESMO commit** — há lição registrada no projeto de que remover só um lado deixa a main sem buildar.

- [ ] **Step 5 (Caminho B, só se o Step 2 apontou consumidor vivo): Substituir os números**

Trocar as linhas 68-71 e 82-88 por chamadas à régua única:

```tsx
import { nivelDesempenho, ehProficiente, PROFICIENCIA_MINIMA } from '@/features/gestor/lib/regras';
import { formatPct } from '@/features/gestor/lib/formatters';

// conceito: NÃO reimplementar. O conceito vem do backend (resultados_ies_tri.concept),
// nunca de uma régua no cliente (spec §4.1).
const conceito = headerSummary.conceito ?? null;

// classificação de aluno: uma régua só
const proficientes = data.allStudents.filter((s) => ehProficiente(s.percentual)).length;
const criticos = data.allStudents.filter(
  (s) => nivelDesempenho(s.percentual) === 'critico',
).length;
const medianos = data.allStudents.filter(
  (s) => nivelDesempenho(s.percentual) === 'mediano',
).length;

const resumo =
  `- Crítico (abaixo de 30%): **${criticos}** alunos\n` +
  `- Mediano (30% a 80%): **${medianos}** alunos\n` +
  `- Proficientes (${PROFICIENCIA_MINIMA}% ou mais): **${proficientes}** alunos\n\n`;
```

Note que as faixas "Atenção (45-55%)" e "Oportunidade (55-60%)" **desaparecem** — elas não existem na régua canônica e eram invenção local.

- [ ] **Step 6: Rodar a suíte inteira e commitar**

Run: `npm run test:run`

Expected: PASS, incluindo os 3 testes novos de "regra unica". Nenhuma regressão nos testes existentes.

Run: `npm run lint && npm run type-check && npm run build`

Expected: os três sem erro.

```bash
git add -A
git commit -m "chore(gestor): elimina a regua divergente do AiChatDrawer

Spec §4.4/§7.3: o AiChatDrawer classificava conceito por 80/60/40/20 e risco
por 45/55/60 — nenhum dos dois compativel com a regua canonica (critico<30,
mediano 30-80, excelente>=80; proficiente>=60). Enquanto existisse, o mesmo
aluno podia aparecer classificado de dois jeitos no produto.

Depois da Task 64 seus unicos consumidores eram GestorLayout.tsx (ja removido)
e DesempenhoInstitucionalV2.tsx, que era pagina orfa — nada no buildAppRoutes
a montava. Os dois arquivos sairam juntos, no mesmo commit, para nao deixar
import orfao quebrando o build.

Teste-guarda garante que os arquivos nao voltem e que nenhum arquivo de
src/features/gestor reimplemente corte de nivel fora de lib/regras.ts."
```
