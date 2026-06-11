## Diagnóstico

A edge function `admin-bulk-update-email` **não tem nada de errado**, e o CSV também está OK (44 linhas, dentro do cap de 50, formato válido). O problema é de **autenticação no cliente**.

### Evidências

1. **Console do navegador** (18:55:36, antes do upload):
   ```
   AuthApiError: Invalid Refresh Token: Refresh Token Not Found
   status: 400, code: refresh_token_not_found
   ```
2. **Rota atual: `/login`** — o admin foi deslogado automaticamente porque o refresh token expirou/sumiu.
3. **Logs da edge function**: apenas `booted` / `shutdown`, nenhum log de processamento (`processing N rows`). Isso significa que a função foi chamada mas retornou cedo no caminho `401 unauthorized` (esse caminho não escreve `console.log`).
4. **Teste direto via curl com Origin do preview**: a função respondeu corretamente (`401 unauthorized` quando sem token, CORS OK). Confirma que infra/CORS estão funcionando.

### Fluxo do que aconteceu

```text
admin abre a aba  →  refresh token já estava inválido
admin seleciona CSV e confirma
client chama supabase.functions.invoke('admin-bulk-update-email')
  → cliente Supabase tenta refresh → falha
  → request sai sem Authorization válido
edge function → 401 "unauthorized" (sem log)
usersService.bulkUpdateEmail → retorna { success: false, error: 'Falha ao atualizar emails em lote', results: [] }
BulkEmailUpdateTab marca os 44 como failed com reason genérica
AuthContext detecta token inválido → redireciona para /login
```

Por isso todas as 44 linhas mostram a **mesma** mensagem genérica "Falha ao atualizar emails em lote" — não houve processamento por linha, foi falha de transporte/auth.

## Solução

### Ação imediata (sem código)
O admin precisa **fazer login novamente** no preview e tentar de novo. O CSV está válido e deve processar normalmente.

### Melhorias de código (para evitar repetição e dar feedback claro)

1. **`src/components/admin/BulkEmailUpdateTab.tsx` — guard de sessão antes de iniciar**
   - Em `runUpdate`, chamar `supabase.auth.getUser()` antes do loop.
   - Se retornar erro/null, abortar com toast: *"Sua sessão expirou. Faça login novamente para continuar."* e não disparar nenhum invoke.

2. **`src/services/usersService.ts` — propagar 401 distintamente**
   - No `bulkUpdateEmail`, inspecionar `error?.context?.status` (ou `error.message`) e, quando for 401/unauthorized, retornar `error: 'session_expired'` em vez do genérico.

3. **`BulkEmailUpdateTab.tsx` — renderização de erro contextual**
   - Quando `res.error === 'session_expired'`, mostrar banner topo da tabela com CTA "Fazer login novamente" e não preencher 44 linhas com falha individual (evita relatório falso-negativo confuso).

4. **(Opcional) `admin-bulk-update-email/index.ts` — log no caminho 401**
   - Adicionar `console.log('[admin-bulk-update-email] unauthorized: no/invalid bearer')` antes do `return jsonResponse(401, ...)` para facilitar diagnóstico futuro nos logs do Supabase.

## Detalhes técnicos

- Não há alteração de schema, RLS ou edge function lógica de negócio.
- CORS já está correto (`.lovable.app` e `.lovableproject.com` no allowlist) — nenhuma mudança necessária.
- O cap de 50/lote e o `CHUNK_DELAY_MS` continuam adequados; 44 linhas cabem em 1 chamada.
- Mudança 4 (log do 401) é só observabilidade — opcional, não afeta comportamento.

Quero que eu siga em frente com as melhorias 1–3 (e opcionalmente 4)?