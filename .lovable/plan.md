

# Plano: Corrigir CORS para o dominio academy.sanar.com.br

## Problema

Apos a mudanca da URL live para `https://academy.sanar.com.br/`, nenhum usuario consegue fazer login. O navegador bloqueia a requisicao para a Edge Function `auth-login` porque o dominio `academy.sanar.com.br` nao esta na lista de origens CORS permitidas.

## Causa raiz

Existem **3 arquivos** com listas de origens permitidas, e nenhum inclui `https://academy.sanar.com.br`:

1. `supabase/functions/_shared/cors.ts` — configuracao compartilhada (usada por varias funcoes)
2. `supabase/functions/auth-login/index.ts` — CORS inline (funcao de login)
3. `supabase/functions/update-password/index.ts` — CORS inline (funcao de troca de senha)

## Correcoes

### 1. `supabase/functions/_shared/cors.ts`

Adicionar `'https://academy.sanar.com.br'` ao Set `ALLOWED_ORIGINS`.

### 2. `supabase/functions/auth-login/index.ts`

Adicionar `origin === 'https://academy.sanar.com.br'` a funcao `isAllowedOrigin` inline.

### 3. `supabase/functions/update-password/index.ts`

Adicionar `origin === 'https://academy.sanar.com.br'` a funcao `isAllowedOrigin` inline.

---

## Secao Tecnica

Cada arquivo recebe apenas **1 linha adicional**:

**`_shared/cors.ts`** — adicionar na linha 7 do Set:
```
'https://academy.sanar.com.br',
```

**`auth-login/index.ts`** — adicionar na condicao (apos linha 11):
```
origin === 'https://academy.sanar.com.br' ||
```

**`update-password/index.ts`** — adicionar na condicao (apos linha 23):
```
origin === 'https://academy.sanar.com.br' ||
```

Apos as alteracoes, as edge functions serao redeployadas automaticamente, e o login voltara a funcionar em `https://academy.sanar.com.br`.
