## Visão Geral
- Página definida em `src/pages/Dashboard.tsx` e acessada via rota protegida `App.tsx:193–207` dentro de `PageWrapper` com `DashboardSkeleton`.
- Usa `StudyContext` para fontes de dados (`progress`, `studyContents`) e renderiza KPIs, gráficos (Recharts) e configurações de lembretes.

## Rotas e Acesso
- Rota: `path="/dashboard"` sob `ProtectedRoute` com `PageWrapper` que aplica loading message e skeleton: `src/App.tsx:193–205`.
- Skeleton específico: `src/components/skeletons/DashboardSkeleton.tsx` com placeholders para header, métricas, gráficos e tabela: `1–73`.

## Dados e Estado
- Fonte: `useStudy()` obtém `progress` e `studyContents`: `src/pages/Dashboard.tsx:20–22`.
- Cálculos no Dashboard:
  - `disciplineData` baseado em `progress.progressByDiscipline`: `src/pages/Dashboard.tsx:24–30`.
  - `pieData` a partir de `disciplineData`: `32–36`.
  - `totalCompleted` e `totalProgress`: `38–40`.
  - `typeData` por `studyContents.type` e completos: `42–51`.
  - `radialData` para gráfico radial: `53–57`.
- Contexto `StudyContext`:
  - Carrega conteúdos via edge function `get-study-contents`: `src/contexts/StudyContext.tsx:29–47`.
  - Carrega progresso do usuário de `user_progress` com fallback para `localStorage`: `57–105`.
  - Atualiza `progressByDiscipline`: `115–135`.
  - Toggle otimista de conclusão e sincronização com Supabase: `207–260`.

## Estrutura de UI
- Header com ícone e título: `src/pages/Dashboard.tsx:62–74`.
- Métricas principais com `ProgressCard` e cards shadcn: `76–127`. Componente `ProgressCard`: `src/components/ProgressCard.tsx:49–76`.
- Seção de gráficos: grid 1x2 em desktop, empilhado em mobile: `129–175` e `175–215`.
- Seção de progresso radial e tipos de conteúdo: `217–287`.
- Configurações de lembretes: `ReminderSettings` ao final: `289–293`.

## Gráficos e Visualização
- Recharts utilizados: BarChart com `completed/total` por disciplina: `src/pages/Dashboard.tsx:141–169`.
- PieChart para distribuição de conteúdos concluídos: `186–210`.
- RadialBarChart para progresso geral com label central percentual: `229–239`.
- Tooltips com estilo claro; eixos com `text-gray` (melhorar compatibilidade dark).

## Reminder Settings
- Componente em `src/components/ReminderSettings.tsx`:
  - Carrega/salva config em `study_reminders` via Supabase: `55–75`, `96–107`.
  - Integra permissões de notificação Web: `37–41`, `127–147`.
  - Função serverless `send-study-reminder` para e-mail de teste: `181–199`.

## Responsividade e Tema
- Layout fluido com `grid` e `gap`; gráficos com `ResponsiveContainer`.
- Algumas classes usam `text-gray-900`/`fill-gray-900` e tooltips claros; revisar aparência em dark mode.

## Observações Técnicas
- Cálculo de `week` a partir de `semestre` ao processar conteúdos: `src/contexts/StudyContext.tsx:144–152` (ver coerência semântica).
- `type` inferido por presença de links: pode resultar em classificação imprecisa se múltiplos links existirem.
- Fallbacks robustos para ausência de dados (evita crashes).

## Pontos de Melhorias Propostos
1. Compatibilidade com dark mode nos gráficos (cores de eixos, tooltips, rótulos).
2. Filtros por disciplina/semana e intervalo de tempo; seleção impactando todos os gráficos.
3. Série temporal (linha/área) de progresso ao longo dos dias/semanas.
4. Estados vazios explícitos para cada gráfico com mensagens amigáveis.
5. Acessibilidade: alto contraste, `aria` para tooltips e percentuais.
6. Performance: memoização dos datasets e split de gráficos (lazy) para reduzir custo inicial.
7. Exportar progresso (CSV/PNG) e compartilhar (link).
8. Integração entre Dashboard e StudyGuide (deep link para matéria ao clicar nas barras/pizza).

## Plano de Implementação
### Fase 1: Dark Mode e Acessibilidade
- Ajustar palettes, tooltips e eixos para detectar tema atual e aplicar cores adequadas.
- Adicionar `aria-labels` e foco teclado nos gráficos interativos.

### Fase 2: Filtros Globais e Integração
- Adicionar controles de filtro (disciplinas, período) no header.
- Aplicar filtros aos datasets; sincronizar com `StudyContext` quando aplicável.
- Habilitar clique em barras/setores para navegar ao `StudyGuide` com `query` da disciplina.

### Fase 3: Série Temporal e Estados Vazios
- Criar dataset temporal a partir de `user_progress` (timestamp) e renderizar linha/área.
- Implementar mensagens e placeholders por gráfico quando `data.length === 0`.

### Fase 4: Performance e Export
- `useMemo`/`useCallback` para datasets; `React.lazy`/`Suspense` para gráficos.
- Botões de exportação (CSV dos conteúdos/progresso; `toDataURL` para gráficos).

### Entregáveis
- UI atualizada compatível com dark mode.
- Filtros funcionais com impacto nos gráficos.
- Novo gráfico temporal e estados vazios.
- Export/Share básico.

Confirma que devo avançar com este plano?