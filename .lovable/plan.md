## Objetivo
Adicionar um campo "Role" (menu suspenso) na seção **Criar Usuário Individual** do Portal do Admin (`/gestao-usuarios`), permitindo definir o papel do novo usuário no momento da criação. O default é **Aluno** (nenhuma linha em `user_roles`).

## Mudanças

### 1. Frontend — `src/components/admin/UsersTab.tsx`
- Acrescentar `role: 'aluno'` no estado `singleUser` (linha 32) e no reset (linha 127).
- Adicionar um novo `<Select>` ao lado de "Semestre" (mesmo padrão visual do select de Instituição), com as opções vindas do enum `app_role`:
  - **Aluno** (valor `aluno`, default — não cria linha em `user_roles`)
  - **Admin** (`admin`)
  - **Professor** (`professor`)
  - **Gestor** (`gestor`)
  - **Gestor Formal** (`gestor_formal`)
  - **B2B Partner** (`b2b_partner`)
  - **Atendimento** (`atendimento`)
  - **Moderator** (`moderator`)
  - **User** (`user`)
- No `handleSingleCreate`, enviar `role` no body do invoke `b2b-create-user` apenas quando diferente de `aluno`.
- Layout: o grid atual é 2 colunas (Nome/Email, IES/Semestre). Vamos passar IES/Semestre/Role para 3 colunas em telas md+ (mantém responsivo) — apenas no segundo bloco. Sem alteração no fluxo de upload em massa.

### 2. Edge Function — `supabase/functions/b2b-create-user/index.ts`
- Estender o `createUserSchema` com `role: z.enum([...app_roles]).optional()`.
- Após criar/atualizar o usuário com sucesso, se `role` foi enviado e é diferente de `aluno`:
  - Fazer `supabaseAdmin.from('user_roles').insert({ user_id, role })` com `onConflict: 'user_id,role'` (ignore duplicates).
  - Logar erro mas não falhar a criação do usuário (o usuário base já está criado).
- Se `role` ausente ou `aluno`: comportamento atual inalterado (não insere em `user_roles`).

### 3. Sem migração de banco
A tabela `user_roles` e o enum `app_role` já existem com as roles necessárias. Não há mudanças de schema.

## Comportamento esperado
- Default (Aluno): idêntico ao atual — nenhuma linha em `user_roles`, dashboards continuam contando o usuário como aluno.
- Outras roles: linha inserida em `user_roles` automaticamente; usuário passa a ter os acessos correspondentes (regras já existentes em `accessRules.ts` e RLS).
- Importação em massa (CSV): **sem alteração** nesta entrega — todos continuam como aluno.