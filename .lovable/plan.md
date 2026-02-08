
# Plano: Integrar Jornada do Estudante na Aba Engajamento

## Objetivo
Transformar a página separada "Jornada do Estudante" em uma sub-seção dentro da aba **Engajamento** do Analytics, criando uma navegação interna com duas visões: "Engajamento" (atual) e "Jornada do Estudante".

## Arquitetura Proposta

```text
Analytics.tsx
└── TabsContent value="engagement"
    └── RealEngagementTab (atualizado)
        ├── Sub-Tabs internas:
        │   ├── "Métricas Gerais" (conteúdo atual do RealEngagementTab)
        │   └── "Jornada do Estudante" (conteúdo do StudentJourneyDashboard)
```

## Mudanças Necessárias

### 1. Atualizar `RealEngagementTab.tsx`
- Adicionar sub-tabs internas usando o componente `Tabs` do Radix
- Tab 1: "Métricas Gerais" - manter o conteúdo atual (sessões, páginas, dispositivos, horários)
- Tab 2: "Jornada" - incorporar o conteúdo do StudentJourneyDashboard

### 2. Criar componente `StudentJourneySection.tsx`
- Extrair a lógica e UI do `StudentJourneyDashboard.tsx` para um componente reutilizável
- Remover o header próprio (título e seletor de período) já que estará dentro do Analytics
- Receber `filters` como props para usar o mesmo período/IES do Analytics pai
- Manter: KPIs, Funil, Gráfico de atividade diária, Top matérias, Buscas sem resultado

### 3. Ajustar `Analytics.tsx`
- Passar os `filters` (dateRange, iesId) para o `RealEngagementTab`
- O componente de Jornada usará esses filtros automaticamente

### 4. Limpar rotas e sidebar
- Remover a rota `/jornada-estudante` do `DynamicRoutes.tsx`
- Remover o item "Jornada do Estudante" da sidebar em `AppSidebar.tsx`
- Deletar ou deprecar o arquivo `StudentJourneyDashboard.tsx` (ou manter como redirect)

## UI Final Proposta

```text
┌─────────────────────────────────────────────────────────┐
│  Analytics                          [Atualizar] [Exportar] │
├─────────────────────────────────────────────────────────┤
│  [Filtros: Data | IES | Excluir...]                       │
├─────────────────────────────────────────────────────────┤
│  Visão Geral | [Engajamento] | Progresso | Demografia...  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│   ┌──────────────────┬─────────────────┐                │
│   │ Métricas Gerais  │     Jornada     │  ← Sub-tabs    │
│   └──────────────────┴─────────────────┘                │
│                                                          │
│   [Conteúdo da sub-tab selecionada]                     │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Detalhes Técnicos

### Props do novo componente `StudentJourneySection`
```typescript
interface StudentJourneySectionProps {
  filters: {
    dateRange: { start: Date; end: Date };
    iesId?: string;
    excludedIES?: string[];
  };
  isLoading?: boolean;
}
```

### Estrutura das sub-tabs em `RealEngagementTab`
```typescript
<Tabs defaultValue="metrics" className="w-full">
  <TabsList className="grid w-full grid-cols-2 max-w-md mb-6">
    <TabsTrigger value="metrics">Métricas Gerais</TabsTrigger>
    <TabsTrigger value="journey">Jornada</TabsTrigger>
  </TabsList>
  
  <TabsContent value="metrics">
    {/* Conteúdo atual: Sessões, Páginas, Dispositivos, Horários */}
  </TabsContent>
  
  <TabsContent value="journey">
    <StudentJourneySection filters={filters} />
  </TabsContent>
</Tabs>
```

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/components/analytics/RealEngagementTab.tsx` | Adicionar sub-tabs e integrar StudentJourneySection |
| `src/components/analytics/StudentJourneySection.tsx` | **Criar** - Componente extraído do Dashboard |
| `src/pages/Analytics.tsx` | Passar filters para RealEngagementTab |
| `src/components/DynamicRoutes.tsx` | Remover rota `/jornada-estudante` |
| `src/components/AppSidebar.tsx` | Remover item da sidebar |
| `src/pages/StudentJourneyDashboard.tsx` | Deletar ou manter redirect |

## Benefícios

1. **Navegação mais limpa** - Menos itens na sidebar
2. **Contexto unificado** - Jornada usa os mesmos filtros do Analytics
3. **Relacionamento lógico** - Engajamento e Jornada são complementares
4. **Menos código duplicado** - Um único sistema de filtros
5. **UX consistente** - Usuário não precisa alternar entre páginas

## Considerações

- O seletor de período interno do StudentJourneyDashboard será substituído pelo filtro global do Analytics
- Os dados serão refetchados quando os filtros mudarem (já implementado via React Query)
- A URL permanece `/analytics` com a aba "engagement" selecionada
