

## Correcao da Validacao e Logica de Upsert no Import de Guia de Estudos

### Problemas Identificados

**Problema 1: Validacao nao compara com o banco de dados**

Na etapa de validacao (linhas 303-309 do `StudyGuideImportWizard.tsx`), o `changePlan` e calculado estaticamente:
```
inserts: allNormalized.length  // sempre = total de linhas validas
updates: 0                     // sempre zero
```
Nenhuma consulta ao banco e feita durante a validacao. Por isso, ao subir 2.846 linhas para a FAME (que ja tem dados), todas aparecem como "insercoes", quando muitas sao identicas ao que ja existe.

**Problema 2: Fingerprint nao distingue "identidade" de "dados"**

O `rowFingerprint` atual (linha 72 da Edge Function) inclui TODOS os campos:
```
semestre|materia|tema|subtema|aula|link_aula|link_pdf|link_quiz
```

Isso significa que se uma linha tem a mesma materia/tema/subtema/aula mas um link diferente, ela e tratada como "nova" (e a antiga e deletada). Funciona, mas:
- Nao reporta como "atualizacao" — reporta como delete + insert
- Nao identifica corretamente o que e "a mesma linha com dados diferentes" vs "linha totalmente nova"

A definicao correta (conforme o usuario especificou):
- **Chave de identidade**: `semestre + materia + tema + subtema + aula` — define "a mesma linha"
- **Campos de dados**: `link_aula + link_pdf + link_quiz` — se diferem, e uma atualizacao
- Mesma identidade + mesmos dados = INALTERADA (pular)
- Mesma identidade + dados diferentes = ATUALIZACAO
- Identidade nova = INSERCAO
- Identidade no banco que nao existe no arquivo = REMOCAO

---

### Plano de Correcao

#### 1. Nova action `preview_changes` na Edge Function

**Arquivo: `supabase/functions/admin-upload-study-guide/index.ts`**

Adicionar uma action que faz a mesma comparacao do `smart_import` mas SEM executar nenhuma operacao no banco. Retorna apenas contagens:
- `unchanged`: linhas identicas (mesma identidade + mesmos dados)
- `updates`: linhas com mesma identidade mas dados diferentes
- `inserts`: linhas novas (identidade nao existe no banco)
- `deletes`: linhas no banco cuja identidade nao existe no arquivo

Usa as mesmas funcoes `fetchAllExisting` e fingerprints ja existentes.

#### 2. Separar fingerprint em identityKey e dataFingerprint

**Arquivo: `supabase/functions/admin-upload-study-guide/index.ts`**

Criar duas funcoes:

```text
identityKey(r) = [semestre, materia, tema, subtema, aula]
                  .map(v => (v||'').trim().toLowerCase()).join('|')

dataFingerprint(r) = [link_aula, link_pdf, link_quiz]
                      .map(v => (v||'').trim().toLowerCase()).join('|')
```

Logica de comparacao:
- Construir mapa do banco: `identityKey -> { id, dataFingerprint }`
- Para cada linha do arquivo:
  - Se identityKey nao existe no mapa: NOVA (insert)
  - Se existe e dataFingerprint igual: INALTERADA (skip)
  - Se existe e dataFingerprint diferente: ATUALIZACAO (delete old + insert new)
- Identidades no mapa que nao existem no arquivo: REMOCAO (delete)

#### 3. Atualizar smart_import para usar identityKey

**Arquivo: `supabase/functions/admin-upload-study-guide/index.ts`**

Refatorar `handleSmartImport` para usar a logica de identity/data separadas. A operacao continua sendo delete + insert (nao ha UPDATE SQL), mas agora as contagens reportam corretamente:
- `unchanged` para linhas identicas
- `updated` para linhas com mesma identidade mas dados diferentes (em vez de contar como delete+insert)
- `inserted` apenas para linhas genuinamente novas
- `deleted` apenas para linhas que existem no banco mas nao no arquivo

#### 4. Frontend chama preview_changes durante validacao

**Arquivo: `src/components/admin/study-guide-import/StudyGuideImportWizard.tsx`**

Na funcao `runValidation`, apos validar o arquivo localmente, se o modo for MERGE ou REPLACE:
- Chamar a Edge Function com `action: 'preview_changes'`
- Enviar todas as linhas normalizadas + config
- Usar a resposta para definir o `changePlan` com valores reais

Para APPEND, manter o comportamento atual (todas as linhas sao insercoes).

#### 5. Atualizar tipo ChangePlan

**Arquivo: `src/components/admin/study-guide-import/types.ts`**

Adicionar campo `unchanged` ao `ChangePlan`:
```text
interface ChangePlan {
  inserts: number;
  updates: number;
  deletes: number;
  ignored: number;
  unchanged: number;  // NOVO
}
```

#### 6. Atualizar UI de validacao para mostrar unchanged

**Arquivo: `src/components/admin/study-guide-import/components/ValidationSummary.tsx`**

Exibir badge adicional no "Plano de Mudancas" mostrando linhas inalteradas (ex: "=1.500 inalteradas").

---

### Resumo das Mudancas

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/admin-upload-study-guide/index.ts` | Nova action `preview_changes`; separar `identityKey`/`dataFingerprint`; refatorar `smart_import` |
| `src/components/admin/study-guide-import/StudyGuideImportWizard.tsx` | Chamar `preview_changes` durante validacao para MERGE/REPLACE |
| `src/components/admin/study-guide-import/types.ts` | Adicionar `unchanged` ao `ChangePlan` |
| `src/components/admin/study-guide-import/components/ValidationSummary.tsx` | Exibir contagem de linhas inalteradas no plano de mudancas |

### Resultado Esperado

- Na validacao, o usuario vera: "+300 insercoes, ~50 atualizacoes, =2.496 inalteradas" em vez de "+2.846 insercoes"
- O modo MERGE faz upsert real: identifica linhas existentes pela chave de identidade (semestre+materia+tema+subtema+aula) e atualiza apenas os links que mudaram
- Linhas identicas ao banco nao sao tocadas

