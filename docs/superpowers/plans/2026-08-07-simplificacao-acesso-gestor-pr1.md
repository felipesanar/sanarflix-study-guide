# Simplificação do acesso do gestor — PR 1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o acesso ao Portal do Gestor depender só de papel e escopo de IES, removendo a feature `gestao.enabled` de ponta a ponta, e fechar dois furos de autorização confirmados em produção.

**Architecture:** Quatro migrations aditivas (nenhuma toca `user_has_feature`), mais três arquivos de front que deixam de consultar feature e passam a derivar de papel. O guard de papel e o de escopo de IES dentro das 11 RPCs ficam intactos — só o quarto bloco do preâmbulo sai.

**Tech Stack:** Postgres/Supabase (plpgsql, RLS), React + TypeScript, vitest.

Spec: `docs/superpowers/specs/2026-08-07-simplificacao-acesso-gestor-design.md`

## Global Constraints

- **Nada é aplicado em produção por este plano.** O banco deste projeto recebe DDL por caminho manual. Toda migration nasce não aplicada; a aplicação é decisão explícita do Felipe.
- **`public.user_has_feature(text) NUNCA é recriada nem dropada.** 19 RPCs institucionais legadas dependem dela para chaves `aluno.%`.
- Migrations **aditivas**: só `CREATE OR REPLACE FUNCTION`, `DROP FUNCTION` da helper explicitamente órfã, `DELETE` das 3 chaves, e `CREATE/DROP POLICY` de `announcements`. Nada de `ALTER TABLE`.
- Ao recriar qualquer RPC `get_gestor_*`, a base é **a migration mais recente que a recria**: `20260807021546_a19e4160-6f1c-4f0d-9cc8-f9743ff340dc.sql` para 9 delas, `20260807022207_de63e0ae-b9a7-4108-9c1f-81734944dace.sql` para `get_gestor_detalhamento` e `get_gestor_questoes`. Usar base mais antiga reverte fix de produção — já aconteceu duas vezes neste projeto.
- Fora do bloco removido, **nenhuma outra linha do corpo das funções pode mudar**. Verificar por script, nunca por leitura.
- A ordem dos três blocos que ficam é obrigatória: papel (`Access denied`) → resolução de `v_ies` (`IES not resolved`) → `gestor_pode_acessar_ies` (`Permission denied: cannot access this IES`).
- Guards estáticos ficam em `src/test/unit/`, no padrão dos `gestorMigrations*.test.ts` existentes.
- O helper `corpoDaFuncao(sql, nome)` usado nos testes das Tasks 3 e 5 **não existe ainda**: os arquivos atuais têm equivalentes locais (ver `src/test/unit/gestorMigrationsRestauraGuardGestaoEnabled.test.ts`, que fatia de `CREATE OR REPLACE FUNCTION public.<nome>` até o `$function$;` que fecha). Copie esse padrão para o arquivo novo em vez de importar de outro teste.
- Nenhum hex literal, `rgb()`, classe `bg-white`/`text-gray-*` ou classe arbitrária ambígua do Tailwind em `.ts`/`.tsx` do gestor (`src/features/gestor/__tests__/tema.test.tsx`).

## Ordem de implantação (importa)

**As duas migrations deste PR não são um bloco só — a ordem certa tem três passos.** A versão anterior desta seção dizia só "aplicar as migrations antes de subir o front": isso está certo para a primeira migration e **errado** para a segunda, que não pode ser tratada como parte do mesmo bloco.

1. **Aplicar `20260807030000`** (as 11 RPCs `get_gestor_*` param de exigir `gestao.enabled`). O banco deixa de exigir a feature; o front (`useAccessRules.ts:35` na `main`, antes da Task 1 abaixo) ainda exige — nada muda para o usuário: quem tinha a feature ligada continua vendo o portal, quem não tinha continua sem ver. Esta é uma janela **sem efeito perceptível**.
2. **Subir o front** — a mudança de `pr1/front` (Task 1: `useAccessRules.ts` passa a usar `hasExperience`, não mais `hasFeature('gestao.enabled')`). O front para de ler a chave.
3. **Aplicar `20260807031000`** (apaga as 3 chaves de `gestao.*` e a helper órfã) — só agora. Apagar a linha de `gestao.enabled` faz `hasFeature('gestao.enabled')` devolver `false` para **qualquer IES** (`coalesce(bool_or(enabled), false)` sobre zero linhas). Se o passo 2 ainda não tiver acontecido, **todo gestor perde o portal** até o front subir — não é uma janela invisível, é queda total e imediata para 100% dos gestores. Ver o cabeçalho da própria `20260807031000` para o pré-requisito **adicional** (GestorLayout.tsx / botões Exportar e IA), que se soma a este e não o substitui.

Dentro de cada par a ordem também é obrigatória — RPC antes do front que a lê; front antes do `DELETE` que apaga o que ele ainda lê — e a `20260807031000` nunca pode ser aplicada fora da posição 3.

---

### Task 1: Front deixa de consultar feature para o gate do gestor

**Files:**
- Modify: `src/hooks/useAccessRules.ts:35`
- Modify: `src/experiences/shared/ExperienceGuard.tsx:33-38`
- Test: `src/test/unit/useAccessRules.test.tsx`
- Test: `src/test/components/ExperienceGuard.test.tsx`

**Interfaces:**
- Consumes: `useAuth()` devolve `{ user, access }`, onde `access.experiences` é `string[]`; `hasExperience(access, 'gestao')` de `src/experiences/access.ts`.
- Produces: `AccessRules.desempenhoInstitucional` passa a significar "o usuário tem papel de gestor", não "a IES tem a feature". O nome do campo **não muda** nesta task — renomear tocaria consumidores fora do escopo.

- [ ] **Step 1: Escrever o teste que falha, em `src/test/unit/useAccessRules.test.tsx`**

Leia os testes já existentes no arquivo antes de escrever, para seguir o padrão de mock de `useAuth`/`useEffectiveFeatures` que ele já usa.

```tsx
it('desempenhoInstitucional vem do papel, não da feature gestao.enabled', () => {
  mockUseAuth.mockReturnValue({
    user: { id: 'u1', roles: ['gestor'] },
    access: { roles: ['gestor'], experiences: ['gestao'], capabilities: [] },
  });
  // a IES NÃO tem a feature — antes isto bastava para negar
  mockUseEffectiveFeatures.mockReturnValue({
    features: {}, bypass: false, loading: false, refetching: false,
    error: null, hasFeature: () => false, refetch: vi.fn(),
  });

  const { result } = renderHook(() => useAccessRules());

  expect(result.current.accessRules.desempenhoInstitucional).toBe(true);
});

