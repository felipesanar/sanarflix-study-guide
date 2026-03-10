

## Audit Completo: Sistema de Ranking (End-to-End)

### Arquitetura Geral

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        FONTES DE DADOS                             │
│                                                                    │
│  ┌─────────────────┐    ┌───────────────────┐   ┌───────────────┐  │
│  │ answer_progress  │    │ consumo_metabase   │   │    users      │  │
│  │ (simulados)      │    │ (videos/questões)  │   │ (ies/semestre)│  │
│  └────────┬────────┘    └────────┬──────────┘   └───────┬───────┘  │
│           │                      │                      │          │
│  ┌────────▼────────┐    ┌────────▼──────────┐           │          │
│  │ get_user_rankings│    │get_cohort_consumo │           │          │
│  │ (RPC - DB)       │    │_ranking (RPC - DB)│           │          │
│  └────────┬────────┘    └────────┬──────────┘           │          │
└───────────┼──────────────────────┼──────────────────────┼──────────┘
            │                      │                      │
┌───────────▼──────────────────────▼──────────────────────▼──────────┐
│                    CAMADA DE FETCHING                               │
│                                                                    │
│  useHomeData.fetchRankings()  ←── DUPLICADO ──→  useRankings()     │
│  RankingConsumoModal.load()  ←── TRIPLICADO                        │
│                                                                    │
│  Cada um recalcula tudo independentemente com lógica idêntica      │
└────────────────────────────────┬───────────────────────────────────┘
                                 │
