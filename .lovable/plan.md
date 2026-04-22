

# Remoção completa do campo "Dificuldade" (back + front)

## Escopo
Eliminar toda referência à dificuldade das questões — do banco, dos RPCs, dos serviços, das telas de admin, das telas do aluno, do PDF de prova revisada, do Analytics e dos exports. Nada na UX deve mais exibir, pedir, filtrar ou usar "Fácil / Médio / Difícil / Moderado".

## 1. Banco de dados (migração aditiva — mas removendo coluna é destrutivo; exige confirmação)

⚠️ **Atenção**: remover `questoes_simulado.grau_dificuldade` é uma operação **destrutiva** (viola a Core rule "DB migrations must be purely additive"). Como o usuário pediu explicitamente a remoção em back e front, farei `DROP COLUMN` — mas registro aqui como exceção explicitamente autorizada por este pedido. Dados existentes nessa coluna serão perdidos.

Migração:
1. `ALTER TABLE questoes_simulado DROP COLUMN grau_dificuldade;`
2. Recriar os RPCs que referenciam essa coluna **sem** o campo/bloco de dificuldade:
   - `get_questions_by_subspecialty` (migrations 20260128135226, 20260128134007) — remover `coalesce(q.grau_dificuldade, 'Médio')` do RETURNS TABLE e do SELECT.
   - `get_performance_analysis_for_simulado` (migrations 20260326132253, 20260306142117, 20260205223128, 20260123203748, 20251112193840, 20250914002844) — remover a CTE `difficulty`, a chave `byDifficulty` do JSON retornado e o campo `dificuldade` em `get_question_details`.
3. Consultas JS que fazem `.select('... grau_dificuldade ...')` deixam de incluir a coluna (ver Front).

## 2. Frontend — arquivos a editar

### `src/types/simulado.ts`
- Remover `dificuldade: 'Fácil' | 'Médio' | 'Difícil'` da interface `Questao`.

### `src/types/desempenhoV2.ts`
- Remover `byDifficulty: RpcAreaData[]` de `SimuladoAnalysisData`.

### `src/services/simuladosApi.ts`
- Remover `dificuldade: q.grau_dificuldade || 'Médio'` do mapeamento em `buscarQuestoesSimulado`.

### `src/hooks/useSimuladosAnalytics.ts`
- Remover campo `dificuldade` do tipo `QuestaoProblematica`.
- Remover `segmentacaoDificuldade` do tipo de retorno, estado inicial e payload retornado.
- Remover `grau_dificuldade` do `.select()` de `questoes_simulado`.
- Remover `buildDimensaoMap('grau_dificuldade')` e a variável `segmentacaoDificuldade`.
- Remover `dificuldade: q?.grau_dificuldade || null` do builder de `questoesProblematicas`.

### `src/hooks/useErrorNotebook.ts`
- Remover `grau_dificuldade` da interface `QuestionDetails` e do `.select()`.

### `src/components/admin/SimuladosTab.tsx`
- Remover campo `grau_dificuldade` da interface `Questao`.
- Remover coluna "Grau de dificuldade" do template XLSX (linhas ~210–253), do array de colunas esperadas e do parsing do upload.
- Remover o bloco `<div>Dificuldade:</div>` da lista de questões (linha ~1101) e o `<Select>` "Dificuldade" do formulário de edição (linhas ~1628–1634).
- Remover `grau_dificuldade` do payload do `update`.

### `src/pages/SimuladoCorrecao.tsx`
- Remover `grau_dificuldade` do tipo `CorrectedQuestion`, do `.select()`, do mapeamento e do badge visual (linhas ~610–622).
- Remover o cálculo de `porDificuldade` (diffMap) e removê-lo do objeto `stats` passado ao PDF.

### `src/pages/SimuladoDesempenho.tsx`
- Remover `interface DifficultyData`, `DifficultyBadge` e o campo `dificuldade` de `ReviewedQuestion`.
- Remover `byDifficulty` do state, cache, fetch e dos props de `PerformanceSummary`.
- Remover o bloco que exibe "pior dificuldade" no summary.
- Remover passagem de `difficulty` para o PDF.

### `src/utils/pdfProvaRevisada.ts`
- Remover `dificuldade` de `QuestaoRevisada` e `porDificuldade` de `ProvaRevisadaStats`.
- Remover o bloco de render "por dificuldade" em `drawAnalysisPage` (linhas ~1009–1025).

### `src/utils/exportSimuladosAnalytics.ts`
- Remover `segmentacaoDificuldade` do tipo.
- Remover a seção "Dificuldade" do CSV (linhas ~250–255).
- Remover a aba "POR DIFICULDADE" do XLSX (linhas ~573–578).

### `src/components/analytics/RealSimuladosTab.tsx`
- Remover `segmentacaoDificuldade` do destructuring, do `exportData` e do prop `byDificuldade` passado a `SegmentacaoCharts`.

### `src/components/analytics/simulados/SegmentacaoCharts.tsx`
- Remover `byDificuldade` das props.
- Remover o `<TabsTrigger value="dificuldade">` e o `<TabsContent value="dificuldade">`.
- Ajustar `grid-cols` do `TabsList` para acomodar uma aba a menos.

### `src/components/caderno-erros/ErrorNotebookItem.tsx`
- Remover o `<Badge>` que exibe `questionDetails.grau_dificuldade` (linhas ~269–273).

### `src/pages/DesempenhoInstitucional.tsx`
- Remover `dificuldade: string` da interface `QuestionDetail` (linha 26) e qualquer render associado.

## 3. Não mexer (strings em contexto descritivo, não relacionadas ao campo)
Strings como "dificuldade" em tooltips de `RealOverviewTab.tsx` ("usuários podem estar tendo dificuldade", "revise a dificuldade das questões") referem-se a interpretações textuais de KPIs de sessão/abandono, não ao campo. Vou manter essas microcopies para não alterar insights não solicitados — **salvo** se o usuário quiser remover também a palavra em contextos interpretativos.

## 4. Nomenclatura final
Nenhuma tela, badge, tab, coluna de tabela, coluna de export, campo de formulário, template XLSX ou tooltip referente a **dificuldade de questão** permanece. A cadeia toda (DB → RPC → hook → componente → PDF/export) é simplificada.

## 5. Critérios de aceite
- [ ] Coluna `questoes_simulado.grau_dificuldade` removida.
- [ ] Todos os RPCs recriados sem referência a `grau_dificuldade` / `difficulty` / `byDifficulty`.
- [ ] Nenhum `grep` por `grau_dificuldade`, `byDifficulty`, `DifficultyBadge`, `porDificuldade`, `segmentacaoDificuldade`, `DifficultyData` retorna resultado em `src/` e `supabase/migrations/` novos.
- [ ] Template XLSX do admin não contém mais a coluna "Grau de dificuldade".
- [ ] Tela de correção do aluno, PDF revisado, Analytics (aba Segmentação), exportações CSV/XLSX e caderno de erros não exibem mais dificuldade.
- [ ] Sem erros de TypeScript; `src/integrations/supabase/types.ts` será regenerado automaticamente após a migração.
- [ ] Nenhuma quebra visual (grids e tabs reequilibrados onde havia a aba/coluna removida).

