## Alteração: Sanção regulatória baseada em % de proficientes (pcp)

### Contexto
Hoje, `src/utils/mapInstitutionalData.ts` deriva a sanção a partir do `concept` da tabela `resultados_ies_tri` via `getSancaoFromConcept(concept)`. A função `getSancao(percentProficientes)` existe mas está sem uso (código morto).

### Mudanças em `src/utils/mapInstitutionalData.ts`

1. **Remover** a função morta `getSancao(percentProficientes)` (linhas 59–64).

2. **Remover** a função `getSancaoFromConcept(concept)` e substituí-la por uma nova função baseada em `pcp` (percentual de proficientes), com as faixas abaixo. O valor de `pcp` já é normalizado para 0–100 em `triPercentProficientes` mais adiante no arquivo — usaremos essa mesma normalização como entrada.

```ts
/**
 * Sanção regulatória derivada EXCLUSIVAMENTE do % de alunos proficientes (pcp
 * de resultados_ies_tri), independentemente do conceito da IES.
 *
 *   pcp < 30           → Suspensão imediata de ingresso de novos estudantes
 *   30 ≤ pcp < 40      → Redução de 50% das vagas autorizadas do curso
 *   40 ≤ pcp < 50      → Redução de 25% das vagas autorizadas do curso
 *   50 ≤ pcp < 60      → Abertura de processo de supervisão para monitoramento
 *   pcp ≥ 60           → Sem sanção
 */
function getSancaoFromPcp(percentProficientes: number | null | undefined): string | null {
  if (percentProficientes === null || percentProficientes === undefined) return null;
  const p = percentProficientes;
  if (p < 30) return 'Suspensão imediata de ingresso de novos estudantes';
  if (p < 40) return 'Redução de 50% das vagas autorizadas do curso';
  if (p < 50) return 'Redução de 25% das vagas autorizadas do curso';
  if (p < 60) return 'Abertura de processo de supervisão para monitoramento';
  return null;
}
```

3. **Substituir o cálculo de `sancao`** (atualmente baseado em `triConceptNota`):

   De:
   ```ts
   const sancao = triConceptNota !== null ? getSancaoFromConcept(triConceptNota) : null;
   ```
   Para:
   ```ts
   const sancao = triPercentProficientes !== null ? getSancaoFromPcp(triPercentProficientes) : null;
   ```

   Isso garante que a sanção dependa exclusivamente de `pcp` (mesma faixa do conceito pode ter sanções diferentes conforme o `pcp`).

4. **Atualizar os logs** existentes para refletir a nova origem:
   ```ts
   console.log('[TRI] PCP loaded:', triPercentProficientes);
   console.log('[TRI] Regulatory sanction derived from pcp:', sancao);
   ```

5. **Atualizar o comentário-bloco** acima do cálculo para deixar explícito que a sanção é derivada de `pcp`, não de `concept`. O comentário sobre `triSnapshot.sanctions` e `is_restricted` serem ignorados permanece válido.

### Sem outras alterações necessárias
- `meta.sancaoRegulatoriaLabel` e `headerSummary.sancao` consomem a mesma variável `sancao` — atualizam automaticamente.
- `MetaInstitucionalCard.tsx` e `InstitutionalAlertBanner.tsx` apenas exibem o label — não precisam mudar.
- Nada no backend muda.

### Memória
Atualizar `mem://architecture/tri-data-source-priority` para registrar que a **sanção regulatória** agora é derivada de `pcp` (não mais do `concept`), enquanto `concept` continua sendo a fonte do label "Conceito N".