it('aluno não recebe desempenhoInstitucional, mesmo se a IES tiver a feature', () => {
  mockUseAuth.mockReturnValue({
    user: { id: 'u2', roles: ['aluno'] },
    access: { roles: ['aluno'], experiences: ['aluno'], capabilities: [] },
  });
  mockUseEffectiveFeatures.mockReturnValue({
    features: { 'gestao.enabled': true }, bypass: false, loading: false,
    refetching: false, error: null, hasFeature: () => true, refetch: vi.fn(),
  });

  const { result } = renderHook(() => useAccessRules());

  expect(result.current.accessRules.desempenhoInstitucional).toBe(false);
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/test/unit/useAccessRules.test.tsx`
Expected: FAIL — o primeiro teste recebe `false` (hoje lê `hasFeature('gestao.enabled')`).

- [ ] **Step 3: Trocar a fonte em `useAccessRules.ts:35`**

Substituir a linha:

```ts
      desempenhoInstitucional: hasFeature('gestao.enabled'),
```

por:

```ts
      // Papel, não feature. O portal do gestor deixou de ser liberado por IES
      // (spec 2026-08-07): todo gestor tem acesso completo, sempre. O nome do
      // campo é legado de quando isto era a feature `gestao.enabled`.
      desempenhoInstitucional: hasExperience(access, 'gestao'),
```

Acrescentar ao topo do arquivo:

```ts
import { hasExperience } from '@/experiences/access';
```

e obter `access` do `useAuth()` na linha 22:

```ts
  const { user, access } = useAuth();
```

Incluir `access` no array de dependências do `useMemo` (linha 39):

```ts
  }, [user, access, features, bypass]);
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/test/unit/useAccessRules.test.tsx`
Expected: PASS

- [ ] **Step 5: Simplificar o `ExperienceGuard`**

Em `src/experiences/shared/ExperienceGuard.tsx`, remover o `featureGateOk` (linhas 33-34) e a metade dele na condição:

```tsx
  const { user, access } = useAuth();
  const { accessRules } = useAccessRules();

  if (!hasExperience(access, experience)) {
    return <Navigate to={getDefaultRouteForUser(user, accessRules, access)} replace />;
  }

  return <>{children}</>;
