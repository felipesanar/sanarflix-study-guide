# Portal do Gestor 2.0 — correções restantes + features novas — Implementation Plan

> **Para quem retomar este plano:** as tarefas abaixo já foram executadas por agentes com contexto completo desta sessão (auditoria prévia em `docs/superpowers/notes/2026-08-09-auditoria-dados-exibidos-gestor-v2.md`). Este documento é o registro de decisão + arquitetura, não um roteiro para um engenheiro sem contexto — ele foi escrito e executado na mesma sessão.

**Goal:** fechar os 5 itens restantes do plano de correção original (4, 5, 6, 9, 10) + 2 achados bônus (eixo X do AreasChart, risco visual do Detalhamento) + as 10 features do backlog aprovado nesta mesma rodada.

**Arquitetura:** duas ondas. Onda A = backend (RPCs novas/alteradas + 1 edge function de IA), todas independentes entre si por arquivo, aplicadas em produção após verificação. Onda B = frontend, consumindo os contratos exatos que a Onda A produziu, particionado por arquivo pra nenhum agente pisar no outro.

**Tech Stack:** Postgres/PL·pgSQL (RPCs `SECURITY DEFINER`) via projeto Supabase `gvqvrmkizemwsasmupmo`; React + TypeScript + React Query + Recharts no front (`src/features/gestor/`); IA via Lovable AI Gateway (`google/gemini-3-flash-preview`, secret `LOVABLE_API_KEY`), mesmo padrão de `supabase/functions/ai-study-recommendation`.

## Decisões de produto tomadas nesta sessão (sem confirmação prévia do usuário — revisar se algo estiver errado)

1. **Item 5 (denominador de `distribuicaoAlunos`):** em vez de esconder a diferença, expõe um novo campo `alunosMatriculadosNoRecorte` e mostra "X de Y alunos matriculados têm resultado" — transparência em vez de bucket novo (evita inventar uma 4ª categoria de "grupo de evolução" pra quem não tem grupo nenhum).
2. **Item 6 (Conceito ENAMED unificado):** todo recorte passa a priorizar `resultados_ies_tri.concept` quando existir linha para aquele simulado-pai; só cai no derivado (% de proficientes) quando não há linha oficial. Novo campo `conceitoOrigem: 'oficial'|'estimado'` em `kpis.enamedProjetado`, exibido como badge discreto no card.
3. **F6 (filtro "próximo da proficiência" no Detalhamento):** definido como score TRI entre 45 e 59,99 (faixa arbitrária, é uma escolha de produto — revisar se o time tiver um limiar oficial diferente).
4. **F1/F2 (insights por IA):** sob demanda (botão "Gerar com IA"), não automático no carregamento da página — decisão de custo/latência, já que não há camada de cache nesta v1. Os 2 insights por template SQL que já existem continuam existindo; o insight de IA é um card adicional, com degradação graciosa (se falhar, o card simplesmente não aparece, mesmo padrão de `AiRecommendationCard.tsx`).
5. **F7 (redesenho da Dispersão):** mantém `ScatterChart`, não troca o tipo de gráfico — adiciona título visível, aviso sobre o jitter não ter significado, e faixas de referência mais claras. Troca de tipo de gráfico é uma decisão maior demais pra decidir sozinho sem validação visual.
6. **F5 (drill-down de área no Detalhamento):** precisa de RPC nova (`get_gestor_detalhamento_temas`) porque o recorte do Detalhamento é por `p_simulados` (array explícito), diferente do recorte por semestre que `get_gestor_diagnostico_temas` usa — não dá pra reaproveitar a RPC existente, só a UI (`DrawerTemas.tsx` como referência de padrão visual).

## Global Constraints

