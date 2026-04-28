## Objetivo

Liberar a tela **Desempenho Institucional (v2)** para alunos da IES `TESTE_IES Performance Acadêmica` (`00000000-0000-5000-a000-00003ef75c87`) e garantir que, quando não houver dados reais (RPCs vazias ou erro), a tela mostre os mocks já existentes em vez de erro.

## Contexto descoberto

- `desempenhoInstitucional` é uma feature do tipo `AccessRules` (já existe em `src/types/index.ts` e `src/utils/accessRules.ts`).
- A liberação para alunos B2B é controlada pela tabela `ies_features` via `useIesFeatures` + `useAccessRules`.
- A rota `/desempenho-institucional-v2` em `DynamicRoutes.tsx` já consome `accessRules.desempenhoInstitucional`.
- **Bug atual:** o componente admin `IesFeaturesTab.tsx` não inclui `desempenhoInstitucional` em `AVAILABLE_FEATURES`, então não há toggle na UI para ativá-la.
- **TESTE_IES não tem registro algum** de `desempenhoInstitucional` em `ies_features` hoje (apenas `home`, `studyGuide`, `dashboard`).
- O hook `useInstitutionalPerformanceData` já tem `getMockViewModel()`, mas só cai em mock quando **não há sessão**. Quando há sessão e as RPCs falham/retornam vazio, ele exibe erro.
- A página V2 já lida com `usingMock`, então basta acionar esse fallback de forma controlada.

## Mudanças

### 1. Migração SQL — habilitar a feature para TESTE_IES
Inserir/atualizar 1 linha em `ies_features` (additivo, sem DELETE/TRUNCATE):

```sql
INSERT INTO ies_features (ies_id, feature_key, enabled)
VALUES ('00000000-0000-5000-a000-00003ef75c87', 'desempenhoInstitucional', true)
ON CONFLICT (ies_id, feature_key) DO UPDATE SET enabled = true, updated_at = now();
```

### 2. Admin UI — `src/components/admin/IesFeaturesTab.tsx`
Adicionar `desempenhoInstitucional` (e, por consistência, `errorNotebook`) em `AVAILABLE_FEATURES` para que admins consigam ativar/desativar pela tela de gerenciamento de features.

### 3. Sidebar / navegação — `src/components/AppSidebar.tsx` e `MobileBottomNav.tsx`
Confirmar que o item "Desempenho Institucional" aparece no menu quando `accessRules.desempenhoInstitucional === true`. Já existe lógica baseada em accessRules; apenas validar que o link aponta para `/desempenho-institucional-v2`.

### 4. Fallback de mock — `src/hooks/useInstitutionalPerformanceData.ts`
Hoje só cai em mock quando não há sessão. Vou estender o comportamento para cair em mock quando:
- `simulados` carregados retornam lista vazia para a IES (não há simulados → não há dados a mostrar), **ou**
- as RPCs `get_institutional_performance`/`get_institutional_student_scores` retornarem dados vazios/incompletos, **ou**
- ocorrer erro nas RPCs.

Comportamento:
- Setar `setUsingMock(true)` e popular `data` com `getMockViewModel()`.
- Manter `error = null` (a página exibe banner "usando dados de demonstração" via `usingMock` no `GlobalFilterBar`).
- Manter logs de console para diagnóstico.

Esse fallback é seguro porque o componente já trata a flag `usingMock` na barra de filtros.

### 5. (Opcional, leve) Indicador visual
Garantir que o aviso de "dados de demonstração" do `GlobalFilterBar` esteja claro. Sem alterações de design, apenas validar texto. Se já existir, sem mudança.

## Detalhes técnicos

- A RPC `get_institutional_simulados` provavelmente retornará vazio para TESTE_IES (sem simulados configurados). O hook detecta isso e aciona mock antes de tentar `fetchInstitutionalPerformance`.
- A página `DesempenhoInstitucionalV2` já chama `autoSelectSimulado` — quando estamos em mock, não há `simuladoId` real; seguimos exibindo o mock independente do filtro.
- Nenhuma alteração em RLS é necessária (mocks são client-side; tabela `ies_features` já tem políticas adequadas).
- Migração é purely additive (em conformidade com a regra de migrações).

## Resultado esperado

- Alunos da IES TESTE_IES passam a ver "Desempenho Institucional" no menu e conseguem abrir a tela.
- Sem dados reais, a tela renderiza com os mocks (KPIs, faixas, evolução, alunos abaixo etc.) e um aviso discreto de "dados de demonstração".
- Admins ganham toggle no painel "Gerenciamento de Features por IES" para ativar/desativar Desempenho Institucional (e Caderno de Erros) em qualquer IES.
