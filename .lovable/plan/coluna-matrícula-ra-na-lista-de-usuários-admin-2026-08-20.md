# Coluna "Matrícula/RA" na lista de usuários (Admin)

Adicionar uma sexta coluna na tabela de usuários do Portal do Admin, entre "IES" e "SEM.", exibindo o campo `matricula_ra` já existente em `public.users`, editável pelo mesmo fluxo do lápis.

## Comportamento

- Leitura: mostra o RA em fonte mono; quando o valor é `null`/vazio, exibe "Em branco" em cinza (estilo atenuado), para o admin identificar o que falta preencher.
- Edição: ao clicar no lápis, a célula vira um input de texto ao lado dos campos de nome/IES/semestre já editáveis. Salvar (check verde) grava o valor no banco e a lista recarrega.
- Campo opcional: deixar em branco limpa o RA (grava `null`). Valor é normalizado (trim) e limitado a 50 caracteres.
- Atendimento (CX) também pode editar, seguindo a mesma capability `users.edit` usada hoje pelos outros campos.

## Detalhes técnicos

Backend (necessário): o admin **não** tem policy de UPDATE em `public.users` (só o próprio usuário e a role `atendimento`), então as edições da lista já passam pela edge function `b2b-create-user`. Vou estender essa função:

- Adicionar `matricula_ra` (string opcional/nullable, máx. 50) ao schema Zod.
- Semântica de "ausente = não alterar" (mesma convenção já usada para `semestre`): só entra no `updatePayload` / no insert quando a chave vem no corpo. String vazia grava `null`.
- Incluir `matricula_ra` em `fields_updated` do log de auditoria quando mudar.
- Redeploy da função (automático).

Frontend (`src/components/admin/UsersListTable.tsx`):

- Incluir `matricula_ra` no `select` de `fetchUsers` e no tipo `UserRow`.
- Adicionar `matricula_ra: string` ao `EditingState`, preenchido em `startEditing` e limpo em `cancelEditing`.
- Novo `<TableHead>` "Matrícula/RA" e nova `<TableCell>` posicionados entre IES e Sem.
- `saveEditing` envia `matricula_ra` no corpo do invoke de `b2b-create-user`.

Nada muda no schema do banco (a coluna já existe) e nenhuma migration é necessária.
