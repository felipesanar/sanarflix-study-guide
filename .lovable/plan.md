
## Objetivo

1. Os 5 usuários listados ficam apenas com role `atendimento` (Guilherme, Ketlyn, Rita, Samuel perdem `admin`; Glenda já está OK).
2. Habilitar Atendimento (CX) a **criar** e **editar** usuários não-admin no painel `/atendimento/usuarios`. Ações críticas (promover/rebaixar admin, excluir, trocar e-mail em massa, edição de roles) continuam exclusivas do admin.

## Mudanças

### 1. Banco — dados (`insert` tool, DELETE)
Remover o role `admin` dos 4 usuários (mantendo `atendimento`):
- `gdguilherme968@gmail.com`
- `ketlynivanoski@gmail.com`
- `ritaolivmoura@gmail.com`
- `samuel.laila2904@gmail.com`

### 2. Banco — capability (migration)
Nova capability `users.edit` (criar + editar campos básicos: nome/IES/semestre). Adicionar na RPC `public.get_access()`:
- `admin` recebe `users.edit` (já tem `users.manage`, é aditivo).
- `atendimento` recebe `users.edit` além de `users.support` e `feedbacks.support`.

`users.manage` continua sendo exclusivo do admin — cobre roles, exclusão, promover admin, troca de e-mail em massa.

### 3. Frontend — modelo de acesso
`src/experiences/access.ts`:
- Adicionar `'users.edit'` no union `Capability`.
- Incluir `'users.edit'` em `ADMIN_CAPABILITIES` e `ATENDIMENTO_CAPABILITIES`.

### 4. Frontend — `UsuariosPage`
- Derivar `canEdit = can(access, 'users.edit')`.
- Renderizar os botões **"Novo usuário"** e **"Cadastro em lote"** quando `canEdit` (hoje só se `canManage`).
- Card final ("Trocar e-mail em massa") e `BulkEmailUpdateTab` permanecem gated por `canManage`.
- Passar `canEdit` para `UsersListTable`.

### 5. Frontend — `UsersListTable`
Nova prop `canEdit: boolean`. Semântica:
- Ícone lápis (editar linha): visível se `canEdit`.
- No modo edição: quando `!canManage`, esconder a coluna de checkboxes de roles (Atendimento edita só nome/IES/semestre).
- Menu de ações — para atendimento (sem `canManage`) manter apenas: **Reenviar Convite**, **Copiar link de primeiro acesso**, **Copiar link de redefinição**, **Sincronizar Auth**. Ocultar Promover/Remover Admin e Remover Usuário.
- Checkbox de seleção em massa, barra de bulk (excluir/trocar e-mail em massa), DangerZone de delete: continuam gated por `canManage`.

### 6. Frontend — `CreateUserDialog`
- Quando o caller não tem `users.manage` (ou seja, Atendimento): remover as opções `Admin` do select de role (também remover `Gestor`, `Gestor de Grupo`, `Professor` por segurança — Atendimento cria só `aluno` ou `atendimento`), e travar o campo em `aluno` quando o role select estiver oculto.
- `BulkCreateUsersDialog`: verificar se aceita role no CSV; se aceitar, restringir para Atendimento no client (e a edge rejeita `admin` no servidor mesmo assim).

### 7. Edge Function — `b2b-create-user`
Hoje exige role `admin` (linha 358–376). Passar a aceitar também `atendimento`:
- Verificar `has_role(caller, 'admin')` OU `has_role(caller, 'atendimento')`.
- Se caller é `atendimento` (e não admin): rejeitar (`FORBIDDEN`) quando `body.role === 'admin'` ou `id_ies === B2B_IES_ID` (essa IES concede admin implicitamente).
- Manter rate limit e audit log; registrar `caller_role` no audit para rastreabilidade.

Demais edge functions administrativas (`delete-user`, `sync-user-auth`, `generate-user-link`, `bulk-email-update`) continuam admin-only — mas Atendimento **precisa** invocar `sync-user-auth` e `generate-user-link` para os itens de menu descritos em §5. Alternativas:
- Permitir `atendimento` nessas duas funções também (rejeitando quando o alvo tem role `admin`). Recomendado — mantém a UX útil pro CX sem expor exclusão nem troca de e-mail em massa.

## Detalhes técnicos

- SQL da limpeza de roles (via `insert` tool):
  ```sql
  DELETE FROM public.user_roles
  WHERE role = 'admin'
    AND user_id IN (
      SELECT id FROM public.users
      WHERE lower(email) IN (
        'gdguilherme968@gmail.com','ketlynivanoski@gmail.com',
        'ritaolivmoura@gmail.com','samuel.laila2904@gmail.com'
      )
    );
  ```
- Migration em `get_access()`: substituir o bloco de capabilities do `admin` e do `atendimento` acrescentando `'users.edit'`.
- Depois de aplicar, os 4 usuários precisam relogar para o novo `get_access` refletir no cliente (o AuthContext refaz a chamada no boot; um refresh basta).

## Fora de escopo

- Não altero RLS de `public.user_roles` — Atendimento não vai editar roles pelo frontend.
- Não mexo em `delete-user` nem no fluxo de exclusão (continua admin-only, como pedido: "criar novos usuários... e editar também").
- Não mudo o portal do `/admin` — Atendimento não entra nele; usa `/atendimento/usuarios`.
