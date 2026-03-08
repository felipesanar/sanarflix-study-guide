

# Caderno de Erros -- Adaptado para o Academy

## Contexto da Adaptação

O prompt original foi pensado para uma plataforma com plano PRO/freemium (SanarFlix PRO: ENAMED). O Academy **nao tem modelo freemium** -- todos os usuarios sao B2B vinculados a uma IES. Portanto:

- **Nao ha gate/paywall/upsell**. A feature sera disponivel para todos os usuarios autenticados.
- A "tela de correcao" no Academy e a pagina `SimuladoDesempenho.tsx` (aba Desempenho do `/simulados`), que ja tem o `QuestionModal` para revisar questoes por subespecialidade.
- O acesso sera controlado via `ies_features` (chave `error_notebook`), como todas as outras features.
- A taxonomia existente usa `grande_area`, `especialidade` e `tema` (da tabela `questoes_simulado`).

## Faseamento

### Fase 1: Estrutura de dados + Captura na revisao

**Migracao SQL** -- Criar tabela `error_notebook_entries`:
```sql
CREATE TABLE public.error_notebook_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL,
  simulado_id UUID NOT NULL,
  simulado_nome TEXT NOT NULL,
  grande_area TEXT,
  especialidade TEXT,
  tema TEXT,
  reason TEXT NOT NULL CHECK (reason IN ('did_not_know','did_not_remember','did_not_understand_statement','answered_without_confidence')),
  learning_text TEXT,
  was_correct BOOLEAN NOT NULL DEFAULT false,
  source TEXT NOT NULL DEFAULT 'simulation_correction',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.error_notebook_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own entries"
  ON public.error_notebook_entries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all entries"
  ON public.error_notebook_entries FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_error_notebook_user ON error_notebook_entries(user_id);
CREATE INDEX idx_error_notebook_tema ON error_notebook_entries(tema);
CREATE INDEX idx_error_notebook_simulado ON error_notebook_entries(simulado_id);
CREATE INDEX idx_error_notebook_reason ON error_notebook_entries(reason);
CREATE INDEX idx_error_notebook_created ON error_notebook_entries(created_at DESC);

CREATE TRIGGER update_error_notebook_updated_at
  BEFORE UPDATE ON error_notebook_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

**Componentes a criar:**

1. `src/components/caderno-erros/AddToErrorNotebookDrawer.tsx` -- Drawer/modal com radio cards para motivo + textarea para aprendizado (280 chars). Aberto pelo botao no QuestionModal.

2. `src/components/caderno-erros/AddToErrorNotebookButton.tsx` -- Botao "Adicionar ao Caderno de Erros" com estados: default, loading, saved, error. Inclui protecao contra duplo clique.

3. `src/hooks/useErrorNotebook.ts` -- Hook com funcoes: `addEntry`, `updateEntry`, `deleteEntry`, `fetchEntries` (com filtros), `checkIfAdded` (por question_id + simulado_id).

**Integracao:** Adicionar o botao `AddToErrorNotebookButton` dentro do `QuestionModal` no `SimuladoDesempenho.tsx`, abaixo do comentario do professor. O botao aparece para TODAS as questoes (erradas, certas, anuladas). Metadados captados automaticamente do contexto da questao ja carregada.

### Fase 2: Controle de acesso

- Adicionar `errorNotebook` ao tipo `AccessRules` em `src/types/index.ts`
- Atualizar `accessRules.ts` com default false, admin true, professor true
- O `useAccessRules` hook ja integra com `ies_features` -- a IES precisa ter `error_notebook: true` habilitado
- Rota `/caderno-de-erros` protegida via `DynamicRoutes.tsx` com redirect para `/simulados` se sem acesso

### Fase 3: Pagina dedicada do Caderno de Erros

**Pagina:** `src/pages/CadernoErros.tsx`

- Header com titulo e descricao
- Barra de busca (debounce 300ms, client-side em `learning_text`)
- Filtros combinaveis: Grande Area, Tema, Motivo, Simulado (chips/selects em desktop, drawer em mobile)
- Listagem agrupada: Grande Area > Tema > cards compactos
- Badge de reincidencia quando >= 2 erros no mesmo tema
- Cada card mostra: motivo (badge), aprendizado, simulado, data, link para questao original (abre QuestionModal), acoes editar/excluir
- Estados: loading skeleton, empty state, erro, sem resultados

**Componentes:**
- `src/components/caderno-erros/ErrorNotebookList.tsx`
- `src/components/caderno-erros/ErrorNotebookFilters.tsx`
- `src/components/caderno-erros/ErrorNotebookItem.tsx`
- `src/components/caderno-erros/ErrorNotebookEmptyState.tsx`

### Fase 4: Analytics, sidebar, polimento

**Sidebar:** Adicionar item "Caderno de Erros" com icone `BookMarked` no `AppSidebar.tsx`, condicional via `accessRules.errorNotebook`.

**Rota:** Adicionar `/caderno-de-erros` em `DynamicRoutes.tsx`.

**Analytics** (via `useAnalyticsTracker` existente):
- `ce_add_clicked` (simulado_id, question_id)
- `ce_error_added` (simulado_id, question_id, reason, has_learning_text)
- `ce_page_viewed`
- `ce_search_used`
- `ce_filter_applied` (filter_type)
- `ce_question_navigated` (question_id)
- `ce_entry_edited`
- `ce_entry_deleted`

**Responsividade:** Mobile-first, drawer para filtros em mobile, cards compactos com acoes por toque.

## Arquivos a criar/editar

| Arquivo | Acao |
|---------|------|
| Migracao SQL | Criar tabela `error_notebook_entries` |
| `src/types/index.ts` | Adicionar `errorNotebook` a `AccessRules` |
| `src/utils/accessRules.ts` | Adicionar regra para `errorNotebook` |
| `src/hooks/useErrorNotebook.ts` | Criar hook CRUD |
| `src/components/caderno-erros/AddToErrorNotebookButton.tsx` | Criar botao |
| `src/components/caderno-erros/AddToErrorNotebookDrawer.tsx` | Criar drawer de captura |
| `src/components/caderno-erros/ErrorNotebookList.tsx` | Criar listagem |
| `src/components/caderno-erros/ErrorNotebookFilters.tsx` | Criar filtros |
| `src/components/caderno-erros/ErrorNotebookItem.tsx` | Criar card do item |
| `src/components/caderno-erros/ErrorNotebookEmptyState.tsx` | Criar empty states |
| `src/pages/CadernoErros.tsx` | Criar pagina dedicada |
| `src/pages/SimuladoDesempenho.tsx` | Integrar botao no QuestionModal |
| `src/components/AppSidebar.tsx` | Adicionar item nav |
| `src/components/DynamicRoutes.tsx` | Adicionar rota |

## O que NAO sera feito (fora do escopo v1)

- Sem gate/paywall (nao existe modelo freemium no Academy)
- Sem IA ou deteccao semantica
- Sem modo flashcard
- Sem dashboard de evolucao
- Sem integracao fora da Plataforma de Simulados
- Sem soft delete (delete real, mais simples para v1)

