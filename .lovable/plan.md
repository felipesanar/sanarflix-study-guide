

# Plano: Correção de Leitura de Roles via user_roles

## Problemas Identificados

1. **UsersListTable exibe "Aluno" hardcoded** (linha 1103): qualquer usuário não-admin mostra badge "Aluno", ignorando roles como `gestor` e `atendimento` que já estão carregados no array `user.roles`.

2. **RPCs do Supabase não incluem `gestor`**: as funções `get_institutional_simulados`, `get_institutional_performance`, `get_institutional_student_scores`, `get_institutional_evolution` e `get_institutional_question_details` verificam apenas `admin`, `professor` e `b2b_partner`. Gestores com acesso na sidebar receberão erro "Access denied" ao tentar carregar dados.

3. **AuthContext já carrega roles corretamente** via `get_user_roles` RPC — não precisa de alteração estrutural, apenas um log de debug.

## Alterações

### 1. `src/components/admin/UsersListTable.tsx` — Exibir role real

Substituir o bloco hardcoded (linhas 1096-1104):

```tsx
// Antes
{isAdmin ? (
  <Badge variant="default" className="bg-primary">
    <Shield className="h-3 w-3 mr-1" />Admin
  </Badge>
) : (
  <Badge variant="secondary">Aluno</Badge>
)}

// Depois — mapear todas as roles do array user.roles
```

Criar um mapa de labels:
```
admin → Admin (com ícone Shield, badge primary)
professor → Professor
gestor → Gestor
atendimento → Atendimento
b2b_partner → Parceiro B2B
(sem roles) → Aluno (fallback)
```

### 2. Migration SQL — Adicionar `gestor` às RPCs institucionais

Atualizar 5 RPCs para incluir `has_role(v_user_id, 'gestor')` na verificação de acesso:
- `get_institutional_simulados`
- `get_institutional_performance`
- `get_institutional_student_scores`
- `get_institutional_evolution`
- `get_institutional_question_details`

O gestor usará a IES do próprio perfil (mesmo comportamento de professor).

### 3. `src/contexts/AuthContext.tsx` — Log de debug

Adicionar `console.log('[Auth] role from DB:', roles)` após carregamento de roles no `refreshUserProfile` e no `login`.

## Detalhes técnicos

- O `accessRules.ts` e `AppSidebar.tsx` já estão corretos — gestor tem `desempenhoInstitucional: true` e atendimento tem `userManagement: true`
- O `UserManagement.tsx` já restringe atendimento à aba Usuários
- A única lacuna real está na **exibição** (badge hardcoded) e no **backend** (RPCs sem gestor)

