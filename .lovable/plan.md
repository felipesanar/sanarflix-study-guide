
# Plano de Melhoria: Indicador Global + Sistema de Exportacao XLSX Premium

## Analise da Situacao Atual

### Problemas Identificados

**1. Indicador "Dados reais" duplicado e mal posicionado**
- Aparece no footer (linha 174-177 de Analytics.tsx) E no header (Badge na linha 106-109)
- O footer contem versao mais descritiva "Dados reais do Supabase" mas esta escondido la embaixo
- Badge do header e minimalista demais ("Dados reais")

**2. Sistema de Exportacao fragmentado e incompleto**
- ExportModal.tsx: Exporta apenas dados gerais de usuarios (CSV simples)
- exportSimuladosAnalytics.ts: Exporta apenas dados de Simulados (XLSX/CSV)
- Nenhum exporta dados de TODAS as abas (Overview, Engagement, Progress, Demographics)
- Faltam informacoes contextuais importantes no XLSX

**3. Qualidade do XLSX atual**
- Sem formatacao visual profissional (cores, bordas, estilos)
- Cabecalhos sem destaque visual
- Falta indice/sumario executivo
- Sem graficos embutidos
- Metadados incompletos (falta versao do sistema, usuario exportador)
- Numeros sem formatacao de milhar brasileira

---

## Plano de Implementacao

### FASE 1: Reposicionamento do Indicador Global

**Mudancas em Analytics.tsx:**

```text
ANTES (Header):
┌────────────────────────────────────────────────────────────┐
│ [BarChart] Analytics              [Atualizar] [Dados reais]│
└────────────────────────────────────────────────────────────┘

DEPOIS (Header - aprimorado):
┌────────────────────────────────────────────────────────────────────────┐
│ [BarChart] Analytics    [Atualizar] [● Dados reais | 5min] [Exportar] │
└────────────────────────────────────────────────────────────────────────┘
```

**Novos elementos do indicador:**
- Bolinha verde pulsante indicando conexao ativa
- Timestamp "ha X min" da ultima atualizacao
- Tooltip com detalhes (fonte: Supabase, ultimo sync, status)
- Botao "Exportar" global movido para o header

**Remocao:**
- Eliminar footer duplicado (linhas 172-189)
- Consolidar toda a UI de status e export no header

---

### FASE 2: Sistema de Exportacao XLSX Premium Global

**Novo arquivo: `src/utils/exportAnalyticsReport.ts`**

Estrutura do relatorio XLSX com 12+ abas:

