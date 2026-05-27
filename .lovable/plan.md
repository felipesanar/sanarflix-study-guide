## Causa raiz

A edge function `b2b-create-user` está retornando 401, e os logs mostram:

```
[Auth] Failed to verify token: AuthSessionMissingError: Auth session missing!
  at SupabaseAuthClient._getUser
  at index.ts:309 → supabaseAdmin.auth.getUser(token)
```

Em `supabase-js@2.106`, `client.auth.getUser(jwt)` é encaminhado internamente por `_useSession`. Quando o client foi criado com `persistSession: false` (o caso do `supabaseAdmin` na function), não existe sessão local — e `_useSession` lança `AuthSessionMissingError` antes mesmo de validar o JWT que foi passado como argumento. Resultado: 401 em toda invocação, mesmo com Authorization válido.

Isso explica por que:
- o front-end já está mandando os campos corretos;
- a UI da edição existe e o botão verde dispara `supabase.functions.invoke('b2b-create-user', ...)`;
- o request chega na function (passa Origin, rate limit, header check) mas falha no `getUser`.

## Correção

Mudança cirúrgica apenas em `supabase/functions/b2b-create-user/index.ts`, na seção de verificação do chamador (linhas ~296–319):

Trocar `supabaseAdmin.auth.getUser(token)` pelo padrão canônico que funciona em todas as versões de `supabase-js`: criar um client efêmero com o anon key e o header `Authorization` do chamador, e chamar `auth.getUser()` sem argumentos.

```ts
const supabaseCaller = createClient(supabaseUrl, anonKey, {
  global: { headers: { Authorization: authHeader } },
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
const { data: { user: callerUser }, error: authErr } = await supabaseCaller.auth.getUser();
```

O resto da function (verificação de admin via RPC `has_role`, validação Zod, fluxo de UPDATE/CREATE, geração de link, e-mail Novu) permanece intacto. `supabaseAdmin` continua sendo usado para todas as operações privilegiadas subsequentes.

## Verificação após o fix

1. Refazer a edição de papel no Portal do Admin → toast de sucesso, sem 401.
2. Conferir nos logs da edge function que não há mais `AuthSessionMissingError`.
3. Confirmar via Supabase que a linha em `user_roles` foi inserida/removida conforme a seleção.

## Fora do escopo

- Não mexer no front-end (já está correto).
- Não alterar RLS de `user_roles` (admin já tem permissão e o `toggleAdminRole` existente, que faz exatamente o mesmo `delete`/`insert` no client, funciona — o problema é só na edge function).
- Não tocar nas outras edge functions agora, mesmo que algumas possam ter o mesmo padrão; cuidamos disso só se o usuário reportar.