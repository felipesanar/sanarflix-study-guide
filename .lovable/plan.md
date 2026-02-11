

# Fix: Import do Guia de Estudos falhando com erro 546 (CPU Time Exceeded)

## Causa Raiz

Sao dois problemas encadeados:

1. **Sem constraint UNIQUE na tabela `conteudos`**: A tabela so tem uma primary key (`id` UUID). Nao existe constraint unique em `(id_ies, semestre, materia, tema, subtema, aula)`.
2. **Fallback lento na Edge Function**: Quando o `upsert` com `onConflict` falha (erro `42P10` -- sem constraint compativel), a funcao cai num fallback que tenta inserir/atualizar **cada linha individualmente** (ate 1000 queries separadas por lote), esgotando o CPU time limit.

Os logs confirmam:
```text
Upsert error: "there is no unique or exclusion constraint matching the ON CONFLICT specification"
CPU Time exceeded
```

## Solucao

Simplificar a logica de MERGE na Edge Function para usar **DELETE por escopo + INSERT em massa**, eliminando a dependencia do upsert e do fallback individual. Como o cliente ja deduplica as linhas (estrategia `keep_last`), nao ha risco de duplicatas.

## Detalhes Tecnicos

### 1. Edge Function `admin-upload-study-guide/index.ts`

Substituir toda a logica de MERGE/upsert (linhas ~240-300) por uma abordagem simples:

- **MERGE e REPLACE**: Deletar registros existentes para cada combinacao IES+semestre presente no lote, depois fazer `INSERT` em massa.
- **APPEND**: Manter o `INSERT` simples atual (sem delete previo).

```typescript
// Para MERGE e REPLACE: delete scoped + bulk insert
if (config.mode === "MERGE" || config.mode === "REPLACE") {
  // Agrupar por IES+semestre para deletar apenas o escopo relevante
  const iesSemestres = new Map<string, Set<string>>();
  rows.forEach((row) => {
    if (!iesSemestres.has(row.id_ies)) {
      iesSemestres.set(row.id_ies, new Set());
    }
    iesSemestres.get(row.id_ies)!.add(row.semestre);
  });

  // Delete escopo
  for (const [iesId, semestres] of iesSemestres.entries()) {
    await supabaseAdmin
      .from("conteudos")
      .delete()
      .eq("id_ies", iesId)
      .in("semestre", Array.from(semestres));
  }

  // Bulk insert em sub-batches de 200
  for (let i = 0; i < records.length; i += 200) {
    const chunk = records.slice(i, i + 200);
    const { error } = await supabaseAdmin.from("conteudos").insert(chunk);
    if (error) throw error;
  }
}
```

### 2. Cliente `StudyGuideImportWizard.tsx`

- Reduzir `BATCH_SIZE` de 1000 para **500** como margem de seguranca adicional.
- Remover a logica especial que altera o modo para MERGE nos lotes subsequentes (ja que o delete agora e escopado por IES+semestre dentro de cada lote e nao conflita).

### Resumo das mudancas

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/admin-upload-study-guide/index.ts` | Substituir upsert+fallback por delete-escopo+insert para modos MERGE/REPLACE |
| `src/components/admin/study-guide-import/StudyGuideImportWizard.tsx` | Reduzir BATCH_SIZE para 500 |

