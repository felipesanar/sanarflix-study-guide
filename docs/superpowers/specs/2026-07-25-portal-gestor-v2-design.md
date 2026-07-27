# Portal do Gestor v2 — SanarFlix Academy (spec)

**Data:** 2026-07-25 · **Autores:** Felipe Souza + Claude · **Status:** em validação

**Fontes desta spec, em ordem de precedência:**

1. Handoff de design `design_handoff_gestor_sanarflix` (zip "Nova Visão do Gestor SanarFlix", export de 24/07/2026 após a reunião com o João) — **o norte de *o que* cada tela faz**.
2. Decisões da reunião "Alinhamento Academy" de 24/07/2026 (Felipe + João) — **sobrescrevem o handoff** onde o design não foi atualizado antes do export.
3. Decisões da reunião "SF Academy - Tech" de 22/07/2026 (Felipe, João, Adlany, Leonardo).
4. Contraproposta de arquitetura de 17/07/2026 (Felipe + João).
5. Estado real do repositório e do banco `gvqv` — **vence o handoff em *como* implementar** (regra do próprio `CLAUDE.md` do handoff).

O PRD original ("Mudanças Prioritárias SanarFlix Academy", Leonardo, 07/07) foi deliberadamente deixado de fora: a contraproposta e as três reuniões já consolidaram o que dele sobrevive.

---

## 1. Problema

A experiência atual do gestor são 5 rotas (`/gestor/visao-institucional`, `/diagnostico-curricular`, `/alunos`, `/insights-pedagogicos`, `/inteligencia-decisoria`) que são wrappers finos sobre `src/components/analytics/v2/modules/`. Problemas concretos:

1. **Sem jornada.** Cinco abas paralelas, nenhuma responde "minha instituição está melhorando?" em segundos. O gestor precisa saber onde clicar antes de entender o que está vendo.
2. **Métricas misturadas em janelas temporais diferentes.** Os KPIs atuais comparam períodos distintos entre si (um olha o último simulado, outro o período todo), o que a reunião de 22/07 identificou como a maior fonte de confusão: *"eles estão utilizando recortes temporais diferentes"*.
3. **TRI e conceito ENAMED aparecem agregados**, o que é estatisticamente inválido — são métricas por simulado. A contraproposta trata isso como divergência central com o PRD.
4. **Camada de dados frágil.** `useInstitutionalPerformanceData` não usa React Query: é `useState`/`useEffect` manual, 6 RPCs por render, com fallback silencioso para mock (`getMockViewModel()`) quando não há sessão ou a IES não tem simulados.
5. **Regras de negócio duplicadas e divergentes.** `PROFICIENCY_THRESHOLD = 60` é copy-paste literal em 10 arquivos; existem 5 réguas de classificação de desempenho incompatíveis no projeto (detalhe em §5.4).
6. **Sem shell próprio.** `GestorLayout` é header + tabs dentro de `max-w-7xl`; o design pede sidebar de 240px sem header no conteúdo.

## 2. Escopo

### 2.1 Entra

Três telas, uma persona (gestora acadêmica de IES parceira), princípio **executivo antes de investigativo**:

| Rota | Tela | Pergunta que responde |
|---|---|---|
| `/gestor` | **Início** | "O que está acontecendo e o que eu faço agora?" |
| `/gestor/visao-geral` | **Visão Geral** | "Como estamos e onde dói?" |
| `/gestor/detalhamento` | **Detalhamento por Simulados** | "O que exatamente aconteceu neste simulado?" |

Diagnóstico Curricular e Visão de Alunos **vivem dentro da Visão Geral** — não são rotas.

### 2.2 Não entra (decisões travadas, não reabrir)

- **Checklist de pendências do gestor** — descartado em 22/07: *"senão a experiência do gestor vira uma outra coisa, e nesse momento a gente não quer trazer essa complexidade agora"*. A âncora da home é o cronograma.
- **Filtro de turma** — o Academy não tem essa estrutura de dados.
- **Filtro por simulado específico na Visão Geral** — "geral" pressupõe tudo; recortar simulado é papel do Detalhamento.
- **Comparação entre duas IES pelo gestor de grupo** — fora do escopo (24/07), sem demanda de cliente.
- **Rota própria de Insights Pedagógicos e de Inteligência Decisória** — os 2 insights autogerados viram **bloco dentro da Visão Geral**; as duas rotas antigas morrem e Inteligência Decisória é descontinuada.
- **Ranking / engajamento** — visão futura. Antes de qualquer coisa, João precisa levantar com o Diego Dias o estado e o débito técnico das views já construídas.
- **Versão mobile de produto.** Alvo é desktop 1440–1920; abaixo de 1280 as grades de 4 colunas viram 2, abaixo de 1024 viram 1 com tabelas em rolagem horizontal.
- **Reaproveitar o cronograma para o aluno** — decidido em 24/07: *"deixa o aluno no escuro mesmo, por enquanto"*.

### 2.3 Fora desta spec, mas dependência dela

O admin precisa de tela para o CX/cadastros popular contrato e datas de simulado (§6.3). Sem isso o cronograma nasce vazio.

## 3. Personas e permissões

| Papel no handoff | Role real (`app_role`) | Vê | Seletor de IES |
|---|---|---|---|
| `admin_b2b` | `admin` | Todas as IES | Dropdown com todas |
| `gestor_grupo` | `gestor_grupo` | IES do seu grupo (`get_accessible_ies`) | Dropdown com as do grupo |
| `gestor_ies` | `gestor` | Apenas a própria IES (`users.id_ies`) | **Rótulo estático, sem afordância de clique** |

Regras herdadas do modelo de acesso v2 (já em produção):

