# Auditoria de UI/UX — Portal do Gestor

Revisão do portal como produto (3 rotas: Início, Visão Geral, Detalhamento por Simulados + shell fixo). Base da análise: `src/features/gestor/**` (shell, rotas, 40+ componentes, `gestor-theme.css`, testes de guarda).

---

## A. Executive Design Review

O portal está muito acima da média de dashboards B2B em **disciplina de sistema**: existe uma camada de tokens escopada (`--gp-*`, par claro/escuro obrigatório, validado por teste), régua única de tabela, motion com 5 durações canônicas, estados de bloco (loading/vazio/erro/parcial/low-sample) e testes que reprovam `bg-gray-*`, `h-screen` e literal sem par escuro. Isso é patrimônio: não deve ser refeito.

O que impede a percepção de "SaaS enterprise premium internacional" hoje não é estética — são cinco lacunas estruturais:

1. **Três sistemas tipográficos concorrentes.** O mesmo papel "título de bloco" aparece como `style={{fontSize:16,fontWeight:700}}`, `style={{fontSize:15}}` e `text-base font-semibold`/`text-sm font-semibold`. Dezenas de `fontSize` numéricos crus espalhados fora de qualquer escala. Sem escala nomeada, cada tela drifta.
2. **Ausência de camada de chrome contextual.** Sem header de conteúdo, sem breadcrumb, sem barra de filtros persistente: o recorte vigente (IES + semestre + simulados) mora em controles espalhados no corpo da página e some ao rolar. Em uso diário, o gestor perde a resposta a "que corte estou vendo?".
3. **Densidade e ferramentas de dado abaixo do necessário.** Três tabelas densas boas, mas sem seleção múltipla, sem ações em massa, sem personalização/fixação de coluna, sem colunas fixas em scroll horizontal, sem export real — `onExportar` é no-op com toast "ainda não disponível" (`AcoesRecorte.tsx`, `VisaoGeral.tsx`). Um portal de gestão sem export sai como imaturo em avaliação enterprise.
4. **Desktop-only de fato.** O shell não tem uma única classe responsiva: sidebar `w-60` fixa, sem colapso, sem drawer. Em 1194px (viewport atual do usuário) a área útil já fica apertada; abaixo de ~900px a experiência degrada sem rota de fuga além de `overflow-x-auto`.
5. **Descoberta e velocidade.** 3 itens de nav, zero busca global, zero atalho de teclado, zero saved views. Quem usa isso toda semana repete o mesmo caminho de cliques para chegar ao mesmo corte.

## B. Top 10 melhorias prioritárias

| # | Melhoria | Impacto | Esforço | Prio |
|---|---|---|---|---|
| 1 | Escala tipográfica nomeada (`--gp-text-display/h1/h2/h3/body/label/overline/num`) + varredura substituindo todo `fontSize` cru | Alto | Médio | P0 |
| 2 | `PageHeader` canônico (h1 + subtítulo + slot de ações) e container único de rota (`max-w`+padding) — hoje o skeleton do shell usa moldura que nenhuma tela replica | Alto | Baixo | P0 |
| 3 | **Barra de contexto sticky** no topo do conteúdo: chips do recorte (IES · semestre · simulados) editáveis inline + "limpar" | Alto | Médio | P0 |
| 4 | Export real com auditoria (CSV/XLSX de tabela e do recorte), substituindo o no-op | Alto | Médio | P0 |
| 5 | Escala de espaçamento (`--gp-space-1..8`) e três densidades de superfície padronizadas (card / bloco interno / trilho) | Alto | Médio | P1 |
| 6 | Upgrade da `TabelaGestor`: coluna sticky, zebra opcional, seleção múltipla + barra de ações em massa, "colunas" (mostrar/ocultar), altura de linha compacta/confortável | Alto | Alto | P1 |
| 7 | Shell responsivo: sidebar colapsável (ícones, 64px) + drawer abaixo de `lg`, com estado persistido | Alto | Médio | P1 |
| 8 | Sistema único de skeleton (remover `@/components/ui/skeleton` de `BlocoInsights`) e um `EstadoDeBloco` que centralize loading/vazio/erro/parcial | Médio | Baixo | P1 |
| 9 | Command palette (`⌘K`) — trocar IES, ir para tela, abrir aluno, aplicar semestre | Médio | Médio | P2 |
| 10 | Saved views ("Meus recortes"): salvar/rebatizar/fixar combinações de filtro | Alto | Alto | P2 |

