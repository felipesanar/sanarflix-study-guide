# Status atual do usuário `1c95aa8d-8bea-4b40-86a2-2f06814d5b12`

**Lucélia Malescha** — `lucelia.malescha@uniatenas.edu.br`
- `users.id_ies` = PARACATU (`d86c32ba-…`)
- `users.semestre` = 1
- `user_roles.role` = `gestor_grupo` ✅ (já alterado manualmente)
- `user_groups` = **VAZIO** ❌

## Problema

A role `gestor_grupo` por si só não dá acesso multi-IES. As RLS policies (`simulados_admin`, `answer_progress`, `resultados_ies_tri`, `questoes_simulado`, `simulados_finalizados`, etc.) e o front (`useInstitutionalPerformanceData` via `accessible_ies`) chamam a função `get_accessible_ies(user)`, que faz `UNION` entre:

1. `users.id_ies` do próprio usuário
2. `group_ies.ies_id` de todos os grupos em que o usuário está via `user_groups`

Como a Lucélia **não tem linha em `user_groups`**, hoje ela enxerga apenas PARACATU — e não as 6 IES do grupo UNIATENAS (PARACATU, PASSOS, PORTO SEGURO, SETE LAGOAS, SORRISO, VALENÇA). Funciona, mas como se fosse `gestor` simples.

## Plano de correção para esta usuária

Inserir o vínculo dela ao grupo UNIATENAS (`6d761931-88b1-4909-bd59-220809892cd0`):

```sql
INSERT INTO public.user_groups (user_id, group_id)
VALUES ('1c95aa8d-8bea-4b40-86a2-2f06814d5b12',
        '6d761931-88b1-4909-bd59-220809892cd0')
ON CONFLICT DO NOTHING;
```

Após isso, pedir para ela deslogar/relogar (o `accessible_ies` é resolvido no `AuthContext` no login). Validação: ela deve ver o seletor de IES no Desempenho Institucional listando as 6 IES do grupo.

## Checklist completo — promover um usuário existente a `gestor_grupo`

Para qualquer usuário pré-existente que precise virar gestor de grupo, alterar manualmente nestas tabelas (nesta ordem):

1. **`public.user_roles`** — trocar a role antiga (`aluno`/`gestor`/`gestor_formal`) por `gestor_grupo`.
   - Se houver linhas antigas conflitantes (ex.: `aluno`), removê-las para evitar acúmulo de papéis.
2. **`public.educational_groups`** — garantir que o grupo existe (criar com `name` + `slug` se necessário).
3. **`public.group_ies`** — garantir que todas as IES do grupo estão vinculadas (`group_id`, `ies_id`). Sem isso o grupo fica "vazio" mesmo com o vínculo do usuário.
4. **`public.user_groups`** — inserir `(user_id, group_id)`. **Esta é a etapa esquecida com mais frequência** e foi exatamente o que faltou no caso da Lucélia.
5. **`public.users`** (opcional, mas recomendado):
   - `id_ies`: pode ficar com uma IES "âncora" do grupo (é usada como fallback e seleção default no dashboard).
   - `semestre`: irrelevante para gestor, mas evite `NULL` para não disparar o `SemesterPromptBanner`.
6. **Sessão do usuário** — após qualquer alteração nessas tabelas, o usuário precisa **deslogar e logar de novo** (ou um refresh forçado), porque `roles` e `accessible_ies` são carregados uma vez no `AuthContext` e cacheados na sessão.

### Validação rápida (SQL)

```sql
SELECT u.email,
       ur.role,
       (SELECT array_agg(eg.name)
          FROM user_groups ug
          JOIN educational_groups eg ON eg.id = ug.group_id
         WHERE ug.user_id = u.id) AS grupos,
       public.get_accessible_ies(u.id) AS ies_acessiveis
  FROM users u
  LEFT JOIN user_roles ur ON ur.user_id = u.id
 WHERE u.id = '<uuid>';
```

`ies_acessiveis` deve retornar o array completo das IES do grupo. Se vier só 1 UUID, faltou o passo 4.

## Detalhes técnicos

- Função-chave: `public.get_accessible_ies(_user uuid)` — `SECURITY DEFINER`, usada por todas as RLS policies de `gestor_grupo` e pelo front via `authService.getAccessibleIes`.
- Front: `src/contexts/AuthContext.tsx` popula `user.accessible_ies`; `useInstitutionalPerformanceData` decide o filtro de IES com base em `isGestorGrupo(user) && accessibleIes`.
- Nenhuma migration de schema é necessária — todas as estruturas já existem. Apenas DML (`INSERT`) na tabela `user_groups`.
