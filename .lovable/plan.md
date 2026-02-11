

# Fix: "INTERNATO" rejeitado como valor invalido no importador

## Causa Raiz

A validacao no arquivo `parseFile.ts` (linha 409-410) faz:

```text
const semestreStr = String(semestreRaw || '').trim();
const isInternato = /^internato$/i.test(semestreStr);
```

O `.trim()` do JavaScript so remove espacos ASCII comuns. Planilhas Excel/Google Sheets frequentemente inserem caracteres invisives como:
- Non-breaking space (`\u00A0`)
- BOM (Byte Order Mark `\uFEFF`)
- Zero-width spaces (`\u200B`)
- Outros whitespace Unicode

Esses caracteres fazem com que "INTERNATO" no arquivo nao case exatamente com a regex `^internato$`, resultando na rejeicao.

Alem disso, o valor "ESTAGIO OPTATIVO I-II" tambem aparece como invalido -- esse e um caso real de valor nao suportado. Porem, o "INTERNATO" deveria ser aceito e nao esta sendo.

## Solucao

Aplicar normalizacao robusta ao valor do semestre antes da validacao:
1. Remover todos os caracteres Unicode invisives (non-breaking spaces, BOM, zero-width chars)
2. Normalizar acentos (NFD + strip diacritics) para cobrir variacoes como "Internató"
3. Colapsar espacos multiplos

## Secao Tecnica

### Arquivo a editar

**`src/components/admin/study-guide-import/utils/parseFile.ts`** (linhas 408-410)

Substituir:
```typescript
const semestreRaw = row.semestre || row.semester;
const semestreStr = String(semestreRaw || '').trim();
const isInternato = /^internato$/i.test(semestreStr);
```

Por:
```typescript
const semestreRaw = row.semestre || row.semester;
const semestreStr = String(semestreRaw || '')
  .replace(/[\u00A0\u200B\u200C\u200D\uFEFF\u2060\u2028\u2029]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const semestreNormalized = semestreStr
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();
const isInternato = semestreNormalized === 'internato';
```

Isso garante que qualquer variacao de "INTERNATO" vinda de planilhas (com caracteres invisives, acentos, espacos extras) seja corretamente reconhecida.

Nenhum outro arquivo precisa ser alterado.