- Nenhum componente checa role literal — só `can()` / `hasExperience()` de `src/experiences/access.ts`. Role literal só em derivação de acesso e em escopo de dado.
- O `iesId` que o cliente manda é **hint de UI**, nunca autorização. Toda RPC escopa pela IES derivada do token via `user_can_access_ies` / `get_accessible_ies`.
- `admin` e `atendimento` têm bypass de feature calculado no servidor (`user_has_feature`).

## 4. Regras de negócio

### 4.1 Métricas e escalas

| Métrica | Escala | Onde aparece | Coluna de origem |
|---|---|---|---|
| **Proficiência** | 0–100 | Aluno e instituição | `resultados_alunos_tri.score_proprio` |
| **Conceito ENAMED projetado** | 1–5 inteiro | Visão Geral (KPI) e Detalhamento | `resultados_ies_tri.concept` |
| **Percentual de acerto** | 0–100% | Todas as telas | derivado de `answer_progress.correct` |
| **Número de acertos** | inteiro | Detalhamento, por aluno | `resultados_alunos_tri.num_correct` |
| **Índice de acerto da questão** | 0–100% | Detalhamento das Questões | derivado de `answer_progress.correct` por `question_id` |

**"Nota TRI" foi eliminada como métrica separada.** O handoff a trata como coluna própria (`AlunoNoSimulado.notaTri`, 0–100) ao lado de `proficiencia`, e ainda a lista no glossário como conceito distinto. A reunião de 24/07 concluiu que são a mesma coisa e decidiu manter **um** nome: *"KPIs do drawer: Nota TRI/Proficiência (eram duplicados — decidido manter só um)"* e *"Proficiência Média (= TRI Médio, mantém só um nome)"*.

**Decisão: o rótulo é "Proficiência".** Consequências:
- `TabelaAlunosSimulado` tem **uma** coluna de escala 0–100 (Proficiência), não duas.
- O glossário perde a entrada "Nota TRI" e mantém só "Proficiência (0 a 100)".
- A regra "sem TRI na Visão Geral" continua valendo com outra formulação: **a Visão Geral não mostra proficiência por simulado individual** — só a série de evolução e os KPIs agregados.

> **PENDÊNCIA (nº8):** o banco tem **dois** scores 0–100 por aluno — `score_proprio` e `score_enamed` — e a spec assume `score_proprio` como "Proficiência". Se `score_enamed` for uma métrica de produto distinta (projeção na escala ENAMED) e não um intermediário de cálculo, então "Nota TRI" e "Proficiência" *não* eram duplicados e essa decisão precisa ser revista. Confirmar com o João antes de implementar o drawer do aluno.

Invariantes:

- **Proficiência nunca se aplica a área, especialidade ou tema.** Esses três usam **sempre % de acerto**.
- **A Visão Geral não mostra proficiência por simulado individual nem leitura questão-a-questão.** Proficiência por simulado é do Detalhamento.
- **Conceito ENAMED não tem média.** Com 2+ simulados vira comparativo lado a lado (`porSimulado[]`), nunca um número único.
- Todo indicador carrega tooltip de rastreabilidade `Período · Fonte · Atualizado em · Critério`, com o texto do critério vindo do servidor (`meta.criterio`) para não divergir entre telas.

### 4.2 `theta` não é exibido

O banco tem `resultados_alunos_tri.theta` (escala bruta de TRI, **não documentada no schema** — nenhum comentário nem CHECK; por convenção IRT provavelmente centrada em 0, mas isso é inferência). A escala 0–100 que as telas usam é `score_proprio`, não `theta`. Evidência: `supabase/migrations/20260708143105_...sql:86` trata `score_proprio < 60` como abaixo do esperado, e as linhas 131–149 derivam `concept` 1–5 de faixas de `pcp` (90/75/60/40).

**`theta` não é exibido em nenhuma tela.** Se em algum ponto for preciso, exige conversão explícita e documentada.

### 4.3 Corte de proficiente — divergência resolvida

O handoff diz "proficiente = proficiência **> 60**" e seu caso de teste nº1 afirma *"60 não é proficiente"*. **Isso contradiz banco e front**, que usam `>= 60`:

- Banco: `score_proprio < 60` = abaixo do esperado (`20260708143105_...sql:86`) ⇒ 60 é proficiente.
- Front: `PROFICIENCY_THRESHOLD = 60` com comparação `percentual >= 60` (`src/utils/mapInstitutionalData.ts:30`, `src/utils/desempenhoV2Filters.ts:9`).

**Decisão: `>= 60`.** O handoff está errado neste ponto. Mudar o corte alteraria contagem de aluno que o gestor já viu, e a coluna `is_proficient_proprio` do banco já materializa essa semântica. O caso de teste nº1 do handoff deve ser reescrito para "60 **é** proficiente; 59,9 não é".

### 4.4 Níveis de desempenho — resolvido

O Diagnóstico Curricular classifica em **excelente / mediano / crítico** (3 níveis). A decisão de 24/07 é **não criar régua nova e reusar as réguas do Flix**; Felipe confirmou em 25/07: **vale a régua canônica do projeto**.

**Régua canônica em vigor** (`src/utils/mapInstitutionalData.ts:33-39`, `src/utils/desempenhoV2Filters.ts:97-103`), sobre **% de acerto**:

| Faixa | Intervalo |
|---|---|
| Insuficiente | 0–30 |
| Regular | 30–50 |
| Intermediário | 50–60 |
| Bom | 60–80 |
| Excelente | 80–100 |

**Mapeamento 5 faixas → 3 níveis** (decisão desta spec):

| Nível | Corte | Faixas canônicas que absorve |
|---|---|---|
| **Crítico** | `acertoPct < 30` | Insuficiente |
| **Mediano** | `30 <= acertoPct < 80` | Regular · Intermediário · Bom |
| **Excelente** | `acertoPct >= 80` | Excelente |

Critério: preserva as bordas da régua canônica e coincide com o exemplo dado na reunião de 24/07 (*"abaixo de 30% crítico, acima de 80% excelente"*). Nenhum corte novo é inventado.