┌────────────────────────────────▼───────────────────────────────────┐
│                         UI LAYER                                   │
│                                                                    │
│  Home.tsx → RankingCard (card resumido, 2 seções)                  │
│               ├── Simulado: clica → /simulados?aba=desempenho     │
│               └── Consumo: clica → RankingConsumoModal            │
│                                     (refaz TODAS as queries)       │
└────────────────────────────────────────────────────────────────────┘
```

---

### Fluxo Detalhado

**1. Ranking de Simulados** (`get_user_rankings` RPC)
- Busca TODAS as respostas do `answer_progress` (sem filtro de simulado quando `p_simulado_id = NULL`)
- Agrupa por `user_id`, conta acertos
- Rankeia dentro da IES do usuário (`ies_ranking`) e dentro do semestre (`semester_ranking`)
- Retorna JSON com `rankingIES.rank` e `rankingSemester.rank`
- **O card usa apenas `rankingIES`** — o `rankingSemester` é ignorado

**2. Ranking de Consumo** (`get_cohort_consumo_ranking` RPC)
- Filtra users da mesma IES + mesmo semestre (cohort)
- Cruza com `supabase_to_metabase` → `consumo_metabase`
- Rankeia por `videos_assistidos` e `questoes_respondidas` separadamente
- **O card usa `Math.min(rank_videos, rank_questoes)`** — pega a melhor posição entre os dois

**3. Fallback Manual** (quando RPC falha)
- Faz exatamente as mesmas queries manualmente: `users` → `supabase_to_metabase` → `consumo_metabase`
- Calcula ranking client-side

---

### Bugs e Problemas Encontrados

**BUG 1 (Crítico): Código triplicado com divergência potencial**
A lógica de ranking de consumo existe em **3 lugares** com código quase idêntico:
- `useHomeData.ts` (linhas 352-478) — usado pelo card na Home
- `useRankings.ts` (linhas 18-140) — hook extraído mas NÃO usado em lugar nenhum visível
- `RankingConsumoModal.tsx` (linhas 47-141) — refaz TUDO quando o modal abre

Quando o usuário clica em "Consumo" no RankingCard, o modal abre e **refaz todas as queries do zero**, incluindo 3 RPCs + fallback. Isso é redundante — os dados já foram buscados pelo `useHomeData`.

**BUG 2 (Crítico): Ranking mostra #1 de 1 com 0 atividade**
O screenshot mostra exatamente isso: "🥇 #1 de 1" + "Você assistiu **0 aulas**" + "Você respondeu **0 questões**". Quando o cohort tem 1 pessoa e 0 atividade, o RPC `get_cohort_consumo_ranking` usa `RANK()` que retorna 1 para todos. O SQL tenta tratar isso:
```sql
CASE WHEN (SELECT COUNT(*) FROM consumo WHERE videos_assistidos > 0) = 0
THEN (SELECT total FROM totals)  -- Deveria colocar último
ELSE RANK() OVER (...)
END
```
Mas a coluna `total` no resultado é `(SELECT total FROM totals)` que também é 1. Então o resultado é `rank_videos = 1, total = 1` — o que faz o frontend mostrar "#1 de 1" mesmo com zero atividade. O card deveria mostrar um estado vazio.

**BUG 3 (Médio): Percentile invertido no card**
```typescript
// RankingCard.tsx linha 82
Top {100 - getPercentile(rank, total) + 1}% da turma
```
Com `getPercentile = ((total - rank + 1) / total) * 100`:
- Rank 1 de 10: percentile = 100%, display = "Top 1%" ✓
- Rank 1 de 1: percentile = 100%, display = "Top 1%" — misleading com 0 atividade
- Rank 10 de 10: percentile = 10%, display = "Top 91%" — **ERRADO**, deveria ser "Top 100%"

A fórmula `100 - percentile + 1` está errada. "Top X%" deveria ser `ceil(rank / total * 100)`.

**BUG 4 (Médio): RankingCard label diz "Comparativo semanal" mas não é semanal**
O subtítulo diz "Comparativo semanal" mas os dados são acumulados (all-time), não semanais.

**BUG 5 (Menor): Modal usa `window.location.href` em vez de router**
```typescript
// RankingConsumoModal.tsx linha 293
window.location.href = '/guia-estudos';
```
Isso causa um full page reload em vez de navegação SPA.

**BUG 6 (Menor): `useRankings` hook é dead code**
O hook `src/hooks/home/useRankings.ts` existe mas não é importado em nenhum lugar. A lógica vive duplicada dentro de `useHomeData.fetchRankings()`.

**BUG 7 (Menor): Modal não tem loading state**
Quando o modal abre, ele faz 3+ queries sem mostrar skeleton/spinner. O conteúdo fica no `initialMetrics` (zeros) até carregar.

**BUG 8 (UX): Empty state é mostrado DEPOIS dos cards com dados**
O modal mostra os cards "#1 de 1" com 0 atividade E TAMBÉM mostra o empty state "Ainda não há dados suficientes" abaixo. Deveria ser um OU outro.

**BUG 9 (Data): `consumo_metabase` é uma tabela estática/importada**
Os dados de consumo vêm de uma tabela `consumo_metabase` que parece ser importada periodicamente de um Metabase externo (via `supabase_to_metabase` mapping). Isso significa que o ranking de consumo NÃO reflete atividade em tempo real — depende de quando a importação foi feita. Não há nenhuma indicação disso na UI.

---

### Problemas de Performance

1. **6+ queries por abertura de modal**: IES RPC + Semester RPC + Cohort ranking RPC + (fallback: users query + metabase mapping + consumo query)
2. **Dados já disponíveis**: `useHomeData` já buscou os mesmos dados, mas o modal não os recebe como prop
3. **Sem cache**: Cada abertura do modal refaz tudo

---

### Resumo de Achados

| # | Severidade | Problema | Impacto |
|---|-----------|----------|---------|
| 1 | Crítico | Código triplicado, modal refaz queries | Performance, manutenção |
| 2 | Crítico | #1 de 1 com 0 atividade | UX enganosa |
| 3 | Médio | Percentile invertido para últimos colocados | Dado errado |
| 4 | Médio | Label "semanal" mas dados são all-time | UX enganosa |
| 5 | Menor | `window.location.href` em vez de router | Full reload |
| 6 | Menor | `useRankings` é dead code | Manutenção |
| 7 | Menor | Modal sem loading state | UX |
| 8 | UX | Empty state coexiste com cards de dados | UX confusa |
| 9 | Data | `consumo_metabase` é estática, sem indicação | Expectativa errada |