```

`accessRules` continua sendo usado — `getDefaultRouteForUser` o recebe. Não remova a chamada de `useAccessRules`.

Atualizar o docblock (linhas 20-25) para não prometer mais um gate por feature.

- [ ] **Step 6: Rodar a suíte de ExperienceGuard**

Run: `npx vitest run src/test/components/ExperienceGuard.test.tsx src/test/unit/route-gates.test.tsx`
Expected: PASS. Se algum teste existente afirmava que a feature desligada nega o acesso, ele agora está errado por decisão — atualize a asserção e o nome do teste, e explique no commit. **Não delete o teste.**

- [ ] **Step 7: Suíte inteira**

Run: `npx vitest run` e `npm run type-check`
Expected: verde nos dois.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useAccessRules.ts src/experiences/shared/ExperienceGuard.tsx src/test
git commit -m "feat(gestor): acesso ao portal passa a depender de papel, nao de feature por IES"
```

---

### Task 2: Remover as 3 chaves de gestão do console do admin

**Files:**
- Modify: `src/services/admin/featureCatalog.ts`
- Test: `src/test/unit/featureCatalog.test.ts`

**Interfaces:**
- Consumes: nada da Task 1.
- Produces: o catálogo exibido no admin deixa de listar `gestao.enabled`, `gestao.exportar`, `gestao.ia`.

- [ ] **Step 1: Ler o arquivo e o teste antes de mudar**

Run: `cat src/services/admin/featureCatalog.ts` e `cat src/test/unit/featureCatalog.test.ts`

O catálogo pode ser uma constante local ou vir do banco. **Se vier do banco** (query em `feature_catalog`), não há o que remover aqui — as chaves somem na Task 5, e esta task se resume a garantir que a UI lide com catálogo sem chaves `gestao.*`. Nesse caso, registre isso no relatório e vá para o Step 4.

- [ ] **Step 2: Escrever o teste que falha**

```ts
it('o catálogo do admin não expõe chave de gestão', () => {
  const chaves = listarFeaturesDoCatalogo().map((f) => f.key);
  expect(chaves.filter((k) => k.startsWith('gestao.'))).toEqual([]);
});
```

