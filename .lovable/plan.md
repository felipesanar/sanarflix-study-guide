

# Captação e Visualização de Eventos de Edição de Semestre

## Objetivo
Captar consistentemente o evento de edição de semestre (primeira definição e alterações subsequentes), e exibir esses dados no Analytics de forma a provar a utilidade da feature e a qualidade crescente da base.

## Mudanças

### 1. Captar evento no `EditProfileSheet.tsx`

Adicionar tracking no `confirmSemestreChange` usando o `useAnalyticsTracker` existente. Captar:

- `event_name`: `semester_updated`
- `category`: `interaction`
- `data`:
  - `previous_semester`: valor anterior (ou `null` para primeira definição)
  - `new_semester`: novo valor
  - `is_first_definition`: boolean (true se anterior era null)
  - `source`: `profile_edit` | `onboarding_banner`

Também adicionar tracking no `SemesterPromptBanner.tsx` para captar `semester_banner_shown` e `semester_banner_clicked`.

### 2. Criar seção "Saúde do Semestre" na aba Demografia do Analytics

Adicionar uma nova seção no `RealDemographicsTab.tsx` com:

- **Card KPI "Definições de Semestre"**: total de eventos `semester_updated` no período filtrado
- **Card KPI "Primeira Definição"**: quantos foram `is_first_definition: true` (conversões do banner)
- **Card KPI "Taxa de Conversão do Banner"**: `banner_clicked / banner_shown`
- **Mini gráfico temporal**: linha de definições de semestre por dia no período
- **InsightBox automático**: interpretação do impacto (ex: "23 usuários definiram semestre pela primeira vez. A completude de semestre subiu de X% para Y%")

### 3. Buscar dados de eventos no `useAnalyticsData.ts`

Adicionar uma nova query dentro do `fetchDemographicsMetrics` que busca da tabela `analytics_events` filtrando `event_name IN ('semester_updated', 'semester_banner_shown', 'semester_banner_clicked')` no período selecionado. Retornar:

```typescript
semesterEditing: {
  totalUpdates: number;
  firstDefinitions: number;
  bannerShown: number;
  bannerClicked: number;
  conversionRate: number;
  updatesPerDay: { data: string; total: number; firstDef: number }[];
}
```

Adicionar esse campo ao `DemographicsMetrics` interface.

## Arquivos a editar

| Arquivo | Ação |
|---------|------|
| `src/components/EditProfileSheet.tsx` | Adicionar `useAnalyticsTracker` e captar `semester_updated` |
| `src/components/SemesterPromptBanner.tsx` | Captar `semester_banner_shown` e `semester_banner_clicked` |
| `src/hooks/useAnalyticsData.ts` | Adicionar query de eventos de semestre e campo `semesterEditing` |
| `src/components/analytics/RealDemographicsTab.tsx` | Adicionar seção visual "Saúde do Semestre" com KPIs, gráfico e insights |

## Nenhuma migração SQL necessária
Os eventos são inseridos na tabela `analytics_events` que já existe com RLS adequada.

