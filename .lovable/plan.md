

# Refatoração do Drawer "Visão de Alunos" — Remoção do Score de Risco

## Contexto importante sobre "Nota TRI"
O backend **não fornece um score TRI individual por aluno** — a única métrica disponível por aluno em `StudentScore` é `percentual` (acertos/total × 100). A instrução pede para usar TRI como base do Gap e do status, mas como esse dado não existe na estrutura atual, vou usar o **`percentual` de acertos como base única** (já é o que alimenta toda a tela hoje) e renomear a métrica para refletir isso de forma honesta. Não criarei dados fictícios. Caso futuramente uma coluna TRI seja adicionada, basta trocar a fonte.

## Arquivos afetados
- `src/components/analytics/v2/shared/StudentAnalyticsDrawer.tsx` — refatoração principal do drawer
- `src/components/analytics/v2/modules/VisaoAlunosModule.tsx` — ajuste de imports, badge de status, filtros e ordenação

Nenhum outro arquivo é tocado. Backend, tipos `StudentScore`/`InstitutionalViewModel`, lista de alunos, navegação e demais abas permanecem intactos.

## Mudanças no `StudentAnalyticsDrawer.tsx`

### Remoções completas
- `RiskAssessment` interface e `computeRiskAssessment()` — apagados.
- `getRiskLabel()`, `getRiskVariant()` — apagados.
- Tile **"Score de Risco"** (linha 183) — apagado.
- Card **"Nível de Risco"** com justification longa (linhas 186–208) — substituído por badge simples de status.
- Bloco **"Fatores de Risco"** (linhas 211–226) — renomeado e reescrito como "Indicadores de Desempenho".
- Texto "Recomendação de Intervenção" — renomeado para "Recomendação de Intervenção Pedagógica" e gerado por nova função sem linguagem de risco.

### Mantido (renomeado)
- `RiskLevel` é renomeado para `ProficiencyStatus` com valores: `'proficiente' | 'proximo' | 'abaixo'` (3 níveis em vez de 4, alinhado à nova regra).
- `computeRiskLevel(percentual)` vira `computeProficiencyStatus(percentual)`:
  - `≥ 60` → `'proficiente'` (verde)
  - `50–59` → `'proximo'` (amarelo)
  - `< 50` → `'abaixo'` (vermelho)
- `getRiskColor` vira `getStatusColor` com a paleta acima.

### Novo: `getStatusBadge(status)` retorna `{ label, className }`
- `proficiente` → "Proficiente" / verde
- `proximo` → "Próximo da proficiência" / amarelo
- `abaixo` → "Abaixo da proficiência" / vermelho

### Novo: `buildPedagogicalIndicators(student, areas)` 
Retorna lista plana de indicadores neutros:
- **Gap p/ proficiência**: valor em pontos (ou "Atingido" se ≥60)
- **Percentual de acertos**: `X.X%` (1 decimal)
- **Áreas com menor desempenho**: top 2 áreas com menor `scoresByArea`, formato `"Área (XX%)"`

Cada item tem um `tone: 'neutral' | 'attention' | 'good'` controlando um pequeno ponto colorido (suave, sem vermelho agressivo).

### Novo: `buildRecommendation(student)` 
Texto baseado no status (sem palavra "risco"):
- `abaixo`: "Plano de reforço pedagógico individualizado, com foco nas áreas de menor desempenho e revisão dos temas críticos."
- `proximo`: "Acompanhamento próximo com revisão dirigida nas áreas de menor desempenho. Pequenas melhorias podem garantir a proficiência."
- `proficiente`: "Manter acompanhamento regular. Aluno pode atuar como referência para tutoria entre pares."

### Novo layout dos KPIs superiores (4 tiles fixos)
Grid `grid-cols-2 lg:grid-cols-4 gap-3`:
1. **Nota** — `student.percentual.toFixed(1)` (label: "Nota (% de acertos)") — destaque principal, `text-2xl font-bold`
2. **Gap p/ proficiência**:
   - Se `percentual ≥ 60`: "Proficiente" / verde
   - Se `< 60`: `"X.X pts para proficiência"` / vermelho suave
