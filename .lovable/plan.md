

# Remover Score de Prioridade + Nova Lógica de Classificação (Insights Pedagógicos)

## Objetivo
Eliminar o "Score de Prioridade" (número 0–100, barra de progresso e textos explicativos) da aba **Insights Pedagógicos** e substituí-lo por uma classificação simples e transparente baseada apenas em **percentual de acerto** e **prevalência no simulado**.

## Arquivo afetado
- `src/components/analytics/v2/modules/InsightsPedagogicosModule.tsx` (único arquivo)

Nenhuma outra aba (Inteligência Decisória, Diagnóstico Curricular, Visão Institucional, Visão de Alunos) será tocada.

## Nova lógica de classificação

Para cada **tema** (e área quando aplicável), calcular:
- `percentualAcerto = tema.percentual`
- `prevalencia = (tema.total / totalQuestoesSimulado) × 100`

Classificação por regras encadeadas:

| Categoria | Regra | Cor / Label |
|---|---|---|
| 🔴 **Crítico** | `acerto < 50%` E `prevalencia >= 10%` | `destructive` / "Crítico" |
| 🟡 **Ganho Rápido** | `acerto entre 50% e 65%` E `prevalencia >= 8%` | `amber/orange` / "Ganho Rápido" |
| 🟢 **Ponto Forte** | `acerto >= 70%` | `emerald` / "Ponto Forte" |
| ⚪ **Neutro** | qualquer outro caso | descartado da lista (não exibido) |

**Ordenação dentro de cada grupo:**
```
impacto = prevalencia × (100 - percentualAcerto)
```
Maior impacto primeiro. Esse valor é interno — **não** é exibido na UI.

**Áreas críticas** (quando `area.percentual < 50%` E prevalência da área `>= 10%`) também viram um insight "Crítico" no nível de área, exibido junto com os temas críticos.

## Mudanças na UI

### Removidos completamente
1. Constante `getPriorityFormulaExplanation()` e `GENERAL_PRIORITY_EXPLANATION`.
2. Campo `priority` e `priorityFactors` da interface `PrioritizedInsight`.
3. Nos **cards do Top 3**: linha "Prioridade: X/100", `<TooltipInfo>` adjacente e `<Progress>` bar.
4. No **drawer lateral**: todo o `<Card>` "Score de Prioridade" (header + barra + valor + grid de fatores + bloco "Como este score foi calculado"). As métricas abaixo (Percentual Médio, Questões, Alunos afetados) sobem ocupando o espaço.
5. No **header do módulo**: remover o `<TooltipInfo>` que mostrava a fórmula geral. Trocar texto para "priorizados por relevância no simulado e desempenho dos alunos".
6. Na **lista de insights** (linhas com chevron): trocar a coluna "Prioridade {N}" por apenas "{prevalencia}% prevalência".
7. **Card explicador inferior** ("Como o Score de Prioridade é calculado"): substituir conteúdo pela nova explicação simples (ver abaixo).

### Atualizados

**Filtro de chips** — manter a estrutura, ajustando contagens com base nas novas categorias:
- Todos (N) | Críticos (N) | Ganhos Rápidos (N) | Pontos Fortes (N)

**Tipo `PrioritizedInsight`** — simplificado:
```ts
type: 'critical-area' | 'critical-tema' | 'quick-win' | 'strength'
// remover: priority, priorityFactors
// manter: percentual, prevalencia, gap, questoes, alunosAfetados (usados em recomendação e métricas)
```

**Descrições nos insights** — mensagens diretas:
- Crítico: "Alta incidência no simulado e baixo desempenho dos alunos."
- Ganho Rápido: "Tema relevante e alunos próximos da proficiência — pequeno esforço, alto impacto."
- Ponto Forte: "Tema dominado pela turma — manter consistência."

**Card explicador inferior** (substitui o atual "Como o Score de Prioridade é calculado"):
```
Como classificamos os insights

Cada tema é avaliado por dois critérios objetivos:
• Percentual de acerto — desempenho médio dos alunos no tema
• Prevalência — peso do tema no total de questões do simulado

🔴 Crítico — acerto abaixo de 50% e prevalência ≥ 10%
🟡 Ganho Rápido — acerto entre 50% e 65% e prevalência ≥ 8%
🟢 Ponto Forte — acerto igual ou superior a 70%

A ordem dentro de cada grupo prioriza temas com maior impacto
(combinação de prevalência alta e desempenho mais baixo).
```

### Drawer reorganizado (ordem final)
1. Descrição
2. Breadcrumb (Área › Especialidade › Tema)
3. Grid de 3 métricas (Percentual Médio | Questões | Alunos afetados) — agora é o primeiro bloco visual após o breadcrumb
4. **Novo bloco compacto** "Por que este insight foi classificado assim" — texto curto explicando que a categoria foi atribuída por acerto X% + prevalência Y%
5. Recomendação (mantida)
6. Alunos relacionados (mantido)
7. Outros temas (mantido)

Espaçamento `space-y-5` mantido para evitar buracos visuais.

## Logs de debug
Substituir o `console.log` atual de render por logs por insight durante a classificação:
```ts
console.log('[Insights] Classificação', { 
  nome, percentualAcerto, prevalencia, categoria 
});
```

## Responsividade
- Cards Top 3: `grid-cols-1 md:grid-cols-3` mantido. Sem `<Progress>`, ficam mais compactos.
- Drawer: `w-full sm:max-w-lg` mantido. Grid de métricas continua `grid-cols-3` (legível em ≥375px).
- Lista: layout flex existente mantido; coluna direita simplificada.

## Critérios de aceite
- [ ] Nenhuma menção a "Score de Prioridade" ou número 0–100 em qualquer lugar do módulo.
- [ ] Nenhuma `<Progress>` bar relacionada à prioridade.
- [ ] Insights aparecem apenas se classificados como Crítico, Ganho Rápido ou Ponto Forte (neutros são descartados).
- [ ] Ordenação dentro de cada categoria por `prevalencia × (100 - acerto)` decrescente.
- [ ] Cores: vermelho (crítico), amarelo/laranja (ganho rápido), verde (ponto forte).
- [ ] Card explicador inferior reescrito com a nova lógica simples.
- [ ] Drawer não tem espaços vazios após remoção do bloco Score.
- [ ] Console mostra logs `[Insights] Classificação` para cada tema avaliado.
- [ ] Funciona em viewport 375px sem quebra.

