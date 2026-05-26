# hooks/home — decomposição de `useHomeData.ts`

Decomposição do hook monolítico `useHomeData.ts` (667 linhas) em módulos
focados por domínio.

## Status atual

| Módulo | Linhas | Conteúdo |
|---|---|---|
| `types.ts` | 56 | Interfaces (MeuDiaItem, RankingData, etc.) |
| `cache.ts` | 50 | sessionStorage read/write/clear via CACHE_TTL.HOME |
| `useMeuDia.ts` | 195 | Card de matérias do dia (calendário pessoal/ENAMED/fallback) |
| `useAnnouncements.ts` | 179 | Banners e avisos importantes |
| `useSimuladoPerformance.ts` | 96 | Último simulado + acertos |
| `useTopAulas.ts` | 132 | Top aulas (vídeos/questões) |

## Migração de `useHomeData.ts`

O hook monolítico **ainda existe** porque alguns consumers o usam
diretamente. Migrá-los para usar os hooks decompostos é trabalho
incremental:

1. Identificar consumers de `useHomeData()` via grep.
2. Para cada um, substituir por composição dos hooks domain-específicos.
3. Quando zero consumers restarem, deletar `useHomeData.ts`.

## Por que essa abordagem?

Refactor amplo num único PR = alto risco de regressão na Home (primeira
tela após login). Extração incremental com o hook original preservado
permite reverter cada passo isoladamente e validar via smoke por feature.

## Referência

- Plano: `/root/.claude/plans/monte-um-plano-completo-proud-whale.md` Fase 3
