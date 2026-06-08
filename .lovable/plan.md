# Correção: exclusão de usuários no Portal do Admin

## Causa raiz

O toast "Edge Function returned a non-2xx status code" vem da edge function `delete-user`, que está retornando 500 ao tentar excluir a usuária Amanda (e qualquer outro aluno com histórico de simulado).

Investigação:

1. Os logs mostram a função iniciando (`removing user 4c1bd745-...`) mas nunca logando sucesso.
2. A função apaga manualmente todas as tabelas dependentes antes de deletar `public.users` e em seguida `auth.users`.
3. A tabela `resultados_alunos_tri` tem FK `student_id → public.users(id)` **sem `ON DELETE CASCADE`** e **não está na lista `DEPENDENT_TABLES`** do arquivo `supabase/functions/delete-user/index.ts`.
4. A Amanda possui 1 linha em `resultados_alunos_tri`, então o `DELETE FROM public.users` falha com violação de FK e a função retorna erro 500.

Nenhuma outra FK órfã foi encontrada para alunos comuns — apenas `announcements.created_by` e `simulados_admin.created_by` apontam para `auth.users` sem cascade, mas afetam só admins (que já são bloqueados de auto-delete).

## Correção

**Único arquivo a editar:** `supabase/functions/delete-user/index.ts`

Adicionar `resultados_alunos_tri` (chave `student_id`) à constante `DEPENDENT_TABLES`, antes da deleção de `users`:

```ts
{ table: 'resultados_alunos_tri', filters: ['student_id'] },
```

Isso replica o padrão já usado para as demais tabelas e elimina a violação de FK.

## Validação

1. Após o deploy automático, tentar excluir novamente a Amanda (`4c1bd745-f6e0-4b7f-832e-70e1c8a1c97f`) no Portal do Admin.
2. Conferir o log da função: deve aparecer `User ... removed successfully` e o toast de sucesso na UI.
3. Conferir via SQL que não restam linhas em `users`, `user_roles`, `resultados_alunos_tri` e `auth.users` para esse id.

## Fora de escopo

- Não vou alterar as FKs do banco para `ON DELETE CASCADE` neste passo (mantém migrações puramente aditivas e evita efeito colateral em outras integrações). Caso queira, posso abrir um plano separado para adicionar cascades onde fizer sentido.
- Nenhuma alteração de UI, de policies RLS ou do enum `app_role`.
