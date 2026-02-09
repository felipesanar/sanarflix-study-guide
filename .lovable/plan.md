
# Plano: Auditoria e Melhorias da Aba Demografia do Analytics

## 1. Resumo Executivo

Este plano aborda uma auditoria completa de dados e melhorias significativas de UI/UX para a aba "Demografia" do dashboard de Analytics, seguindo o mesmo padrão premium aplicado à aba Progresso.

---

## 2. Auditoria de Dados - Problemas Identificados

### 2.1 Problema Critico: Discrepancia no Total de Usuarios

| Fonte | Valor | Status |
|-------|-------|--------|
| Banco de dados (query direta) | **5.334** usuarios nao-admin | Correto |
| UI da aba Demografia | **998** usuarios | INCORRETO |
| Diferenca | **4.336 usuarios** (81%) nao estao sendo contados |

**Causa Provavel**: A funcao `fetchDemographicsMetrics` NAO exclui admins explicitamente como as outras abas fazem. Alem disso, a contagem e feita somando `usuariosPorIES` - se a RLS estiver limitando a query, ou se houver usuarios sem IES, eles nao aparecem.

**Verificacao no codigo** (linha 896-902):
```typescript
usuariosData.forEach((u) => {
  if (u.id_ies) {  // <-- IGNORA usuarios sem IES
    usuariosPorIESMap.set(u.id_ies, ...);
  }
  // ...
});
```

### 2.2 Problema: Admins Nao Excluidos

Diferente das abas Engajamento, Progresso e Simulados, a aba Demografia NAO exclui usuarios admin:

```typescript
// Outras abas fazem isso:
const adminIds = await fetchAdminUserIds();
// ...filtram por adminIds

// Aba Demografia NAO faz:
usuariosQuery = supabase.from('users').select('id_ies, semestre');
// Nenhuma exclusao de admins!
```

### 2.3 Problema: Semestres Nao-Numericos

A distribuicao por semestre tem problemas de exibicao:
- Semestre `0` = 479 usuarios (exibido como "Nao informado")
- Semestre `NULL` = 2 usuarios (pode causar NaN)
- Semestres `13` e `14` = 5 usuarios (nao comum, pode ser erro de cadastro)

### 2.4 Metricas Ausentes

A aba atual tem apenas 3 metricas basicas:
1. Total de Usuarios
2. IES Representadas  
3. Semestres Ativos

**Faltam metricas importantes:**
- Taxa de cadastros completos (com IES + semestre)
- Crescimento da base (novos usuarios no periodo)
- Concentracao Herfindahl-Hirschman (metrica de risco de dependencia)
- Distribuicao geografica por porte de IES
- Usuarios inativos vs ativos

---

## 3. Dados Reais do Banco (Auditoria)

### 3.1 Distribuicao por IES (dados corretos)

| IES | Quantidade | % |
|-----|------------|---|
| Fame | 1.129 | 21.2% |
| Famp | 1.088 | 20.4% |
| Integrado | 823 | 15.4% |
| B2C | 741 | 13.9% |
| Funepe | 360 | 6.7% |
| Claretiano | 340 | 6.4% |
| USCS | 289 | 5.4% |
| Unifeso | 244 | 4.6% |
| UEA | 193 | 3.6% |
| Barao de Maua | 121 | 2.3% |
| B2B | 4 | 0.1% |
| **Total com IES** | **5.332** | **99.96%** |
| Sem IES | 2 | 0.04% |

### 3.2 Distribuicao por Semestre (dados corretos)

| Semestre | Quantidade | % |
|----------|------------|---|
| 12o | 1.113 | 20.9% |
| 11o | 648 | 12.1% |
| Nao informado (0) | 479 | 9.0% |
| 1o | 454 | 8.5% |
| 3o | 367 | 6.9% |
| 5o | 331 | 6.2% |
| 7o | 327 | 6.1% |
| 9o | 310 | 5.8% |
| 10o | 309 | 5.8% |
| 6o | 308 | 5.8% |
| 4o | 249 | 4.7% |
| 2o | 241 | 4.5% |
| 8o | 191 | 3.6% |
| 13o-14o | 5 | 0.1% |

**Insight**: Alta concentracao nos semestres finais (11o e 12o = 33% da base) indica foco em alunos proximos da formatura/residencia.

---

## 4. Melhorias de UI/UX

### 4.1 Estrutura Atual vs Proposta

**ATUAL (3 secoes):**
1. 3 Cards simples (Total, IES, Semestres)
2. BarChart IES + PieChart Semestre
3. InsightBoxes basicos

