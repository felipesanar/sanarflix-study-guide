

# Plano: Exportação de Relatórios Institucionais (PDF e XLSX)

## O que será feito

Implementar a geração real de relatórios PDF e XLSX a partir do `ExportReportDrawer` já existente, usando os dados filtrados (`InstitutionalViewModel`) sem novas queries ao Supabase.

## Arquivos novos

### 1. `src/utils/institutionalReportPdf.ts`
Geração de PDF com **jsPDF** (já instalado no projeto).

**Estrutura do documento:**
- **Capa**: nome da IES, simulado, data, filtros ativos
- **Visão Institucional**: KPIs (proficiência média, % proficientes, conceito, distância), faixas de distribuição como tabela
- **Diagnóstico Curricular**: tabela área → especialidade → tema com percentual de acerto
- **Visão de Alunos**: top alunos críticos (abaixo do limiar) com nome, semestre, acerto, distância
- **Inteligência Decisória**: top 10 temas prioritários com score composto, gap e impacto potencial
- **Rodapé**: paginação em todas as páginas

Reutilizará helpers visuais do padrão `pdfGabarito.ts` (gradient header, rounded rect, progress bar, cores wine/brand).

### 2. `src/utils/institutionalReportXlsx.ts`
Geração de XLSX com **xlsx** (já instalado no projeto).

**Abas do arquivo:**
1. **Resumo Institucional**: metadados (IES, simulado, data, filtros) + KPIs + faixas de distribuição
2. **Diagnóstico por Área**: tabela hierárquica (área, especialidade, tema, total, acertos, percentual)
3. **Lista de Alunos**: todos os alunos com nome, semestre, acertos, total, percentual, proficiência TRI
4. **Temas Prioritários**: temas ordenados por score composto com gap, prevalência, impacto

Cada aba terá primeira linha congelada e auto-filtros.

## Arquivo modificado

### 3. `src/components/analytics/v2/shared/ExportReportDrawer.tsx`
- Substituir o `setTimeout` simulado por chamadas reais a `generateInstitutionalPDF` ou `generateInstitutionalXLSX`
- Passar `data`, `filters`, `simuladoNome`, `selectedModules` aos geradores
- Trigger download via `Blob` + `URL.createObjectURL` + click automático em `<a>`
- Manter estados de loading/sucesso/erro existentes
- Aviso visual se `data.allStudents.length > 500`

## Fluxo de dados

```text
ExportReportDrawer
  ├─ format === 'pdf'  → generateInstitutionalPDF(data, filters, modules, simuladoNome)
  │                        → jsPDF → Blob → download
  └─ format === 'xlsx' → generateInstitutionalXLSX(data, filters, modules, simuladoNome)
                           → XLSX.writeFile → download
```

## Detalhes técnicos

- **Sem novas queries**: consome apenas o `InstitutionalViewModel` filtrado já disponível
- **Módulos selecionáveis**: cada seção do PDF/aba do XLSX só é incluída se o módulo correspondente estiver checked
- **Nomes de arquivo**: `relatorio-desempenho-YYYY-MM-DD.pdf` / `.xlsx`
- **Geração assíncrona**: `async` para não travar UI, com try/catch mostrando toast em caso de erro
- **Reutilização de lógica**: `buildDecisionItems()` do `InteligenciaDecisoriModule` será extraída como util compartilhada para PDF/XLSX consumirem os mesmos dados de priorização

