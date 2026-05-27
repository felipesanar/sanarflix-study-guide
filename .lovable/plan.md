## Objetivo

Permitir que o admin edite o **papel** de um usuário diretamente no modo de edição inline da "Lista de Usuários" (Portal do Admin), com um menu suspenso ao lado dos campos Nome / IES / Semestre.

## Onde mexer

Tudo no componente já existente: `src/components/admin/UsersListTable.tsx`. Sem mudanças de schema (o enum `app_role` já contém todos os papéis necessários, e a policy "Admins can manage all user roles" já permite ao admin inserir/deletar em `user_roles`).

## Mudanças

### 1. Estado de edição
Adicionar `role` ao `EditingState`:

```ts
interface EditingState {
  userId: string | null;
  nome: string;
  id_ies: string;
  semestre: string;
  role: string; // '' = aluno (sem papel privilegiado)
}
```

`startEditing` passa a derivar o papel atual a partir de `user.roles` (pega o primeiro papel "editável" encontrado; se nenhum, vira `''` = Aluno).

### 2. Lista de papéis editáveis

Constante no topo do componente:

```ts
const EDITABLE_ROLES = [
  { value: '',              label: 'Aluno' },
  { value: 'admin',         label: 'Admin' },
  { value: 'professor',     label: 'Professor' },
  { value: 'gestor',        label: 'Gestor' },
  { value: 'gestor_formal', label: 'Gestor Formal' },
  { value: 'gestor_grupo',  label: 'Gestor de Grupo' },
  { value: 'atendimento',   label: 'Atendimento' },
  { value: 'b2b_partner',   label: 'Parceiro B2B' },
  { value: 'moderator',     label: 'Moderador' },
];
```

(Cobre todo o enum `app_role` exceto `user`, que não é usado pelo app.)

### 3. UI — célula "Papel" no modo edição

Hoje (linhas 1097-1121) a célula só renderiza badges. Quando `isEditing` for true, mostrar um `<Select>` (shadcn) com as opções acima, em vez dos badges:

```text
[ Select: Gestor de Grupo ▾ ]
```

Quando não estiver editando, mantém os badges como hoje.

### 4. Persistência — `saveEditing`

Hoje a função só chama `b2b-create-user` (nome/IES/semestre). Adicionar, **depois** desse sucesso e **somente se o papel mudou** em relação ao atual:

1. `DELETE FROM user_roles WHERE user_id = X AND role IN (<EDITABLE_ROLES menos ''>)`
   — garante mutua exclusão e elimina o problema dos papéis duplicados (gestor + gestor_grupo) descrito na memória do projeto.
2. Se `editing.role !== ''`: `INSERT INTO user_roles (user_id, role) VALUES (X, editing.role)`.

Tudo via `supabase.from('user_roles')` no client (admin já tem permissão pela policy existente).

Toast de sucesso continua único ("Usuário atualizado com sucesso"); em caso de erro só nas roles, mostrar mensagem específica e ainda assim chamar `fetchUsers()` para refletir o estado real.

### 5. Pequenos ajustes

- `cancelEditing` zera também `role`.
- Não mexer no menu de 3 pontos nem em `toggleAdminRole` (mantém atalho rápido "Promover/Remover Admin").

## Fora de escopo

- Mudar políticas RLS, enum `app_role` ou edge functions.
- Edição em massa de papéis.
- Edição de papel na criação de usuário (formulário "Criar Usuário Individual") — só na linha existente, conforme pedido.
