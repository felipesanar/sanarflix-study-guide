# Fix 2 — regressão em `gestorMigrationsAvisosAlunoContatoContexto.test.ts`

Contexto: verificação final do plano `docs/superpowers/plans/2026-08-11-rollout-faseado-portal-gestor.md`
(reverte a decisão de produto de 06/08–07/08 de que `gestao.portal_v2` estava
morta para sempre; cria `get_gestor_portal_versao()` como RPC de rollout
faseado por IES, cujo trabalho é justamente checar essa chave, revivida com
semântica nova de toggle por IES).

## O que mudou e por quê

1. **`src/test/unit/gestorMigrationsAvisosAlunoContatoContexto.test.ts`**
   O describe `'guard de feature nas RPCs get_gestor_* — gestao.portal_v2 nunca
   volta (GA total, 06/08)'` usa `todasAsRpcsDoGestor()`, um scanner genérico
   que casa `CREATE OR REPLACE FUNCTION public\.(get_gestor_[a-z_]+)\(` em
   todas as migrations. A nova migration `20260811142000_get_gestor_portal_versao.sql`
   passou a ser descoberta por esse mesmo regex, e falhava por desenho em duas
   asserções deste describe: a lista fixa de "onze RPCs" e o `it.each` que
   prova que nenhuma RPC chama `gestao.portal_v2` — que é exatamente o que
   `get_gestor_portal_versao` faz, de propósito.

   **Não toquei em `todasAsRpcsDoGestor()`** (scanner genérico, correto,
   possivelmente reutilizado em outro lugar). Em vez disso, adicionei um
   `.filter((nome) => nome !== 'get_gestor_portal_versao')` no ponto onde o
   describe consome a lista (linha ~175), com um comentário explicando a
   exceção deliberada e apontando para o teste dedicado da nova função.

2. **`src/test/unit/gestorMigrationsPortalVersao.test.ts`**
   Este arquivo (Task 3 do plano) já tinha 5 testes estruturais sobre
   `get_gestor_portal_versao()`, mas nenhum deles fixava literalmente a
   string `'gestao.portal_v2'` — o regex do teste de COALESCE
   (`COALESCE\(\s*\(SELECT f\.enabled FROM public\.ies_features f[\s\S]*?\),\s*false\s*\)`)
   é genérico o bastante para passar com QUALQUER `feature_key`, não
   especificamente `gestao.portal_v2`. Ou seja: a "asserção oposta" que o
   guard geral perdeu ao ser excluído acima não estava, de fato, coberta aqui.
   Adicionei um teste dedicado:

   ```ts
   it('a chave de feature checada é gestao.portal_v2 — esta RPC é a exceção
   deliberada ao guard "gestao.portal_v2 nunca volta" das outras onze RPCs
   get_gestor_* (...), porque checar essa chave É o próprio trabalho dela', () => {
     const sql = readMigration();
     expect(sql).toMatch(/f\.feature_key = 'gestao\.portal_v2'/);
   });
   ```

## Teste alvo — antes e depois

**Antes do fix** (com as 3 migrations de 2026-08-11 no lugar, sem o filtro):
5 falhas no arquivo:
- `descobre as onze RPCs do portal` (12 descobertas, não 11 — `get_gestor_portal_versao` + duas outras pré-existentes)
- `get_gestor_portal_versao vigente nunca chama a feature morta gestao.portal_v2` (falha correta — é o próprio trabalho da função)
- `get_gestor_portal_versao vigente preserva SECURITY DEFINER, STABLE e search_path` (falha colateral — corpo da função inteiro nem chega a ser o esperado nesse describe)
- `get_gestor_visao_geral vigente nunca chama...` (pré-existente, não relacionada)
- `get_gestor_visao_geral vigente preserva...` (pré-existente, não relacionada)

**Depois do fix**: 3 falhas, 37 passando — as 3 restantes são exatamente as
mesmas do baseline sem este plano (só sobre `get_gestor_visao_geral`, cujo
corpo não fecha com `$function$;` na migration vigente — problema
pré-existente, fora do escopo deste plano):