3. **Percentual Médio de Acertos** — `X.X%` (1 decimal)
4. **Semestre** — `"4º semestre"` (texto completo)

### Logs (substitui o atual)
```ts
console.log('[StudentDetailsPanel] Nota:', student.percentual);
console.log('[StudentDetailsPanel] Gap:', gap);
console.log('[StudentDetailsPanel] Status:', status);
```

### Ordem final do drawer
1. Header com nome + **badge de status** (Proficiente/Próximo/Abaixo) ao lado
2. Grid 4 KPIs (TRI/Nota, Gap, Acertos, Semestre)
3. Card "Recomendação de Intervenção Pedagógica"
4. Bloco "Indicadores de Desempenho" (lista plana)
5. Separator
6. Evolução entre Simulados (mantido)
7. Desempenho por Área (mantido — usa `getStatusColor`)
8. Temas Críticos (mantido — independe de risco)
9. Temas de Oportunidade (mantido)

## Mudanças no `VisaoAlunosModule.tsx`

### Imports atualizados
Remove `computeRiskAssessment`, `getRiskLabel`, `getRiskVariant`. Importa novos: `computeProficiencyStatus`, `getStatusColor`, `getStatusBadge`, `type ProficiencyStatus`.

### `getRiskConfig` → `getStatusConfig`
Usa as novas funções; retorna `{ label, className, color }` (sem `variant`).

### `SegmentFilter` reduzido
De 5 valores para 4: `'todos' | 'proficiente' | 'proximo' | 'abaixo'`.
- `SEGMENT_OPTIONS` atualizado: "Todos" / "Proficientes" / "Próximos da proficiência" / "Abaixo da proficiência".
- Cores e ícones revisados (nada de "Risco" como label).

### Ordenação
Remove `'risco'` de `SortKey`. `SortButton` "Risco" é removido. Ficam: Acerto, Nome, Semestre, Gap.

### Lista de alunos (cards)
Badge de status passa a usar `cfg.className` em vez de `variant`. Microcopy "X.Xpp p/ virar" mantido apenas para status `proximo`.

### Counts
Recalculados a partir de `computeProficiencyStatus` (3 categorias). O 4º summary card "Críticos" é mantido — agora mostra "Abaixo da proficiência".

## Responsividade
- KPIs: `grid-cols-2 lg:grid-cols-4` — empilhamento 2x2 em mobile/tablet, 4 colunas em desktop ≥1024px.
- Drawer mantém `w-full sm:max-w-lg`.
- Sem overflow horizontal.

## Critérios de aceite
- [ ] Nenhuma menção a "Score de Risco", "Nível de Risco", "Fatores de Risco" ou número 0–100 de risco no drawer.
- [ ] `computeRiskAssessment`, `getRiskLabel`, `getRiskVariant`, `RiskAssessment` removidos do código.
- [ ] 4 KPIs no topo: Nota, Gap p/ proficiência, % Acertos, Semestre.
- [ ] Badge de status no header com 3 estados: Proficiente (verde) / Próximo (amarelo) / Abaixo (vermelho), baseado apenas em `percentual`.
- [ ] Bloco "Indicadores de Desempenho" substitui "Fatores de Risco".
- [ ] "Recomendação de Intervenção Pedagógica" — sem palavra "risco".
- [ ] `VisaoAlunosModule` compila: chips de filtro, ordenação e badges atualizados (sem opção "Risco").
- [ ] Console mostra `[StudentDetailsPanel] Nota/Gap/Status` ao abrir o drawer.
- [ ] Layout responsivo 375px sem quebra; sem `NaN`/`undefined` na UI.
- [ ] Sem referências mortas a `RiskLevel`/`risk*` em nenhum dos dois arquivos.