## C. Component Audit

| Componente | Estado hoje | Problema | Recomendação | Prio |
|---|---|---|---|---|
| Botões | shadcn `Button` + press que clareia (regra Dendê no CSS) | Hierarquia não declarada: primário/secundário/ghost/destrutivo usados por intuição | Documentar 4 níveis e um único tamanho por contexto | P1 |
| Inputs / Selects | `Select` shadcn + `--gp-border-input` | Sem estados de erro/desabilitado padronizados; nenhum `Input` de texto real no portal | Definir anatomia de campo (label/hint/erro) antes de a primeira busca entrar | P2 |
| Seletor de IES | `Popover` + `cmdk` cru, recentes, skeleton, erro com retry | Bom. Usa `cmdk` sem passar pelo wrapper shadcn `Command` | Manter; padronizar a primitiva para reuso na command palette | P2 |
| Seletor de simulados | Painel custom com sugestão "2 mais recentes" | Sem estado "muitos simulados" (sem busca por decisão recente) | Reavaliar quando IES passar de ~12 simulados | P3 |
| Tabelas | `TabelaGestor` (régua única, mono tabular, foco interno, barra de seleção animada) | Sem sticky column, sem bulk, sem densidade alternável, sem export | Ver B6 | P1 |
| Paginação | `Paginacao` compartilhada com prefetch no hover | Sem "itens por página" nem salto para página | Acrescentar page-size (25/50/100) | P2 |
| Cards / KPI | `KpiCard` com count-up, delta, tooltip de rastreabilidade | Título/valor/rótulo com tamanhos crus; delta e "sem dado" competem visualmente | Reancorar na escala tipográfica; sparkline opcional no KPI | P1 |
| Tags / Badges | `Tag` com 7 anatomias fechadas + `ChipNivel` + `BadgeStatus` | Dois sistemas de "status" (`Tag` e `BadgeStatus`) para papéis próximos | Unificar em `Tag` com variante `status` | P2 |
| Tooltips | `TooltipRastreabilidade` + `Dica`, superfície escura nos dois temas | Bom. Falta variante "rich" (título + linha de fórmula + fonte) | Introduzir `TooltipRico` para métricas com fórmula | P2 |
| Drawers | `Sheet` shadcn com container próprio, 320ms, foco devolvido | `DrawerAluno` com 1.274 linhas concentra 4 responsabilidades | Quebrar em seções (contato, cascata, histórico) | P2 |
| Empty / Erro | `EstadoVazio`, `EstadoErro`, `EstadoVazioDetalhamento`, `role=status/alert` | Vazio ainda genérico em alguns blocos: diz "sem dados", não "o que fazer" | Vazio contextual com 1 ação sugerida por bloco | P1 |
| Skeletons | `GestorSkeleton` + `LinhasSkeleton` + delay de 400ms | Um consumidor fora do padrão (shadcn) | Ver B8 | P1 |
| Gráficos | 3 Recharts + 1 lista custom, animação desligada, séries em token | Eixos e grid pesados; sem legenda interativa nem alternativa tabular consistente | Aliviar grid, legenda clicável, "ver como tabela" | P2 |
| Nav / Sidebar | 3 itens, barra ativa animada, prefetch no hover, recorte propagado na URL | Sem colapso, sem busca, sem seção secundária | Ver B7 + B9 | P1 |
| Toasts | `use-toast` | Usado como muleta para função ausente (export) | Reservar para confirmação/erro; adicionar undo quando houver escrita | P1 |
| Breadcrumbs | Inexistentes | Sem rastro em drills profundos (aluno → área → tema) | Breadcrumb contextual no drawer, não na rota | P2 |

## D. Screen-by-screen

