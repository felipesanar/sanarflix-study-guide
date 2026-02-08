
# Plano: Export Simulados Premium Disponivel em Qualquer Aba

## Problema Atual
O botao "Simulados Premium" fica desabilitado quando o usuario nao visitou a aba Simulados, porque os dados dependem do hook `useSimuladosAnalytics` que so e chamado naquela aba.

## Solucao: Fetch On-Demand no Modal

A ideia e fazer o fetch dos dados de simulados **diretamente no modal** quando o usuario selecionar a opcao "Simulados Premium", sem depender de ter visitado nenhuma aba especifica.

### Abordagem Tecnica

1. **Extrair a logica de fetch do hook para uma funcao reutilizavel**
   - Criar `fetchSimuladosAnalyticsData(filters)` como funcao exportada standalone
   - O hook `useSimuladosAnalytics` passa a usar essa funcao internamente
   - O modal tambem pode chamar essa funcao quando precisar

2. **Modificar ExportReportModal**
   - Remover a dependencia de `simuladosPremiumData` prop
   - Quando usuario seleciona "Simulados Premium" e clica "Baixar":
     - Mostrar estado de loading ("Carregando dados de simulados...")
     - Chamar `fetchSimuladosAnalyticsData(filters)`
     - Gerar o XLSX com os dados retornados

3. **UX Melhorada**
   - O botao "Simulados Premium" fica **sempre habilitado**
   - O loading acontece durante o processo de exportacao
   - Nenhuma dependencia de navegacao previa

### Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/hooks/useSimuladosAnalytics.ts` | Extrair `fetchSimuladosAnalyticsData` como funcao exportada standalone |
| `src/components/analytics/ExportReportModal.tsx` | Remover validacao de `hasSimuladosPremiumData`, chamar fetch on-demand |
| `src/pages/Analytics.tsx` | Remover estado `simuladosPremiumData` e prop (simplificar) |
| `src/components/analytics/RealSimuladosTab.tsx` | Remover callback `onPremiumExportData` (nao mais necessario) |

### Detalhes de Implementacao

**1. Nova funcao standalone em useSimuladosAnalytics.ts:**

```typescript
// Funcao exportada para uso direto (sem estado React)
export async function fetchSimuladosAnalyticsData(
  filters: SimuladosFilters
): Promise<SimuladosPremiumExportData> {
  // Toda a logica de fetch que ja existe no hook
  // Retorna os dados prontos para export
}

// Hook continua existindo, usa a funcao internamente
export function useSimuladosAnalytics(filters: SimuladosFilters) {
  // ...
  const fetchData = useCallback(async () => {
    const result = await fetchSimuladosAnalyticsData(filters);
    setData(result);
  }, [filters]);
  // ...
}
```

**2. Modificacao do ExportReportModal:**

```typescript
const handleExport = async () => {
  setIsExporting(true);
  
  if (selectedFormat === 'xlsx-simulados') {
    // Fetch on-demand - nao precisa ter visitado a aba!
    setExportProgress(10);
    setProgressMessage('Carregando dados de simulados...');
    
    const simuladosData = await fetchSimuladosAnalyticsData({
      dateRange: filters.dateRange,
      iesId: filters.university,
      excludedIES: filters.excludedIES,
    });
    
    setExportProgress(70);
    setProgressMessage('Gerando planilha premium...');
    
    exportSimuladosPremiumXLSX(simuladosData, exportFilters);
  }
  // ...
};
```

**3. Simplificacao de Analytics.tsx:**
- Remover `useState<SimuladosPremiumExportData>`
- Remover prop `simuladosPremiumData` do modal
- Codigo mais limpo

**4. Simplificacao de RealSimuladosTab.tsx:**
- Remover `useEffect` que chama `onPremiumExportData`
- Remover prop `onPremiumExportData`
- Componente mais focado

### Resultado Final

- **ANTES**: Usuario precisa ir em Analytics > Simulados > voltar e clicar Exportar
- **DEPOIS**: Usuario vai em qualquer aba de Analytics, clica Exportar, seleciona Simulados Premium, e funciona

### Nota sobre Performance

O fetch de simulados leva 2-4 segundos (depende do volume de dados). Isso sera visivel no progress bar durante a exportacao, com mensagem clara:

- 0-10%: "Iniciando..."
- 10-60%: "Carregando dados de simulados..."
- 60-85%: "Processando metricas..."
- 85-95%: "Gerando planilha..."
- 95-100%: "Finalizando..."

O cache do hook continua funcionando: se o usuario JA visitou a aba Simulados, os dados ja estao em cache e o fetch retorna instantaneamente.
