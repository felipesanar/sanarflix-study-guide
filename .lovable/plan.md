

# Correção: Edição de usuários não reflete na plataforma

## Problema Identificado

A edição de usuários pelo admin **funciona corretamente no banco de dados** (confirmado: Jéssica já está com IES "Claretiano" no banco). O problema é que **o frontend nunca atualiza os dados do usuário após o login**.

O fluxo atual:
1. Usuário faz login --> dados são salvos em `localStorage` como `sanarflix-user`
2. Em todas as sessões subsequentes, o app carrega os dados do `localStorage` sem nunca consultar o banco novamente
3. Admin edita semestre/IES --> banco atualiza corretamente
4. Usuário abre o app --> carrega dados antigos do `localStorage`
5. Resultado: mudanças feitas pelo admin nunca aparecem para o usuário

## Solucao

Adicionar uma rotina de **refresh do perfil** no `AuthContext` que busca dados frescos do banco (`public.users`) toda vez que o app inicializa ou ganha foco, atualizando o estado e o cache local.

## Detalhes Tecnicos

### 1. Criar funcao `refreshUserProfile` no AuthContext (`src/contexts/AuthContext.tsx`)

Nova funcao que:
- Busca dados atualizados de `public.users` (com JOIN na tabela `ies` para o `ies_nome`)
- Busca roles atualizadas via `get_user_roles`
- Atualiza o state `user` e o `localStorage`

Essa funcao sera chamada:
- Na inicializacao do app (apos restaurar do localStorage)
- Quando a janela ganha foco (`window.addEventListener('focus', ...)`)

```text
Fluxo corrigido:
1. App inicializa --> restaura user do localStorage (instantaneo)
2. Em paralelo, chama refreshUserProfile()
3. refreshUserProfile busca dados frescos do banco
4. Atualiza state + localStorage com dados novos
5. Resultado: mudancas do admin refletem automaticamente
```

### 2. Mudancas especificas no AuthContext

- Extrair a logica de refresh para uma funcao reutilizavel `refreshUserProfile(userId: string)`
- Chamar essa funcao no `useEffect` de inicializacao (substituindo o refresh parcial de roles que ja existe)
- Adicionar listener de `visibilitychange`/`focus` para re-buscar quando o usuario volta ao app
- Debounce de ~30 segundos para nao fazer queries excessivas

### 3. Nenhuma mudanca na Edge Function

A Edge Function `b2b-create-user` ja atualiza corretamente o banco. O problema e exclusivamente no frontend.

### Resumo

| Arquivo | Mudanca |
|---|---|
| `src/contexts/AuthContext.tsx` | Adicionar `refreshUserProfile()` que busca dados frescos de `public.users` + `ies` + roles na inicializacao e ao ganhar foco |

