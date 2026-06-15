## Causa raiz

- Edge Function `b2b-create-user` aplica `checkRateLimit(..., { limitPerMin: 30 })` por IP.
- `UsersTab.tsx` envia em paralelo (`CONCURRENCY=5`, delay de 300 ms entre chunks), saturando o limite após ~30 linhas.
- Resultado observado: 30 sucessos, 230 erros `RATE_LIMITED`, ~59 s.

O limite faz sentido para impedir enumeração/abuso por usuários comuns, mas é restritivo demais para o fluxo legítimo de admin importando CSV.

## Objetivo

Permitir que admins importem lotes grandes (até o limite atual de 1000 linhas) sem disparar `RATE_LIMITED`, mantendo a proteção contra abuso para chamadas não-admin.

## Mudanças propostas

### 1. Backend — `supabase/functions/b2b-create-user/index.ts`
- Após autenticar o JWT e confirmar `role = 'admin'` (já existente), **pular `checkRateLimit`** para admins (eles já são autenticados e autorizados).
- Manter `limitPerMin: 30` para qualquer chamada não-admin (defesa em profundidade caso alguém invoque a função sem o role correto).
- Estrutura:
  ```
  verificar JWT → carregar perfil → se NÃO admin: checkRateLimit (30/min) → seguir
  ```

### 2. Frontend — `src/components/admin/UsersTab.tsx`
- Ajustar `CONCURRENCY` de 5 → 3 e `INTER_CHUNK_DELAY_MS` de 300 → 500 ms (margem extra mesmo sem rate limit, para não sobrecarregar o Supabase Auth, que internamente também tem limites).
- Tratar resposta `RATE_LIMITED` com **retry automático com backoff**: ao receber esse código, aguardar `reset_in` segundos (ou 60 s por padrão) e tentar a linha novamente, até 2 retries. Só marcar como erro definitivo se persistir.
- Atualizar a mensagem de erro `RATE_LIMITED` no `BatchProcessingReport` para algo mais didático ("Limite temporário atingido — reenviar este lote em alguns segundos") já que com a mudança backend isso só ocorrerá em casos extremos.

### 3. Service — `src/services/usersService.ts`
- Em `createUser`, propagar o campo `reset_in` quando o backend devolver `code: 'rate_limited'`, para o componente saber quanto esperar no retry.

### 4. Documentação curta
- Atualizar `docs/user-import-flow.md` (ou criar uma seção) explicando: limite efetivo agora é 1000 linhas/lote, admins não têm rate limit por IP, retries automáticos cobrem picos.

## Riscos / mitigações
- Pular rate limit para admin é seguro porque a função já valida `role = admin` via JWT antes de qualquer escrita; um token comprometido de admin já implicaria risco maior do que rate limit.
- Mantemos o limite para chamadas não-admin como guarda contra enumeração.

## Verificação após implementação
1. Importar CSV de teste com ~100 linhas e confirmar 0 erros `RATE_LIMITED`.
2. Importar CSV de 260 linhas (mesmo do incidente) e confirmar processamento completo.
3. Chamar a Edge Function sem token de admin e confirmar que ainda recebe 429 após 30 req/min.