> **RISCO A VERIFICAR COM DADO REAL (Fase 0):** "mediano" absorve uma faixa de 50 pontos, e 30% de acerto é um piso muito baixo — na prática o grupo "crítico" pode nascer quase sempre vazio, esvaziando o valor diagnóstico da tela. A Fase 0 roda uma query de distribuição real de % de acerto por grande área nas IES com simulado, e se "crítico" ficar vazio na maioria dos recortes, a alternativa é subir o corte para `< 50` (Insuficiente + Regular). **Decisão baseada em evidência, não em preferência** — e é ajuste de uma constante em `regras.ts`, sem impacto de arquitetura.

Este mapeamento vale para **grande área, especialidade e tema** (as três usam % de acerto). Ele **não** substitui o corte de proficiente do aluno (§4.3), que é `>= 60` sobre proficiência — são métricas e propósitos diferentes.

#### Réguas divergentes a consolidar

O projeto hoje tem cinco réguas incompatíveis:

| Régua | Cortes | Métrica | Onde |
|---|---|---|---|
| Distribuição (canônica) | 0–30 Insuficiente / 30–50 Regular / 50–60 Intermediário / 60–80 Bom / 80–100 Excelente | % de acerto do aluno | `src/utils/mapInstitutionalData.ts:33-39`, `desempenhoV2Filters.ts:97-103` |
| Conceito institucional | 90/75/60/40 → 5/4/3/2/1 | % de alunos proficientes | `mapInstitutionalData.ts:42-48` |
| Sanção regulatória | <30 / 30–40 / 40–50 / 50–60 / ≥60 | `pcp` | `mapInstitutionalData.ts:61-79` |
| Status de KPI | good 60 / warning 40 | % proficientes | `mapInstitutionalData.ts:82-86` |
| AiChatDrawer (divergente) | conceito 80/60/40/20; risco 45/55/60 | misto | `AiChatDrawer.tsx:68-71,82-88` |

A régua canônica e o mapeamento acima entram em **um único módulo** `src/features/gestor/lib/regras.ts`, fonte da verdade do portal novo. Os 10 pontos de `PROFICIENCY_THRESHOLD` duplicado passam a importar dele. O `AiChatDrawer` — que hoje usa conceito 80/60/40/20 e risco 45/55/60, incompatíveis com tudo — é corrigido no mesmo ciclo ou tem seus números removidos.

### 4.5 Filtro global de semestre

Controle segmentado, **idêntico na Visão Geral e no Detalhamento**, persistido na URL:

| Opção | Comportamento |
|---|---|
| **6º ano (padrão)** | Todos os semestres nos gráficos, **11º e 12º em evidência máxima**, demais esmaecidos como referência |
| **Geral** | Todos os semestres, sem destaque |
| **Por semestre** | Revela dropdown 1º…12º; só o semestre escolhido, em evidência |

**Seleção única em toda a página, inclusive no gráfico de dispersão** (decisão do Felipe em 25/07, sobrescrevendo a ideia de 24/07 de permitir multi-semestre na dispersão). Motivo: viabiliza o cálculo de tendência armazenado no backend de forma finita — *"se ele for selecionar mais de um semestre, a quantidade de opções são infinitas para essa reta existir"* — e simplifica o modelo de filtro.

Regras derivadas:
- Com um semestre específico selecionado, controles que só fazem sentido em multi-semestre **somem** (não ficam desabilitados).
- Gráficos que comparam semestres, com um único semestre, viram **distribuição interna daquele semestre** (coluna de pontos com jitter + mediana em destaque), não série de um ponto.

**"6º ano" já existe no banco** como agregador dos semestres 11 e 12: `count(*) FILTER (WHERE u.semestre = ANY (ARRAY[11,12]))` alimenta `num_students_sixth_year` / `num_proficient_sixth_year` / `pcp_sixth_year` (`20260708143105_...sql:87-88`). `users.semestre` é `integer`.

### 4.6 Nomenclatura: "desempenho" na visão por área

Decisão de 24/07: **"proficiência" só onde há TRI** (aluno e simulado). Na visão por grande área o rótulo é **"desempenho"**, sobre % de acerto. Os cards de insight seguem: *"duas áreas com variação de desempenho considerável"* em vez de "consistentemente proficiente" quando o recorte é grande área.

> **PENDÊNCIA NÃO-BLOQUEANTE:** validar a troca de nomenclatura com o Leonardo (item de ação aberto de 24/07). Ele tem apego declarado a "consistentemente proficiente". Implementar com "desempenho" e ajustar rótulo se ele vetar — é mudança de string, não de arquitetura.

### 4.7 Regras do Detalhamento

1. **Nunca "todos"**: seleção explícita de 1+ simulados. Simulado previsto ou em processamento aparece desabilitado com o motivo. Servidor rejeita lista vazia ou "todos" com erro `selecao_de_simulados_obrigatoria`.
2. Acima de **5 simulados**: aviso não-bloqueante de legibilidade.
3. **1 simulado** → leitura completa, incluindo Detalhamento das Questões como **último componente da página**.
4. **2+ simulados** → modo comparativo: métricas em **uma coluna por simulado** (sem média única); questões comparadas **por tema**; alunos ganham coluna **Variação** (só quem participou de todos); **Detalhamento das Questões fica oculto**; o comparativo abre **colapsado** e expande sob demanda.
5. **Régua de evolução** (`1º simulado · anterior · atual`): some com 1 simulado realizado; com 2, mostra os dois pontos. Rótulo do ponto corrente é **"atual"**, não "último" (24/07: "último" é ambíguo).
6. **3 KPIs**: Percentual de acerto médio · Conceito ENAMED (projetado) · Proficiência média. Os que são média recalculam com 2+ simulados; o ENAMED vira comparativo. *Não* há KPI de "simulados realizados" aqui (redundante com a Visão Geral).

