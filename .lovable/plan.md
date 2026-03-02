

## Auditoria e Correcao do Pipeline de Upload de Guia de Estudos

### Bugs Criticos Encontrados

#### BUG 1 (CRITICO): Batching no frontend destroi dados em MERGE/REPLACE

Este e o bug principal causando perda e mistura de dados entre semestres.

O frontend envia dados em lotes de 500 linhas (arquivo `StudyGuideImportWizard.tsx`, linha 405). Para cada lote, a Edge Function `admin-upload-study-guide` executa DELETE escopado + INSERT. O problema:

```text
Arquivo com 1200 linhas, modo MERGE, semestre 3:

Lote 1 (linhas 1-500):
  -> DELETE FROM conteudos WHERE id_ies = X AND semestre IN ('3')
  -> INSERT linhas 1-500  (OK ate aqui)

Lote 2 (linhas 501-1000):
  -> DELETE FROM conteudos WHERE id_ies = X AND semestre IN ('3')
  -> APAGA as 500 linhas do lote 1!
  -> INSERT linhas 501-1000

Lote 3 (linhas 1001-1200):
  -> DELETE FROM conteudos WHERE id_ies = X AND semestre IN ('3')
  -> APAGA as 500 linhas do lote 2!
  -> INSERT linhas 1001-1200

Resultado: apenas as ultimas 200 linhas sobrevivem.
```

Se o arquivo tem multiplos semestres misturados nos lotes, semestres inteiros podem ser apagados e substituidos por dados parciais.

#### BUG 2: MERGE e REPLACE fazem exatamente a mesma coisa

No codigo da Edge Function (linha 158), ambos os modos executam a mesma logica: delete + insert. Nao ha diferenciacao real entre eles.

#### BUG 3: Fill-down de celulas mescladas pode propagar semestre errado

A funcao `fillDownMergedCells` (parseFile.ts, linha 244) propaga o valor do semestre para baixo em celulas vazias. Se uma planilha tem semestres diferentes separados por linhas vazias, o fill-down vai atribuir o semestre anterior a linhas que pertencem a outro semestre.

#### BUG 4: Contagem de deletes sempre zero

A Edge Function usa `.delete()` sem `{ count: 'exact' }`, entao `count` retorna `null/undefined`, e o total de deletes reportado e sempre 0.

---

### Plano de Correcao

#### 1. Corrigir a logica de batching (BUG CRITICO)

**Arquivo: `src/components/admin/study-guide-import/StudyGuideImportWizard.tsx`**

A solucao e separar o DELETE do INSERT:
- Enviar um primeiro request com `action: 'delete'` contendo apenas os escopos (IES + semestres) a serem limpos
- Depois enviar os lotes de INSERT com `action: 'insert_only'`
- Assim o DELETE acontece apenas UMA VEZ, e todos os lotes subsequentes fazem apenas INSERT

**Arquivo: `supabase/functions/admin-upload-study-guide/index.ts`**

Adicionar suporte a dois tipos de request:
- `action: 'delete_scope'` -- executa apenas o DELETE escopado, retorna contagem
- `action: 'insert_only'` -- executa apenas INSERT (sem delete)
- Manter compatibilidade com o fluxo atual para APPEND (que nao deleta nada)

Fluxo corrigido:
```text
Arquivo com 1200 linhas, modo MERGE:

Request 1 (delete_scope):
  -> DELETE FROM conteudos WHERE id_ies = X AND semestre IN ('3')
  -> Retorna: deleted = 850

Request 2 (insert_only, lote 1):
  -> INSERT linhas 1-500

Request 3 (insert_only, lote 2):
  -> INSERT linhas 501-1000

Request 4 (insert_only, lote 3):
  -> INSERT linhas 1001-1200

Resultado: todas as 1200 linhas inseridas corretamente.
```

#### 2. Diferenciar MERGE de REPLACE

**Arquivo: `supabase/functions/admin-upload-study-guide/index.ts`**

- REPLACE: deleta TUDO do escopo (IES inteira ou IES+semestres) e reinsere -- comportamento atual
- MERGE: deleta apenas os semestres que aparecem no arquivo, mantendo semestres nao mencionados intactos

Na pratica, com `scope: 'ies_semestre'`, ambos tem o mesmo efeito. Mas com `scope: 'ies_full'`:
- REPLACE: apaga TODOS os semestres da IES
- MERGE: apaga apenas os semestres presentes no arquivo

Implementacao: no modo MERGE, forcar `scope = 'ies_semestre'` independente da configuracao.

#### 3. Proteger fill-down contra propagacao incorreta

**Arquivo: `src/components/admin/study-guide-import/utils/parseFile.ts`**

- Resetar `lastValues` quando uma linha completamente vazia for encontrada (possivel separador entre secoes)
- Limitar fill-down a no maximo 50 linhas consecutivas sem valor original
- Adicionar warning quando fill-down for aplicado para que o usuario saiba

#### 4. Corrigir contagem de deletes

**Arquivo: `supabase/functions/admin-upload-study-guide/index.ts`**

Adicionar `{ count: 'exact' }` nas queries de delete para obter contagens reais.

#### 5. Adicionar logs detalhados para rastreabilidade

**Arquivo: `supabase/functions/admin-upload-study-guide/index.ts`**

- Logar IES, semestres, e contagens por semestre em cada operacao
- Logar amostra das primeiras 3 linhas do payload para debugging

---

### Resumo das Mudancas

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/admin-upload-study-guide/index.ts` | Separar DELETE e INSERT em actions distintas; diferenciar MERGE/REPLACE; fix count; logs |
| `src/components/admin/study-guide-import/StudyGuideImportWizard.tsx` | Enviar delete_scope primeiro, depois lotes insert_only; atualizar progresso |
| `src/components/admin/study-guide-import/utils/parseFile.ts` | Proteger fill-down; adicionar warning de fill-down |

### Resultado Esperado

- Todas as linhas do arquivo serao inseridas corretamente, independente do tamanho
- Dados de um semestre nunca serao sobrescritos por dados de outro
- Modos MERGE, REPLACE e APPEND terao comportamentos distintos e corretos
- Celulas mescladas serao tratadas com seguranca

