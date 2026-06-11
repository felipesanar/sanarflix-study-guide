## Diagnóstico

A request `POST /functions/v1/admin-bulk-update-email` está saindo do preview com `Origin: https://0567bb51-…lovableproject.com` (domínio `.lovableproject.com`, não `.lovable.app`).

O guard de CORS em `supabase/functions/_shared/cors.ts` só aceita:
- domínios exatos da lista
- `.app.github.dev`
- `.lovable.app`

Como `.lovableproject.com` **não está na allowlist**, a edge function responde `403 forbidden` ao preflight (por isso o log mostra apenas "booted" e nada de invocação real), o browser dispara `Failed to fetch`, e o `usersService.bulkUpdateEmail` cai no fallback genérico `"Falha ao atualizar emails em lote"` — exatamente o badge vermelho da screenshot.

Isso afeta TODAS as edge functions que usam `isAllowedOrigin` quando chamadas do preview `.lovableproject.com` (não só esta). No domínio publicado (`academy.sanar.com.br`) funciona normalmente.

## Correção

Adicionar `.lovableproject.com` ao `isAllowedOrigin` em `supabase/functions/_shared/cors.ts`:

```ts
if (origin.endsWith('.lovable.app')) return true;
if (origin.endsWith('.lovableproject.com')) return true; // preview sandbox
```

Mudança isolada de 1 linha, sem efeito em produção (academy.sanar.com.br continua passando pelo match exato da lista).

## Validação

1. Após o deploy do shared module, refazer o upload do CSV no preview.
2. Confirmar que a request agora retorna 200 e que o resultado mostra `Atualizado` ou um `reason` específico (ex.: `user_not_found`) em vez do fallback genérico.
3. Conferir `supabase--edge_function_logs admin-bulk-update-email` — deve aparecer a linha `processing N rows`.

## Fora de escopo

- Sem mudanças no `admin-bulk-update-email/index.ts` em si — a lógica de update/auth/notify está correta.
- Sem mudanças no frontend (`BulkEmailUpdateTab.tsx`, `usersService.ts`).