### 4.8 Regras da Visão Geral

- **4 KPIs nesta ordem**: Conceito ENAMED projetado (1–5) · Alunos proficientes (%) · Percentual de acerto (%) · Simulados realizados (feitos/total). Os três primeiros **lideram pela evolução**, não pelo valor absoluto isolado (22/07: *"eu acho que o key result tem que ser a evolução"*), com a régua `1º · anterior · atual`.
- **Gráfico protagonista com 3 modos** (24/07, sobrescreve o handoff que dizia não existir "Geral"):
  - **Geral** — linha de evolução da proficiência institucional por simulado (0–100).
  - **Por grande área** — multi-linha, **em % de acerto** (não proficiência).
  - **Por aluno** — **dispersão** nota × semestre com linha de tendência.
  
  O controle vive **dentro do gráfico**, não no topo da página (22/07: *"o filtro tem que estar no gráfico, não na página"*). A troca **alterna o componente exibido, sem refetch** — todos os dados já vêm carregados na query da tela.
- **Diagnóstico Curricular (resumo)**: 3 grupos por nível de desempenho; a seta abre a **cascata ao lado**, dividindo o grid em dois (não é drawer); a cascata tem **2 níveis** (grande área → especialidade); a especialidade abre o **drawer de temas**. Expande **para baixo, no lugar**, empurrando o conteúdo; clicar de novo recolhe.
- **Visão de Alunos (resumo)**: distribuição por grupo de evolução + dispersão com linha de tendência. Ordem: **Visão de Alunos acima, visão por área abaixo** (22/07: dado mais macro precede o micro).
- **Insights**: 2 insights autogerados (um por área, um por aluno), leitura textual curta, sem linguagem de aluno.
- **Tabela de alunos** ao fim, com busca, **tag do grupo ao lado do nome**, proficiência por simulado, tendência e paginação. O nome abre a visão detalhada.
- Removido: links de ação dentro dos cards de nível ("Ver alunos em TRI", "Explorar diagnóstico") — o detalhamento já aparece imediatamente abaixo.

### 4.9 Hierarquia de conteúdo — confirmada no banco

```
Grande área   →   Especialidade   →   Tema
(grande_area)     (especialidade)     (tema)
```

Três níveis, exatamente. **Não existe "subespecialidade"** em `questoes_simulado`. O `bySubspecialty` de `get_institutional_performance` é alimentado literalmente por `questoes_simulado.tema` (`20260625174437_...sql:81`) — é nome herdado, não um quarto nível. Isso resolve a confusão de 22/07 e confirma a decisão de 24/07 ("acaba no tema").

Consequência: **a cascata de 2 níveis + drawer de temas do handoff roda sobre a RPC existente sem nenhuma mudança de schema.**

> **PENDÊNCIA (item de ação aberto de 22/07):** verificar se **todos** os simulados já cadastrados seguem essa hierarquia preenchida. Uma questão com `grande_area` ou `especialidade` nulo produz nó órfão na cascata. Precisa de auditoria de dado antes do piloto.

### 4.10 Ausência, parcialidade e confiança

| Situação | Flag | UI |
|---|---|---|
| Aluno não participou | `participou: false` | Célula `—` + badge "Não participou". **Fora de toda média** |
| Amostra pequena (n < 10) | `lowSample: true` | Badge "cobertura parcial" + tooltip com o n |
| Gabarito processando | `status: "processing"` | Card/linha desabilitada com o motivo, **sem número** |
| Recorte parcial | `partial: true` | Faixa informativa acima do bloco |

**Nunca preencher lacuna com zero, média do grupo ou estimativa.** Se o servidor não mandou, a UI mostra `—`, "sem dados" ou o estado de carregamento.

### 4.11 Linha de tendência e ponto projetado

Decisão de 24/07: a tendência é **calculada no backend e armazenada**, recalculada só quando entra nova leva de questões/resultados — não a cada requisição do gestor.

O **ponto projetado** usa crescimento médio por simulado **ponderado pelo tempo até o próximo simulado** (ex.: +2 pontos em 1 mês, próximo simulado em 2 meses → projeção de +4), não soma linear simples.

A tendência representa **a janela toda**, não um ponto específico — sem tooltip por ponto.

> **PENDÊNCIA TÉCNICA (reconhecida em 24/07):** a viabilidade do ponto projetado não foi validada — *"acho que tem valor, só não sei a nível de complexidade na conta por detrás"*. Fica como spike na Fase 0. Se não fechar, a linha de tendência entra sem ponto projetado e a projeção vira fase futura. **A tela não depende dela.**

## 5. Arquitetura de dados

### 5.1 Abordagem: RPCs agregadoras por tela

O handoff especifica 11 endpoints REST com envelope próprio. O projeto não tem REST — usa RPCs Postgres via `supabase-js`. **Decisão: criar RPCs agregadoras por tela que devolvem o envelope do handoff**, compondo as tabelas direto.

Justificativa:
- O handoff exige agregação no servidor: *"Agregações no backend. O front nunca soma base bruta."*
- Um round-trip por tela em vez de seis.
- Regras que a UI não pode decidir sozinha (nunca média com 2+ simulados, `null` vs `0`, `lowSample`, `criterio`) ficam onde não podem ser burladas.
- **Não encosta nas 19 RPCs com guard injetado** (§7.1).

### 5.2 RPCs novas

Nomenclatura `get_gestor_*` para separar do namespace `get_institutional_*` legado.

