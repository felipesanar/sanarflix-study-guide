## Insights Pedagógicos por Especialidade + Tooltip explicativo

Mudar a unidade dos insights de **tema** para **especialidade** no módulo Insights Pedagógicos, mantendo a mesma lógica de classificação (Crítico / Ganho Rápido / Ponto Forte). Adicionar um tooltip discreto com a explicação da metodologia ao lado do título e remover o bloco fixo de explicação no rodapé.

Apenas o arquivo `src/components/analytics/v2/modules/InsightsPedagogicosModule.tsx` será modificado, mais um novo componente `InsightsInfoTooltip.tsx`. Nada fora do módulo de insights muda.

### Escopo das mudanças

**1. Arquivo modificado:** `src/components/analytics/v2/modules/InsightsPedagogicosModule.tsx`

- `buildInsights()`: percorrer `data.curricular.areas[].specialties[]` em vez de `…specialties[].temas[]`. Cada `CurricularSpecialtyNode` já tem `total` e `percentual` ponderados (média ponderada por questão), então não há média simples — apenas usar os campos prontos.
- `prevalencia_especialidade = (specialty.total / totalQuestions) * 100`.
- Manter a função `classify()` exatamente como está (mesmos thresholds: 50/65/70 e 10/8).
- Tipos do `PrioritizedInsight`: trocar `'critical-tema'` por `'critical-specialty'`, remover `temaName`, manter `specialtyName` como o foco do insight; áreas críticas continuam gerando `critical-area`.
- Títulos:
  - Crítico: `"<Especialidade> está abaixo da proficiência"`
  - Ganho rápido: `"<Especialidade> é ganho rápido"`
  - Ponto forte: `"<Especialidade> é ponto forte"`
- Descrições conforme spec:
  - Crítico: "Alta incidência no simulado e baixo desempenho dos alunos"
  - Ganho rápido: "Alta incidência e desempenho intermediário — oportunidade clara de ganho"
  - Ponto forte: "Especialidade bem dominada pela turma — manter consistência"
- Ordenação: `impacto = prevalencia * (100 - percentual)`, desc dentro de cada grupo (críticos → ganhos → fortes), igual ao atual.
- Logs: `console.log('[Insights]', specialty.name, percentual, prevalencia)` por especialidade processada.
- Atualizar textos auxiliares (`getCategoryReason`, `getInterpretation`, `getRecommendationText`) para usar especialidade no lugar de tema.
- Drawer de detalhe (`InsightDetailSheet`):
  - "Outros temas em <area>" passa a listar **outras especialidades da mesma área** (excluindo a atual), ordenadas por `percentual` asc, top 5.
  - Path de contexto: Área › Especialidade (sem tema).
- Header: adicionar `<InsightsInfoTooltip />` ao lado de "X insights gerados".
- Remover o `Card` de explicação fixa no rodapé (linhas ~419-444).

**2. Novo arquivo:** `src/components/analytics/v2/modules/InsightsInfoTooltip.tsx`

- Ícone `Info` (lucide), `text-muted-foreground` com hover discreto.
- Desktop: usa `Tooltip` do shadcn (`@/components/ui/tooltip`) para hover.
- Mobile: usa `Popover` do shadcn com toggle por click (detecção via `matchMedia('(hover: none)')` ou simplesmente sempre renderizar o `Popover` controlado; usaremos uma abordagem unificada com `Popover` + `onMouseEnter/Leave` no desktop e `onClick` no mobile, OR mais simples: renderizar ambos condicionalmente com base em `useIsMobile()` (hook já existente em `@/hooks/use-mobile`).
- Conteúdo: bloco com título "Como classificamos os insights", os dois critérios (acerto + prevalência), as três faixas (🔴 / 🟡 / 🟢) e a nota sobre ordenação por impacto, exatamente como na spec.
- Estilo: fundo branco/card, borda sutil, sombra leve, `rounded-lg`, fade-in suave. Largura ~320px, texto pequeno.

### Critérios de aceite
- Cards/lista mostram especialidades, não temas.
- Filtros (Todos/Críticos/Ganhos/Fortes) seguem funcionando, contadores corretos.
- Simulador de Impacto, demais abas, layout e estilo dos cards permanecem inalterados.
- Tooltip aparece no header, hover no desktop, click no mobile.
- Bloco fixo de explicação removido — sem duplicação.
- Console mostra um log por especialidade processada e nenhum erro.
