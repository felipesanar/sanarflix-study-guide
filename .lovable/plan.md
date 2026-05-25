# Perfil Gestor de Grupo (Multi-IES) — Plano de Implementação

## Objetivo
Adicionar um terceiro nível de acesso institucional — **Gestor de Grupo** — capaz de visualizar dashboards, simulados, TRI e respostas de um conjunto arbitrário de IES vinculadas a um Grupo Educacional, sem alterar Admin nem Gestor individual. Arquitetura escalável (sem hardcode): a relação Stela ↔ UNIATENAS ↔ 6 IES é apenas seed inicial.

## Diagnóstico da arquitetura atual (Fase 1)

**IES é resolvida hoje 1:1 user→IES:**
- `public.users.id_ies uuid` é a fonte única.
- `public.get_current_user_ies_id()` retorna `users.id_ies` do `auth.uid()`.
- RLS institucional (`simulados_admin`, `questoes_simulado`, `answer_progress`, `resultados_ies_tri`, `resultados_alunos_tri`, `conteudos`, `sanarclass_lessons`, `announcements`) compara `get_current_user_ies_id()` contra `ies_id` único ou `= ANY(ies_ids)`.
- RPCs institucionais (`get_institutional_performance`, `get_institutional_student_scores`, `get_institutional_evolution`, `get_institutional_*_tri`, `get_student_growth_tri`) recebem **um `p_ies_id`** e validam `has_role('gestor')` + `users.id_ies = p_ies_id`.
- Frontend: `AuthContext.user.id_ies` (singular), `useIesFeatures(user.id_ies)`, `useDesempenhoV2State.filters.iesId` (string única no querystring).

**Pontos de quebra para multi-IES:** RLS, validação das RPCs, `useIesFeatures`, ausência de seletor de IES no header e ausência de conceito de "Visão Consolidada".

## Modelagem de dados (Fase 2) — totalmente aditiva

```text
educational_groups
  id uuid pk, name text, slug text unique, created_at

group_ies                        -- N:N grupo ↔ IES
  group_id uuid fk, ies_id uuid fk, PK(group_id, ies_id)

user_groups                      -- N:N usuário ↔ grupo
  user_id uuid fk, group_id uuid fk,
  role text default 'gestor_grupo', PK(user_id, group_id)
```

Novo valor em `app_role`: **`gestor_grupo`** (mantém `gestor` e `gestor_formal` intocados).

Funções `SECURITY DEFINER`:

```text
get_user_group_ies(_user uuid) RETURNS uuid[]
user_can_access_ies(_user uuid, _ies uuid) RETURNS bool
  -- admin OR b2b_partner OR _ies = users.id_ies OR _ies ∈ get_user_group_ies(_user)
get_accessible_ies(_user uuid) RETURNS uuid[]   -- união IES própria + IES de grupos
```

**Seed inicial (já com UUIDs confirmados no banco):**

| IES | UUID |
|---|---|
| PARACATU | `d86c32ba-2d09-4c7e-a426-1d981ec7b595` |
| PASSOS | `9baa1401-bf54-4451-b96c-49e4823564fb` |
| PORTO SEGURO | `08cc7497-7ce6-49d8-828e-d6c897716cb7` |
| SETE LAGOAS | `a1f1e8ca-a58e-4f87-abfe-4cc62aa4a686` |
| SORRISO | `6e69a5e4-daab-4322-b70b-cdcf9f3c2cf9` |
| VALENÇA | `ac2f94a5-d33b-4547-94ed-ae4d0877fbc7` |

- `educational_groups`: `('UNIATENAS','uniatenas')`.
- `group_ies`: 6 linhas (uma por IES acima).
- `user_groups`: `(562bbcc3-328c-4434-9eae-0bacc8d40d37, <id_uniatenas>, 'gestor_grupo')`.
- `user_roles`: `(562bbcc3-328c-4434-9eae-0bacc8d40d37, 'gestor_grupo')`.

RLS das novas tabelas: SELECT para admin e para o próprio `user_id`; INSERT/UPDATE/DELETE apenas admin. Toda nova relação grupo↔IES e usuário↔grupo é cadastrável via admin no futuro — nada hardcoded em código.

## Backend / RLS / RPCs (Fase 3)

