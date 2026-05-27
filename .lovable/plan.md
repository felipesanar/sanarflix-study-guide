## Objetivo
Substituir o backend de rate limiting (hoje `Deno.openKv()` com fallback em memória) por uma tabela Postgres `kv_store`, mantendo a mesma interface pública de `checkRateLimit()` para não tocar nas ~15 Edge Functions já padronizadas.

## Por que mudar
- `Deno.openKv()` não está habilitado no projeto Supabase (precisaria de flag de infra que o runtime hospedado não expõe).
- Fallback em memória **não funciona entre instâncias** do edge runtime → rate limit "vaza" (cada cold start zera o contador).
- Tabela em Postgres é cross-instance, durável e usa a conexão que as functions já têm.

## Mudanças

### 1. Migration: tabela `kv_store` + função atômica de incremento
- Tabela `public.kv_store`:
  - `key text primary key`
  - `value jsonb` (guarda `{ count, window }`)
  - `expires_at timestamptz` (TTL lógico)
  - `updated_at timestamptz default now()`
- Grants: **apenas `service_role`** (rate limit é chamado pelas edge functions com service key; nunca exposto a anon/authenticated).
- RLS ENABLE + zero policies (service_role bypassa RLS).
- Função `public.kv_incr(p_key text, p_ttl_seconds int, p_limit int)` `SECURITY DEFINER`:
  - `INSERT ... ON CONFLICT (key) DO UPDATE SET value = jsonb_set(...)` incrementando `count` atomicamente quando ainda na mesma janela, ou resetando para 1 quando `expires_at < now()`.
  - Retorna `{ count, remaining, reset_in }`.
- Job de limpeza: índice `idx_kv_store_expires_at` + função `kv_cleanup()` para `DELETE WHERE expires_at < now()` (rodada sob demanda; sem pg_cron por ora).

### 2. Refator `supabase/functions/_shared/rateLimit.ts`
- Remover `Deno.openKv()` e `memoryStore`.
- Criar cliente Supabase com `SUPABASE_SERVICE_ROLE_KEY` (cached em module-scope, criado uma vez por instância).
- `checkRateLimit()` continua com mesma assinatura `(req, { key, limitPerMin })` e mesmo retorno `{ allowed, remaining, resetIn }` → **zero mudança nas functions consumidoras**.
- Implementação: 1 chamada `supabase.rpc('kv_incr', { p_key, p_ttl_seconds: 65, p_limit })`.
- Em caso de erro de rede/DB no RPC: **fail-open** (permitir request, logar warning). Justificativa: rate limit não deve derrubar o happy path; segurança de fato vem da validação de JWT + Zod + RLS.

### 3. Sem mudanças em
- Nenhuma das 15 functions já deployadas (corrigir-simulado, b2b-create-user, etc.) precisa ser tocada.
- Sem mudança no frontend.
- Sem mudança em CORS, auth, Zod schemas.

## Testes / validação (após aprovar e fazer build)
1. Migration aplica sem erro (verificar `kv_store` e `kv_incr` criados).
2. Smoke em `corrigir-simulado`: 11 requests rápidos → 11º retorna 429 com `Retry-After`.
3. Conferir no SQL Editor: `SELECT key, value, expires_at FROM kv_store WHERE key LIKE 'rl:corrigir-simulado:%'` mostra contador subindo.
4. Esperar 65s → novo request retorna 200 (janela resetou).
5. Logs da function não devem ter "kv fail-open" em operação normal.

## Detalhes técnicos (para revisor)

**SQL da função `kv_incr` (esboço):**
```sql
create or replace function public.kv_incr(
  p_key text, p_ttl_seconds int, p_limit int
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_now timestamptz := now();
  v_count int;
  v_expires timestamptz;
begin
  insert into kv_store(key, value, expires_at)
  values (p_key, jsonb_build_object('count', 1), v_now + make_interval(secs => p_ttl_seconds))
  on conflict (key) do update
    set value = case
          when kv_store.expires_at < v_now
            then jsonb_build_object('count', 1)
          else jsonb_set(kv_store.value, '{count}',
                 to_jsonb(coalesce((kv_store.value->>'count')::int, 0) + 1))
        end,
        expires_at = case
          when kv_store.expires_at < v_now
            then v_now + make_interval(secs => p_ttl_seconds)
          else kv_store.expires_at
        end,
        updated_at = v_now
  returning (value->>'count')::int, expires_at
  into v_count, v_expires;

  return jsonb_build_object(
    'count', v_count,
    'remaining', greatest(0, p_limit - v_count),
    'reset_in', greatest(0, extract(epoch from v_expires - v_now)::int),
    'allowed', v_count <= p_limit
  );
end $$;
```

**Por que `jsonb` e não colunas dedicadas:** mantém a tabela genuinamente "KV", aproveitável depois para outros casos de cache curto (ex.: dedupe de webhooks). Mas só rate limit usa agora.

## Riscos / trade-offs
- **+1 round-trip ao DB por request autenticado** nas 15 functions. Latência esperada: 5–15ms na mesma região. Aceitável dado o ganho de correção.
- Se DB estiver indisponível, rate limit cai (fail-open). Alternativa fail-closed quebraria o app inteiro junto com o DB — pior trade.
- Tabela cresce até cleanup rodar. Para 10 req/min/IP × N functions, volume é trivial (KB/dia). Cleanup manual basta nos primeiros meses.

## Fora de escopo
- Mover outras coisas para `kv_store` (sessões, feature flags, etc.) — só rate limit por enquanto.
- `pg_cron` para cleanup automático — adicionar em PR separado se a tabela crescer.
