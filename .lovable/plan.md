

## Objetivo
Remover a coluna `id_ies` do CSV/XLSX de cadastro em lote. O admin seleciona a IES em um dropdown **antes** do upload, e essa IES e aplicada a todos os usuarios do lote.

## Mudancas

### 1. Estado e UI -- adicionar seletor de IES no card de lote
- Novo estado `batchIesId` para armazenar a IES selecionada para o lote
- Adicionar um `Select` (dropdown de IES) acima do input de arquivo
- O botao "Processar Arquivo" so fica habilitado se `batchIesId` E `csvFile` estiverem preenchidos

### 2. Processamento do CSV -- remover exigencia de `id_ies`
- Remover `id_ies` da lista `requiredColumns` (passa a ser apenas `nome`, `email`, `semestre`)
- No loop de processamento, usar `batchIesId` no lugar de `user.id_ies` ao chamar `b2b-create-user`
- Se o CSV ainda contiver uma coluna `id_ies`, ela sera ignorada (o valor do dropdown prevalece)

### 3. Template de exemplo (XLSX) -- simplificar
- Remover coluna `id_ies` da aba "Usuarios" (fica: `nome`, `email`, `semestre`)
- Remover a aba "IES (Referencia)" (nao e mais necessaria, pois a IES e selecionada na UI)
- Ajustar larguras de coluna

### 4. Validacao
- Validacao de linha: exigir apenas `nome`, `email`, `semestre`
- Validacao pre-processamento: exigir `batchIesId` selecionado

## Arquivo afetado
`src/components/admin/UsersTab.tsx` -- unico arquivo modificado

## Resumo da UX final
1. Admin seleciona a IES no dropdown
2. Admin faz upload do CSV/XLSX (apenas nome, email, semestre)
3. Clica em "Processar Arquivo"
4. Todos os usuarios sao cadastrados na IES selecionada
