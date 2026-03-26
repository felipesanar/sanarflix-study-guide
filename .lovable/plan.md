

# Plano: Dar acesso completo ao role "atendimento" na lista de usuários

## Problema

A tabela `public.users` possui RLS (Row Level Security) que permite SELECT apenas para:
- O próprio usuário (`auth.uid() = id`)
- Admins (`has_role(auth.uid(), 'admin')`)
- Professores (mesma IES)

O role `atendimento` não está incluído em nenhuma dessas policies, então só consegue ver seu próprio cadastro.

## Solução

Uma única migration SQL que adiciona duas policies:

### 1. SELECT — Atendimento pode ver todos os usuários
```sql
CREATE POLICY "Atendimento can view all users"
ON public.users
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'atendimento'));
```

### 2. UPDATE — Atendimento pode editar todos os usuários
```sql
CREATE POLICY "Atendimento can update all users"
ON public.users
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'atendimento'))
WITH CHECK (public.has_role(auth.uid(), 'atendimento'));
```

Isso permite que o atendimento:
- Visualize todos os usuários cadastrados
- Edite dados de qualquer usuário (nome, semestre, IES)
- A criação e exclusão de usuários já funcionam via Edge Functions com `service_role`, então não precisam de policy adicional

## Nenhuma alteração no front-end

O front-end já está preparado — o `UsersListTable` faz queries diretas na tabela `users`. Assim que a RLS permitir acesso, os dados aparecerão automaticamente.

## Detalhes técnicos

- Usa a função `has_role` (SECURITY DEFINER) já existente, evitando recursão de RLS
- Não altera nenhuma policy existente — apenas adiciona novas
- Não modifica a tabela `users` nem a tabela `user_roles`

