## Diagnóstico (consolidado)

O problema é **100% de dados** em `questoes_simulado.grande_area` (texto livre, sem trim nem canonicalização na importação). Confirmado na base:

| `grande_area` exato | Qtd |
|---|---|
| `Ginecologia` | 2 |
| `Ginecologia e Obstetrícia` | 474 |
| `Preventiva` | 226 |
| `Preventiva ` *(trailing space)* | 2 |
| `Medicina Preventiva` | 37 |
| `Medicina Preventiva/Saúde Coletiva` | 126 |

**No 2º Simulado FAI**: 19× `Preventiva` + 1× `Preventiva ` (espaço) → 2 cards "Preventiva"; 17× `Ginecologia e Obstetrícia` + 1× `Ginecologia` → 2 cards distintos.

**Onde é amplificado:** `SimuladoDesempenho.tsx:783` e `SimuladoCorrecao.tsx:366` fazem `areaMap.get(area)` por string crua — qualquer variação vira card separado. O mesmo padrão existe em `useSimuladosAnalytics`, `useErrorNotebook`, Caderno de Erros e exports.

---

## Correção (decisões confirmadas)

**Mapa canônico:**
- `Ginecologia` → `Ginecologia e Obstetrícia`
- `Medicina Preventiva` → `Preventiva`
- `Medicina Preventiva/Saúde Coletiva` → `Preventiva`
- Sempre aplicar `trim()` (elimina `Preventiva ` com espaço)

### Camada 1 — Dados (migração aditiva, sem DELETE/TRUNCATE)

Migração SQL única que só executa `UPDATE`:

1. `UPDATE public.questoes_simulado SET grande_area = trim(grande_area) WHERE grande_area <> trim(grande_area);`
2. `UPDATE … SET grande_area = 'Ginecologia e Obstetrícia' WHERE trim(grande_area) = 'Ginecologia';`
3. `UPDATE … SET grande_area = 'Preventiva' WHERE trim(grande_area) IN ('Medicina Preventiva','Medicina Preventiva/Saúde Coletiva');`
4. Criar função `public.normalize_grande_area(text) RETURNS text` (`IMMUTABLE`) com a mesma lógica.
5. Criar trigger `BEFORE INSERT OR UPDATE OF grande_area ON questoes_simulado` que aplica `normalize_grande_area(NEW.grande_area)` → impede a regressão em futuras importações de CSV.

Nada removido. Reversível por `UPDATE` inverso a partir do snapshot.

### Camada 2 — Frontend defensivo

1. Criar `src/utils/grandeArea.ts`:
   ```ts
   export function normalizeGrandeArea(raw?: string | null): string {
     if (!raw) return 'Outros';
     const t = raw.trim();
     const map: Record<string, string> = {
       'Ginecologia': 'Ginecologia e Obstetrícia',
       'Medicina Preventiva': 'Preventiva',
       'Medicina Preventiva/Saúde Coletiva': 'Preventiva',
     };
     return map[t] ?? t;
   }
   ```
2. Aplicar onde se agrupa/exibe `grande_area`:
   - `src/pages/SimuladoDesempenho.tsx` (linhas ~775 e ~783)
   - `src/pages/SimuladoCorrecao.tsx` (linhas ~351 e ~366)
   - `src/hooks/useSimuladosAnalytics.ts`
   - `src/hooks/useErrorNotebook.ts`
   - Componentes `caderno-erros/*` que filtram/listam por área
   - `src/utils/exportSimuladosAnalytics.ts`

Mantém o app correto mesmo antes da migração rodar e blinda contra futuras variantes que escapem do trigger.

### Memória do projeto

Adicionar `mem://constraints/grande-area-canonical-mapping` registrando o mapa canônico + trigger, para que próximas importações respeitem a regra.

### Fora de escopo
- Não tocar em `especialidade`, `tema`, `subtema`.
- Não normalizar case (preservar casing canônico).
- Não alterar schema da coluna (continua `text`).

### Verificação pós-deploy
1. SQL: `SELECT DISTINCT grande_area FROM questoes_simulado WHERE grande_area ILIKE '%preventiva%' OR grande_area ILIKE '%ginecolog%';` deve retornar apenas `Preventiva` e `Ginecologia e Obstetrícia`.
2. Abrir resultado do **2º Simulado FAI** e confirmar **5 grandes áreas** (em vez de 7).
3. Tentar `INSERT` com `'Medicina Preventiva '` e ver o trigger gravar como `'Preventiva'`.