Ajuste o nome da função ao que o arquivo realmente exporta.

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npx vitest run src/test/unit/featureCatalog.test.ts`
Expected: FAIL, listando as chaves `gestao.*` encontradas.

- [ ] **Step 4: Remover as entradas de gestão**

Apagar as três entradas do catálogo. Se houver agrupamento por módulo ("Gestão") que fique vazio, apagar o grupo também — seção vazia no console é ruído.

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npx vitest run src/test/unit/featureCatalog.test.ts src/test/components/admin`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/services/admin/featureCatalog.ts src/test
git commit -m "chore(admin): tira as chaves de gestao do catalogo de features"
```

---

### Task 3: Migration — as 11 RPCs sem o guard de feature

**Files:**
- Create: `supabase/migrations/<timestamp>_gestor_remove_guard_feature_acesso_por_papel.sql`
- Create: `src/test/unit/gestorMigrationsAcessoPorPapel.test.ts`

**Interfaces:**
- Consumes: nada das tasks anteriores.
- Produces: as 11 funções `get_gestor_*` sem nenhuma referência a `gestao.enabled`.

- [ ] **Step 1: Montar a migration por fatiamento, nunca por transcrição**

Escreva um script (Node ou Python, em scratchpad, fora do repo) que:
1. leia `supabase/migrations/20260807021546_a19e4160-6f1c-4f0d-9cc8-f9743ff340dc.sql` e `supabase/migrations/20260807022207_de63e0ae-b9a7-4108-9c1f-81734944dace.sql`;
2. fatie cada `CREATE OR REPLACE FUNCTION public.<nome>` até o `$function$;` que a fecha;
3. remova de cada corpo **apenas** o bloco de guard de feature — o comentário que o introduz mais o `IF NOT public.user_has_feature_for_ies('gestao.enabled', v_ies) THEN ... END IF;` (e, em `get_gestor_contexto`, a variante `user_has_feature('gestao.enabled')`);
4. concatene as 11 num arquivo novo.

Depois, um segundo script que pegue o arquivo gerado, **reinsira** o bloco removido e compare caractere a caractere com a fonte. Só siga se as 11 derem match exato.

- [ ] **Step 2: Cabeçalho da migration**

Em português sem acento, padrão do diretório. Precisa dizer:
- que o acesso ao portal passou a depender só de papel e escopo de IES (spec de 07/08);
- que `gestao.enabled` sai por decisão de produto, e que isso **remove a capacidade de desligar o portal de uma IES por via técnica**;
- que os três blocos restantes do preâmbulo (papel, resolução de `v_ies`, `gestor_pode_acessar_ies`) continuam e nessa ordem;
- que quem recriar qualquer uma das 11 precisa preservar esses três blocos;
- que **NAO FOI APLICADA em producao** (07/08/2026).

- [ ] **Step 3: Escrever o guard estático em `src/test/unit/gestorMigrationsAcessoPorPapel.test.ts`**

Leia `src/test/unit/gestorMigrationsRestauraGuardGestaoEnabled.test.ts` antes — ele já tem o método de provar ordem por comparação de índices, e você vai reaproveitá-lo invertido.

```ts
const RPCS_COM_IES = [
  'get_gestor_cronograma', 'get_gestor_avisos', 'get_gestor_visao_geral',
  'get_gestor_diagnostico', 'get_gestor_diagnostico_temas', 'get_gestor_alunos',
  'get_gestor_aluno', 'get_gestor_detalhamento', 'get_gestor_questoes',
];

it('nenhuma das 11 checa gestao.enabled', () => {
  expect(sql).not.toMatch(/gestao\.enabled/);
});