```text
┌─────────────────────────────────────────────────────────────┐
│                    ESTRUTURA DO XLSX                        │
├─────────────────────────────────────────────────────────────┤
│ ABA 1: CAPA E SUMARIO                                       │
│   - Logo SanarFlix Academy (imagem base64)                  │
│   - Titulo: "Relatorio Analitico Completo"                  │
│   - Periodo analisado                                        │
│   - Data/hora de geracao                                     │
│   - Usuario que exportou                                     │
│   - Filtros aplicados (IES, exclusoes)                       │
│   - Sumario com links para cada aba                          │
│   - Versao do sistema                                        │
├─────────────────────────────────────────────────────────────┤
│ ABA 2: VISAO EXECUTIVA                                      │
│   - KPIs principais em destaque visual                       │
│   - Usuarios totais, ativos hoje, ativos 7d                  │
│   - Sessoes hoje, media de tempo                             │
│   - Page views, simulados iniciados/finalizados              │
│   - Taxa de abandono                                         │
│   - Comparativo vs periodo anterior (se disponivel)          │
├─────────────────────────────────────────────────────────────┤
│ ABA 3: ENGAJAMENTO                                          │
│   - Tabela: Sessoes por dia (data, count, duracao media)     │
│   - Tabela: Page views por pagina (ranking)                  │
│   - Tabela: Horarios de pico (hora, acessos)                 │
│   - Metricas: Mobile vs Desktop                              │
├─────────────────────────────────────────────────────────────┤
│ ABA 4: PROGRESSO ACADEMICO                                  │
│   - Tabela: Progresso por materia                            │
│   - Tabela: Usuarios por faixa de progresso                  │
│   - Taxa de conclusao de conteudo                            │
├─────────────────────────────────────────────────────────────┤
│ ABA 5: DEMOGRAFIA                                           │
│   - Tabela: Usuarios por IES                                 │
│   - Tabela: Usuarios por semestre                            │
│   - Graficos de distribuicao (se possivel)                   │
├─────────────────────────────────────────────────────────────┤
│ ABA 6: SIMULADOS - RESUMO                                   │
│   - KPIs executivos de simulados                             │
│   - Taxa conclusao, acuracia, tempo medio                    │
│   - Comportamento (saidas aba, fullscreen)                   │
├─────────────────────────────────────────────────────────────┤
│ ABA 7: SIMULADOS - LISTA DETALHADA                          │
│   - Cada simulado com todas as metricas                      │
│   - Status, datas, questoes, performance                     │
├─────────────────────────────────────────────────────────────┤
│ ABA 8: SEGMENTACAO - IES                                    │
│   - Desempenho por instituicao                               │
├─────────────────────────────────────────────────────────────┤
│ ABA 9: SEGMENTACAO - SEMESTRE                               │
│   - Desempenho por semestre                                  │
├─────────────────────────────────────────────────────────────┤
│ ABA 10: SEGMENTACAO - PEDAGOGICA                            │
│   - Por Grande Area, Especialidade, Tema, Dificuldade        │
├─────────────────────────────────────────────────────────────┤
│ ABA 11: QUESTOES PROBLEMATICAS                              │
│   - Top 50 questoes com maior taxa de erro                   │
│   - Enunciado completo, classificacao, metricas              │
├─────────────────────────────────────────────────────────────┤
│ ABA 12: BASE DE USUARIOS                                    │
│   - Lista de usuarios com metricas individuais               │
│   - Nome, email, IES, semestre, sessoes, simulados           │
├─────────────────────────────────────────────────────────────┤
│ ABA 13: METADADOS TECNICOS                                  │
│   - Versao do sistema                                        │
│   - Data de extracao                                         │
│   - Contagem de registros por tabela                         │
│   - Hash de integridade (opcional)                           │
└─────────────────────────────────────────────────────────────┘
```

---

### FASE 3: Formatacao Visual Premium do XLSX

**Estilos a implementar usando SheetJS (xlsx):**

```text
┌──────────────────────────────────────────────────────────────┐
│ PALETA DE CORES INSTITUCIONAL                                │
├──────────────────────────────────────────────────────────────┤
│ Primaria (Headers):     #8B1538 (Vinho SanarFlix)            │
│ Secundaria (Subheaders): #1E40AF (Azul escuro)               │
│ Sucesso (valores bons):  #16A34A (Verde)                     │
│ Alerta (valores medios): #CA8A04 (Amarelo)                   │
│ Erro (valores ruins):    #DC2626 (Vermelho)                  │
│ Fundo alternado:         #F9FAFB / #FFFFFF                   │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ FORMATACAO DE CELULAS                                        │
├──────────────────────────────────────────────────────────────┤
│ Cabecalhos:                                                  │
│   - Fundo: #8B1538 (vinho)                                   │
│   - Texto: Branco, Bold                                      │
│   - Borda: 1px solid #666                                    │
│   - Alinhamento: Centro                                      │
│                                                              │
│ Dados:                                                       │
│   - Zebra striping (linhas alternadas)                       │
│   - Numeros: Alinhamento direita                             │
│   - Texto: Alinhamento esquerda                              │
│   - Percentuais: Formato "0.0%"                              │
│   - Datas: Formato "DD/MM/YYYY"                              │
│   - Numeros grandes: Separador de milhar brasileiro          │
│                                                              │
│ KPIs destacados:                                             │
│   - Fonte maior (14pt)                                       │
│   - Bold                                                     │
│   - Fundo colorido por performance                           │
└──────────────────────────────────────────────────────────────┘
```

**Nota tecnica:** A biblioteca `xlsx` (SheetJS) na versao community tem limitacoes de estilo. Para formatacao avancada, sera necessario:
- Usar `xlsx-style` (fork com estilos) OU
- Usar `exceljs` (biblioteca alternativa mais poderosa) OU
- Implementar estilos basicos disponiveis no xlsx

