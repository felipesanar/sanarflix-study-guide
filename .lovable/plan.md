## Diagnóstico

Investiguei o fluxo completo e os dados estão **100% corretos no banco**:

- Usuário `fauditore2912@gmail.com` (Felipe Souza, FUNEPE, 8º semestre): OK
- `answer_progress`: 200 respostas (100 + 100), 148 acertos
- `simulados_finalizados`: 2 finalizações registradas
- Ambos simulados FUNEPE estão com `status='encerrado'` e `liberacao_desempenho='imediato'`

Testei os RPCs simulando a sessão JWT do usuário:

- `get_user_simulados()` → retorna os 2 simulados ✅
- `get_user_performance_aggregates()` → retorna `{total: 200, acertos: 148}` ✅

**Conclusão: o backend está correto. O bug é client-side.**

## Causa raiz

`src/pages/SimuladoDesempenho.tsx` usa cache agressivo em `sessionStorage` com a chave `performanceData_${userId}_${simuladoId|all}`:

1. Linha 570-581: na montagem, lê cache do sessionStorage e inicializa `stats`/`simulados` a partir dele.
2. Linha 598-603: dentro de `fetchDataForView`, se existir entrada em sessionStorage, **retorna imediatamente sem refazer o fetch**, mesmo que os dados em cache sejam vazios.
3. O cache **só é invalidado** quando o usuário clica manualmente no botão "Refresh" (linha 687: `sessionStorage.clear()`).

Como o usuário visitou a aba "Desempenho" **antes** da migração que populou as respostas, ficou cacheado `{stats: {total: 0}, simulados: []}` e a tela exibe permanentemente "Nenhum dado de simulado", mesmo com dados novos no banco.

A condição de empty state (linha 788) reforça isso:
```ts
if (!stats || (stats.total === 0 && simulados.length === 0)) { /* Nenhum dado */ }
```

## Plano de correção

### 1. Invalidação de cache mais inteligente em `SimuladoDesempenho.tsx`

- Sempre disparar o fetch real em background quando `stats.total === 0` ou `simulados.length === 0` no cache (stale-while-revalidate), mesmo se houver entrada cacheada — assim, dados que chegam após a primeira visita aparecem automaticamente.
- Adicionar TTL ao cache (ex: 5 min) salvando `cachedAt` no payload e ignorando entradas antigas.
- Limpar caches antigos sem TTL ao montar.

### 2. Realtime opcional (curto prazo)

Adicionar subscrição realtime nas tabelas `answer_progress` e `simulados_finalizados` filtrando por `user_id`, invalidando o sessionStorage e refazendo `fetchDataForView` quando houver INSERT. Isso garante atualização instantânea quando admin gera dados de teste.

### 3. Mitigação imediata para o seu caso

No próximo deploy, o código já vai detectar o cache "vazio" e refetchar. Mas para destravar **agora sem esperar**, basta o usuário:
- Clicar no botão "Atualizar" (ícone `RefreshCw`) na própria tela de Desempenho, **ou**
- Abrir DevTools → Application → Session Storage → limpar e recarregar.

## Arquivos a alterar

- `src/pages/SimuladoDesempenho.tsx` — lógica de cache (`fetchDataForView`, leitura inicial, useEffect de cache).

Sem migrações de banco. Sem mudanças em RPCs.