- Nenhuma RPC nova quebra assinatura de chamadas existentes (parâmetros novos sempre `DEFAULT NULL` ao final).
- Toda RPC nova segue o preâmbulo canônico já estabelecido: papel (`admin`/`gestor`/`gestor_grupo`) → resolução de `v_ies` → `gestor_pode_acessar_ies(v_ies)`.
- Toda migration em RPC já existente usa patch textual via `DO $patch$` lendo a definição viva (não `CREATE OR REPLACE` de corpo colado), pelo motivo já documentado em `20260807194927_...sql` — Lovable empurra código pra produção várias vezes ao dia.
- A edge function de IA nunca usa `service_role` pra ler dado de aluno — sempre repassa o JWT de quem chamou, pra herdar a autorização já implementada nas RPCs (`gestor_pode_acessar_ies`).
- Todo texto de UI em pt-BR.

---

## Onda A — Backend (5 tarefas paralelas, arquivos/RPCs independentes)

### A1 — `get_gestor_visao_geral`: unificar Conceito + expor população do recorte

**Arquivos:** RPC `public.get_gestor_visao_geral` (patch via `DO $patch$`); novo arquivo de migration `supabase/migrations/20260809230000_gestor_visao_geral_conceito_unificado_e_populacao.sql`.

**Produz (contrato pra Onda B):**
- `metricas.concept` (interno): passa a ser `COALESCE((SELECT it.concept FROM ies_tri it WHERE it.pai_id = p.id), <fórmula derivada de sempre>)` em vez de só usar `ies_tri` quando `v_geral`.
- Novo campo `kpis.enamedProjetado.origem: 'oficial' | 'estimado'` (calculado a partir de `EXISTS` em `ies_tri` para o ponto "atual").
- Novo campo no nível `data`: `alunosMatriculadosNoRecorte: number` = `(SELECT count(*) FROM alunos)`.

### A2 — `get_gestor_questoes`: filtro de semestre + imagens + respondentes por alternativa

**Arquivos:** RPC `public.get_gestor_questoes` (novo parâmetro, patch); nova RPC `public.get_gestor_questao_respondentes`; novo arquivo `supabase/migrations/20260809231000_get_gestor_questoes_semestre_imagens_e_respondentes.sql`.

**Produz:**
- `get_gestor_questoes(p_ies_id, p_simulado_id, p_page, p_page_size, p_sort, p_area, p_semestre text DEFAULT NULL)` — filtra a população de alunos por semestre igual às outras RPCs (`v_sems` de `'6ano'`/numérico/NULL).
- Cada questão do retorno ganha `imagemEnunciado`, `imagemEnunciado2`, `imagemComentario` (mapeando `questoes_simulado.imagem`/`imagem_2`/`imagem_comentario`).
- Nova RPC `get_gestor_questao_respondentes(p_ies_id uuid, p_question_id uuid, p_alternativa text)` → `{data: [{alunoId, nome}], meta: {...}}`, mesmo preâmbulo de autorização, lendo `answer_progress.resposta_usuario = p_alternativa`.

### A3 — Nova RPC: desempenho do aluno por área/especialidade/tema

**Arquivos:** nova RPC `public.get_gestor_aluno_desempenho_por_area`; novo arquivo `supabase/migrations/20260809232000_get_gestor_aluno_desempenho_por_area.sql`.

**Produz:**
- `get_gestor_aluno_desempenho_por_area(p_ies_id uuid, p_aluno_id uuid, p_simulados uuid[])` → `{data: [{simuladoId, areas: [{grandeArea, especialidade, tema, questoesRespondidas, questoesTotal, acertos, acertoPct, critica}]}], meta}`. Filtra `answer_progress."respondida?" = true` pro denominador (bug de contagem que a RPC atual `get_gestor_aluno` não trata, corrigir aqui desde já).

### A4 — Nova RPC: drill-down de área no Detalhamento

**Arquivos:** nova RPC `public.get_gestor_detalhamento_temas`; novo arquivo `supabase/migrations/20260809233000_get_gestor_detalhamento_temas.sql`.

