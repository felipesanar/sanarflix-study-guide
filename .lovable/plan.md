# Remoção definitiva dos roles depreciados do enum `app_role`

## Contexto

A migration anterior adicionou um `CHECK constraint` que impede inserir os 4 roles depreciados, mas os valores continuam **existindo no tipo enum** `app_role`. Por isso o Supabase Studio ainda lista `user`, `moderator`, `b2b_partner` e `gestor_formal` no dropdown — o Studio lê os valores diretamente do `pg_enum`.

Postgres **não permite remover valores individuais** de um enum. A única forma é recriar o tipo.

## Verificações já feitas

- Única coluna que usa `app_role` no banco: `public.user_roles.role`.
- Nenhuma linha em `user_roles` usa um dos roles depreciados (apenas `admin`, `professor`, `gestor`, `gestor_grupo`, `atendimento`).
- Nenhuma function ou RLS policy referencia literais como `'b2b_partner'::app_role`, `'gestor_formal'::app_role`, `'moderator'::app_role` ou `'user'::app_role` (já limpos na migration anterior).
- Coluna `role` não tem `DEFAULT`.

Portanto a recriação é segura e não quebra nada.

## Plano (uma migration)

1. Remover o `CHECK constraint` `user_roles_role_not_deprecated` (vira redundante).
2. Criar enum novo `app_role_new` com apenas: `admin`, `professor`, `gestor`, `gestor_grupo`, `atendimento`, `aluno`.
   - Inclui `aluno` se ele já existir no enum atual (vou confirmar antes de gerar o SQL final — `aluno` está em uso pelo front em `UserRole`).
3. `ALTER TABLE public.user_roles ALTER COLUMN role TYPE public.app_role_new USING role::text::public.app_role_new`.
4. `DROP TYPE public.app_role`.
5. `ALTER TYPE public.app_role_new RENAME TO app_role`.

Tudo aditivo em relação aos dados: nenhuma linha existente é deletada nem modificada (respeita a regra de migrations puramente aditivas).

## Resultado esperado

Após executar, o dropdown do Supabase Studio em `user_roles.role` mostrará apenas os 5 (ou 6, incluindo `aluno`) roles válidos. Front-end e back-end já estão alinhados.

## Pergunta antes de gerar o SQL

Preciso confirmar 1 ponto: o enum `app_role` atual também tem o valor `aluno`? Se sim, preservo ele no novo enum. Vou verificar isso antes de submeter a migration — só queria seu OK no plano geral primeiro.