| RPC | Serve | Retorno |
|---|---|---|
| `get_gestor_contexto()` | Shell | usuário, papel, IES acessíveis **com nome**, IES atual, contrato vigente, `podeTrocarIes`, `podeExportar` |
| `get_gestor_cronograma(p_ies_id)` | Início + drawer do Detalhamento | simulados contratados com status, datas, modalidade, participantes |
| `get_gestor_avisos(p_ies_id)` | Início | avisos da Sanar para o público "gestor", com lido/não-lido |
| `get_gestor_visao_geral(p_ies_id, p_semestre)` | Visão Geral | 4 KPIs + as 3 séries do gráfico + resumo do diagnóstico + distribuição de alunos + dispersão |
| `get_gestor_diagnostico(p_ies_id, p_semestre, p_node)` | Cascata | um nível da cascata, lazy por nó |
| `get_gestor_diagnostico_temas(p_ies_id, p_semestre, p_especialidade)` | Drawer | temas com % de acerto |
| `get_gestor_alunos(p_ies_id, p_semestre, p_page, p_page_size, p_sort, p_order, p_q)` | Tabela de alunos | paginada no servidor |
| `get_gestor_aluno(p_ies_id, p_aluno_id, p_simulados)` | Drawer do aluno | visão detalhada |
| `get_gestor_detalhamento(p_ies_id, p_semestre, p_simulados[])` | Detalhamento | métricas **uma entrada por simulado** + acerto por área e semestre + dispersão + comparativo por tema |
| `get_gestor_questoes(p_ies_id, p_simulado_id, p_page, p_page_size, p_sort, p_area)` | Tabela de questões | paginada; só com exatamente 1 simulado |

Todas obrigatoriamente:
- `SECURITY DEFINER` com `SET search_path = public`, `STABLE`.
- Guard de role + `user_can_access_ies` no padrão canônico já usado pelas institucionais.
- Guard de feature explícito **no corpo da função**, não injetado: `IF NOT public.user_has_feature('gestao.portal_v2') THEN RAISE EXCEPTION 'feature_not_enabled' USING ERRCODE='42501'; END IF;`
- `REVOKE ALL FROM public, anon` + `GRANT EXECUTE TO authenticated`.
- Envelope com `meta`: `periodo`, `fonte`, `atualizadoEm`, `criterio`, `partial`, `lowSample`.

### 5.3 O que é reusado sem tocar

Estas RPCs continuam servindo as 5 telas antigas durante a coexistência e **não são modificadas**. As novas `get_gestor_*` recompõem a mesma lógica sobre as tabelas, em vez de chamá-las:

`get_institutional_performance` · `get_institutional_student_scores` · `get_institutional_tri` · `get_institutional_evolution_tri` · `get_institutional_simulados` · `get_student_growth_tri` · `get_theme_evolution` · `get_ies_student_count` · `get_simulado_tem_tri`

Tabelas de origem: `simulados_admin`, `questoes_simulado`, `answer_progress`, `simulados_finalizados`, `simulados_iniciados`, `resultados_alunos_tri`, `resultados_ies_tri`, `users`, `ies`, `announcements`, `announcements_viewed`, `feature_catalog`, `ies_features`, `educational_groups`, `group_ies`, `user_groups`.

### 5.4 Materialized views

**Não nesta entrega.** A MV que já existe (`mv_evolucao_institucional_tri`) está órfã — nenhuma RPC a lê desde `20260624133410`, sinal de que esse caminho já foi tentado e abandonado. O contrato de latência do handoff é < 800ms; medir primeiro com RPC direta e índices, e só introduzir MV se não fechar. Índices relevantes já existem (`idx_answer_progress_simulado_user`, `idx_answer_progress_user_simulado`, `idx_questoes_simulado_id`, `idx_users_id_ies`).

## 6. Modelo de dados novo

### 6.1 O que não existe hoje

Verificado em `types.ts` + todas as migrations:

1. **Cronograma/contrato de simulados** — não existe tabela de simulado contratado sem data, nem contagem de contratados por IES (o KPI "3 de 7"), nem distinção agendado × reagendado. **É a âncora da home.**
2. **Modalidade online/presencial** — `simulados_admin` não tem a coluna.
3. **Público-alvo dos avisos** — `announcements` segmenta por IES (`ies_selecionadas`/`ies_excluidas`) e por `semestre_destino`, mas **não por papel**. Não há como mandar aviso só para gestor.

### 6.2 Modelo proposto

Aditivo, sem migração destrutiva.

**`simulados_admin` — colunas novas:**

| Coluna | Tipo | Uso |
|---|---|---|
| `modalidade` | `text` CHECK `in ('online','presencial')`, nullable | Regra de datas (§6.4) |
| `data_realizacao` | `timestamptz` nullable | Presencial: data única de aplicação |
| `data_agendada_original` | `timestamptz` nullable | Guarda a 1ª data marcada; permite derivar "reagendado" |

**`ies_contrato_simulados` — tabela nova:**

```sql
create table public.ies_contrato_simulados (
  id                    uuid primary key default gen_random_uuid(),
  ies_id                uuid not null references public.ies(id) on delete cascade,
  nome_contrato         text not null,
  simulados_contratados int  not null check (simulados_contratados > 0),
  vigencia_inicio       date not null,
  vigencia_fim          date not null,
  created_at            timestamptz not null default now(),
  created_by            uuid references auth.users(id)
);
create unique index on public.ies_contrato_simulados (ies_id, nome_contrato);
-- RLS: SELECT por user_can_access_ies; escrita só via RPC de admin.
```

**`ies_simulado_previsto` — tabela nova** (o "contratado sem data"):

```sql
create table public.ies_simulado_previsto (
  id           uuid primary key default gen_random_uuid(),
  contrato_id  uuid not null references public.ies_contrato_simulados(id) on delete cascade,
  ies_id       uuid not null references public.ies(id) on delete cascade,
  ordem        int  not null,
  nome_previsto text,
  simulado_id  uuid references public.simulados_admin(id),
  created_at   timestamptz not null default now()
);
```

