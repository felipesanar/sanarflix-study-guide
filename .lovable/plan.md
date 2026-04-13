

# Ajuste da Visão Geral do Tema — Diagnóstico Curricular

## Resumo

Remover métricas incorretas ("Gap p/ Proficiência" e "Progresso") do card "Visão Geral do Tema", reorganizar indicadores em linha horizontal, e adicionar gráfico de evolução da acurácia por tema ao longo dos simulados.

## Desafio de dados

A RPC `get_institutional_evolution` retorna dados apenas no nível de **área** (grande_area), não de tema. Para mostrar a evolução da acurácia por tema, é necessário criar uma **nova RPC** que busque dados de `answer_progress` × `questoes_simulado` filtrados por tema, agrupados por simulado.

## Plano de implementação

### 1. Nova RPC: `get_theme_evolution`

Migration SQL criando função `get_theme_evolution(p_tema text, p_ies_id uuid)` que:
- Busca todos os simulados da IES (mesma lógica de `get_institutional_evolution`)
- Para cada simulado, calcula acurácia no tema específico (`questoes_simulado.tema = p_tema`)
- Retorna array de `{ simulado_nome, created_at, total, acertos, percentual }`
- `SECURITY DEFINER` com controle de role (admin/professor/b2b_partner/gestor)

### 2. Novo componente: `ThemeAccuracyEvolutionChart.tsx`

Em `src/components/analytics/v2/`:
- Props: `themeName: string`, `iesId: string`
- Chama a nova RPC via `supabase.rpc('get_theme_evolution', ...)`
- Renderiza `LineChart` (Recharts) com eixo X = simulados, eixo Y = acurácia 0-100%
- Estados: loading (skeleton), empty (mensagem para 0-1 simulados), data
- Tooltip com nome do simulado + % acerto
- Console log: `[ThemeAccuracyEvolution]`

### 3. Modificar `TemaDetailPanel`

No arquivo `DiagnosticoCurricularModule.tsx`:

**Remoções:**
- Grid item "Gap p/ Proficiência" (linhas 387-391)
- Bloco "Progresso" com barra (linhas 394-400)
- Import de `Progress`

**Reorganização dos indicadores:**
- Grid de `grid-cols-2` → `grid-cols-3` com uma linha:
  1. Acurácia (%) — com cor de status
  2. Acertos (valor absoluto)
  3. Questões (total)

**Adição:**
- Importar e renderizar `ThemeAccuracyEvolutionChart` abaixo dos indicadores
- Passar `themeName` e `iesId` (iesId vindo do contexto/filters)

### 4. Passar `iesId` ao `TemaDetailPanel`

O componente `DiagnosticoCurricularModule` recebe `data` (InstitutionalViewModel) mas não o `iesId`. Será necessário:
- Adicionar `iesId?: string` às Props do módulo
- Passá-lo de `DesempenhoInstitucionalV2.tsx` (já disponível nos filters)

### 5. Service layer

Adicionar função em `src/services/institutional.ts`:
```typescript
export async function fetchThemeEvolution(tema: string, iesId: string)
```

## Arquivos modificados

1. **Nova migration SQL** — RPC `get_theme_evolution`
2. **`src/components/analytics/v2/ThemeAccuracyEvolutionChart.tsx`** — novo componente
3. **`src/components/analytics/v2/modules/DiagnosticoCurricularModule.tsx`** — remoções + reorganização + integração do gráfico
4. **`src/services/institutional.ts`** — nova função de fetch
5. **`src/pages/DesempenhoInstitucionalV2.tsx`** — passar `iesId` ao módulo
6. **`src/components/analytics/v2/shell/ModuleContentRenderer.tsx`** — propagar `iesId`

## Sem impacto em

- Card "Classificação e Impacto"
- Breadcrumb
- Outros módulos/abas
- Lógica de cálculo global

