
# Plano: Corrigir CORS em TODAS as Edge Functions

## Diagnóstico do Problema

O SDK do Supabase envia automaticamente 4 headers de telemetria que **devem** estar na lista de `Access-Control-Allow-Headers`:
- `x-supabase-client-platform`
- `x-supabase-client-platform-version`
- `x-supabase-client-runtime`
- `x-supabase-client-runtime-version`

Se esses headers não estiverem explicitamente permitidos, o browser bloqueia a requisição antes de chegar ao servidor.

---

## Funções Afetadas

| Arquivo | Status | Problema |
|---------|--------|----------|
| `_shared/cors.ts` | **CRÍTICO** | Headers incompletos (linha 22 e 31) |
| `auth-login/index.ts` | **CRÍTICO** | Headers incompletos (linha 23) |
| `update-password/index.ts` | **CRÍTICO** | Headers incompletos (linha 35) |
| `save-calendar-arrangement/index.ts` | **CRÍTICO** | Headers incompletos (linha 5) |
| `study-guide-proxy/index.ts` | **CRÍTICO** | Headers incompletos (linha 21) |
| `enamed-proxy/index.ts` | **CRÍTICO** | Headers incompletos (linha 21) |
| `get-study-contents/index.ts` | OK | Já corrigido |
| `corrigir-simulado/index.ts` | OK | Já corrigido |
| `b2c-signup/index.ts` | **CRÍTICO** | Usa `_shared/cors.ts` |
| `session-security/index.ts` | **CRÍTICO** | Usa `_shared/cors.ts` |

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/_shared/cors.ts` | Adicionar headers do SDK nas linhas 22 e 31 |
| `supabase/functions/auth-login/index.ts` | Adicionar headers do SDK na linha 23 |
| `supabase/functions/update-password/index.ts` | Adicionar headers do SDK na linha 35 |
| `supabase/functions/save-calendar-arrangement/index.ts` | Adicionar headers do SDK na linha 5 |
| `supabase/functions/study-guide-proxy/index.ts` | Adicionar headers do SDK na linha 21 |
| `supabase/functions/enamed-proxy/index.ts` | Adicionar headers do SDK na linha 21 |

---

## Mudança 1: `_shared/cors.ts` (arquivo central)

Este é o arquivo mais importante pois é importado por várias funções.

```typescript
// Linha 22 - Em buildCorsHeaders
// Antes:
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',

// Depois:
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',

// Linha 31 - Em corsHeaders (export legacy)
// Antes:
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',

// Depois:
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
```

---

## Mudança 2: `auth-login/index.ts`

```typescript
// Linha 23 - Em buildCorsHeaders
// Antes:
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',

// Depois:
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
```

---

## Mudança 3: `update-password/index.ts`

```typescript
// Linha 35 - Em buildCorsHeaders
// Antes:
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',

// Depois:
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
```

---

## Mudança 4: `save-calendar-arrangement/index.ts`

```typescript
// Linha 5 - Em corsHeaders
// Antes:
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',

// Depois:
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
```

---

## Mudança 5: `study-guide-proxy/index.ts`

```typescript
// Linha 21 - Em buildCorsHeaders
// Antes:
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',

// Depois:
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
```

---

## Mudança 6: `enamed-proxy/index.ts`

```typescript
// Linha 21 - Em buildCorsHeaders
// Antes:
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',

// Depois:
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
```

---

## Sobre o Aviso de Preload de Imagem

O aviso sobre `lovable-uploads/efb6cdcc-7e6b-4bd1-acc1-0dec71e055ff.png` é um warning de otimização e não afeta a funcionalidade. Indica que uma imagem foi pré-carregada via `<link rel="preload">` mas não foi usada rapidamente. Isso é inofensivo e pode ser ignorado.

---

## Resultado Esperado

Após as correções:
1. Login funcionará em guia anônima e normal
2. Guia de estudos carregará corretamente
3. Todas as Edge Functions aceitarão requisições do domínio `guiadeestudos.sanar.com.br`
4. Funções que usam `_shared/cors.ts` serão automaticamente corrigidas

---

## Seção Técnica

O header completo que deve ser usado em TODAS as funções:

```typescript
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version'
```

Esses headers são enviados automaticamente pelo SDK `@supabase/supabase-js` quando o cliente chama `supabase.functions.invoke()` ou faz outras requisições autenticadas. A ausência deles nos CORS headers causa a rejeição da requisição preflight (OPTIONS).