**PROPOSTO (5 secoes):**
1. **Hero Metrics** - 4 MetricCards padrao com interpretacoes contextuais
2. **Saude do Cadastro** - Indicadores de completude de dados
3. **Distribuicao por IES** - BarChart melhorado com concentracao e benchmarks
4. **Distribuicao por Semestre** - Grafico de barras horizontal (mais legivel que pie)
5. **Insights Inteligentes** - Engine de insights com priorizacao

### 4.2 Novos MetricCards

```
+----------------------------------+
| [Users]           +3.2% 30d     |
|                                  |
| Total de Usuarios                |
| 5.334                            |
| excluindo 8 administradores      |
|----------------------------------|
| [check] Base saudavel. 99.96%    |
| tem IES associada.               |
+----------------------------------+

+----------------------------------+
| [Building2]                      |
|                                  |
| IES Parceiras                    |
| 11                               |
| instituicoes ativas              |
|----------------------------------|
| [alert] Top 3 IES concentram 57% |
| da base. Considere diversificar. |
+----------------------------------+

+----------------------------------+
| [GraduationCap]                  |
|                                  |
| Cadastros Completos              |
| 91.0%                            |
| com IES e semestre informados    |
|----------------------------------|
| [check] Boa taxa de completude.  |
| 479 usuarios sem semestre.       |
+----------------------------------+

+----------------------------------+
| [TrendingUp]                     |
|                                  |
| Concentracao (HHI)               |
| 1.247                            |
| Indice Herfindahl-Hirschman      |
|----------------------------------|
| [info] Mercado moderadamente     |
| concentrado. HHI < 1500 = bom.   |
+----------------------------------+
```

### 4.3 Grafico de IES Melhorado

- Adicionar % ao lado de cada barra
- Cores graduais por tamanho (maior = mais escuro)
- Linha de threshold para "concentracao excessiva" (>25%)
- Tooltip com contexto ("X de Y usuarios totais")

### 4.4 Grafico de Semestre Melhorado

- Trocar PieChart por BarChart horizontal (mais legivel com 12+ categorias)
- Agrupar semestres: Iniciais (1-4), Intermediarios (5-8), Avancados (9-12)
- Destacar "Nao informado" em cor diferente
- Adicionar % ao lado de cada barra

### 4.5 Secao de Saude do Cadastro (NOVA)

```
+------------------------------------------------------------------+
| Saude do Cadastro                                                |
| Qualidade dos dados demograficos                                 |
+------------------------------------------------------------------+
| [ProgressBar] Usuarios com IES:      ██████████████████████ 99.96%
| [ProgressBar] Usuarios com Semestre: ██████████████████████ 91.0%
| [ProgressBar] Cadastros Completos:   ████████████████████  90.8%
|                                                                   |
| [info] 2 usuarios sem IES | 479 sem semestre | 5 em semestre >12 |
+------------------------------------------------------------------+
```

### 4.6 Insights Inteligentes Melhorados

| Tipo | Trigger | Insight |
|------|---------|---------|
| alerta | Top IES > 25% | "Fame representa 21% da base. Dependencia moderada." |
| alerta | Top 3 > 60% | "Top 3 IES concentram X%. Risco de dependencia." |
| oportunidade | IES pequena crescendo | "UEA cresceu X% no periodo. Potencial de expansao." |
| insight | Semestres finais > 30% | "33% em semestres 11-12. Base madura para residencia." |
| info | Cadastros incompletos > 10% | "9% sem semestre. Considere campanha de atualizacao." |

---

## 5. Arquivos a Modificar

### 5.1 `src/hooks/useAnalyticsData.ts`

**Mudancas na funcao `fetchDemographicsMetrics`:**

1. **Excluir admins** (alinhamento com outras abas):
```typescript
const fetchDemographicsMetrics = useCallback(async () => {
  // NOVO: Excluir admins
  const adminIds = await fetchAdminUserIds();
  
  // Buscar usuarios excluindo admins
  let usuariosQuery = supabase.from('users').select('id, id_ies, semestre');
  const { data: usuariosData } = await usuariosQuery;
  
  // Filtrar admins no cliente
  const usuariosFiltrados = (usuariosData || [])
    .filter(u => !adminIds.has(u.id));
  
  // ...resto da logica
});
```