### Início (`/gestor`)
- **Funciona:** foco em orientação (nenhum número de desempenho), direcionadores como porta de entrada, cronograma e avisos em `ErrorBoundary` próprio.
- **Problemas:** sem `h1` real de tela (a saudação faz esse papel); grid `2fr/1fr` só quebra em `md`; direcionadores parecem decorativos por não indicarem o corte que aplicam.
- **Oportunidades:** transformar direcionadores em atalhos que já levam o recorte aplicado; timeline de atividade institucional (novo resultado disponível, gabarito fechado) em vez de lista de avisos.
- **Recomendação:** `PageHeader` com saudação + linha de contexto; 3 direcionadores em largura total; coluna direita como "Agenda + Atividade".
- **Prio:** P1.

### Visão Geral (`/gestor/visao-geral`)
- **Funciona:** narrativa macro→micro (KPIs → gráfico protagonista → diagnóstico → alunos), tabela nominal sob demanda (privacidade por padrão), estado por bloco, placeholder anunciado em transição.
- **Problemas:** página longa sem âncoras; filtro de semestre solto no corpo; 4 KPIs sem tendência visual; diagnóstico e "Visão de Alunos" com títulos em três tamanhos diferentes; `scrollIntoView` ao abrir a tabela é frágil.
- **Oportunidades:** barra sticky de contexto + índice lateral de seções; KPI com micro-sparkline; diagnóstico como matriz de prioridade (volume × acerto) com quadrantes.
- **Recomendação:** header fixo (título + chips + ações) → KPIs → gráfico → diagnóstico → alunos → insights, com divisor tipográfico "macro / micro" em vez de mudança de tamanho ad hoc.
- **Prio:** P0 (chrome/tipografia) + P1 (KPI/diagnóstico).

### Detalhamento por Simulados (`/gestor/detalhamento`)
- **Funciona:** seleção explícita de simulados (nunca "todos"), coluna por simulado, KPIs próprios, cascata de área→especialidade→tema, tabela de questões com disclosure e estado "processando".
- **Problemas:** a tela mais densa do produto é também a mais textual (notas explicativas, mesmo já recolhidas); dois seletores + Sheet de cronograma competindo no topo; tabelas sem coluna fixa nem export; comparação de 2+ simulados sem indicador visual de qual coluna é a referência.
- **Oportunidades:** toolbar única (simulados · semestre · cronograma · export) sticky; ajuda contextual por métrica em tooltip rico em vez de parágrafo na tela; realce da coluna "mais recente".
- **Recomendação:** promover a seleção de simulados a toolbar horizontal fixa; tabelas com coluna de aluno fixa e bulk ("exportar selecionados").
- **Prio:** P0 (toolbar/export) + P1 (tabela).

### Shell
- **Funciona:** sidebar de 4 blocos legível, `ExperienceSwitcher` no rodapé, `h-dvh`, prefetch de rota, esqueleto imediato na troca de tela.
- **Problemas:** zero responsividade; logo de 48px domina o topo; "Avisos" como ícone que navega para outra rota (parece notificação, é link); nenhuma ação global (busca, ajuda, atalhos).
- **Recomendação:** sidebar colapsável, lockup em 32px, popover real de avisos com contagem, e um rodapé de área de conteúdo com versão/atualização de dado.
- **Prio:** P1.

## E. Premium UI Opportunities

- Sticky context bar com chips de recorte editáveis (resolve "que corte é esse?" sem custo de espaço).
- Matriz de prioridade com quadrantes nomeados no diagnóstico curricular (troca lista por decisão).
- Tooltip rico com fórmula + fonte + data do dado — reforça confiança onde o produto já é honesto ("—" em vez de número inventado).
- Coluna sticky + zebra sutil + densidade alternável nas tabelas: densidade operacional sem perder acabamento.
- Bulk actions com barra flutuante e contagem ("12 alunos selecionados").
- Command palette e atalhos (`g v`, `g d`, `⌘K`) para uso recorrente.
- Saved views por gestor, com uma view padrão fixável.
- Optimistic feedback + undo em qualquer escrita futura.
- Timeline de atividade institucional (novo simulado, gabarito, resultado).
- Micro-sparkline nos KPIs e realce da série de referência nos gráficos.
- Refinamento de superfície: reduzir dependência de sombra, usar linha de 1px + degrau de cor (o tema escuro já faz isso — o claro ainda apoia em sombra).