Semântica: o contrato declara *quantos* simulados a IES tem direito; cada linha de `ies_simulado_previsto` é um slot. Slot com `simulado_id` nulo = **"A definir"** (24/07: *"permitindo salvar o simulado sem data, só para o gestor ter visibilidade de quantos simulados a IES tem direito"*). Slot preenchido aponta para o simulado real. O KPI "3 de 7" é `count(slots com simulado realizado) / contrato.simulados_contratados`.

**`announcements` — coluna nova:**

| Coluna | Tipo | Uso |
|---|---|---|
| `publico_alvo` | `text[]` default `'{aluno}'`, valores em `('aluno','gestor','professor')` | Segmentação por persona |

Backfill: todos os avisos existentes recebem `{aluno}` para não vazar aviso de aluno no portal do gestor.

### 6.3 Superfície de admin (dependência)

O CX/cadastros precisa poder: criar contrato por IES, definir quantos simulados, criar slots, vincular slot a simulado, marcar modalidade e datas. Sem isso o cronograma nasce vazio e a home fica sem âncora no piloto. Escopo próprio, mas **bloqueia a Fase 1**.

### 6.4 Derivação de status do cronograma

| Status | Regra |
|---|---|
`realizado` | Existe `simulados_finalizados` para o simulado, ou `data_encerramento < now()` |
`em processamento` | Realizado mas sem linha em `resultados_ies_tri` (gabarito não fechado) |
`agendado` | Tem data futura e `data_agendada_original` é nula ou igual à data atual |
`reagendado` | Tem data futura e `data_agendada_original` difere da data atual |
`previsto` | Slot sem `simulado_id`, ou simulado sem nenhuma data → exibe **"A definir"** |

Datas por modalidade (24/07): **online** tem data de início (quando aparece pro aluno) + data de liberação do resultado; **presencial** tem só data de realização. A tag "Reagendado" **some automaticamente** quando a data é alterada para uma nova data definitiva — o campo `data_agendada_original` é atualizado junto.

## 7. Riscos

### 7.1 Guards de feature não estão nos arquivos SQL — risco alto

A migration `20260709171344` criou `public.user_has_feature(text)` e rodou um bloco `DO $patch$` que **injetou dinamicamente**, via `pg_get_functiondef`, o guard `IF NOT (...) THEN RAISE EXCEPTION 'feature_not_enabled' USING ERRCODE='42501'` em **19 funções**.

**Consequência: nenhum arquivo `.sql` do repositório contém o corpo que está rodando em produção.** Recriar qualquer uma dessas 19 funções a partir da migration versionada **remove o guard de feature silenciosamente** — e a IES com a feature desligada volta a receber dado.

Mitigação, obrigatória em qualquer PR que toque essas funções:
1. Extrair o corpo real com `pg_get_functiondef` do prod **antes** de alterar.
2. Nunca copiar de `supabase/migrations/*.sql` como base.
3. Depois de aplicar, verificar que a string `feature_not_enabled` continua no corpo.

As RPCs novas `get_gestor_*` nascem com o guard **escrito no corpo**, o que elimina o problema para elas.

### 7.2 Cronograma é dado que não existe — risco alto de escopo

A home inteira depende de dado que precisa ser modelado, migrado e **populado por gente**. O risco não é técnico, é operacional: se o CX não preencher contrato e datas, a home fica vazia no piloto. Mitigação: a Fase 0 entrega o modelo **e** a tela de admin, e o piloto só começa com as IES-piloto com contrato preenchido.

### 7.3 Divergências de régua de desempenho — risco médio

Cinco réguas incompatíveis no projeto (§4.4). Se o portal novo usar uma e a tela antiga outra, o mesmo aluno aparece "Bom" numa e "Crítico" na outra durante a coexistência. Mitigação: módulo único de regras + as réguas oficiais do Felipe antes de implementar o Diagnóstico.

### 7.4 Stack do handoff é de outro projeto — risco baixo, custo real

O handoff assume styled-components + Dendê Design System + ícones Fontello + Visx/Nivo + MSW + pnpm. O repo é Tailwind + shadcn/ui + recharts 2.12 + npm + vitest, **sem MSW e sem Playwright**.

Pela regra do próprio handoff (divergência em *como* → vence o repositório):

| Handoff | No projeto |
|---|---|
styled-components | Tailwind + shadcn/ui |
Dendê Design System | `src/components/ui/*` (49 componentes) + tokens de `src/index.css` |
Ícones Fontello Dendê | `lucide-react` (já em uso) |
Visx / Nivo | recharts 2.12 (já em uso, com exemplos temados) |
Tokens `var(--*)` do handoff | Reconciliar com as custom properties existentes de `src/index.css` — **não sobrescrever**, mapear |
MSW | Fixtures do handoff + mocks de módulo do vitest |
Playwright e2e | Não existe no projeto; testes de integração em vitest + testing-library |
`pnpm lint/typecheck/test/build` | `npm run lint` · `npm run type-check` · `npm run test:run` · `npm run build` |
Virtualização `@tanstack/react-virtual` | Dependência nova; só se a tabela passar de 100 linhas de fato |

**Consequência prática: os 9 arquivos de `prompts/` do handoff não servem** — foram escritos para a outra stack. O plano de implementação substitui eles.

### 7.5 Coexistência de duas árvores de gestor — risco médio

Durante o piloto, `/gestor/*` serve 3 telas novas para IES com a flag e 5 antigas para as demais. Risco de deriva: bug corrigido numa árvore e não na outra. Mitigação: janela de coexistência curta e explícita (2 semanas de piloto + GA por lotes), e a decisão de não investir em nada nas telas antigas nesse período.

### 7.6 Auditoria de hierarquia nos simulados antigos — risco médio

Questão com `grande_area`, `especialidade` ou `tema` nulo produz nó órfão na cascata e distorce % de acerto por área. Item de ação aberto desde 22/07, nunca executado. Mitigação: query de auditoria na Fase 0 e decisão explícita (corrigir dado ou tratar "Sem classificação" como nó legítimo).

