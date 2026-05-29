## Correção: "Alunos Proficientes" deve arredondar para baixo

### Problema
Em `src/utils/mapInstitutionalData.ts` (linhas 151–153) o cálculo de `triPercentProficientes` usa `Math.round`. No caso reportado (Valença, 71/95 = 74,7%) isso vira **75%**, e esse valor inflado é propagado para o `MetaInstitucionalCard`, que ao avaliar `percentProficientes < 75` enquadra a IES em **Conceito 4** (faixa 75–90) — contradizendo o KPI "Nota Prevista da IES" (Conceito 3, lido de `triConceptNota`). A "Distância Próxima Faixa" também passa a mirar 90 (15 p.p.) em vez de 75.

### Mudança
**Arquivo:** `src/utils/mapInstitutionalData.ts`

```ts
const triPercentProficientes = triPcpRaw !== null
  ? Math.floor(triPcpRaw <= 1 ? triPcpRaw * 100 : triPcpRaw)
  : null;
```

(troca de `Math.round` → `Math.floor`, mantendo a normalização fração/percentual)

### Efeitos esperados (Valença, 71/95)
- KPI "Alunos Proficientes": 75% → **74%**
- MetaInstitucionalCard "Conceito Atual": Conceito 4 → **Conceito 3** (faixa 60–75)
- MetaInstitucionalCard progresso: "0% para Conceito 5" → "~93% para Conceito 4"
- KPI "Distância Próxima Faixa": 15 p.p. → **1 p.p.**
- Header / `InstitutionalAlertBanner`: "Com 75%…" → "Com 74%…"

### Por que aplicar na fonte
`triPercentProficientes` alimenta `MetaInstitucionalCard`, `getConceitoInfo`, `distanciaPP`, `alunosFaltamMeta`, `InstitutionalHeader` e `InstitutionalAlertBanner`. Flooring uma única vez na origem garante consistência sem espalhar `Math.floor` por vários componentes.

### Não muda
- `triConceptNota` (KPI "Nota Prevista da IES") — continua vindo da coluna `concept` de `resultados_ies_tri`.
- Sanção regulatória — `getSancaoFromPcp` opera em faixas largas; 74,7→74 não cruza limiar.
- Quantitativos absolutos `num_proficient` / `num_students` — preservados.

### Validação
- Conferir no preview que com a IES Valença / Simulado Global Valença - UNIATENAS o card mostra 74%, o MetaInstitucionalCard mostra "Conceito 3" e a Distância Próxima Faixa cai para ~1 p.p.
- Verificar que IES com pcp inteiro (ex.: 80%) não sofrem alteração.
