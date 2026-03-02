
## Remover Limites de Linhas e Implementar Batching Ilimitado

### Problema

Existem 4 pontos no codigo que impoe um limite rigido de 10.000 linhas:

1. **Frontend** (`StudyGuideImportWizard.tsx`, linha 459): `if (rowsToImport.length > 10000)` — bloqueia o envio antes mesmo de chamar o servidor
2. **Edge Function `handleSmartImport`** (linha 328): rejeita com erro 400
3. **Edge Function `handleInsertOnly`** (linha 571): rejeita com erro 400
4. **Edge Function main handler** (linha 748): rejeita no path legado

Mesmo a validacao (preview_changes) funcionando corretamente e mostrando ~2.000 insercoes, o frontend envia TODAS as 10.225 linhas do arquivo para o servidor fazer a comparacao — e o servidor rejeita por exceder 10.000.

### Solucao

Implementar batching no frontend para dividir automaticamente os dados em lotes menores e processar sequencialmente, sem nenhum limite artificial.

---

### Mudancas

#### 1. Frontend: Remover limite e implementar batching para smart_import

**Arquivo: `src/components/admin/study-guide-import/StudyGuideImportWizard.tsx`**

- Remover o bloco `if (rowsToImport.length > 10000) throw new Error(...)` (linhas 459-461)
- Implementar envio em lotes de 5.000 linhas para smart_import:
  - Dividir `rowsToImport` em chunks de 5.000
  - Enviar cada chunk como uma requisicao separada com `action: 'smart_import'`
  - Agregar os resultados (inserted, updated, deleted, unchanged, errors) de cada lote
  - Atualizar progresso visual entre cada lote
  - Se um lote falhar, registrar o erro mas continuar com os proximos lotes
- Para APPEND, manter batching atual de 500 linhas (ja funciona)

#### 2. Edge Function: Remover limites artificiais

**Arquivo: `supabase/functions/admin-upload-study-guide/index.ts`**

- Remover `if (rows.length > 10000)` de `handleSmartImport` (linha 328-330)
- Remover `if (rows.length > 10000)` de `handleInsertOnly` (linha 571-573)
- Remover `if (rows.length > 10000)` do main handler legado (linha 748-749)
- Manter os sub-batches internos de 200 linhas para inserts/deletes (ja existem e funcionam bem)

#### 3. Frontend: Batching para preview_changes tambem

**Arquivo: `src/components/admin/study-guide-import/StudyGuideImportWizard.tsx`**

O preview_changes envia todas as linhas em um unico request. Para arquivos muito grandes (>10k linhas), o payload pode exceder limites do Edge Function.
- Se totalLinhas > 5.000, dividir o preview em lotes por IES (cada IES em um request separado)
- Agregar os changePlans de cada IES

---

### Fluxo Resultante

```text
Arquivo com 10.225 linhas
  |
  v
Validacao local (sem limite)
  |
  v
preview_changes: enviado por IES se > 5.000 linhas
  → Retorna: 2.000 inserts, 50 updates, 8.175 unchanged
  |
  v
smart_import: dividido em lotes de 5.000
  Lote 1: linhas 1-5.000 → servidor compara e opera
  Lote 2: linhas 5.001-10.000 → servidor compara e opera
  Lote 3: linhas 10.001-10.225 → servidor compara e opera
  → Resultados agregados no frontend
```

### Detalhes Tecnicos

**Batching do smart_import no frontend:**
```text
const SMART_BATCH_SIZE = 5000;
const batches = dividir(rowsToImport, SMART_BATCH_SIZE);

for (let i = 0; i < batches.length; i++) {
  updateProgress('uploading', (i/batches.length)*100, `Lote ${i+1}/${batches.length}...`);
  
  const { data } = await supabase.functions.invoke('admin-upload-study-guide', {
    body: { action: 'smart_import', config, rows: batches[i] }
  });
  
  // Agregar contagens
  aggregatedCounts.inserted += data.counts.inserted;
  aggregatedCounts.updated += data.counts.updated;
  // ... etc
}
```

**Importante:** O batching do smart_import funciona corretamente porque cada lote e independente — o servidor busca os dados existentes do banco, compara com as linhas do lote, e faz as operacoes necessarias. Linhas inalteradas sao simplesmente ignoradas pelo servidor.

### Resumo

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/admin-upload-study-guide/index.ts` | Remover 3 limites de 10.000 linhas |
| `src/components/admin/study-guide-import/StudyGuideImportWizard.tsx` | Remover limite de 10.000; implementar batching de 5.000 para smart_import e preview_changes |