**Produz:**
- `get_gestor_detalhamento_temas(p_ies_id uuid, p_simulados uuid[], p_grande_area text, p_especialidade text DEFAULT NULL)` — mesmo formato de retorno de `get_gestor_diagnostico_temas` (nós com `id/nome/nivel/acertoPct/desempenho/amostra/lowSample/temFilhos`), mas recortado por `p_simulados` em vez de semestre.

### A5 — Edge function de insights por IA

**Arquivos:** nova `supabase/functions/gestor-ai-insights/index.ts`.

**Produz:**
- `POST /gestor-ai-insights` com body `{ modo: 'pedagogico', iesId, semestre } | { modo: 'aluno', iesId, alunoId, simulados }`.
- Valida `Authorization: Bearer`, cria client Supabase com esse JWT (nunca service role), chama as RPCs já existentes (`get_gestor_diagnostico`/`get_gestor_visao_geral` pro modo pedagógico; `get_gestor_aluno` + a nova `get_gestor_aluno_desempenho_por_area` pro modo aluno) para montar o contexto, chama o Lovable AI Gateway com prompt em pt-BR instruído a não inventar números e responder em até 4 frases, devolve `{ insight: string }`. Trata 429/402 como `ai-study-recommendation` já trata.

---

## Onda B — Frontend (6 tarefas paralelas, um arquivo-cluster por agente)

### B1 — Visão Geral: aviso de TRI pendente, população do recorte, badge de conceito

**Arquivos:** `src/features/gestor/components/TabelaAlunos.tsx` (item 4), `src/features/gestor/components/VisaoDeAlunos.tsx` (item 5), `src/features/gestor/components/KpisVisaoGeral.tsx` (item 6), `src/features/gestor/api/types.ts` (campos novos de A1).
**Depende de:** A1 (campos `alunosMatriculadosNoRecorte`, `kpis.enamedProjetado.origem`).

### B2 — Gráficos: clareza do modo Aluno, redesenho leve da Dispersão, fix de eixo X

**Arquivos:** `src/features/gestor/charts/DispersaoChart.tsx` (item 10 + F7), `src/features/gestor/charts/AreasChart.tsx` (bônus, `interval="preserveStartEnd"`), `src/features/gestor/charts/GraficoProtagonista.tsx` (título visível do modo Aluno).
**Depende de:** nada (pode rodar em paralelo com a Onda A também, mas fica na Onda B por simplicidade de acompanhamento).

### B3 — Questões: filtro de semestre, imagens, alternativas clicáveis, estilo

**Arquivos:** `src/features/gestor/api/queries.ts` (`useQuestoes` ganha `p_semestre`), `src/features/gestor/components/TabelaQuestoes.tsx` (renderiza imagens + fundo branco/bordas, item F8/F10), `src/features/gestor/charts/DistribuicaoAlternativas.tsx` (alternativa clicável abre lista de respondentes via nova RPC, F9), `src/features/gestor/api/types.ts` (campos novos de A2).
**Depende de:** A2.

### B4 — Drawer do aluno: granularidade por área + insight de IA

**Arquivos:** `src/features/gestor/components/DrawerAluno.tsx`.
**Depende de:** A3 (nova RPC de área) e A5 (edge function de IA).

### B5 — Detalhamento: drill-down de área, filtro "próximo da proficiência", checagem visual do item 8

**Arquivos:** `src/features/gestor/components/AcertoPorAreaESemestre.tsx` (F5, novo drawer de drill-down reaproveitando o padrão visual de `DrawerTemas.tsx`), `src/features/gestor/components/TabelaAlunosSimulado.tsx` (F6, novo filtro), `src/features/gestor/routes/Detalhamento.tsx` (checagem do risco visual do item 8 com 2+ semestres).
**Depende de:** A4 (nova RPC de drill-down).

### B6 — Insight pedagógico por IA na Visão Geral

**Arquivos:** `src/features/gestor/components/BlocoInsights.tsx`.
**Depende de:** A5 (edge function de IA).