### 7.7 Dado sensível de aluno — risco de conformidade

A tela expõe dado educacional identificável. Requisitos herdados do handoff, todos aplicáveis:
- ID de aluno é UUID opaco na URL — nunca CPF, matrícula ou e-mail.
- Payload de aluno **não vai para `localStorage`** — cache só em memória (React Query).
- Sem PII em telemetria, log, breadcrumb ou nome de evento.
- Texto vindo da API (enunciado, nome) renderizado como texto — **nunca** `dangerouslySetInnerHTML`.
- Export sempre de um recorte, nunca a base inteira, com auditoria (`quem · quando · escopo · formato`) e cabeçalho de confidencialidade.
- "Copiar resumo" copia texto agregado — nunca lista nominal completa.
- Trilha de auditoria para acesso a dado nominal (drawer do aluno).

## 8. Arquitetura de front

### 8.1 Estrutura

```
src/features/gestor/
├── routes/         Inicio.tsx · VisaoGeral.tsx · Detalhamento.tsx
├── shell/          GestorShell.tsx (sidebar 240px) · SidebarIes.tsx · SidebarNav.tsx
├── components/     KpiCard · FiltroSemestre · SeletorSimulados · CascataDiagnostico
│                   DrawerTemas · DrawerAluno · TabelaAlunos · TabelaAlunosSimulado
│                   TabelaQuestoes · AcertoPorAreaESemestre · ComparativoSimulados
│                   CronogramaSimulados · AvisosSanar · TooltipRastreabilidade · Glossario
├── charts/         EvolucaoChart · AreasChart · DispersaoChart · DistribuicaoAlternativas
├── hooks/          useFiltrosGestor · useGestorContexto · useVisaoGeral · useDetalhamento
│                   useDiagnostico · useAlunos · useQuestoes · useCronograma
├── api/            queries.ts · types.ts (espelha contracts/types.ts do handoff)
├── lib/            formatters.ts · regras.ts
└── __tests__/
```

Diretório novo `src/features/gestor/`, separado de `src/experiences/gestor/` (as 5 telas antigas), para a coexistência não gerar conflito de merge.

### 8.2 Estado

| Escopo | O que guarda |
|---|---|
| **URL** (query string) | `semestre`, `simulados[]`, ordenação, filtro de área, aluno aberto |
| **React Query** | Todo dado remoto, `queryKey: ['gestor', recurso, filtros]`, `staleTime` 5min, `keepPreviousData: true` |
| **Local (`useState`)** | Nó expandido da cascata, drawer aberto, hover/seleção de gráfico, **modo do gráfico protagonista** |
| **Contexto** | Apenas tema e usuário/permissões (já existentes) |

Nada de Redux. Estado compartilhável vai na URL — link colável, voltar/avançar funcionam, refresh preserva o recorte.

O **modo do gráfico protagonista** (Geral/Área/Aluno) é estado local e **não dispara refetch**: as três séries vêm na mesma query de `get_gestor_visao_geral`.

### 8.3 Shell

Sidebar fixa de 240px, **sem header no topo do conteúdo**. De cima para baixo: lockup SanarFlix Academy (altura mínima 48px) → seletor de IES (dropdown só para `admin` e `gestor_grupo`; rótulo estático para `gestor`) → navegação (Início, Visão Geral, Detalhamento) → rodapé com notificações e perfil.

Assets já estão no repo (untracked, precisam ser commitados): `public/sanarflix-academy-lockup.svg`, `-lockup-white.svg`, `-symbol.svg`, `-symbol-white.svg`, `-appicon-192/512.png`, `-favicon-64.png`. Regras: nunca `filter: invert()`, nunca redesenhar o lockup, nunca sombra colorida na marca.

### 8.4 Estados obrigatórios por bloco

Todo componente implementa `loading` (skeleton que **reserva a altura final**), `empty`, `error` (com "Tentar novamente" que refaz só a query daquele bloco), `partial`, `low_sample` e `no_permission` quando aplicável. **Error boundary por bloco, não por página** — um gráfico quebrado não derruba a tela.

### 8.5 Performance

- Code-split por rota; `charts/` em chunk separado.
- Virtualização só onde a tabela realmente passa de 100 linhas.
- Orçamento: LCP < 2,5s, INP < 200ms, CLS < 0,1 na Visão Geral com dado real; JS inicial da rota < 250 KB gzip; latência de RPC < 800ms.
- Troca de filtro re-renderiza apenas os blocos afetados.

## 9. Rollout

**Chave nova no `feature_catalog`: `gestao.portal_v2`**, sob o master `gestao.enabled` existente.

- Piloto com 1–2 IES por 2 semanas → ajuste → GA por lotes.
- Rollback = desligar a chave via `admin_set_ies_features` (já existe, já audita).
- Nenhuma migração destrutiva de dado. As 5 telas antigas continuam vivas e servidas pelas RPCs legadas.
- `GestorIndexRedirect` decide a árvore: com `gestao.portal_v2` ligada, `/gestor` é o Início novo; sem ela, mantém o comportamento atual.
- O teste-guarda de rotas (`src/test/unit/route-gates.test.tsx`) precisa cobrir as 3 rotas novas — rota sem gate quebra a suíte por construção.

Ao fim do GA: remover as 5 páginas antigas, `src/components/analytics/v2/modules/`, as chaves `gestao.visao_institucional`/`diagnostico_curricular`/`alunos`/`insights_pedagogicos`/`inteligencia_decisoria` e as RPCs institucionais que ficarem sem consumidor.

## 10. Telemetria

Sem PII em nome de evento ou propriedade.

