

# Caderno de Erros v2 — Features Pendentes

## Escopo

Implementar as 5 features que ficaram fora da v1:

1. **Soft delete** (substituir hard delete)
2. **Dashboard de evolução** (mini painel de tendências)
3. **Modo flashcard** (revisão ativa dos erros)
4. **Integração fora da Plataforma de Simulados** (adicionar erros manuais)
5. **Detecção semântica de reincidência via IA** (agrupamento inteligente)

---

## Mudanças

### 1. Soft Delete

**Migração SQL**: Adicionar coluna `deleted_at TIMESTAMPTZ DEFAULT NULL` à tabela `error_notebook_entries`. Atualizar a RLS policy para filtrar `deleted_at IS NULL` automaticamente. Criar index parcial em `deleted_at`.

**`useErrorNotebook.ts`**: Mudar `deleteEntry` de `DELETE` para `UPDATE ... SET deleted_at = now()`. Adicionar `fetchEntries` com `.is('deleted_at', null)` em todas as queries. Adicionar função `restoreEntry(id)` para desfazer exclusão.

**`ErrorNotebookItem.tsx`**: Após exclusão, mostrar toast com botão "Desfazer" que chama `restoreEntry`. Timeout de 5s antes de confirmar visualmente.

### 2. Dashboard de Evolução

Criar `src/components/caderno-erros/ErrorNotebookDashboard.tsx` — seção no topo da página `/caderno-de-erros` com:

- **KPI cards**: Total de erros registrados, temas com reincidência, % por motivo dominante, erros nos últimos 7 dias
- **Gráfico temporal** (AreaChart/Recharts): erros adicionados por semana nas últimas 8 semanas
- **Distribuição por motivo** (PieChart): pizza dos 4 motivos
- **Top 5 temas** com mais erros (bar horizontal)

Dados calculados client-side a partir dos entries já carregados (sem nova query).

**`CadernoErros.tsx`**: Adicionar `<ErrorNotebookDashboard entries={allEntries} />` acima dos filtros, colapsável via Collapsible.

### 3. Modo Flashcard

Criar `src/components/caderno-erros/FlashcardMode.tsx` — experiência de revisão ativa:

- Botão "Modo Revisão" no header da página do Caderno de Erros
- Abre modal/drawer full-screen com cards empilhados
- Frente do card: mostra área + tema + motivo original (sem o aprendizado)
- Verso do card: mostra aprendizado registrado + link para questão
- Navegação: swipe ou botões "Lembro" / "Não lembro"
- Ao final: resumo com % de acertos da revisão
- Filtros aplicados na página se refletem nos cards do flashcard
- Analytics: `ce_flashcard_started`, `ce_flashcard_completed` com `{ total, remembered, forgot }`

### 4. Integração Fora da Plataforma de Simulados

Permitir adicionar erros manualmente (sem questão de simulado):

**`useErrorNotebook.ts`**: Tornar `question_id` e `simulado_id` opcionais no `AddEntryParams`. Adicionar campo `source: 'manual' | 'simulation_correction'`.

**Migração SQL**: Alterar constraints para `question_id` e `simulado_id` serem nullable. Adicionar default `source = 'simulation_correction'`.

**Criar `src/components/caderno-erros/ManualEntryForm.tsx`**: Form com campos:
- Grande Área (texto livre ou select das áreas existentes)
- Tema (texto livre)
- Motivo (radio cards existentes)
- Aprendizado (textarea 280 chars)
- Sem question_id/simulado_id

**`CadernoErros.tsx`**: Adicionar botão "Adicionar erro manual" no header, que abre drawer com `ManualEntryForm`.

**`ErrorNotebookItem.tsx`**: Mostrar badge "Manual" quando `source === 'manual'`. Esconder link "Ver questão" quando não há `question_id`.

### 5. Detecção Semântica de Reincidência via IA

Criar edge function `supabase/functions/analyze-error-patterns/index.ts`:
- Recebe entries do usuário (últimos 50)
- Usa Lovable AI gateway (Gemini) para agrupar semanticamente temas similares
- Retorna clusters de temas relacionados com insight textual
- Ex: "Você tem 4 erros em temas relacionados a Cardiologia (ICC, Arritmias, HAS). Considere revisar essa área como um bloco."

**Criar `src/components/caderno-erros/AIInsightsCard.tsx`**: Card no dashboard que chama a edge function e exibe insights. Cache em sessionStorage por 30min (mesmo padrão do `AiRecommendationCard`). Botão refresh. Loading skeleton.

**`CadernoErros.tsx`**: Adicionar `<AIInsightsCard entries={allEntries} />` no dashboard.

---

## Arquivos

| Arquivo | Ação |
|---------|------|
| Migração SQL | `deleted_at` + nullable `question_id`/`simulado_id` |
| `src/hooks/useErrorNotebook.ts` | Soft delete, restore, manual entries |
| `src/components/caderno-erros/ErrorNotebookDashboard.tsx` | Criar — KPIs + gráficos |
| `src/components/caderno-erros/FlashcardMode.tsx` | Criar — revisão ativa |
| `src/components/caderno-erros/ManualEntryForm.tsx` | Criar — form manual |
| `src/components/caderno-erros/AIInsightsCard.tsx` | Criar — insights IA |
| `supabase/functions/analyze-error-patterns/index.ts` | Criar — edge function IA |
| `src/pages/CadernoErros.tsx` | Integrar dashboard, flashcard, manual entry |
| `src/components/caderno-erros/ErrorNotebookItem.tsx` | Soft delete UX, badge manual, conditional link |