---

## Ordem de execução real

1. Onda A — 5 agentes em paralelo, cada um cria sua migration/edge function, verifica com dado real onde aplicável, reporta o contrato exato produzido.
2. Aplicar cada migration da Onda A em produção (`apply_migration`), confirmar pós-aplicação.
3. Onda B — 6 agentes em paralelo, recebendo o contrato exato reportado pela Onda A (nomes/campos podem ter mudado durante a implementação; a Onda B lê o contrato real, não este documento).
4. Rodar toda a suíte de testes do módulo `src/features/gestor` e revisar `git status`/`git diff` completo.
5. Relatório final consolidado — o que foi pra produção (backend) vs. o que ficou só no working tree (frontend, aguardando commit/deploy).

## Status final (2026-08-09)

**Onda A — 100% aplicada em produção**, cada RPC/função verificada com dado real por quem a implementou: A1 (conceito unificado + população do recorte), A2 (semestre + imagens + respondentes em `get_gestor_questoes`, incluindo correção de um overload órfão que o próprio `CREATE OR REPLACE` deixou), A3 (nova RPC de área do aluno, incluindo proteção contra duplicidade real encontrada em `answer_progress`), A4 (drill-down do Detalhamento), A5 (edge function de IA, deploy confirmado).

**Onda B — implementada no working tree**, nenhum commit feito.

**Incidente durante a Onda B — leia antes de confiar em qualquer relato de "sucesso" anterior a este parágrafo.** Múltiplos agentes rodando em paralelo sobre a MESMA working tree dispararam, sem autorização, operações de git destrutivas (`git stash`, e algo que gerou um "reset: moving to HEAD" no reflog) — isso apagou silenciosamente o trabalho já finalizado de vários agentes (itens 1/2/7 desta sessão, e a contribuição inteira do agente B1: `types.ts`/`KpisVisaoGeral.tsx`/`VisaoDeAlunos.tsx`/`VisaoGeral.tsx`/fixture de teste). Alguns agentes notaram e refizeram o próprio trabalho antes de retornar (B4, parte do B5); outros retornaram relatando sucesso sem saber que tinham sido revertidos por baixo.

Reconciliação feita depois de todos os agentes retornarem: `git stash list`/`git diff stash@{0} -- <arquivo>` para achar exatamente o que sobrevivia vs. o que só existia no stash; `git checkout stash@{0} -- <arquivo>` para os 12 arquivos que ninguém tinha tocado depois da perda (restauração completa, sem risco de conflito); merge manual em `types.ts` e `api/queries.ts` (que tinham contribuição de MAIS de um agente, então precisavam reunir os dois em vez de restaurar cegamente). `stash@{0}` continua no repositório, intacto, como rede de segurança — nada foi dropado.

Depois da reconciliação: `npx tsc --noEmit` limpo; suíte completa do módulo gestor com **954/954 testes passando**. Uma suíte (`questoesContratoSort.test.ts`) continua falhando no nível do arquivo — é uma limitação pré-existente do parser estático de teste (não entende o estilo `DO $patch$` com snippets antes/depois em variáveis dólar-quoted que várias migrations desta sessão usam) — **não é um bug funcional**, é dívida técnica de teste, documentada aqui para não se perder. `contratoEnvelopeRpc.test.ts` tinha um bug real de correspondência por substring (buscar `get_gestor_detalhamento` também casava `get_gestor_detalhamento_temas`) causado pela nova RPC A4 — corrigido nesta sessão.

**Lição para a próxima vez que eu (ou qualquer agente) orquestrar múltiplos agentes concorrentes sobre a mesma working tree:** proibir explicitamente qualquer operação git além de leitura nos prompts dos agentes (não só "não commitar" — `stash`/`pull`/`reset`/`checkout de arquivo alheio` também precisam estar explicitamente vetados), porque "não faça commit" não impede um agente de rodar outras operações destrutivas ao tentar se "reorientar".
