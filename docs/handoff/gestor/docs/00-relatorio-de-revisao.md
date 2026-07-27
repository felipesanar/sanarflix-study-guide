# Relatório de Revisão — Nova Visão do Gestor (SanarFlix Academy)

Reconciliação das edições feitas tela a tela: o que mudou, o que virou regra, onde foi propagado, inconsistências corrigidas e as regras consolidadas em vigor.

Arquivos: **Visão Final do Gestor.dc.html** (clara) e **Visao Final do Gestor Dark.dc.html** (escura).

---

## 1. Alterações detectadas (tela · componente · o quê)

| # | Tela | Componente | Mudança |
|---|------|-----------|---------|
| 1 | Global | Filtro de semestre | Vira controle segmentado **6º ano (Padrão) · Geral · Por semestre**; "Por semestre" revela o dropdown de semestre |
| 2 | Global | Escala TRI | TRI passa de 0–1000 para **0–100** |
| 3 | Global | Áreas/especialidades/temas | Deixam de usar "proficiência (inteiro)"; passam a **% de acerto** |
| 4 | Visão Geral | Card Diagnóstico | Classificação por **nível de desempenho** (Excelente/Mediano/Crítico), não mais consistência de proficiência |
| 5 | Visão Geral | Diagnóstico (cascata) | Passa a **2 níveis** (grande área → especialidade → drawer de temas); nível de subtema removido |
| 6 | Visão Geral | Visão de Alunos (gráfico) | "Aluno" vira **dispersão** de todos os alunos, não linhas; só linha de tendência |
| 7 | Visão Geral | Classificação no período | **Removida** da Visão Geral; busca + paginação migram para a Visão de Alunos |
| 8 | Visão Geral | Tabela de alunos | **Tag do grupo** ao lado do nome (consist. proficiente / em variação / consist. não proficiente) |
| 9 | Visão Geral | CTA do Diagnóstico | Abre ao lado (setinha), divide o grid; não é drawer |
| 10 | Detalhamento | KPIs | Viram **% de acerto médio · Conceito ENAMED (sem média) · Proficiência média**; reagem a semestre+simulados |
| 11 | Detalhamento | Acerto por área e por semestre | Sem toggle "por área/por semestre"; **segue o filtro global**; clique cruzado área↔semestre; 6º ano evidencia 11º/12º |
| 12 | Detalhamento | Detalhamento das Questões | Vai para o **fim da página**; ordenação (ordem/mais erradas/mais acertadas) + filtro de grande área; oculto com 2+ simulados |
| 13 | Detalhamento | Visão de Alunos do simulado | Ganha **drawer** por aluno + **paginação** + **ordenação** |
| 14 | Detalhamento | Comparativo (2+ simulados) | **Versão colapsada premium** (indicadores-chave); tabelão completo só sob demanda |
| 15 | Global | Marca | Lockup oficial SanarFlix Academy (branco no escuro), logo animado no hero |

---

## 2. O que virou regra/padrão (vs. mudança local)

Viraram **regra de produto** (propagadas): 1, 2, 3, 4, 5, 6, 10, 11 — mudam formato de dado, regra de negócio ou padrão de componente.

Viraram **padrão de componente/interação** (propagados a todos os estados): 1, 8, 9, 12, 13, 14.

**Local/pontual**: 15 (acabamento de marca), 7 (remoção pontual, mas com efeito de mover capacidades para a tela irmã).

---

## 3. Propagação realizada

- **Filtro de semestre segmentado (1):** aplicado na **Visão Geral** e no **Detalhamento** (mesmo componente, ids independentes; "Por semestre" abre o dropdown nas duas).
- **TRI 0–100 (2):** card do Detalhamento, comparativo, tabela de alunos e glossário "Entenda as métricas".
- **% de acerto para áreas (3):** cascata do Diagnóstico (colapsada e expandida), gráfico "por grande área" (título e meta), drawer do aluno ("comparativo entre grandes áreas · % de acerto"), Detalhamento (barras por área) e comparativo por tema.
- **Níveis de desempenho (4/5):** card-resumo da Visão Geral **e** cascata do Diagnóstico (grupos Excelente/Mediano/Crítico; 2 níveis + drawer).
- **Tag de grupo do aluno (8):** tabela de alunos da Visão Geral (todas as linhas de exemplo).
- **Detalhamento das Questões (12):** reordenado para o fim; ordenação de 3 opções + filtro de grande área; nota de "oculto com 2+".
- **Comparativo colapsado (14):** resumo premium por simulado + "Ver comparativo completo".

---

