
# Transformacao do Export de Simulados: De Recorte Basico para Analise Profunda Premium

## Diagnostico Atual

### O que o Export "Apenas Simulados" faz hoje (exportSimuladosFromAnalyticsData)
Arquivo: `src/utils/exportAnalyticsReport.ts` linhas 446-508

| Aba | Conteudo | Problema |
|-----|----------|----------|
| 1. Resumo | 4 metricas basicas (total simulados, media acertos, total respostas, questoes problematicas) | Muito superficial, sem contexto |
| 2. Simulados | Lista com nome, questoes, iniciados, finalizados, taxa | Falta: acuracia, tempo, saidas de aba, IES vinculadas |
| 3. Questoes Problematicas | Enunciado + taxa erro | Falta: grande area, especialidade, tema, dificuldade, distribuicao alternativas |

### O que o hook useSimuladosAnalytics disponibiliza (mas NAO esta sendo usado)
Arquivo: `src/hooks/useSimuladosAnalytics.ts`

**Dados ricos nao aproveitados:**
- `segmentacaoIES` - Acuracia por instituicao com n_respostas
- `segmentacaoSemestre` - Acuracia por semestre com n_respostas  
- `segmentacaoArea` - Acuracia por grande area medica
- `segmentacaoEspecialidade` - Acuracia por especialidade
- `segmentacaoTema` - Acuracia por tema
- `segmentacaoDificuldade` - Acuracia por nivel de dificuldade
- `temporal.inicioPorDia` - Evolucao temporal de inicios
- `temporal.conclusaoPorDia` - Evolucao temporal de conclusoes
- `temporal.heatmapHorario` - Mapa de calor hora x dia
- `comportamento` - Metricas de integridade (saidas aba, fullscreen, p95, abandono)
- `executive` - KPIs executivos completos

**Por simulado (SimuladoOverview):**
- `acuracia_media`, `tempo_mediano_segundos`, `tempo_medio_segundos`
- `saidas_aba_media`, `saidas_fullscreen_media`
- `tentativas_media`, `questoes_anuladas`, `questoes_nao_respondidas_media`
- `ies_ids` - IES vinculadas ao simulado

**Por questao (QuestaoProblematica):**
- `grande_area`, `especialidade`, `tema`, `dificuldade`
- `distribuicao` - Array com contagem por alternativa
- `comentario`, `anulada`

---

## Solucao: Novo Export Premium de Simulados

### Arquitetura
O export de simulados deve usar os dados do `useSimuladosAnalytics` diretamente, nao o simplificado do `useAnalyticsData.simulados`.

**Mudanca de abordagem:**
- ANTES: `exportSimuladosFromAnalyticsData(data: AnalyticsExportData)` - dados superficiais
- DEPOIS: `exportSimuladosPremium(data: SimuladosAnalyticsData)` - dados completos

### Nova Estrutura do XLSX (15+ abas especializadas)

| Aba | Conteudo Detalhado |
|-----|-------------------|
| 1. Capa Executiva | Logo, periodo, filtros, resumo de 12+ KPIs |
| 2. KPIs Executivos | Tabela completa com todas as metricas executive |
| 3. Simulados Detalhados | 14 colunas: nome, status, datas, duracao, questoes, iniciados, concluintes, taxa, acuracia, tempo mediano, saidas aba/fullscreen, tentativas, anuladas |
| 4. Performance por IES | Ranking de IES por acuracia com n_respostas e alunos |
| 5. Performance por Semestre | Comparativo de semestres |
| 6. Performance por Grande Area | Gaps pedagogicos por area medica |
| 7. Performance por Especialidade | Especialidades com maior/menor acuracia |
| 8. Performance por Tema | Granularidade maxima - todos os temas |
| 9. Performance por Dificuldade | Comparativo Facil/Medio/Dificil |
| 10. Evolucao Temporal | Series inicios e conclusoes por dia |
| 11. Heatmap de Atividade | Matriz hora x dia da semana |
| 12. Questoes Problematicas | Top 50 com 9 colunas: enunciado, area, esp, tema, dif, taxa erro, n_respostas, anulada, comentario |
| 13. Comportamento e Integridade | Metricas de friccao, abandono, p95, simulados com alta friccao |
| 14. Matriz Simulado x IES | Tabela cruzada: acuracia de cada simulado por IES (nova analise!) |
| 15. Metadados Tecnicos | Contagens, versao, filtros, timestamp |