- Adicionar policies `gestor_grupo` paralelas às de `gestor` em: `simulados_admin`, `questoes_simulado`, `answer_progress`, `resultados_ies_tri`, `resultados_alunos_tri`, `simulados_finalizados` (SELECT), `users` (SELECT alunos da IES), `conteudos`, `sanarclass_lessons`, `announcements` — usando `user_can_access_ies(auth.uid(), <coluna_ies>)` ou `<coluna_ies_ids> && get_accessible_ies(auth.uid())`.
- Atualizar RPCs institucionais para autorizar via `user_can_access_ies(auth.uid(), p_ies_id)` em vez de `users.id_ies = p_ies_id`. Assinatura e payload inalterados — totalmente retrocompatível com Gestor individual e Admin.
- Visão Consolidada do MVP: fan-out client-side reaproveitando as RPCs por IES. RPC server-side `get_group_consolidated_*` fica para iteração seguinte sem mudar contrato de componente.

## Frontend (Fase 4)

1. **Tipos** (`src/types/index.ts`): `User` ganha `accessible_ies?: { id: string; nome: string }[]` e `groups?: { id: string; name: string; ies: { id: string; nome: string }[] }[]`. Mantém `id_ies`/`ies_nome`.
2. **`auth-login` edge function**: após buscar roles, popular `accessible_ies` (união `users.id_ies` + `get_accessible_ies`) e `groups` (via `user_groups` → `group_ies` → `ies`). Logs obrigatórios: `[Auth] User role`, `[Auth] Accessible colleges`, `[Auth] Group context`.
3. **`accessRules.ts`**: novo helper `isGestorGrupo(user)`; `getAccessRules` trata `gestor_grupo` como `gestor` (libera `desempenhoInstitucional`).
4. **Novo hook `useAccessibleIes()`**: retorna lista de IES acessíveis + grupos + flag `isMultiIes`.
5. **`useDesempenhoV2State`**: aceitar valor especial `iesId = '__group__'` (Visão Consolidada) ou UUID de IES. Default = primeira IES; querystring preservada.
6. **Novo `IesSelector`** no header de `DesempenhoInstitucionalV2`: aparece se `accessible_ies.length > 1`; opção "Visão Consolidada do Grupo" primeiro, depois as IES. Para gestor individual e admin, comportamento atual preservado.
7. **`useIesFeatures`**: passa a aceitar a IES atualmente selecionada (fallback ao `user.id_ies`).
8. **Visão Consolidada (MVP)**: quando `iesId === '__group__'`, fan-out das RPCs por IES e agregação client-side (médias ponderadas por `num_students` para TRI/PCP, somas para contagens).

## Segurança

- Isolamento garantido por RLS via `user_can_access_ies` — Gestor de Grupo nunca enxerga IES fora do(s) seu(s) grupo(s); tentativas via querystring retornam vazio.
- `gestor_grupo` **não** ganha permissão administrativa (sem `UserManagement`, sem tabelas `admin_*`).
- Nenhuma lista fixa em código; tudo via tabelas.

## Fase 5 — Validação

- Admin: nada muda (policies admin permanecem prioritárias).
- Gestor individual: queries continuam restritas à própria IES.
- Stela: seletor lista 6 IES + Consolidada; trocar IES recarrega dashboard; `?iesId=<IES_fora_grupo>` → vazio.
- Console: três `[Auth] …` no login.
- `tsc --noEmit` limpo após regeneração de `types.ts`.

## Entregáveis (na ordem)

1. **Migration 1** — tabelas `educational_groups`, `group_ies`, `user_groups`; enum `gestor_grupo`; funções `get_user_group_ies` / `user_can_access_ies` / `get_accessible_ies`; RLS das novas tabelas.
2. **Migration 2** — policies `gestor_grupo` nas tabelas institucionais + refator das RPCs para usarem `user_can_access_ies`.
3. **Migration 3 (seed)** — UNIATENAS + 6 vínculos `group_ies` + `user_groups`/`user_roles` da Stela (com os UUIDs acima).
4. **Edge `auth-login`** — devolve `accessible_ies` e `groups`.
5. **Frontend** — `types/index.ts`, `accessRules.ts`, `useAccessibleIes`, `IesSelector`, ajustes em `useDesempenhoV2State`, `useIesFeatures` e `DesempenhoInstitucionalV2` (header + fan-out consolidado).
6. **QA** conforme critérios de sucesso do briefing.

## Pontos abertos para confirmar antes de "Implementar"

1. **Nome do role**: `gestor_grupo` está ok, ou prefere outro (`group_manager`, `gestor_de_grupo`)?
2. **Visão Consolidada do MVP**: aceitamos agregação client-side (fan-out) agora e RPC server-side numa iteração futura, ou já querem o RPC consolidado na primeira leva (atrasa ~1 ciclo)?