| Evento | Propriedades | Por quê |
|---|---|---|
`gestor_tela_vista` | tela, semestre | Adoção por tela |
`gestor_filtro_alterado` | tipo, valor | O filtro está sendo usado? |
`gestor_modo_grafico_alterado` | modo | Os 3 modos se justificam? |
`gestor_tempo_ate_primeiro_insight` | ms | Tempo até abrir cascata/drawer/detalhe |
`gestor_drawer_aberto` | tipo | Profundidade de investigação |
`gestor_export_solicitado` | escopo | Valor percebido |
`gestor_erro_bloco` | bloco, código | Saúde real por bloco |

## 11. Definição de pronto

- Regras da §4 cobertas por teste unitário (`ehProficiente`, `calcularVariacao`, `agregarPorSimulado`, redutor de filtro, formatadores).
- Todos os estados da matriz implementados e revisados no claro **e** no escuro.
- Sem `any`, sem `@ts-ignore`, sem `console.log`, sem código morto, sem `TODO` órfão.
- `npm run lint` · `npm run type-check` · `npm run test:run` · `npm run build` verdes.
- Teclado completo (drawer com trap e ESC), foco visível, contraste AA, gráfico com alternativa textual/tabular (`role="img"` + `<title>`/`<desc>`).
- Checklist de segurança da §7.7.
- Nenhum hex ou px solto — tudo via token.
- Screenshot claro/escuro no PR, comparado ao protótipo.

## 12. Casos de teste críticos

1. Proficiente é `>= 60` — **60 é proficiente**, 59,9 não é (§4.3).
2. Nenhuma tela exibe uma coluna "Nota TRI" separada de "Proficiência" (§4.1); a Visão Geral não mostra proficiência por simulado individual.
3. Conceito ENAMED nunca é média: com 2 simulados, dois valores.
4. Selecionar 0 simulados no Detalhamento → estado vazio, **nenhuma requisição de métrica**.
5. Selecionar 6 simulados → aviso não-bloqueante; tela continua utilizável.
6. Com 2+ simulados, "Detalhamento das Questões" **não é renderizado**.
7. Aluno sem participação → `—` + "Não participou", fora de toda média.
8. `variacao` só existe quando o aluno participou de **todos** os simulados comparados.
9. Filtro "Por semestre" → controles multi-semestre somem; gráfico de comparação vira distribuição.
10. Filtro "6º ano" → 11º e 12º em evidência, demais esmaecidos.
11. Clique cruzado área ↔ semestre recalcula o outro eixo; segundo clique limpa.
12. Filtro de semestre persiste entre Visão Geral ↔ Detalhamento e sobrevive ao refresh (via URL).
13. `gestor` não recebe dropdown de IES; `admin` recebe.
14. Nenhuma tela aplica TRI, ENAMED ou proficiência a tema/especialidade — lá é % de acerto.
15. Troca de modo do gráfico protagonista **não dispara requisição**.
16. IES sem `gestao.portal_v2` continua vendo as 5 telas antigas.
17. RPC `get_gestor_*` chamada por gestor de outra IES → erro de permissão, sem revelar existência.

## 13. Pendências

| # | Pendência | Bloqueia | Responsável |
|---|---|---|---|
| 1 | ~~Réguas de desempenho~~ — **RESOLVIDA em 25/07**: régua canônica, mapeada em crítico `<30` / mediano `30–80` / excelente `>=80` (§4.4). Resta validar a distribuição com dado real na Fase 0 | Nada | — |
| 2 | Superfície de admin para contrato e datas de simulado (§6.3) | Fase 1 (Início) | a definir |
| 3 | Auditoria de hierarquia nos simulados já cadastrados (§4.9, §7.6) | Piloto | João |
| 4 | Spike de viabilidade do ponto projetado (§4.11) | Nada — degrada para tendência sem projeção | João |
| 5 | Validar "desempenho" vs "proficiência" com o Leonardo (§4.6) | Nada — mudança de string | Felipe |
| 6 | Levantar com o Diego Dias o estado das views de engajamento | Nada — visão futura | João |
| 7 | Commitar os assets `public/sanarflix-academy-*` (hoje untracked) | Fase 0 | — |
| 8 | `score_proprio` vs `score_enamed`: são a mesma métrica de produto? (§4.1) | Drawer do aluno | João |

---

## Anexo A — Divergências handoff × decisões, resolvidas

| Tema | Handoff | Decisão em vigor | Origem |
|---|---|---|---|
Gráfico protagonista | toggle "Grande área \| Aluno", sem "Geral" | **3 modos: Geral \| Grande área \| Aluno** | 24/07 |
Nomenclatura na visão por área | "% de acerto" | **"desempenho"** (a validar com o Léo) | 24/07 |
Níveis de desempenho | proficiente > 60 como base | **régua canônica do projeto**: crítico `<30` / mediano `30–80` / excelente `>=80` | 24/07 + Felipe 25/07 |
Linha de tendência | regressão no cliente | **backend, armazenada** + ponto projetado ponderado | 24/07 |
Semestre na dispersão | seleção única | **seleção única** (multi descartado) | Felipe, 25/07 |
Corte de proficiente | `> 60`, "60 não é proficiente" | **`>= 60`** — handoff está errado | banco + front
"Nota TRI" como métrica própria | coluna e glossário separados de proficiência | **eliminada** — é a mesma coisa; rótulo único "Proficiência" | 24/07 |
Hierarquia | 3 níveis, sem subtema | **confirmado no banco**: `grande_area`/`especialidade`/`tema` | SQL |
Papéis | `admin_b2b`/`gestor_grupo`/`gestor_ies` | `admin`/`gestor_grupo`/`gestor` do enum `app_role` | repo |
Stack | styled-components + Dendê + Visx + MSW + pnpm | Tailwind + shadcn + recharts + vitest + npm | §7.4 |
Endpoints | 11 REST com envelope | **10 RPCs `get_gestor_*`** com o mesmo envelope | §5.2 |
Botão "Contratar mais simulados" | ausente | ideia de 22/07, **fora desta entrega** | — |
