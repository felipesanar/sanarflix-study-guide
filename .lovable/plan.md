

## Auditoria End-to-End: Cadastro/Atualização em Lote por CSV

### Fluxo Completo Auditado

```text
CSV Upload → Parse linhas → Loop sequencial por usuário →
  → Edge Function b2b-create-user (auth + public.users + role + email) →
    → Novu (welcome email com recovery link) →
      → Usuário clica link → /auth/update-password → verifyOtp → define senha
```

---

### Problemas Identificados

#### 1. CRÍTICO — CSV parsing ingênuo com `split(',')` (linha 127/146)
O parser usa `line.split(',')` que quebra com valores contendo vírgulas (ex: `"Silva, João"` em nomes compostos com vírgula). Campos entre aspas não são tratados.

**Correção:** Usar a lib XLSX (já importada) para parsear o CSV em vez de split manual. `XLSX.read()` suporta CSV nativamente e trata aspas/escapes.

#### 2. ALTO — Sem validação de `batchIesId` antes do envio
Se o admin não seleciona uma IES, o botão é desabilitado mas não há validação no `processCsvFile`. Se por alguma razão `batchIesId` estiver vazio, todas as chamadas falharão com `IES_NOT_FOUND` (404) — gerando centenas de chamadas desperdiçadas.

**Correção:** Validação explícita no início de `processCsvFile`.

#### 3. ALTO — Loop sequencial sem concorrência nem rate limiting
Cada usuário é processado sequencialmente (1 edge function call por vez). Para 500 usuários, isso pode levar 15-25 minutos. Não há:
- Concorrência controlada (ex: 3-5 em paralelo)
- Delay entre chamadas para evitar rate limit do Supabase Auth
- Possibilidade de cancelamento pelo admin

**Correção:** Implementar processamento em chunks paralelos (3-5 simultâneos) com `Promise.allSettled`, delay inter-chunk, e um `AbortController` para cancelamento.

#### 4. ALTO — `emailSent: true` é retornado antes do email ser enviado
Na edge function (linha 366-370), o email de boas-vindas é enviado via `EdgeRuntime.waitUntil` (fire-and-forget em background), mas a resposta retorna `emailSent: true` imediatamente — antes de saber se realmente foi enviado. O relatório mostra "✅ Enviado" para emails que podem ter falhado silenciosamente.

**Correção:** Aguardar a resposta do `sendWelcomeEmail` antes de retornar, ou retornar `emailSent: 'queued'` e ser honesto no relatório.

#### 5. MÉDIO — Recovery link expira em 1h (padrão Supabase)
O token de recuperação gerado por `generateLink({ type: 'recovery' })` expira em 1 hora por padrão do Supabase. Em um cadastro em lote de centenas de alunos, muitos só vão abrir o email horas ou dias depois — o link já terá expirado.

**Correção:** Documentar/alertar o admin. Considerar usar `type: 'invite'` que tem expiração mais longa (24h), ou implementar uma rota de reenvio em lote.

#### 6. MÉDIO — Sem limite de tamanho do arquivo CSV
Não há validação do tamanho do arquivo. Um CSV gigante (50k+ linhas) pode travar a aba do navegador durante o parse e sobrecarregar a Edge Function com milhares de chamadas.

**Correção:** Limitar a 1000 linhas por lote com mensagem clara.

#### 7. MÉDIO — Sem progresso visual durante processamento em lote
O admin só vê "Processando..." sem saber em que linha está ou quanto falta. Para lotes grandes, isso é uma experiência ruim.

**Correção:** Adicionar barra de progresso com contagem (ex: "Processando 45/200...").

#### 8. BAIXO — Email de fallback sem token (linha 116)
Se `generateRecoveryLink` falha, o `confirmationUrl` cai para `https://academy.sanar.com.br/auth/update-password` (URL estática sem token). O email é enviado com um link que leva a uma página de "Link inválido". O usuário fica sem saber o que fazer.

**Correção:** Se o link não pôde ser gerado, não enviar o email e reportar a falha.

#### 9. BAIXO — Nenhuma validação de email format no frontend
O CSV pode conter emails malformados (sem @, espaços). A validação só acontece no Zod da edge function, gerando chamadas de rede desnecessárias.

**Correção:** Validar formato do email no frontend antes de disparar a requisição.

#### 10. BAIXO — Nome regex rejeita nomes com hífens, apóstrofos e números
O schema Zod na edge function usa `regex(/^[a-zA-ZÀ-ÿ\s]+$/)` que rejeita nomes como "O'Brien", "Ana-Maria", "João Jr." — nomes válidos em português e outros idiomas.

**Correção:** Relaxar o regex para aceitar hífens, apóstrofos e pontos.

---

### Plano de Correções

| # | Arquivo | Mudança |
|---|---------|---------|
| 1 | `UsersTab.tsx` | Usar `XLSX.read(csvText)` para parsear CSV em vez de `split(',')` |
| 2 | `UsersTab.tsx` | Validar `batchIesId` explicitamente no início |
| 3 | `UsersTab.tsx` | Processamento em chunks paralelos (5 simultâneos) com barra de progresso e cancelamento |
| 6 | `UsersTab.tsx` | Limitar a 1000 linhas com mensagem de erro |
| 7 | `UsersTab.tsx` | Barra de progresso visual (X/total) |
| 9 | `UsersTab.tsx` | Validação de email no frontend antes do envio |
| 4 | `b2b-create-user/index.ts` | Aguardar `sendWelcomeEmail` e retornar status real |
| 8 | `b2b-create-user/index.ts` | Não enviar email se recovery link falhar; reportar `emailSent: false` |
| 10 | `b2b-create-user/index.ts` | Relaxar regex do nome para aceitar hífens, apóstrofos e pontos |