```
Test Files  1 failed (1)
     Tests  3 failed | 37 passed (40)
```

Falhas restantes (idênticas às 3 obtidas com as 3 migrations de 2026-08-11
temporariamente removidas — verifiquei isso movendo
`supabase/migrations/20260811*.sql` para fora, rodando o arquivo, e
restaurando):
1. `descobre as onze RPCs do portal` — ainda falha porque a lista descoberta
   também inclui `get_gestor_aluno_desempenho_por_area` e
   `get_gestor_detalhamento_temas`, que já existiam ANTES deste plano
   (confirmado: falha idêntica com as migrations do plano removidas).
2. `get_gestor_visao_geral vigente nunca chama a feature morta gestao.portal_v2` — falha porque `corpoDaFuncao` não encontra o fechamento `$function$;` para essa função na migration vigente.
3. `get_gestor_visao_geral vigente preserva SECURITY DEFINER, STABLE e search_path` — mesma causa acima.

Nenhuma das 3 é nova nem foi tocada por este plano.

## Confirmação de `gestorMigrationsPortalVersao.test.ts`

Antes do meu ajuste, o arquivo NÃO tinha nenhuma asserção que fixasse a
literal `'gestao.portal_v2'` — o único teste que passa perto disso
(COALESCE) usa um regex genérico que passaria com qualquer feature_key.
Adicionei o teste faltante (ver acima). Resultado depois do ajuste:

```
✓ src/test/unit/gestorMigrationsPortalVersao.test.ts (6 tests) 6ms
Test Files  1 passed (1)
     Tests  6 passed (6)
```

## Type-check

```
npx tsc --noEmit -p tsconfig.app.json
EXIT: 0
```
(sem saída, limpo)

## Arquivos alterados

- `src/test/unit/gestorMigrationsAvisosAlunoContatoContexto.test.ts` — filtro
  de exclusão de `get_gestor_portal_versao` no describe de guard, com
  comentário explicativo. Nenhum outro describe do arquivo foi tocado.
- `src/test/unit/gestorMigrationsPortalVersao.test.ts` — novo teste
  garantindo que a função referencia literalmente `gestao.portal_v2`.

## Autorrevisão

- Confirmei que `todasAsRpcsDoGestor()` permanece intocada (scanner genérico
  preservado).
- Confirmei que a lista hardcoded de "onze RPCs" no teste
  `descobre as onze RPCs do portal` não foi alterada — continua com os
  mesmos 11 nomes de antes.
- Confirmei que os describes `get_gestor_avisos vigente (achado 2)`,
  `get_gestor_aluno vigente (achado 2)`, `get_gestor_contexto vigente
  (achado 15)` e `get_gestor_aluno_contato vigente (achados 12 e 16)` não
  foram tocados (não usam `todasAsRpcsDoGestor()`) — `git diff` confirma que
  só as linhas do describe de guard mudaram nesse arquivo.
- Verifiquei empiricamente (movendo e restaurando as migrations de 2026-08-11)
  que as 3 falhas remanescentes são idênticas ao baseline sem este plano —
  não há falha nova nem RPC adicional inesperada varrida pelo mesmo
  mecanismo de descoberta.
- `git status` após restaurar as migrations mostrou só o arquivo de teste
  principal como modificado antes da segunda edição; depois das duas
  edições, `git diff --stat` mostra exatamente os 2 arquivos esperados,
  +14/-1 linhas no total.

## Concerns

Nenhum. O fix segue exatamente o padrão pedido (mesma classe de ajuste que
`buildAppRoutes.test.ts` e `regua-unica.test.ts` já receberam neste plano), a
regressão foi isolada e corrigida sem enfraquecer as asserções originais, e a
"asserção oposta" ficou coberta no teste dedicado da nova RPC em vez de
simplesmente desaparecer.