it('nenhuma das 11 chama user_has_feature_for_ies', () => {
  expect(sql).not.toMatch(/user_has_feature_for_ies\s*\(/);
});

it('user_has_feature NAO e recriada (19 RPCs legadas dependem dela)', () => {
  expect(sql).not.toMatch(/CREATE OR REPLACE FUNCTION public\.user_has_feature\b/);
});

it.each(RPCS_COM_IES)(
  '%s mantem papel -> resolucao de v_ies -> gestor_pode_acessar_ies, nessa ordem',
  (nome) => {
    const corpo = corpoDaFuncao(sql, nome);
    const idxPapel = corpo.indexOf("has_role(v_uid,'admin'::app_role)");
    const idxResolucao = corpo.indexOf('IES not resolved');
    const idxEscopo = corpo.indexOf('gestor_pode_acessar_ies(v_ies)');
    expect(idxPapel).toBeGreaterThan(-1);
    expect(idxResolucao).toBeGreaterThan(idxPapel);
    expect(idxEscopo).toBeGreaterThan(idxResolucao);
  },
);
```

`get_gestor_contexto` e `get_gestor_aluno_contato` ficam fora do `it.each` — não recebem `p_ies_id`. Escreva asserções próprias: `contexto` mantém só o bloco de papel; `aluno_contato` mantém papel e `aluno_nao_encontrado`.

- [ ] **Step 4: Rodar**

Run: `npx vitest run src/test/unit/gestorMigrationsAcessoPorPapel.test.ts`
Expected: PASS

- [ ] **Step 5: Rodar a suíte de unit inteira**

Run: `npx vitest run src/test/unit`
Expected: os testes que afirmavam a **presença** do guard de `gestao.enabled` vão falhar — `gestorMigrationsRestauraGuardGestaoEnabled.test.ts` e as asserções correspondentes em `gestorMigrationsAvisosAlunoContatoContexto.test.ts`.

Isso é esperado: eles provavam o estado anterior. Delete `gestorMigrationsRestauraGuardGestaoEnabled.test.ts` inteiro (o arquivo existe só para aquele guard) e atualize as asserções do outro para afirmar a **ausência**. **Preserve, movendo para o docblock do teste novo, o conhecimento que morava lá:** por que um guard some em silêncio quando se recria uma RPC, e por que a ordem dos blocos importa.

- [ ] **Step 6: Rodar de novo e commitar**

Run: `npx vitest run src/test/unit && npm run type-check`

```bash
git add supabase/migrations src/test/unit
git commit -m "feat(gestor): 11 RPCs deixam de exigir gestao.enabled; papel e escopo de IES bastam"
```

---

### Task 4: Migration — apagar as chaves e a helper órfã

**Files:**
- Create: `supabase/migrations/<timestamp>_gestor_apaga_chaves_de_feature.sql`
- Test: acrescentar ao `src/test/unit/gestorMigrationsAcessoPorPapel.test.ts` da Task 3

**Interfaces:**
- Consumes: a Task 3 precisa vir antes — dropar `user_has_feature_for_ies` com as RPCs ainda chamando-a quebraria as 11.
- Consumes: **um pré-requisito de front, descrito abaixo.** Escrever e commitar a migration é seguro a qualquer momento; **aplicá-la em produção não é.**

> ⚠️ **Não aplique esta migration antes de ler.** A premissa do spec de que
> `gestao.exportar` e `gestao.ia` são dado morto valia para o estado **pós-#17**,
> não para a `main` de hoje. Em `src/experiences/gestor/GestorLayout.tsx:51-52` as
> duas chaves eram lidas via `useEffectiveFeatures` e controlavam os botões
> **Exportar** e **IA** do header do `/gestor` e os drawers correspondentes.
> Como `hasFeature` devolve `false` para chave inexistente, o `DELETE` faria os
> dois botões sumirem em silêncio para todo gestor.
>
> Isso foi corrigido em **07/08** pelo commit `fix(gestor): Exportar e IA deixam de
> depender de ies_features`, que remove o gate e trava o comportamento em
> `src/test/unit/gestorExportarIaSemFeature.test.tsx`. **Aplique esta migration
> somente depois** que esse commit estiver na `main` **e deployado** — ou depois que
> o **PR #17** estiver mergeado e deployado, já que ele apaga `src/experiences/gestor/`
> inteiro e o portal novo (`src/features/gestor/`) não referencia nenhuma das duas chaves.
>
> Checagem antes de aplicar — lista quem ainda **consome** chave `gestao.*`.
> Nenhuma das 3 chaves apagadas aqui pode aparecer no resultado:
> ```bash
> git grep -nE "hasFeature\(\s*['\"]gestao\." -- src/
> ```
> Grepar por `gestao.exportar` direto dá falso positivo — pega comentário e o
> próprio teste de regressão. É o `hasFeature(` que denuncia consumo real.
>
> **Atenção ao escopo da Task 3/front:** `pr1/front` conserta o consumidor de
> `gestao.enabled` (`useAccessRules.ts` passa a usar `hasExperience`), mas **não
> toca `GestorLayout.tsx`** — os dois consumidores de `gestao.exportar`/`gestao.ia`
> sobrevivem a `pr1/front`. Quem cobre esse buraco é o commit citado acima; ele
> precisa entrar junto.
>
> Efeito colateral a conferir em produção (projeto **gvqv**, não `lljn` — o MCP
> aponta para o projeto errado): IES com as chaves `false` ou sem linha passam a
> ver os botões. Pelo seed de 09/07 o esperado é zero afetadas, mas confirme:
> ```sql
> SELECT feature_key, enabled, count(*) FROM public.ies_features
>  WHERE feature_key IN ('gestao.exportar','gestao.ia') GROUP BY 1,2 ORDER BY 1,2;
> ```

- [ ] **Step 1: Escrever a migration**

```sql
-- Apaga as 3 chaves de gestao e a helper que ficou orfa.
-- Depende da migration anterior, que tirou o guard das 11 RPCs get_gestor_*.
-- NAO FOI APLICADA em producao (07/08/2026).
--
-- user_has_feature(text) NAO e tocada: 19 RPCs institucionais legadas ainda a
-- usam para chaves aluno.%. O ramo dela que trata gestao.% vira inerte.

DELETE FROM public.ies_features
 WHERE feature_key IN ('gestao.enabled', 'gestao.exportar', 'gestao.ia');

DELETE FROM public.feature_catalog
 WHERE key IN ('gestao.enabled', 'gestao.exportar', 'gestao.ia');

DROP FUNCTION IF EXISTS public.user_has_feature_for_ies(text, uuid);
```

Confirme o nome da coluna de `feature_catalog` (`key` ou `feature_key`) lendo `supabase/migrations/20260709154234_1472e1b3-9f1d-4448-9027-eb94c980abc7.sql` antes de escrever. Errar aqui é um `DELETE` que não apaga nada e passa despercebido.

- [ ] **Step 2: Teste**

```ts
it('a migration de limpeza nao dropa user_has_feature', () => {
  expect(sqlLimpeza).not.toMatch(/DROP FUNCTION[^;]*user_has_feature\s*\(/);
});

it('dropa a helper orfa user_has_feature_for_ies', () => {
  expect(sqlLimpeza).toMatch(/DROP FUNCTION IF EXISTS public\.user_has_feature_for_ies\(text, uuid\)/);
});
```

A primeira asserção é a que importa: `user_has_feature_for_ies` e `user_has_feature` compartilham prefixo, e um regex descuidado pega as duas.

- [ ] **Step 3: Rodar e commitar**

Run: `npx vitest run src/test/unit`

```bash
git add supabase/migrations src/test/unit
git commit -m "chore(gestor): apaga as 3 chaves de gestao e a helper orfa"
```

---

### Task 5: Migration — funções de papel param de aceitar UUID alheio

**Files:**
- Create: `supabase/migrations/<timestamp>_hardening_funcoes_de_papel.sql`
- Create: `src/test/unit/hardeningFuncoesDePapel.test.ts`

**Interfaces:**
- Consumes: nada. Independente das tasks 1-4.
- Produces: `get_user_roles` e `get_accessible_ies` recusam UUID que não seja do chamador, salvo admin ou `service_role`.

**Decisão de escopo, já tomada — não reabra:** `has_role(uuid, app_role)` **não** é endurecida. Ela é chamada por dezenas de RLS policies, a cada linha avaliada; um `EXISTS` extra dentro dela custa em toda leitura do app, e a checagem de admin naturalmente chamaria `has_role`, criando recursão. O que ela vaza é um booleano por UUID conhecido. Registre isso no cabeçalho da migration como dívida consciente.

- [ ] **Step 1: Entender por que o ramo de `service_role` existe**

A edge function `supabase/functions/auth-login/index.ts:183-224` chama `get_user_roles` e `get_accessible_ies` com o client `service_role`, **antes de existir sessão** — `auth.uid()` é nulo ali. Uma checagem ingênua de "só o próprio UUID" quebra o login de todos os usuários.

O ramo é seguro porque `anon` não tem EXECUTE nessas funções (verificado em produção em 07/08: `has_function_privilege('anon', ...) = false`), então só `service_role` alcança o caminho de `auth.uid()` nulo.

- [ ] **Step 2: Escrever a migration**

```sql
-- Hardening: get_user_roles e get_accessible_ies aceitavam UUID de qualquer
-- usuario, sem conferir se era o do chamador. Qualquer autenticado -- inclusive
-- aluno -- podia enumerar papel e escopo de IES de outra conta.
--
-- Confirmado em producao 07/08/2026: anon NAO tem EXECUTE nas duas
-- (has_function_privilege('anon', ...) = false); o ACL esta em authenticated e
-- service_role. Nao era exposicao publica, era divulgacao entre autenticados.
--
-- Por que nao REVOKE: as RLS policies chamam essas funcoes; revogar de
-- authenticated derrubaria as policies. A checagem vai para dentro.
--
-- Por que o ramo de service_role: a edge auth-login chama as duas antes de
-- existir sessao, com auth.uid() nulo. Sem esse ramo, o login quebra.
--
-- DIVIDA CONSCIENTE: has_role(uuid, app_role) NAO e endurecida. E chamada por
-- dezenas de RLS policies a cada linha; um EXISTS extra custaria em toda
-- leitura do app, e checar admin dentro dela criaria recursao. Vaza um booleano
-- por UUID ja conhecido.
--
-- NAO FOI APLICADA em producao (07/08/2026).

CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id uuid)
RETURNS SETOF public.app_role
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF current_user <> 'service_role'
     AND _user_id IS DISTINCT FROM auth.uid()
     AND NOT EXISTS (
       SELECT 1 FROM public.user_roles r
        WHERE r.user_id = auth.uid() AND r.role = 'admin'::public.app_role
     )
  THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY SELECT role FROM public.user_roles WHERE user_id = _user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_user_roles(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_user_roles(uuid) TO authenticated, service_role;
```

A checagem de admin é inline (`EXISTS` sobre `user_roles`), **não** `has_role` — evita recursão.

Para `get_accessible_ies(uuid)`: leia o corpo real em `supabase/migrations/20260525145930_eabe4239-9c96-4bca-a9ca-5a1e6de67157.sql:39-51`, preserve a lógica exata de UNION, e envolva no mesmo preâmbulo. Ela é `LANGUAGE sql` hoje e vira `plpgsql` — mantenha `STABLE SECURITY DEFINER` e `search_path = public, pg_temp` (aplicado por `20260526010000_impersonation_rpcs_security_definer.sql`).

- [ ] **Step 3: Teste estático**

```ts
it('get_user_roles recusa UUID de terceiro', () => {
  const corpo = corpoDaFuncao(sql, 'get_user_roles');
  expect(corpo).toMatch(/_user_id IS DISTINCT FROM auth\.uid\(\)/);
  expect(corpo).toMatch(/RAISE EXCEPTION 'Access denied'/);
});

it('a checagem de admin e inline, nao via has_role (evita recursao)', () => {
  const corpo = corpoDaFuncao(sql, 'get_user_roles');
  expect(corpo).toMatch(/FROM public\.user_roles r/);
  expect(corpo).not.toMatch(/has_role\s*\(/);
});

it('preserva o ramo de service_role, senao o login quebra', () => {
  expect(corpoDaFuncao(sql, 'get_user_roles')).toMatch(/current_user <> 'service_role'/);
  expect(corpoDaFuncao(sql, 'get_accessible_ies')).toMatch(/current_user <> 'service_role'/);
});

it('has_role NAO e recriada (decisao registrada)', () => {
  expect(sql).not.toMatch(/CREATE OR REPLACE FUNCTION public\.has_role\b/);
});
```

- [ ] **Step 4: Rodar e commitar**

Run: `npx vitest run src/test/unit && npm run type-check`

```bash
git add supabase/migrations src/test/unit
git commit -m "fix(seg): get_user_roles e get_accessible_ies param de aceitar UUID alheio"
```

**Nota para quem for aplicar em produção:** esta é a única migration do PR 1 que pode quebrar o login se estiver errada. Depois de aplicar, faça um login real de teste antes de considerar concluída.

---

### Task 6: Migration — `announcements` filtra por persona na RLS

**Files:**
- Create: `supabase/migrations/<timestamp>_announcements_rls_publico_alvo.sql`
- Create: acrescentar ao `src/test/unit/hardeningFuncoesDePapel.test.ts`

**Interfaces:**
- Consumes: nada.

- [ ] **Step 1: Ler a policy vigente**

Ela está em `supabase/migrations/20251031015858_4c9e2a85-5a21-4b13-8e3a-a55e5fb7e9bf.sql:32-44`, e a coluna `publico_alvo` foi acrescentada depois, em `supabase/migrations/20260726110000_announcements_publico_alvo.sql:15-58`. Leia as duas antes de escrever — em especial o tipo e o default de `publico_alvo`, e como `get_gestor_avisos` a filtra hoje (`20260807021546_*.sql:366`).

O `USING` atual, confirmado em produção em 07/08:

```
((ativo = true) AND ((data_expiracao IS NULL) OR (data_expiracao > now()))
 AND ((visibilidade = 'todas') OR ((visibilidade = 'seletivo') AND (get_current_user_ies_id() = ANY (ies_selecionadas)))
      OR ((visibilidade = 'exceto') AND (NOT (get_current_user_ies_id() = ANY (ies_excluidas))))))
```

- [ ] **Step 2: Escrever a migration**

Recriar a policy preservando o `USING` inteiro e acrescentando o filtro de persona. A persona do leitor tem de vir do papel dele, não de parâmetro. Decida entre:

- `'aluno' = ANY(publico_alvo)` para quem não tem papel de gestor, e `'gestor' = ANY(publico_alvo)` para quem tem; ou
- um `EXISTS` que case qualquer persona a que o usuário pertença.

**Se `publico_alvo` puder ser nulo ou vazio em linhas antigas**, decida explicitamente o que acontece com elas — negar todas as legadas de uma vez é regressão visível para o aluno. Verifique quantas linhas estão nesse estado antes de escolher, e registre a contagem no relatório. Se não conseguir verificar (não temos acesso de leitura ao banco a partir daqui), **pare e reporte** em vez de adivinhar.

- [ ] **Step 3: Teste estático**

```ts
it('a policy de announcements filtra por publico_alvo', () => {
  expect(sqlAnnouncements).toMatch(/publico_alvo/);
});

it('preserva os filtros que ja existiam', () => {
  expect(sqlAnnouncements).toMatch(/ativo/);
  expect(sqlAnnouncements).toMatch(/data_expiracao/);
  expect(sqlAnnouncements).toMatch(/visibilidade/);
});
```

O segundo teste é o que impede a regressão real: recriar policy é onde se perde condição sem perceber.

- [ ] **Step 4: Rodar e commitar**

Run: `npx vitest run src/test/unit && npm run type-check`

```bash
git add supabase/migrations src/test/unit
git commit -m "fix(seg): RLS de announcements passa a filtrar por publico_alvo"
```

---

### Task 7: Fechamento

- [ ] **Step 1: Suíte inteira**

Run: `npx vitest run && npm run type-check`
Expected: verde nos dois. Registre a contagem.

- [ ] **Step 2: Conferir que nada de `gestao.` sobrou no código de acesso**

Run: `grep -rn "gestao\.enabled\|gestao\.exportar\|gestao\.ia" src/ supabase/migrations/ --include=*.ts --include=*.tsx --include=*.sql | grep -v "^supabase/migrations/2026080[0-6]"`

Expected: só as migrations novas (nos comentários de cabeçalho) e nenhum código executável.

- [ ] **Step 3: Abrir o PR**

Corpo do PR precisa dizer, em destaque:
- que as migrations **não foram aplicadas** e a ordem correta é **banco antes do front**;
- que o CX (`atendimento`) perde acesso ao portal;
- que a Sanar perde a capacidade de desligar o portal de uma IES por via técnica;
- que `has_role` ficou de fora do hardening, e por quê.
