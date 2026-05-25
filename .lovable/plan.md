## Diagnóstico

### 1. Configuração no backend — está correta ✅ (com 1 ressalva)

Consultas confirmam:

| Item | Valor |
|---|---|
| `users.id` | `48436225-55a2-494b-8d69-645cf9fcef39` |
| `users.email` | `joaonader@ufba.br` / `nome`: João Vitor Nader Silva |
| `users.id_ies` | `9baa1401-bf54-4451-b96c-49e4823564fb` (**PASSOS**) |
| `users.semestre` | `1` |
| `user_roles` | `gestor_grupo` ✔ (granted em 2026-05-25) |
| `user_groups` | vinculado ao grupo `UNIATENAS` (`6d761931-…`) |
| `group_ies` (UNIATENAS) | PARACATU, PASSOS, PORTO SEGURO, SETE LAGOAS, SORRISO, VALENÇA ✔ |
| `app_role` enum | inclui `gestor_grupo` ✔ |
| RPC `get_user_roles` | `SECURITY DEFINER`, retorna `gestor_grupo` quando consultado direto no banco ✔ |

**Ressalva (config "suja"):** o usuário foi criado preenchendo `id_ies = PASSOS` e `semestre = 1`. Para um gestor_grupo puro, esses campos deveriam ser `NULL` (ou usar uma IES "âncora" do grupo). Tê-los preenchidos faz a UI tratá-lo como aluno: o `useIesFeatures` carrega features da IES PASSOS, que são justamente as três opções vistas no print (Início, Simulados, Caderno de Erros). Isso é cosmético — não deveria esconder "Desempenho Institucional".

### 2. Por que "Desempenho Institucional" não aparece

A lógica de visibilidade (`src/utils/accessRules.ts` → `getAccessRules`) já trata `gestor_grupo`:

```ts
isGestor(user) // true para gestor | gestor_formal | gestor_grupo
// retorna { ...DEFAULT_RULES, desempenhoInstitucional: true }
```

E `useAccessRules.ts` faz o curto-circuito correto:

```ts
if (isAdmin || isProfessor || isGestor(user) || isAtendimento) return baseRules;
```

Logo, **se o front realmente recebesse `roles = ['gestor_grupo']`, o item apareceria.** Como ele NÃO aparece e o sidebar mostra exatamente o conjunto de features da IES PASSOS, a conclusão é:

> No runtime, `user.roles` está chegando **vazio** (ou sem `gestor_grupo`) — então a `useAccessRules` cai no ramo "Aluno B2B" e usa só `ies_features`.

Causas prováveis, em ordem de probabilidade:

**a) Cache de localStorage anterior à atribuição da role.** O usuário foi criado/logado antes da role `gestor_grupo` ser inserida em `user_roles`. O `AuthContext` inicializa o estado a partir de `localStorage.sanarflix-user` (linhas 121-141 e 153-165), e o `refreshUserProfile` é throttled (5s) — se a sessão já estava ativa, o cache antigo prevalece até o próximo login limpo.

**b) `refreshUserProfile` chamando `get_user_roles` pelo client anon.** O RPC é `SECURITY DEFINER` e está acessível, então retorna a role. Mas se por algum motivo o `EXECUTE` para `authenticated` não estiver concedido, `rolesResult.data` viria `null` → `roles = []`. Vale validar.

**c) O `auth-login` (edge function) retorna `roles: userRoles` corretamente — mas se houve qualquer falha não-fatal no RPC dentro dele (`rolesError`), o array volta vazio sem erro visível ao cliente.

### 3. Como confirmar a causa raiz (próximos passos sugeridos)

1. Pedir ao usuário João Vitor para **deslogar completamente**, limpar `localStorage` da aba, e logar de novo. Em seguida, abrir o console e procurar os logs:
   - `[Auth] role from DB:` (deve aparecer `['gestor_grupo']`)
   - `[Auth] Accessible colleges:` (deve listar as 6 IES do UNIATENAS)
2. Se mesmo após login limpo `role from DB:` vier `[]`, é problema de permissão/RLS do RPC chamado pelo cliente — corrigir com `GRANT EXECUTE ON FUNCTION public.get_user_roles(uuid) TO authenticated;`
3. Se vier preenchido mas o item continuar oculto, o problema é de cache/throttle do `useAccessRules` ou ordem de hidratação — investigar `useIesFeatures` que pode estar sobrescrevendo `desempenhoInstitucional` para `false` antes do `isGestor` ser avaliado.

### 4. Correções de configuração recomendadas (independente da causa)

- Normalizar o cadastro de gestor_grupo no `b2b-create-user`: quando `role === 'gestor_grupo'`, **não** exigir/gravar `id_ies` nem `semestre` (ou gravá-los como `NULL`). Caso contrário a sidebar herda features de IES de aluno e fica visualmente inconsistente.
- Forçar `refreshUserProfile` a ignorar o throttle quando `roles` no estado vier vazio — evita que o cache antigo persista após uma promoção de role.

## Critérios de Sucesso

- [x] Identificada a causa provável (cache stale de `roles` + cadastro com `id_ies`/`semestre` de aluno).
- [x] Backend (roles, grupos, IES, RPC) verificado e validado como correto.
- [x] Apontada a ressalva de configuração (`id_ies`/`semestre` preenchidos em um gestor_grupo).
- [x] Plano de verificação claro (logout/login limpo + checar logs `[Auth] role from DB:`).

Nenhuma alteração de código foi feita — apenas análise, como solicitado.