### Analises Exclusivas (nao presentes no Excel Completo)

1. **Matriz Cruzada Simulado x IES**
   - Linha: cada simulado
   - Coluna: cada IES
   - Celula: acuracia media
   - Permite comparar performance relativa entre instituicoes em cada prova

2. **Gaps Pedagogicos Rankeados**
   - Listar temas/especialidades com acuracia < 50%
   - Ordenar por n_respostas (priorizar gaps com volume)
   - Adicionar coluna "Prioridade de Intervencao" (alta/media/baixa)

3. **Analise de Distribuicao de Respostas**
   - Para cada questao problematica, mostrar % em cada alternativa
   - Identificar distratores mais escolhidos (potencial de insight pedagogico)

4. **Indicadores Comparativos**
   - Delta entre IES: diferenca entre melhor e pior performance
   - Coeficiente de variacao por tema (consistencia de aprendizado)

---

## Implementacao Tecnica

### Passo 1: Criar nova funcao de export
Arquivo: `src/utils/exportSimuladosAnalytics.ts` (ja existe, expandir)

Adicionar: `exportSimuladosPremiumXLSX(data: SimuladosAnalyticsData, filters: ExportFilters)`

### Passo 2: Atualizar ExportReportModal para chamar o hook correto
Arquivo: `src/components/analytics/ExportReportModal.tsx`

**Problema atual:** O modal recebe `data: AnalyticsExportData` que tem dados simplificados de simulados.

**Solucao:** Quando o usuario seleciona "Apenas Simulados":
- Usar os dados do `useSimuladosAnalytics` (ja disponivel na aba Simulados)
- Passar `SimuladosAnalyticsData` para a nova funcao de export

**Abordagem de integracao:**
- Adicionar prop opcional `simuladosFullData?: SimuladosAnalyticsData` ao modal
- Quando disponivel, usar para o export premium
- Quando nao disponivel (ex: acessou modal de outra aba), mostrar mensagem sugerindo ir para aba Simulados

### Passo 3: Conectar RealSimuladosTab com ExportReportModal
Arquivo: `src/components/analytics/RealSimuladosTab.tsx`

Ja existe `handleExportXLSX` que chama `exportToXLSX`. Precisamos garantir que o modal global tenha acesso a esses dados.

**Opcao elegante:** Criar um contexto `SimuladosAnalyticsContext` que compartilha os dados entre a aba e o modal. Ou passar via props de Analytics.tsx.

### Passo 4: Enriquecer CSV de simulados
Atualizar `exportToCSV` em `exportSimuladosAnalytics.ts` para incluir todas as secoes novas.

---

## Diferenciais do Export Premium vs Completo

| Aspecto | XLSX Completo | XLSX Simulados Premium |
|---------|---------------|------------------------|
| Foco | Generalista (engajamento, demografia, etc) | Exclusivamente pedagogico |
| Granularidade | 8 abas com visao geral | 15 abas com drilldown |
| Simulados | Lista basica (5 colunas) | Tabela completa (14 colunas) |
| Segmentacao | IES e semestre (2 abas) | IES, semestre, area, especialidade, tema, dificuldade (6 abas) |
| Questoes | Top 50 com 3 colunas | Top 50 com 9 colunas + distribuicao |
| Analises exclusivas | Nenhuma | Matriz cruzada, gaps rankeados, comportamento detalhado |
| Temporal | Sessoes por dia | Inicios e conclusoes por dia + heatmap |
| Comportamento | Nao inclui | Saidas aba/fullscreen, p95, abandono, friccao alta |

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/utils/exportSimuladosAnalytics.ts` | Expandir `exportToXLSX` para 15 abas + nova funcao com matriz cruzada |
| `src/components/analytics/ExportReportModal.tsx` | Adicionar prop `simuladosFullData`, chamar export correto |
| `src/pages/Analytics.tsx` | Passar dados de simulados para o modal quando na aba Simulados |
| `src/components/analytics/RealSimuladosTab.tsx` | Expor dados via callback ou context para o modal |

---

## Resultado Esperado

**Antes:**
- Export de simulados = 3 abas basicas com dados superficiais
- Mesma informacao que ja esta no Excel completo (so menos)

**Depois:**
- Export de simulados = 15 abas especializadas com analise profunda
- Dados exclusivos: matriz cruzada, gaps rankeados, distribuicao de alternativas, heatmap
- Valor real para coordenadores pedagogicos e gestores de IES
- Justifica ter uma opcao separada no modal