## F. Design System Recommendations

- **Tipografia:** escala nomeada de 8 degraus + 3 pesos, exposta como tokens; proibir `fontSize` numérico em componente (guard de teste, no mesmo modelo do que já reprova `bg-gray-*`).
- **Espaçamento:** `--gp-space-*` de 4 em 4; padding de card, de bloco interno e de célula derivados dela.
- **Raio:** manter 4 degraus; travar uso (pill só em chip, `lg` só em card).
- **Sombra:** reduzir a 2 níveis (card, overlay) e privilegiar borda no tema claro.
- **Cor de status:** promover `--gp-success/warning/danger/info` a tokens do repo (hoje é o único bloco literal do tema) e padronizar o par `-on`/`-surface` em todo chip.
- **Ícones:** um único conjunto (Dendê) com 3 tamanhos (16/18/20) — proibir tamanhos avulsos.
- **Hierarquia de botão / campo / superfície:** documentar 4 / 3 / 3 níveis com exemplo por tela.
- **Motion:** manter as 5 durações; eliminar duplicação de token em Framer Motion via um objeto único de constantes derivado do tema.
- **Breakpoints:** definir 3 comportamentos de shell (drawer < lg, colapsado lg–xl, completo > xl).
- **Unificar:** `Tag` + `BadgeStatus`; `GestorSkeleton` como única fonte de skeleton; `PageHeader` e `SecaoCard` como únicos donos de título.

## G. UX/UI Roadmap

- **Quick wins (dias):** `PageHeader` + container único · sistema único de skeleton · h1 no Início · lockup 32px · vazios contextuais · page-size na paginação.
- **P1:** escala tipográfica + varredura de `fontSize` · escala de espaçamento · barra de contexto sticky · export real · sidebar colapsável/responsiva · KPI com tendência · toolbar do Detalhamento.
- **P2:** tabela avançada (sticky, bulk, colunas, densidade) · tooltip rico · unificação de tags · command palette · popover de avisos · gráficos com legenda interativa.
- **Future:** saved views · matriz de prioridade · timeline de atividade · atalhos de teclado documentados · undo em escritas.

## H. Before / After

| Tela | Estado atual | Problema | Nova abordagem | Benefício |
|---|---|---|---|---|
| Visão Geral | Filtro solto no corpo, página longa | Corte vigente invisível ao rolar | Header + chips de recorte sticky | Confiança no número, menos volta ao topo |
| Detalhamento | Dois seletores + Sheet + notas | Topo disputado, muito texto | Toolbar única sticky + tooltip rico | Menos carga cognitiva, mais dado por tela |
| Tabelas | Densas, ordenáveis, sem export | Fim da linha operacional | Sticky column + seleção + export | O gestor termina a tarefa no produto |
| Início | Direcionadores + cronograma + avisos | Não parece o começo de um fluxo | Atalhos com recorte pré-aplicado + atividade | Caminho curto para a pergunta do dia |
| Shell | Sidebar fixa 240px | Quebra fora do desktop | Colapsável + drawer | Uso em notebook e tablet |

## Nota crítica final (1–10)

Visual quality 7 · UX 6,5 · Consistency 6 · Accessibility 8 · Information hierarchy 6,5 · Component quality 7 · Data density 6 · Navigation 5,5 · Responsiveness 3 · Enterprise readiness 5 · Premium perception 6.

**O que falta para parecer enterprise premium internacional:** (1) uma escala tipográfica e de espaçamento de verdade, aplicada sem exceção — é o que separa "bem feito" de "desenhado"; (2) chrome contextual persistente (header, chips de recorte, breadcrumb no drill) para o produto nunca perder o contexto do usuário; (3) fechar o ciclo operacional — export real, seleção, ações em massa, undo: hoje o portal informa, mas não deixa o gestor **agir**; (4) responsividade de shell; (5) velocidade para o usuário recorrente (busca global, atalhos, saved views); (6) refinamento de superfície no tema claro, trocando sombra por linha e degrau de cor. Nada disso exige abandonar a identidade atual — todos os seis se apoiam em decisões que o portal já tomou bem.
