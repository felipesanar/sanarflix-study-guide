# Corrigir filtro de semestre no drill-down de "Acerto por grande área"

## Diagnóstico (verificado)

A RPC que alimenta o drawer de especialidades/temas, `public.get_gestor_detalhamento_temas`, tem hoje a assinatura `(p_ies_id uuid, p_simulados uuid[], p_grande_area text, p_especialidade text)` — **não existe parâmetro de semestre** (migration `20260809233000_get_gestor_detalhamento_temas.sql`, CTE `alunos` filtra apenas por `id_ies` e ausência de role).

No cliente, `src/features/gestor/routes/Detalhamento.tsx` monta `DrawerTemasDetalhamento` passando somente `iesId` + `simuladosNoRecorte`, e o hook `useDetalhamentoTemas` (`src/features/gestor/api/queries.ts`) documenta explicitamente que "semestre nunca chega à RPC".

Ou seja: o recorte por semestre do card ("Acerto por grande área" recalculado no cliente a partir da `matriz`, em `AcertoPorAreaESemestre.tsx`) e o filtro global de semestre não atravessam para o drawer. Por isso especialidade e tema mostram sempre o número do recorte cheio.

## O que vai ser feito

### 1. Banco (migration aditiva)

Recriar `public.get_gestor_detalhamento_temas` com um parâmetro novo no fim, `p_semestre text DEFAULT NULL`, mantendo a assinatura antiga funcionando (default = comportamento atual):

- Parse do semestre igual às RPCs irmãs (`get_gestor_detalhamento`): `NULL`/`geral` → todos; `6ano` → todos, com evidência em 11/12; `1`..`12` → aquele semestre; qualquer outro valor → `semestre_invalido`.
- Aplicar `AND (v_sems IS NULL OR u.semestre = ANY (v_sems))` na CTE `alunos`, exatamente como em `get_gestor_detalhamento`.
- Preservar guards, `SECURITY DEFINER`, `SET search_path`, checagem de escopo de simulados e as ACLs atuais (`REVOKE` de `PUBLIC`/`anon`, `GRANT EXECUTE` para `authenticated` e `service_role`).
- Nada mais da função muda: agregação, classificação crítico/mediano/excelente, `amostra`, `respostas`, `lowSample`, `temFilhos` seguem idênticos.

### 2. Cliente

- `useDetalhamentoTemas`: aceitar `semestre` e enviá-lo como `p_semestre`, incluindo o valor na `queryKey` (para o drawer refazer a busca quando o semestre mudar).
- `DrawerTemasDetalhamento`: nova prop `semestre`, repassada ao hook, e um rótulo do recorte vigente no cabeçalho do drawer (ex.: "7º semestre" / "6º ano" / "todos os semestres"), para o gestor ver de qual corte o número vem.
- `Detalhamento.tsx`: calcular o semestre efetivo do drill-down — se o recorte cruzado ativo for do tipo `semestre`, usa esse; senão usa o filtro global da tela — e passar ao drawer. Manter a limpeza existente do drill-down quando IES/simulados mudam.

### 3. Testes

Atualizar/estender `DrawerTemasDetalhamento.test.tsx` e `Detalhamento.test.tsx` para cobrir: `p_semestre` enviado conforme o recorte clicado, troca de semestre disparando nova busca, e o caso sem recorte (semestre global).

## Observação de consistência

Com o filtro global em `6ano`, o card de grande área hoje não corta os dados (só marca 11º/12º em evidência). O drawer vai seguir a mesma régua, para os dois números continuarem batendo. O corte duro por um semestre específico acontece quando o gestor clica na coluna do semestre ou escolhe um semestre no filtro global.