## 4. Inconsistências encontradas e corrigidas

- **Rótulo de meta no gráfico por grande área** dizia "meta de proficiência" → corrigido para **"meta de acerto"** (mantido "proficiência" nos gráficos Geral e por aluno, que são institucional/aluno).
- **"TRI médio (0–1000)"** remanescente no card e no glossário → **% de acerto médio** e TRI 0–100.
- **Notas "Como funciona" do Detalhamento** citavam "TRI (0–1000)" e "drill por semestre" (padrões antigos) → atualizadas.
- **Comparativo** com rótulo "TRI médio" → **"Percentual de acerto médio"** com %.
- **[Dark] Tooltip de rastreabilidade** com texto `color:#1E2223` (quase invisível sobre o fundo escuro) → **corrigido** para tom claro legível (AA).
- **Toggle "Por semestre"** no gráfico de acerto por área (redundante sob filtro de semestre) → removido; componente segue o filtro.

---

## 5. Cenários/estados criados

- **Variações do "Acerto por área e por semestre":** Geral, semestre específico, e as duas interações de clique (semestre → recalcula áreas; área → recalcula semestres).
- **Comparativo:** estado **colapsado** (novo) + **expandido** (tabelão) com controle de abrir.
- **Drawer do aluno no Detalhamento:** resultado no simulado, % de acerto por área, situação, posição/percentil, ação exportar/copiar.
- **Paginação e ordenação** na Visão de Alunos do simulado.

---

## 6. Paridade claro × escuro

Concluída. A versão escura foi regenerada a partir da versão clara já reconciliada, com a camada de tokens dark reaplicada — as duas ficam idênticas em estrutura, componentes, ordem e regras (incluindo alunos do simulado com drawer/paginação/ordenação, Questões como último componente, bloco de variações e comparativo colapsado).

---

## 7. Regras consolidadas (referência em vigor)

1. **Uma persona, uma jornada; executivo antes de investigativo.** Início orienta (cronograma é a âncora, sem indicadores). Visão Geral = macro. Detalhamento = investigativo.
2. **Semestre = período do aluno**, via controle **6º ano (Padrão) · Geral · Por semestre** (idêntico em VG e Detalhamento). "6º ano" evidencia os semestres 11º e 12º; "Por semestre" abre o dropdown; preservado ao trocar de tela.
3. **Proficiência (0–100) só para aluno e instituição.** Grande área, especialidade e tema usam **sempre % de acerto** — nunca proficiência inteira.
4. **TRI é 0–100** (rótulo "Nota TRI", por aluno). **Conceito ENAMED** é sempre "projetado" (1–5) e **não tem média** — com 2+ simulados vira comparativo.
5. **Sem TRI nem ENAMED na Visão Geral.** VG tem no máximo os KPIs: Conceito ENAMED (último simulado), % proficientes, % acerto, nº de simulados. Régua 1º · anterior · atual (some com 1 simulado; com 2 mostra os dois).
6. **Diagnóstico Curricular:** níveis **Excelente / Mediano / Crítico**; cascata de **2 níveis** (grande área → especialidade); os **temas** (com % de acerto) só no **drawer**; baixa amostra = "cobertura parcial".
7. **Visão de Alunos:** distribuição por evolução (proficiente / em variação / não proficiente); cada aluno traz a **tag do grupo**; ausência = "—"; busca + paginação; drill-down = "visão detalhada" (nunca "drill-down").
8. **Detalhamento — 1 simulado:** métricas (% acerto médio, ENAMED, proficiência média) + "Acerto por área e por semestre" (segue o filtro, clique cruzado) + dispersão Nota × Semestre + Visão de Alunos (drawer/paginação/ordenação) + **Detalhamento das Questões no fim** (ordenação: ordem da prova / mais erradas / mais acertadas; filtro de grande área).
9. **Detalhamento — 2+ simulados:** **nunca "todos"**; agregação honesta (uma coluna por simulado, sem média única); comparativo **colapsado por padrão**, tabelão completo sob demanda; questões comparam por **tema**; "Detalhamento das Questões" fica **oculto**.
10. **Esqueleto estável** entre Visão Geral e Detalhamento (mesmo shell, header na sidebar, sem header no topo do conteúdo).
11. **Seleção de IES** só é clicável (dropdown) para **Admin** e **gestor de grupo**; para gestor de uma IES é rótulo fixo.
12. **Marca:** lockup oficial SanarFlix Academy (variante branca em fundo escuro), logo animado no hero, wordmark "Academy" em vermelho; ícones Fontello Dendê; medium/altíssima fidelidade conforme a página.
