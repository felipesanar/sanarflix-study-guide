

# Fix: Opção INTERNATO não aparece no dropdown do Guia de Estudos

## Causa Raiz

A Edge Function `get-study-contents` busca todos os registros da tabela `conteudos` para a IES do aluno, mas **sem paginação**. O Supabase tem um limite padrão de **1.000 linhas** por query. Como cada IES tem ~2.300 registros, a resposta é silenciosamente truncada, retornando apenas os primeiros 1.000 registros (semestres 1 a ~5), e o INTERNATO (753 registros ao final) nunca chega ao frontend.

## Solucao

Modificar a Edge Function `get-study-contents` para buscar **todos os registros** usando paginacao interna (loop de fetches com `.range()`), garantindo que nenhum dado seja perdido.

## Detalhes Tecnicos

### Arquivo a editar

**`supabase/functions/get-study-contents/index.ts`** (linhas 91-95)

Substituir a query unica:

```typescript
const { data: conteudos } = await supabaseAdmin
  .from('conteudos')
  .select('...')
  .eq('id_ies', userData.id_ies);
```

Por um loop de paginacao:

```typescript
const PAGE_SIZE = 1000;
let allConteudos: any[] = [];
let from = 0;
let hasMore = true;

while (hasMore) {
  const { data, error } = await supabaseAdmin
    .from('conteudos')
    .select('id, id_ies, semestre, materia, tema, subtema, aula, link_aula, link_pdf, link_quiz')
    .eq('id_ies', userData.id_ies)
    .range(from, from + PAGE_SIZE - 1);

  if (error) throw error;

  if (data && data.length > 0) {
    allConteudos = allConteudos.concat(data);
    from += PAGE_SIZE;
    hasMore = data.length === PAGE_SIZE;
  } else {
    hasMore = false;
  }
}
```

Em seguida, retornar `allConteudos` no lugar de `conteudos`.

### Nenhuma alteracao no frontend

O frontend (`StudyGuide.tsx`) ja trata corretamente o valor "INTERNATO" na logica de `semestres` (linha 558) e no `GuideToolbar` via `formatSemestreName`.