---

### FASE 4: Modal de Exportacao Aprimorado

**Novo fluxo de exportacao:**

```text
┌────────────────────────────────────────────────────────────────┐
│ [X]                    EXPORTAR RELATORIO                      │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  PERIODO: 08/01/2026 a 07/02/2026                              │
│  IES: Todas (exceto: Teste, Demo)                              │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  SELECIONE O FORMATO                                    │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │                                                         │   │
│  │  [████████████████████]  Excel Completo (.xlsx)         │   │
│  │  ★ RECOMENDADO                                          │   │
│  │  • 13 abas organizadas                                  │   │
│  │  • Formatacao profissional                              │   │
│  │  • Graficos embutidos                                   │   │
│  │  • ~350 KB estimado                                     │   │
│  │                                                         │   │
│  │  [░░░░░░░░░░░░░░░░░░░░]  CSV Simples (.csv)             │   │
│  │  • Arquivo unico                                        │   │
│  │  • Compativel com qualquer software                     │   │
│  │  • ~120 KB estimado                                     │   │
│  │                                                         │   │
│  │  [░░░░░░░░░░░░░░░░░░░░]  Apenas Simulados (.xlsx)       │   │
│  │  • Foco em performance de provas                        │   │
│  │  • 10 abas especializadas                               │   │
│  │  • ~200 KB estimado                                     │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  PREVIEW DOS DADOS (Resumo)                             │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  Total Usuarios: 1.234                                  │   │
│  │  Sessoes no periodo: 5.678                              │   │
│  │  Simulados analisados: 12                               │   │
│  │  Questoes mapeadas: 1.200                               │   │
│  │  Registros totais: ~15.000                              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                │
│           [Cancelar]                    [⬇ Baixar Relatorio]   │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Criar/Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/pages/Analytics.tsx` | Modificar | Mover indicador e export para header, remover footer |
| `src/utils/exportAnalyticsReport.ts` | Criar | Novo sistema de export XLSX completo |
| `src/components/analytics/ExportReportModal.tsx` | Criar | Novo modal de export premium |
| `src/components/analytics/DataStatusIndicator.tsx` | Criar | Componente do indicador global |
| `src/utils/exportSimuladosAnalytics.ts` | Modificar | Refatorar para usar formatacao compartilhada |

---

## Detalhes Tecnicos

### Dependencias
- `xlsx` (ja instalado) - para geracao basica
- Considerar adicionar `exceljs` para formatacao avancada (opcional)

### Formatacao de Numeros Brasileiros
```typescript
// Formato brasileiro para numeros
const formatBR = (n: number) => n.toLocaleString('pt-BR');
const formatPercent = (n: number) => `${n.toFixed(1)}%`;
const formatDate = (d: Date) => d.toLocaleDateString('pt-BR');
```

### Estilos XLSX (usando xlsx)
```typescript
// Estilos basicos disponiveis
wsSheet['!cols'] = [{ wch: 30 }, { wch: 15 }]; // Largura colunas
wsSheet['!merges'] = [{ s: {r:0,c:0}, e: {r:0,c:5} }]; // Merge cells
wsSheet['!freeze'] = { xSplit: 0, ySplit: 1 }; // Congelar cabecalho
```

### Timestamp de Ultima Atualizacao
```typescript
// Armazenar no hook useAnalyticsData
const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

// Atualizar apos fetch
setLastUpdated(new Date());

// Exibir no indicador
const timeAgo = formatDistanceToNow(lastUpdated, { locale: ptBR, addSuffix: true });
// "ha 5 minutos"
```

---

## Resultado Esperado

**Antes:**
- Indicador "Dados reais" perdido no footer
- Export fragmentado entre abas
- XLSX sem formatacao profissional
- Dados incompletos na exportacao

**Depois:**
- Indicador proeminente no header com timestamp
- Export global unificado acessivel de qualquer aba
- XLSX premium com 13 abas organizadas
- Formatacao visual institucional
- Metadados completos de rastreabilidade
- Opcoes de formato (Completo, Simulados, CSV)