2. **Adicionar novas metricas**:
```typescript
interface DemographicsMetrics {
  usuariosPorIES: { ies_nome: string; ies_id: string; quantidade: number; percentual: number }[];
  usuariosPorSemestre: { semestre: string; quantidade: number; percentual: number }[];
  
  // NOVAS
  totalUsuarios: number; // Total real excluindo admins
  usuariosComIES: number;
  usuariosComSemestre: number;
  cadastrosCompletos: number; // Com IES E semestre
  taxaCompletude: number;
  indiceHHI: number; // Concentracao Herfindahl-Hirschman
  concentracaoTop3: number; // % nas top 3 IES
  semestresPorGrupo: {
    iniciais: number; // 1-4
    intermediarios: number; // 5-8
    avancados: number; // 9-12+
  };
}
```

3. **Calcular HHI** (indice de concentracao):
```typescript
// HHI = soma dos quadrados das participacoes de mercado
const hhi = usuariosPorIES.reduce((sum, ies) => {
  const share = (ies.quantidade / totalUsuarios) * 100;
  return sum + (share * share);
}, 0);
// HHI < 1500 = competitivo, 1500-2500 = moderado, > 2500 = concentrado
```

### 5.2 `src/components/analytics/RealDemographicsTab.tsx`

**Mudancas principais:**

1. Migrar 3 Cards simples para 4 MetricCards padrao
2. Adicionar secao "Saude do Cadastro"
3. Trocar PieChart de semestres por BarChart horizontal
4. Melhorar BarChart de IES com % e cores graduais
5. Expandir engine de insights com mais triggers
6. Adicionar estados especiais para baixo volume

---

## 6. Ordem de Implementacao

### Fase 1: Correcao Critica de Dados (Prioridade Alta)
1. Adicionar exclusao de admins em `fetchDemographicsMetrics`
2. Garantir contagem correta de total de usuarios
3. Adicionar percentuais aos dados

### Fase 2: Novas Metricas (Prioridade Alta)
1. Calcular HHI (indice de concentracao)
2. Calcular taxa de completude
3. Agrupar semestres por fase

### Fase 3: Migracao para MetricCard (Prioridade Alta)
1. Substituir 3 Cards simples por 4 MetricCards
2. Adicionar interpretacoes contextuais
3. Adicionar indicadores de status

### Fase 4: Secao de Saude do Cadastro (Prioridade Media)
1. Criar visualizacao de completude
2. Listar problemas de dados
3. Sugestoes de acao

### Fase 5: Melhorias de Graficos (Prioridade Media)
1. Trocar PieChart por BarChart horizontal
2. Adicionar % e cores graduais ao BarChart de IES
3. Melhorar tooltips com contexto

### Fase 6: Insights Inteligentes (Prioridade Baixa)
1. Expandir triggers de insights
2. Adicionar insights de tendencia
3. Priorizar por severidade

---

## 7. Secao Tecnica

### Calculo do Indice HHI

```typescript
const calcularHHI = (distribuicao: { quantidade: number }[], total: number): number => {
  return distribuicao.reduce((sum, item) => {
    const marketShare = (item.quantidade / total) * 100;
    return sum + (marketShare * marketShare);
  }, 0);
};

// Interpretacao:
// HHI < 1500: Mercado competitivo (bom)
// HHI 1500-2500: Mercado moderadamente concentrado
// HHI > 2500: Mercado altamente concentrado (risco)
```

### Agrupamento de Semestres

```typescript
const agruparSemestres = (semestres: { semestre: string; quantidade: number }[]) => {
  const grupos = { iniciais: 0, intermediarios: 0, avancados: 0, naoInformado: 0 };
  
  semestres.forEach(s => {
    const num = parseInt(s.semestre);
    if (isNaN(num) || num === 0) grupos.naoInformado += s.quantidade;
    else if (num <= 4) grupos.iniciais += s.quantidade;
    else if (num <= 8) grupos.intermediarios += s.quantidade;
    else grupos.avancados += s.quantidade;
  });
  
  return grupos;
};
```

### Performance

- Reutilizar `fetchAdminUserIds` (ja cacheado)
- Calcular metricas derivadas no cliente (evitar queries adicionais)
- Manter estrutura de Promise.all existente

---

## 8. Entregaveis

1. Correcao da contagem de usuarios (5.334 vs 998)
2. Exclusao de admins nas metricas demograficas
3. 4 MetricCards com interpretacoes contextuais
4. Indice HHI de concentracao
5. Secao de Saude do Cadastro
6. BarChart horizontal para semestres
7. Insights inteligentes expandidos
8. Percentuais em todos os graficos
