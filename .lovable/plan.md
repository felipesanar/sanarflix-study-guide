

## Auditoria e Upgrade do Pipeline de Importacao para Comparacao de Alto Nivel

### Problemas Identificados

**1. Nenhuma comparacao campo-a-campo com o banco de dados**
O fluxo atual para MERGE/REPLACE faz apenas `DELETE escopo + INSERT tudo`. Nao ha verificacao se uma linha do arquivo ja existe identica no banco. Isso significa:
- Nao sabemos quantas linhas realmente mudaram vs estao iguais
- Deletamos e reinserimos dados identicos desnecessariamente
- Nao ha confianca de que os dados foram inseridos corretamente

**2. Limite de 1000 linhas do Supabase nao e tratado na busca para comparacao**
A query filtrada por semestre no `get-study-contents` (linha 125) nao usa paginacao. Se um semestre tiver mais de 1000 conteudos, os excedentes sao silenciosamente ignorados.

**3. Sem verificacao pos-insercao**
Apos inserir os dados, o sistema nao verifica se a contagem no banco bate com o esperado. Se uma insercao falhar silenciosamente, ninguem sabe.

**4. Sem hash/fingerprint de linha para comparacao eficiente**
Cada linha precisa ser comparada por todos os campos (semestre, materia, tema, subtema, aula, link_aula, link_pdf, link_quiz). Sem uma funcao de fingerprint, a comparacao e fragil.

---

### Plano de Correcao

#### 1. Nova action `smart_import` na Edge Function

**Arquivo: `supabase/functions/admin-upload-study-guide/index.ts`**

Criar uma nova action que faz tudo server-side com acesso total ao banco:

```text
action: 'smart_import'
Entrada: { config, scopes, rows[] }

Fluxo:
1. Buscar TODOS os registros existentes no escopo (IES + semestres) com paginacao
   - Usar .range(from, from+999) em loop ate nao haver mais dados
   - Isso ignora o limite de 1000 do Supabase

2. Criar fingerprint de cada registro existente:
   fingerprint = JSON.stringify([semestre, materia, tema, subtema, aula, link_aula, link_pdf, link_quiz])

3. Criar fingerprint de cada linha do arquivo

4. Comparar:
   - Se fingerprint do arquivo existe nos existentes: IDENTICA (pular)
   - Se nao existe: NOVA ou ALTERADA (precisa inserir)

5. Para MERGE/REPLACE:
   - Deletar registros do escopo que NAO existem no arquivo (foram removidos)
   - Inserir registros do arquivo que NAO existem no banco (novos/alterados)
   - Manter registros identicos intactos

6. Verificacao pos-insercao:
   - Contar registros no banco apos operacao
   - Comparar com contagem esperada
   - Reportar discrepancias

7. Retornar contagens detalhadas:
   { inserted, deleted, unchanged, errors, verified_total }
```

Este approach e superior porque:
- O service_role nao tem limite de 1000 linhas
- A comparacao acontece no servidor, perto do banco, sem latencia
- Nao depende do frontend para orquestrar delete + insert separados
- Verifica o resultado final

#### 2. Funcao de fingerprint para comparacao deterministica

**Arquivo: `supabase/functions/admin-upload-study-guide/index.ts`**

```text
function rowFingerprint(r):
  valores = [r.semestre, r.materia, r.tema, r.subtema, r.aula, r.link_aula, r.link_pdf, r.link_quiz]
  valores_normalizados = valores.map(v => (v || '').trim().toLowerCase())
  return valores_normalizados.join('|')
```

A normalizacao garante que diferencas de espacos, case, ou nulls nao causem falsos positivos.

#### 3. Busca paginada de TODOS os registros existentes

**Arquivo: `supabase/functions/admin-upload-study-guide/index.ts`**

```text
async function fetchAllExisting(supabaseAdmin, iesId, semestres?):
  allRows = []
  PAGE = 1000
  from = 0
  loop:
    query = supabaseAdmin.from('conteudos')
      .select('id, semestre, materia, tema, subtema, aula, link_aula, link_pdf, link_quiz')
      .eq('id_ies', iesId)
    if semestres:
      query = query.in('semestre', semestres)
    query = query.range(from, from + PAGE - 1)
    
    { data } = await query
    if data.length == 0: break
    allRows.push(...data)
    from += PAGE
    if data.length < PAGE: break
  
  return allRows
```

#### 4. Verificacao pos-insercao

**Arquivo: `supabase/functions/admin-upload-study-guide/index.ts`**

Apos todas as insercoes, o sistema faz uma contagem final:

```text
// Contar registros finais no escopo
const { count } = await supabaseAdmin
  .from('conteudos')
  .select('*', { count: 'exact', head: true })
  .eq('id_ies', iesId)
  .in('semestre', semestres);

// Comparar com esperado
const expected = rowsToImport.length;
if (count !== expected) {
  // Reportar discrepancia
}
```

#### 5. Atualizar o frontend para usar smart_import

**Arquivo: `src/components/admin/study-guide-import/StudyGuideImportWizard.tsx`**

Para MERGE e REPLACE:
- Enviar TODAS as linhas em um unico request com `action: 'smart_import'`
- Se o total de linhas exceder 5000, enviar em lotes de 5000 mas com flag `batch_index` e `total_batches` para o servidor saber quando verificar
- O servidor faz o delete e insert inteligente
- O frontend recebe contagens detalhadas: inseridas, removidas, inalteradas, erros

Para APPEND:
- Manter comportamento atual (insert_only sem delete)

#### 6. Corrigir paginacao no get-study-contents

**Arquivo: `supabase/functions/get-study-contents/index.ts`**

A query filtrada por semestre (linha 125) atualmente nao pagina. Adicionar paginacao igual a query sem filtro:

```text
// Antes (sem paginacao):
const { data } = await supabaseAdmin.from('conteudos').select(...).eq(...).in(...)

// Depois (com paginacao):
let allConteudos = [];
let from = 0;
const PAGE_SIZE = 1000;
while (true) {
  const { data } = await query.range(from, from + PAGE_SIZE - 1);
  allConteudos.push(...data);
  if (data.length < PAGE_SIZE) break;
  from += PAGE_SIZE;
}
```

---

### Resumo das Mudancas

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/admin-upload-study-guide/index.ts` | Nova action `smart_import` com comparacao campo-a-campo, busca paginada, verificacao pos-insercao |
| `supabase/functions/admin-upload-study-guide/index.ts` | Funcao `rowFingerprint` para comparacao deterministica |
| `supabase/functions/admin-upload-study-guide/index.ts` | Funcao `fetchAllExisting` com paginacao sem limite de 1000 |
| `src/components/admin/study-guide-import/StudyGuideImportWizard.tsx` | Usar `smart_import` para MERGE/REPLACE em vez de delete_scope + insert_only separados |
| `supabase/functions/get-study-contents/index.ts` | Adicionar paginacao na query filtrada por semestre |

### Resultado Esperado

- Cada linha do arquivo e comparada campo-a-campo com TODOS os registros existentes no banco
- Nenhum limite de 1000 linhas -- busca paginada garante acesso a base completa
- Registros identicos nao sao deletados e reinseridos desnecessariamente
- Contagens precisas: inseridos, removidos, inalterados, erros
- Verificacao pos-insercao confirma integridade dos dados
- Logs detalhados para rastreabilidade de cada operacao

